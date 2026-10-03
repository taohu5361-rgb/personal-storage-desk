//! Free text owned by a category's outer canvas. Asset text stays independent.
use crate::inner_canvas_text::{CanvasTextBlock, validate_block, list_fonts};
use rusqlite::{Connection, params, OptionalExtension};
use serde::{Serialize, Deserialize};
use std::collections::HashSet;
type Result<T> = std::result::Result<T, String>;
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTextBlock {
    pub id: String,
    pub category_id: String,
    pub style_type: String,
    pub title: String,
    pub content: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub z_index: i64,
    pub locked: bool,
    pub group_id: Option<String>,
    #[serde(default)]
    pub rotation: f64,
    pub font_family: String,
    pub font_size: u32,
    pub font_weight: u32,
    pub text_color: String,
    pub text_align: String,
    pub line_height: f64,
    pub border_enabled: bool,
    pub border_color: String,
    pub border_width: f64,
    pub border_radius: f64,
    pub background_color: String,
    pub background_opacity: f64,
    pub shadow: bool,
    pub created_at: i64,
    pub updated_at: i64,
}
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTextChanges {
    #[serde(default)] pub upserts: Vec<CategoryTextBlock>,
    #[serde(default)] pub delete_ids: Vec<String>,
}
pub fn migrate(c: &Connection) -> Result<()> {
    c.execute_batch(include_str!("../migrations/20261002_category_text.sql")).map_err(|e|e.to_string())
}
pub fn list(c: &Connection) -> Result<Vec<CategoryTextBlock>> {
    let mut s=c.prepare("SELECT payload FROM category_text_blocks ORDER BY category_id,created_at,id").map_err(|e|e.to_string())?;
    let values=s.query_map([],|r|r.get::<_,String>(0)).map_err(|e|e.to_string())?.collect::<rusqlite::Result<Vec<_>>>().map_err(|e|e.to_string())?;
    values.iter().map(|v|serde_json::from_str(v).map_err(|e|e.to_string())).collect()
}
fn owner(c: &Connection,id: &str) -> Result<Option<String>> {
    c.query_row("SELECT category_id FROM category_text_blocks WHERE id=?1",[id],|r|r.get(0)).optional().map_err(|e|e.to_string())
}
fn validate(item: CategoryTextBlock,category_id: &str,fonts: &HashSet<String>) -> Result<CategoryTextBlock> {
    let rotation=item.rotation;
    if !rotation.is_finite(){return Err("旋转角度无效".into());}
    if item.category_id != category_id {return Err("文字属于其他分类".into());}
    // Adapt ownership solely at the legacy style validator boundary.
    let mut value=serde_json::to_value(&item).map_err(|e|e.to_string())?;
    value["assetId"]=category_id.into();value["canvasId"]=category_id.into();
    let mut block: CanvasTextBlock=serde_json::from_value(value).map_err(|e|e.to_string())?;
    validate_block(&mut block,category_id,fonts)?;
    let mut value=serde_json::to_value(block).map_err(|e|e.to_string())?;
    value["categoryId"]=category_id.into();value["rotation"]=rotation.into();
    serde_json::from_value(value).map_err(|e|e.to_string())
}
pub fn save(c: &mut Connection,category_id: &str,changes: CategoryTextChanges) -> Result<()> {
    let tx=c.transaction().map_err(|e|e.to_string())?;
    write(&tx,category_id,changes)?;
    tx.commit().map_err(|e|e.to_string())
}
pub fn write(tx:&Connection,category_id:&str,changes:CategoryTextChanges)->Result<()> {
    let exists: bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",[category_id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if !exists {return Err("找不到文字所属分类".into());}
    let fonts=list_fonts(&tx)?.into_iter().map(|f|f.family).collect();
    let mut seen=HashSet::new();
    for item in changes.upserts {
        let mut item=validate(item,category_id,&fonts)?;
        if !seen.insert(item.id.clone()) {return Err("文字更新标识重复".into());}
        if owner(&tx,&item.id)?.is_some_and(|o|o!=category_id) {return Err("文字属于其他分类".into());}
        if let Some(created)=tx.query_row("SELECT created_at FROM category_text_blocks WHERE id=?1",[&item.id],|r|r.get::<_,i64>(0)).optional().map_err(|e|e.to_string())? {item.created_at=created;}
        item.updated_at=crate::now();
        let payload=serde_json::to_string(&item).map_err(|e|e.to_string())?;
        tx.execute("INSERT INTO category_text_blocks(id,category_id,created_at,payload) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",params![item.id,category_id,item.created_at,payload]).map_err(|e|e.to_string())?;
    }
    for id in changes.delete_ids {
        if !seen.insert(id.clone()) {return Err("文字删除与更新标识重复".into());}
        if owner(&tx,&id)?.is_some_and(|o|o!=category_id) {return Err("不能删除其他分类的文字".into());}
        tx.execute("DELETE FROM category_text_blocks WHERE id=?1 AND category_id=?2",params![id,category_id]).map_err(|e|e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn setup(c: Connection) -> Connection {
        c.execute_batch("PRAGMA foreign_keys=ON;CREATE TABLE categories(id TEXT PRIMARY KEY);CREATE TABLE assets(id TEXT PRIMARY KEY);CREATE TABLE asset_inner_canvas(asset_id TEXT,object_id TEXT,object_type TEXT,text_value TEXT,x REAL,y REAL,width REAL,height REAL,z_index INTEGER,locked INTEGER,group_id TEXT,font_size INTEGER,bold INTEGER);INSERT INTO categories VALUES('a'),('b');").unwrap();
        crate::inner_canvas_text::migrate(&c).unwrap();migrate(&c).unwrap();c
    }
    fn item(id: &str,category: &str) -> CategoryTextBlock {
        serde_json::from_value(serde_json::json!({"id":id,"categoryId":category,"styleType":"panel","title":"标题","content":"第一行\nChinese 中文","x":-40,"y":90,"width":280,"height":160,"zIndex":5,"locked":false,"groupId":"text-group","fontFamily":"system-ui","fontSize":20,"fontWeight":400,"textColor":"#ffffff","textAlign":"left","lineHeight":1.5,"borderEnabled":true,"borderColor":"#ffffff","borderWidth":1,"borderRadius":8,"backgroundColor":"#000000","backgroundOpacity":80,"shadow":true,"createdAt":1,"updatedAt":1})).unwrap()
    }
    #[test]
    fn category_ownership_and_transaction_rollback() {
        let mut c=setup(Connection::open_in_memory().unwrap());
        save(&mut c,"a",CategoryTextChanges{upserts:vec![item("one","a")],..Default::default()}).unwrap();
        assert!(save(&mut c,"b",CategoryTextChanges{upserts:vec![item("two","b"),item("one","b")],..Default::default()}).is_err());
        assert_eq!(list(&c).unwrap().len(),1);
        assert!(save(&mut c,"b",CategoryTextChanges{delete_ids:vec!["one".into()],..Default::default()}).is_err());
        assert!(save(&mut c,"a",CategoryTextChanges{upserts:vec![item("bad-owner","b")],..Default::default()}).is_err());
        let mut bad=item("bad","a");bad.width=1.;
        assert!(save(&mut c,"a",CategoryTextChanges{upserts:vec![item("two","a"),bad],..Default::default()}).is_err());
        assert_eq!(list(&c).unwrap().len(),1);
        c.execute("DELETE FROM categories WHERE id='a'",[]).unwrap();assert!(list(&c).unwrap().is_empty());
    }
    #[test]
    fn reopen_keeps_layout_styles_and_deletion_stays_deleted() {
        let temp=tempfile::tempdir().unwrap();let path=temp.path().join("test.sqlite3");
        let mut c=setup(Connection::open(&path).unwrap());
        save(&mut c,"a",CategoryTextChanges{upserts:vec![item("one","a")],..Default::default()}).unwrap();drop(c);
        let mut c=Connection::open(&path).unwrap();migrate(&c).unwrap();let b=list(&c).unwrap().remove(0);
        assert_eq!(b.category_id,"a");assert_eq!(b.x,-40.);assert_eq!(b.font_size,20);assert!(b.shadow);assert_eq!(b.group_id.as_deref(),Some("text-group"));assert!(b.content.contains("中文"));
        save(&mut c,"a",CategoryTextChanges{delete_ids:vec!["one".into()],..Default::default()}).unwrap();drop(c);
        let c=Connection::open(&path).unwrap();migrate(&c).unwrap();assert!(list(&c).unwrap().is_empty());
    }
    #[test]
    fn deleting_custom_font_falls_back_category_text() {
        let mut c=setup(Connection::open_in_memory().unwrap());
        c.execute("INSERT INTO custom_fonts VALUES('f','Test','custom-test','test.ttf','ttf',1)",[]).unwrap();
        let mut b=item("one","a");b.font_family="custom-test".into();
        save(&mut c,"a",CategoryTextChanges{upserts:vec![b],..Default::default()}).unwrap();
        crate::inner_canvas_text::delete_font_record(&mut c,"f").unwrap();assert_eq!(list(&c).unwrap()[0].font_family,"system-ui");
    }
}
