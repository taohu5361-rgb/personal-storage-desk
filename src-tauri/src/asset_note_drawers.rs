use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::AppHandle;

type AppResult<T> = std::result::Result<T, String>;

const MIGRATION: &str = include_str!("../migrations/20260925_asset_note_drawers.sql");
const MODE_MIGRATION: &str = include_str!("../migrations/20261002_asset_note_drawer_modes.sql");

fn default_text_scale() -> f64 { 1.0 }

fn default_mode() -> String { "docked-expanded".into() }

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetNoteDrawer {
    pub id: String,
    pub asset_id: Option<String>,
    #[serde(default)]
    pub category_id: String,
    pub text: String,
    #[serde(default = "default_text_scale")]
    pub text_scale: f64,
    pub side: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub floating_x: f64,
    #[serde(default)]
    pub floating_y: f64,
    pub offset: f64,
    pub width: f64,
    pub height: f64,
    pub order_index: i64,
    pub locked: bool,
    pub style_variant: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub(crate) fn migrate(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(MIGRATION).map_err(|error| error.to_string())?;
    let existing: HashSet<String> = connection.prepare("PRAGMA table_info(asset_note_drawers)")
        .and_then(|mut statement| statement.query_map([], |row| row.get::<_, String>(1))?.collect())
        .map_err(|error| error.to_string())?;
    if !existing.contains("category_id") {
        let count: i64=connection.query_row("SELECT COUNT(*) FROM asset_note_drawers",[],|r|r.get(0)).map_err(|e|e.to_string())?;
        if count>0 {
            if let Some(path)=connection.path().filter(|p|!p.is_empty()) {
                let stamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos();
                connection.execute("VACUUM INTO ?1",[format!("{path}.before-note-attachment-{stamp}.sqlite3")]).map_err(|e|format!("备注归属迁移备份失败，原数据已保留：{e}"))?;
            }
        }
    }
    let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
    for (column, sql) in ["mode", "floating_x", "floating_y"].iter().zip(MODE_MIGRATION.split(';').filter(|sql| !sql.trim().is_empty())) {
        if !existing.contains(*column) {
            transaction.execute_batch(sql).map_err(|error| error.to_string())?;
        }
    }
    if !existing.contains("text_scale") {
        transaction.execute_batch("ALTER TABLE asset_note_drawers ADD COLUMN text_scale REAL NOT NULL DEFAULT 1.0;").map_err(|error| error.to_string())?;
    }
    let schema: String = transaction.query_row("SELECT sql FROM sqlite_master WHERE type='table' AND name='asset_note_drawers'", [], |row| row.get(0)).map_err(|error| error.to_string())?;
    if !schema.contains("width <= 4000") {
        transaction.execute_batch(include_str!("../migrations/20261003_asset_note_drawer_text_scale.sql")).map_err(|error| error.to_string())?;
        transaction.execute_batch(MIGRATION).map_err(|error| error.to_string())?;
    }
    if !existing.contains("category_id") {
        let orphans: i64 = transaction.query_row("SELECT COUNT(*) FROM asset_note_drawers n LEFT JOIN assets a ON a.id=n.asset_id WHERE a.id IS NULL", [], |r| r.get(0)).map_err(|e| e.to_string())?;
        if orphans > 0 { return Err("发现失去所属资产的旧备注，迁移已停止并保留原数据".into()); }
        transaction.execute_batch(include_str!("../migrations/20261004_asset_note_drawer_attachment.sql")).map_err(|e| e.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

fn drawer_from_row(row: &Row<'_>) -> rusqlite::Result<AssetNoteDrawer> {
    Ok(AssetNoteDrawer {
        id: row.get(0)?,
        asset_id: row.get(1)?,
        text: row.get(2)?,
        side: row.get(3)?,
        offset: row.get(4)?,
        width: row.get(5)?,
        height: row.get(6)?,
        order_index: row.get(7)?,
        locked: row.get::<_, i64>(8)? != 0,
        style_variant: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        mode: row.get(12)?,
        floating_x: row.get(13)?,
        floating_y: row.get(14)?,
        text_scale: row.get(15)?,
        category_id: row.get(16)?,
    })
}

fn validate(mut drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    if drawer.id.trim().is_empty() {
        return Err("备注抽屉缺少标识".into());
    }
    if drawer.asset_id.as_ref().is_some_and(|id| id.trim().is_empty()) { drawer.asset_id = None; }
    if drawer.asset_id.is_none() && drawer.mode != "floating" { return Err("独立备注必须使用自由状态".into()); }
    if !["left", "right", "top", "bottom"].contains(&drawer.side.as_str()) {
        return Err("备注抽屉边方向无效".into());
    }
    if !["floating", "docked-expanded", "docked-collapsed"].contains(&drawer.mode.as_str()) {
        return Err("备注抽屉状态无效".into());
    }
    if !drawer.floating_x.is_finite() || !drawer.floating_y.is_finite() {
        return Err("自由备注坐标无效".into());
    }
    if !drawer.offset.is_finite() || !drawer.width.is_finite() || !drawer.height.is_finite() {
        return Err("备注抽屉布局数值无效".into());
    }
    if !drawer.text_scale.is_finite() { return Err("备注文字比例无效".into()); }
    drawer.text_scale = drawer.text_scale.clamp(0.5, 20.0);
    drawer.offset = drawer.offset.max(0.0);
    drawer.width = drawer.width.clamp(180.0, 4000.0);
    drawer.height = drawer.height.clamp(100.0, 4000.0);
    drawer.order_index = drawer.order_index.max(0);
    if drawer.style_variant.is_empty() {
        drawer.style_variant = "default".into();
    }
    Ok(drawer)
}


const COLUMNS: &str = "id,asset_id,text,side,offset,width,height,order_index,locked,style_variant,created_at,updated_at,mode,floating_x,floating_y,text_scale,category_id";

fn context(connection: &Connection, mut drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    drawer = validate(drawer)?;
    if let Some(asset_id) = &drawer.asset_id {
        let category: String = connection.query_row("SELECT category_id FROM assets WHERE id=?1", [asset_id], |r| r.get(0)).map_err(|_| "附属资产不存在".to_string())?;
        if drawer.category_id.is_empty() { drawer.category_id = category.clone(); }
        if drawer.category_id != category { return Err("只能选择当前分类中的资产".into()); }
    }
    if drawer.category_id.is_empty() || !connection.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)", [&drawer.category_id], |r| r.get::<_,bool>(0)).map_err(|e| e.to_string())? {
        return Err("备注所在分类不存在".into());
    }
    Ok(drawer)
}

fn read_record(connection: &Connection, id: &str) -> AppResult<AssetNoteDrawer> {
    connection.query_row(&format!("SELECT {COLUMNS} FROM asset_note_drawers WHERE id=?1"), [id], drawer_from_row).map_err(|_| "备注抽屉不存在".into())
}

fn check_capacity(connection: &Connection, drawer: &AssetNoteDrawer) -> AppResult<()> {
    if let Some(asset) = &drawer.asset_id {
        let count: i64 = connection.query_row("SELECT COUNT(*) FROM asset_note_drawers WHERE asset_id=?1 AND id<>?2", params![asset, drawer.id], |r| r.get(0)).map_err(|e| e.to_string())?;
        if count >= 3 { return Err("每个资产最多允许 3 个备注抽屉".into()); }
    }
    Ok(())
}

fn insert_record(connection: &mut Connection, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    let tx = connection.transaction().map_err(|e| e.to_string())?;
    let mut drawer = context(&tx, drawer)?;
    check_capacity(&tx, &drawer)?;
    drawer.order_index = tx.query_row("SELECT COALESCE(MAX(order_index),-1)+1 FROM asset_note_drawers WHERE category_id=?1 AND asset_id IS ?2", params![drawer.category_id, drawer.asset_id], |r| r.get(0)).map_err(|e| e.to_string())?;
    drawer.created_at = super::now(); drawer.updated_at = drawer.created_at;
    tx.execute("INSERT INTO asset_note_drawers(id,asset_id,text,side,offset,width,height,order_index,locked,style_variant,created_at,updated_at,mode,floating_x,floating_y,text_scale,category_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)", params![drawer.id,drawer.asset_id,drawer.text,drawer.side,drawer.offset,drawer.width,drawer.height,drawer.order_index,drawer.locked as i64,drawer.style_variant,drawer.created_at,drawer.updated_at,drawer.mode,drawer.floating_x,drawer.floating_y,drawer.text_scale,drawer.category_id]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(drawer)
}

fn write_record(connection: &Connection, drawer: &AssetNoteDrawer) -> AppResult<()> {
    let changed = connection.execute("UPDATE asset_note_drawers SET asset_id=?2,text=?3,side=?4,offset=?5,width=?6,height=?7,order_index=?8,locked=?9,style_variant=?10,updated_at=?11,mode=?12,floating_x=?13,floating_y=?14,text_scale=?15,category_id=?16 WHERE id=?1", params![drawer.id,drawer.asset_id,drawer.text,drawer.side,drawer.offset,drawer.width,drawer.height,drawer.order_index,drawer.locked as i64,drawer.style_variant,drawer.updated_at,drawer.mode,drawer.floating_x,drawer.floating_y,drawer.text_scale,drawer.category_id]).map_err(|e| e.to_string())?;
    if changed == 0 { return Err("备注抽屉不存在".into()); }
    Ok(())
}

fn save_record(connection: &Connection, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    let tx = connection.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut drawer = context(&tx, drawer)?;
    let current = read_record(&tx, &drawer.id)?;
    if current.asset_id != drawer.asset_id || current.category_id != drawer.category_id { return Err("备注归属已变化，请重新读取".into()); }
    drawer.updated_at = super::now();
    write_record(&tx, &drawer)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(drawer)
}

fn check_transfer_slot(connection: &Connection, drawer: &AssetNoteDrawer) -> AppResult<()> {
    if drawer.mode == "floating" { return Ok(()); }
    let asset = drawer.asset_id.as_ref().ok_or("独立备注不能吸附")?;
    let (width,height): (f64,f64) = connection.query_row("SELECT COALESCE(l.width,280),COALESCE(l.height,210) FROM assets a LEFT JOIN canvas_layout l ON l.asset_id=a.id WHERE a.id=?1", [asset], |r| Ok((r.get(0)?,r.get(1)?))).map_err(|e|e.to_string())?;
    let vertical = drawer.side == "left" || drawer.side == "right";
    let length = if vertical {drawer.height} else {drawer.width};
    let edge = if vertical {height} else {width};
    if drawer.offset > (edge-length).max(0.0)+0.001 { return Err("目标边位置无效".into()); }
    let mut statement = connection.prepare("SELECT offset,width,height FROM asset_note_drawers WHERE asset_id=?1 AND id<>?2 AND side=?3 AND mode<>'floating'").map_err(|e|e.to_string())?;
    let blockers = statement.query_map(params![asset,drawer.id,drawer.side], |r| Ok((r.get::<_,f64>(0)?,r.get::<_,f64>(1)?,r.get::<_,f64>(2)?))).map_err(|e|e.to_string())?;
    for blocker in blockers {
        let (offset,w,h) = blocker.map_err(|e|e.to_string())?;
        let other_length = if vertical {h} else {w};
        let offset = offset.clamp(0.0,(edge-other_length).max(0.0));
        if drawer.offset < offset+other_length+14.0-0.001 && drawer.offset+length+14.0 > offset+0.001 {return Err("目标边空间不足".into());}
    }
    Ok(())
}

fn transfer_record(connection: &Connection, drawer: AssetNoteDrawer, expected_asset_id: Option<String>) -> AppResult<AssetNoteDrawer> {
    let tx = connection.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut drawer = context(&tx, drawer)?;
    let current = read_record(&tx, &drawer.id)?;
    if current.locked { return Err("请先解锁备注再更换附属资产".into()); }
    if current.asset_id != expected_asset_id || current.category_id != drawer.category_id {return Err("备注归属已变化，请重新读取".into());}
    check_capacity(&tx, &drawer)?;
    check_transfer_slot(&tx, &drawer)?;
    if current.asset_id != drawer.asset_id {
        drawer.order_index = tx.query_row("SELECT COALESCE(MAX(order_index),-1)+1 FROM asset_note_drawers WHERE category_id=?1 AND asset_id IS ?2 AND id<>?3", params![drawer.category_id,drawer.asset_id,drawer.id], |r|r.get(0)).map_err(|e|e.to_string())?;
    }
    drawer.updated_at = super::now();
    write_record(&tx, &drawer)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(drawer)
}

fn list_records(connection: &Connection, asset_ids: Vec<String>) -> AppResult<Vec<AssetNoteDrawer>> {
    let mut seen = HashSet::new(); let mut result = Vec::new();
    let mut statement = connection.prepare(&format!("SELECT {COLUMNS} FROM asset_note_drawers WHERE asset_id=?1 ORDER BY order_index,id")).map_err(|e|e.to_string())?;
    for asset in asset_ids.into_iter().filter(|id|seen.insert(id.clone())) {
        let rows = statement.query_map([asset], drawer_from_row).map_err(|e|e.to_string())?;
        for row in rows { result.push(row.map_err(|e|e.to_string())?); }
    }
    Ok(result)
}

fn list_category_records(connection: &Connection, category_id: &str) -> AppResult<Vec<AssetNoteDrawer>> {
    connection.prepare(&format!("SELECT {COLUMNS} FROM asset_note_drawers WHERE category_id=?1 ORDER BY order_index,id")).and_then(|mut s|s.query_map([category_id],drawer_from_row)?.collect()).map_err(|e|e.to_string())
}

fn delete_record(connection: &Connection, id: &str, asset_id: Option<&str>) -> AppResult<()> {
    if connection.execute("DELETE FROM asset_note_drawers WHERE id=?1 AND asset_id IS ?2", params![id,asset_id]).map_err(|e|e.to_string())? == 0 {return Err("备注抽屉不存在或归属已变化".into());}
    Ok(())
}

// Called inside the asset deletion transaction. Store the visible world center
// of docked notes before their host disappears, including the host's rotation.
pub(crate) fn detach_for_asset_delete(connection: &Connection, asset_id: &str) -> AppResult<()> {
    let records = list_records(connection, vec![asset_id.into()])?;
    if records.is_empty() {return Ok(());}
    let (x,y,w,h,rotation,tags): (f64,f64,f64,f64,f64,String) = connection.query_row("SELECT COALESCE(l.x,90),COALESCE(l.y,90),COALESCE(l.width,280),COALESCE(l.height,210),COALESCE(l.rotation,0),a.tags FROM assets a LEFT JOIN canvas_layout l ON l.asset_id=a.id WHERE a.id=?1",[asset_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).map_err(|e|e.to_string())?;
    let has_tags = serde_json::from_str::<Vec<String>>(&tags).unwrap_or_default().len() > 0;
    let angle = rotation.to_radians(); let cx=x+w/2.0; let cy=y+(h+if has_tags {44.0} else {32.0})/2.0;
    for mut note in records {
        if note.mode != "floating" {
            let offset=note.offset.clamp(0.0,(if note.side=="left"||note.side=="right" {h-note.height} else {w-note.width}).max(0.0));
            let left=match note.side.as_str(){"left"=>x-note.width,"right"=>x+w,_=>x+offset};
            let top=match note.side.as_str(){"top"=>y-note.height,"bottom"=>y+h,_=>y+offset};
            let dx=left+note.width/2.0-cx;let dy=top+note.height/2.0-cy;
            note.floating_x=cx+dx*angle.cos()-dy*angle.sin()-note.width/2.0;
            note.floating_y=cy+dx*angle.sin()+dy*angle.cos()-note.height/2.0;
        }
        note.asset_id=None; note.mode="floating".into(); note.updated_at=super::now();
        write_record(connection,&note)?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_asset_note_drawers(app: AppHandle, asset_ids: Vec<String>) -> AppResult<Vec<AssetNoteDrawer>> {list_records(&super::db(&app)?,asset_ids)}
#[tauri::command]
pub fn list_category_note_drawers(app: AppHandle, category_id: String) -> AppResult<Vec<AssetNoteDrawer>> {list_category_records(&super::db(&app)?,&category_id)}
#[tauri::command]
pub fn create_asset_note_drawer(app: AppHandle, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {insert_record(&mut super::db(&app)?,drawer)}
#[tauri::command]
pub fn save_asset_note_drawer(app: AppHandle, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {save_record(&super::db(&app)?,drawer)}
#[tauri::command]
pub fn transfer_asset_note_drawer(app: AppHandle, drawer: AssetNoteDrawer, expected_asset_id: Option<String>) -> AppResult<AssetNoteDrawer> {transfer_record(&super::db(&app)?,drawer,expected_asset_id)}
#[tauri::command]
pub fn delete_asset_note_drawer(app: AppHandle, id: String, asset_id: Option<String>) -> AppResult<()> {delete_record(&super::db(&app)?,&id,asset_id.as_deref())}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON; CREATE TABLE categories(id TEXT PRIMARY KEY); INSERT INTO categories VALUES('category-a'),('category-b'); CREATE TABLE assets(id TEXT PRIMARY KEY,category_id TEXT NOT NULL DEFAULT 'category-a',tags TEXT NOT NULL DEFAULT '[]'); CREATE TABLE canvas_layout(asset_id TEXT PRIMARY KEY,x REAL DEFAULT 0,y REAL DEFAULT 0,width REAL DEFAULT 400,height REAL DEFAULT 300,rotation REAL DEFAULT 0); INSERT INTO assets(id) VALUES('asset-a'),('asset-b'); INSERT INTO canvas_layout(asset_id) VALUES('asset-a'),('asset-b');",
            )
            .unwrap();
        migrate(&connection).unwrap();
        connection
    }

    fn drawer(id: &str, asset_id: &str) -> AssetNoteDrawer {
        AssetNoteDrawer {
            id: id.into(),
            asset_id: Some(asset_id.into()),
            category_id: String::new(),
            text: String::new(),
            side: "right".into(),
            mode: default_mode(),
            floating_x: 0.0,
            floating_y: 0.0,
            offset: 12.0,
            text_scale: 1.0,
            width: 240.0,
            height: 150.0,
            order_index: 0,
            locked: false,
            style_variant: "default".into(),
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn large_drawer_scale_roundtrips_and_validates() {
        let mut connection = connection();
        let mut item = drawer("scale", "asset-a");
        item.width = 4000.0; item.height = 3500.0; item.text_scale = 12.34;
        insert_record(&mut connection, item.clone()).unwrap();
        let saved = list_records(&connection, vec!["asset-a".into()]).unwrap().remove(0);
        assert_eq!((saved.width, saved.height, saved.text_scale), (4000.0,3500.0,12.34));
        item.text_scale = 50.0;
        assert_eq!(save_record(&connection, item.clone()).unwrap().text_scale, 20.0);
        item.text_scale = f64::NAN;
        assert!(save_record(&connection, item).is_err());
    }

    #[test]
    fn independent_records_persist_free_text_layout_lock_and_delete() {
        let mut connection = connection();
        let mut first = insert_record(&mut connection, drawer("drawer-a", "asset-a")).unwrap();
        let second = insert_record(&mut connection, drawer("drawer-b", "asset-a")).unwrap();
        assert!(first.created_at > 0);
        assert_eq!(second.order_index, 1);

        first.text = "第一行备注\n第二行备注".into();
        first.side = "top".into();
        first.offset = 83.0;
        first.width = 310.0;
        first.height = 180.0;
        first.locked = true;
        save_record(&connection, first.clone()).unwrap();

        let listed = list_records(&connection, vec!["asset-a".into(), "asset-b".into()]).unwrap();
        let saved = listed.iter().find(|item| item.id == "drawer-a").unwrap();
        assert_eq!(saved.text, "第一行备注\n第二行备注");
        assert_eq!(saved.side, "top");
        assert_eq!(saved.offset, 83.0);
        assert_eq!(saved.width, 310.0);
        assert_eq!(saved.height, 180.0);
        assert!(saved.locked);
        assert_eq!(listed.len(), 2);

        delete_record(&connection, "drawer-a", Some("asset-a")).unwrap();
        assert_eq!(list_records(&connection, vec!["asset-a".into()]).unwrap().len(), 1);
    }

    #[test]
    fn insert_enforces_three_drawers_per_asset() {
        let mut connection = connection();
        for index in 0..3 {
            insert_record(&mut connection, drawer(&format!("drawer-{index}"), "asset-a")).unwrap();
        }
        let error = insert_record(&mut connection, drawer("drawer-four", "asset-a")).unwrap_err();
        assert!(error.contains("最多允许 3 个"));
        assert_eq!(list_records(&connection, vec!["asset-a".into()]).unwrap().len(), 3);
        assert!(insert_record(&mut connection, drawer("other-asset-drawer", "asset-b")).is_ok());
    }

    #[test]
    fn migration_is_idempotent_and_preserves_notes_when_an_asset_is_deleted() {
        let mut connection = connection();
        insert_record(&mut connection, drawer("drawer-a", "asset-a")).unwrap();
        migrate(&connection).unwrap();
        detach_for_asset_delete(&connection,"asset-a").unwrap();
        connection.execute("DELETE FROM assets WHERE id='asset-a'", []).unwrap();
        let note=list_category_records(&connection,"category-a").unwrap().remove(0);
        assert_eq!(note.asset_id,None); assert_eq!(note.mode,"floating"); assert_eq!(note.floating_x,400.0);
        assert!(list_records(&connection, vec!["asset-a".into()]).unwrap().is_empty());
    }

    #[test]
    fn legacy_migration_preserves_records_and_accepts_old_command_payloads() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE categories(id TEXT PRIMARY KEY); INSERT INTO categories VALUES('category-a'),('category-b'); CREATE TABLE assets(id TEXT PRIMARY KEY,category_id TEXT NOT NULL DEFAULT 'category-a',tags TEXT NOT NULL DEFAULT '[]'); CREATE TABLE canvas_layout(asset_id TEXT PRIMARY KEY,x REAL DEFAULT 0,y REAL DEFAULT 0,width REAL DEFAULT 400,height REAL DEFAULT 300,rotation REAL DEFAULT 0); INSERT INTO assets(id) VALUES('asset-a'); INSERT INTO canvas_layout(asset_id) VALUES('asset-a');").unwrap();
        connection.execute_batch(MIGRATION).unwrap();
        connection.execute("INSERT INTO asset_note_drawers(id,asset_id,text,side,offset,width,height,order_index,locked,style_variant,created_at,updated_at) VALUES('old','asset-a','旧备注','left',83,310,180,0,1,'default',1,2)", []).unwrap();
        migrate(&connection).unwrap();
        migrate(&connection).unwrap();
        let old = list_records(&connection, vec!["asset-a".into()]).unwrap().remove(0);
        assert_eq!(old.text_scale, 1.0);
        assert_eq!(old.mode, "docked-expanded");
        assert_eq!(old.text, "旧备注");
        assert_eq!((old.offset, old.width, old.height), (83.0, 310.0, 180.0));
        assert!(old.locked);
        assert_eq!((old.created_at, old.updated_at), (1, 2));
        let mut payload = serde_json::to_value(drawer("legacy-payload", "asset-a")).unwrap();
        payload.as_object_mut().unwrap().remove("textScale");
        payload.as_object_mut().unwrap().remove("mode");
        payload.as_object_mut().unwrap().remove("floatingX");
        payload.as_object_mut().unwrap().remove("floatingY");
        let parsed: AssetNoteDrawer = serde_json::from_value(payload).unwrap();
        assert_eq!(parsed.text_scale, 1.0);
        assert_eq!(insert_record(&mut connection, parsed).unwrap().mode, "docked-expanded");
    }

    #[test]
    fn three_modes_and_negative_free_coordinates_survive_database_reopen() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("drawers.sqlite3");
        {
            let mut connection = Connection::open(&path).unwrap();
            connection.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE categories(id TEXT PRIMARY KEY); INSERT INTO categories VALUES('category-a'),('category-b'); CREATE TABLE assets(id TEXT PRIMARY KEY,category_id TEXT NOT NULL DEFAULT 'category-a',tags TEXT NOT NULL DEFAULT '[]'); CREATE TABLE canvas_layout(asset_id TEXT PRIMARY KEY,x REAL DEFAULT 0,y REAL DEFAULT 0,width REAL DEFAULT 400,height REAL DEFAULT 300,rotation REAL DEFAULT 0); INSERT INTO assets(id) VALUES('asset-a'); INSERT INTO canvas_layout(asset_id) VALUES('asset-a');").unwrap();
            migrate(&connection).unwrap();
            for (index, mode) in ["floating", "docked-expanded", "docked-collapsed"].iter().enumerate() {
                let mut record = drawer(&format!("drawer-{index}"), "asset-a");
                record.mode = (*mode).into();
                record.floating_x = -250.5;
                record.floating_y = 780.25;
                record.text = "中文备注\n第二行".into();
                record.side = "bottom".into();
                insert_record(&mut connection, record).unwrap();
            }
            let mut record = list_records(&connection, vec!["asset-a".into()]).unwrap().remove(0);
            record.floating_x = -399.0;
            save_record(&connection, record).unwrap();
        }
        let connection = Connection::open(&path).unwrap();
        migrate(&connection).unwrap();
        let records = list_records(&connection, vec!["asset-a".into()]).unwrap();
        assert_eq!(records.iter().map(|record| record.mode.as_str()).collect::<Vec<_>>(), vec!["floating", "docked-expanded", "docked-collapsed"]);
        assert_eq!(records[0].floating_x, -399.0);
        for record in records {
            assert_eq!(record.text, "中文备注\n第二行");
            assert_eq!(record.floating_y, 780.25);
            assert_eq!((record.width, record.height), (240.0, 150.0));
        }
    }

    #[test]
    fn rejects_invalid_modes_and_non_finite_free_positions() {
        let mut connection = connection();
        let mut invalid = drawer("invalid", "asset-a");
        invalid.mode = "unknown".into();
        assert!(insert_record(&mut connection, invalid.clone()).unwrap_err().contains("状态无效"));
        invalid.mode = "floating".into();
        invalid.floating_x = f64::INFINITY;
        assert!(insert_record(&mut connection, invalid).unwrap_err().contains("坐标无效"));
        let valid = insert_record(&mut connection, drawer("valid", "asset-a")).unwrap();
        assert!(connection.execute("UPDATE asset_note_drawers SET mode='unknown' WHERE id=?1", [&valid.id]).is_err());
    }

    #[test]
    fn transfer_is_atomic_and_stale_saves_cannot_restore_the_old_owner() {
        let mut c=connection();
        let original=insert_record(&mut c,drawer("transfer","asset-a")).unwrap();
        let mut next=original.clone(); next.asset_id=Some("asset-b".into()); next.text="转移时的中文备注".into(); next.text_scale=2.5;
        let saved=transfer_record(&c,next,Some("asset-a".into())).unwrap();
        assert_eq!(saved.asset_id,Some("asset-b".into()));
        assert_eq!(saved.text_scale,2.5);
        assert!(save_record(&c,original.clone()).is_err());
        assert!(transfer_record(&c,original,Some("asset-a".into())).is_err());
        assert_eq!(read_record(&c,"transfer").unwrap(),saved);
        let mut free=saved.clone();free.asset_id=None;free.mode="floating".into();free.floating_x=-300.5;free.floating_y=42.0;
        let free=transfer_record(&c,free,Some("asset-b".into())).unwrap();
        assert_eq!(free.category_id,"category-a");
        assert_eq!(free.text,"转移时的中文备注");
        assert_eq!(list_category_records(&c,"category-a").unwrap().len(),1);
        delete_record(&c,"transfer",None).unwrap();
    }

    #[test]
    fn full_target_cross_category_locked_and_colliding_transfers_preserve_original() {
        let mut c=connection();
        let original=insert_record(&mut c,drawer("moving","asset-a")).unwrap();
        for i in 0..3 {insert_record(&mut c,drawer(&format!("b-{i}"),"asset-b")).unwrap();}
        let mut next=original.clone(); next.asset_id=Some("asset-b".into());
        assert!(transfer_record(&c,next.clone(),original.asset_id.clone()).unwrap_err().contains("3 个"));
        assert_eq!(read_record(&c,"moving").unwrap(),original);
        delete_record(&c,"b-1",Some("asset-b")).unwrap();delete_record(&c,"b-2",Some("asset-b")).unwrap();
        assert!(transfer_record(&c,next.clone(),original.asset_id.clone()).unwrap_err().contains("空间不足"));
        c.execute("UPDATE assets SET category_id='category-b' WHERE id='asset-b'",[]).unwrap();
        assert!(transfer_record(&c,next,original.asset_id.clone()).unwrap_err().contains("当前分类"));
        let mut locked=original.clone();locked.locked=true;save_record(&c,locked.clone()).unwrap();
        locked.asset_id=None;locked.mode="floating".into();
        assert!(transfer_record(&c,locked,original.asset_id).unwrap_err().contains("解锁"));
    }

    #[test]
    fn independent_notes_have_no_asset_limit_and_attachment_follows_category_moves() {
        let mut c=connection();
        for i in 0..5 {let mut note=drawer(&format!("free-{i}"),"asset-a");note.asset_id=None;note.category_id="category-a".into();note.mode="floating".into();insert_record(&mut c,note).unwrap();}
        let attached=insert_record(&mut c,drawer("attached","asset-a")).unwrap();
        c.execute("UPDATE assets SET category_id='category-b' WHERE id='asset-a'",[]).unwrap();
        assert_eq!(list_category_records(&c,"category-a").unwrap().len(),5);
        let moved=list_category_records(&c,"category-b").unwrap();assert_eq!(moved.len(),1);assert_eq!(moved[0].id,"attached");
        assert!(save_record(&c,attached).is_err());
        migrate(&c).unwrap();assert_eq!(list_category_records(&c,"category-a").unwrap().len(),5);
    }

    #[test]
    fn deleting_rotated_host_preserves_world_position_and_free_coordinates() {
        let mut c=connection();
        c.execute("UPDATE canvas_layout SET x=100,y=200,rotation=90 WHERE asset_id='asset-a'",[]).unwrap();
        let note=insert_record(&mut c,drawer("rotated","asset-a")).unwrap();
        let mut free=drawer("free","asset-a");free.mode="floating".into();free.floating_x=-75.0;free.floating_y=999.0;insert_record(&mut c,free).unwrap();
        // FK prevents direct deletion from silently discarding the notes.
        assert!(c.execute("DELETE FROM assets WHERE id='asset-a'",[]).is_err());
        let tx=c.unchecked_transaction().unwrap();detach_for_asset_delete(&tx,"asset-a").unwrap();tx.execute("DELETE FROM assets WHERE id='asset-a'",[]).unwrap();tx.commit().unwrap();
        let saved=read_record(&c,&note.id).unwrap();
        assert!((saved.floating_x-259.0).abs()<1e-8);assert!((saved.floating_y-611.0).abs()<1e-8);
        let free=read_record(&c,"free").unwrap();assert_eq!((free.floating_x,free.floating_y),(-75.0,999.0));assert_eq!(free.asset_id,None);
    }
}
