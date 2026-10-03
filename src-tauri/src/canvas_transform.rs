//! Additive canvas geometry migration and atomic mixed-object transforms.
use rusqlite::{params,Connection,OptionalExtension};
use serde::Deserialize;
type Result<T> = std::result::Result<T,String>;
pub fn migrate(c:&Connection)->Result<()> {
    c.execute_batch("CREATE TABLE IF NOT EXISTS canvas_transform_migrations(version TEXT PRIMARY KEY)").map_err(|e|e.to_string())?;
    let done:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM canvas_transform_migrations WHERE version='20261003_rotation')",[],|r|r.get(0)).map_err(|e|e.to_string())?;
    if done{return Ok(());}
    if let Some(path)=c.path().filter(|p|!p.is_empty()&&*p!=":memory:") {
        c.execute("VACUUM INTO ?1",[format!("{}.before-canvas-transform-{}.sqlite3",path,crate::now())]).map_err(|e|format!("画布布局迁移备份失败：{e}"))?;
    }
    let tx=rusqlite::Transaction::new_unchecked(c,rusqlite::TransactionBehavior::Immediate).map_err(|e|e.to_string())?;
    for table in ["canvas_layout","asset_inner_canvas","asset_text_layouts"] {
        let sql=format!("PRAGMA table_info({table})");
        let columns= {let mut s=tx.prepare(&sql).map_err(|e|e.to_string())?;let rows=s.query_map([],|r|r.get::<_,String>(1)).map_err(|e|e.to_string())?;rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e|e.to_string())?};
        if !columns.is_empty()&&!columns.iter().any(|n|n=="rotation") {tx.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN rotation REAL NOT NULL DEFAULT 0")).map_err(|e|e.to_string())?;}
    }
    tx.execute("INSERT OR IGNORE INTO canvas_transform_migrations VALUES('20261003_rotation')",[]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e|e.to_string())
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct GeometryPatch {
    pub id:String,pub x:f64,pub y:f64,pub width:f64,pub height:f64,
    #[serde(default)] pub rotation:f64,
}
pub fn validate(p:&GeometryPatch)->Result<()> {
    if p.id.trim().is_empty() || ![p.x,p.y,p.width,p.height,p.rotation].iter().all(|v|v.is_finite()) || p.width<1.0 || p.height<1.0 || p.width>100000.0 || p.height>100000.0 {return Err("画布变换数值无效".into());} Ok(())
}
pub fn save(c:&mut Connection,category_id:&str,assets:Vec<GeometryPatch>,texts:Vec<GeometryPatch>,groups:Vec<GeometryPatch>, text_changes:Option<crate::category_text::CategoryTextChanges>)->Result<()> {
    let tx=c.transaction().map_err(|e|e.to_string())?;
    for p in assets {
        validate(&p)?;
        let found:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM assets WHERE id=?1 AND category_id=?2)",params![p.id,category_id],|r|r.get(0)).map_err(|e|e.to_string())?;
        if !found{return Err("资产不能跨画布变换".into());}
        tx.execute("INSERT INTO canvas_layout(asset_id,category_id,x,y,width,height,z_index,locked,rotation) VALUES(?1,?2,?3,?4,?5,?6,1,0,?7) ON CONFLICT(asset_id) DO UPDATE SET x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,rotation=excluded.rotation",params![p.id,category_id,p.x,p.y,p.width,p.height,p.rotation]).map_err(|e|e.to_string())?;
    }
    if let Some(changes)=text_changes {crate::category_text::write(&tx,category_id,changes)?;}
    for p in texts {
        validate(&p)?;
        let json:Option<String>=tx.query_row("SELECT payload FROM category_text_blocks WHERE id=?1 AND category_id=?2",params![p.id,category_id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
        let mut value:serde_json::Value=serde_json::from_str(&json.ok_or("文字不能跨画布变换")?).map_err(|e|e.to_string())?;
        // Patch layout only, preserving the most recently saved content and style.
        for (key,n) in [("x",p.x),("y",p.y),("width",p.width),("height",p.height),("rotation",p.rotation)]{value[key]=serde_json::json!(n);}
        tx.execute("UPDATE category_text_blocks SET payload=?1 WHERE id=?2 AND category_id=?3",params![value.to_string(),p.id,category_id]).map_err(|e|e.to_string())?;
    }
    for p in groups {
        validate(&p)?;
        if tx.execute("UPDATE canvas_groups SET x=?1,y=?2,width=?3,height=?4,updated_at=?5 WHERE id=?6 AND category_id=?7",params![p.x,p.y,p.width,p.height,crate::now(),p.id,category_id]).map_err(|e|e.to_string())?!=1{return Err("分组不能跨画布变换".into());}
    }
    tx.commit().map_err(|e|e.to_string())
}
#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn migration_preserves_positions_and_mixed_transaction_rolls_back() {
  let mut c=Connection::open_in_memory().unwrap();
  c.execute_batch("CREATE TABLE assets(id TEXT PRIMARY KEY,category_id TEXT);INSERT INTO assets VALUES('a','c');CREATE TABLE canvas_layout(asset_id TEXT PRIMARY KEY,category_id TEXT,x REAL,y REAL,width REAL,height REAL,z_index INTEGER,locked INTEGER);INSERT INTO canvas_layout VALUES('a','c',7,8,100,90,1,0);CREATE TABLE category_text_blocks(id TEXT PRIMARY KEY,category_id TEXT,payload TEXT);INSERT INTO category_text_blocks VALUES('t','c','{\"content\":\"keep\",\"x\":1,\"y\":2}');CREATE TABLE canvas_groups(id TEXT,category_id TEXT,x REAL,y REAL,width REAL,height REAL,updated_at INTEGER);").unwrap();
  migrate(&c).unwrap();migrate(&c).unwrap();assert_eq!(c.query_row("SELECT x,y,rotation FROM canvas_layout",[],|r|Ok((r.get::<_,f64>(0)?,r.get::<_,f64>(1)?,r.get::<_,f64>(2)?))).unwrap(),(7.,8.,0.));
  let p=|id:&str|GeometryPatch{id:id.into(),x:20.,y:30.,width:100.,height:90.,rotation:45.};
  assert!(save(&mut c,"c",vec![p("a")],vec![p("missing")],vec![],None).is_err());assert_eq!(c.query_row("SELECT x FROM canvas_layout",[],|r|r.get::<_,f64>(0)).unwrap(),7.);
  save(&mut c,"c",vec![p("a")],vec![p("t")],vec![],None).unwrap();
  let json:String=c.query_row("SELECT payload FROM category_text_blocks",[],|r|r.get(0)).unwrap();let v:serde_json::Value=serde_json::from_str(&json).unwrap();assert_eq!(v["content"],"keep");assert_eq!(v["rotation"],45.);
 }
}
