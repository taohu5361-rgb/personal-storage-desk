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
    pub asset_id: String,
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
    })
}

fn validate(mut drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    if drawer.id.trim().is_empty() || drawer.asset_id.trim().is_empty() {
        return Err("备注抽屉缺少标识或所属资产".into());
    }
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

fn insert_record(connection: &mut Connection, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    let mut drawer = validate(drawer)?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    let count: i64 = transaction
        .query_row(
            "SELECT COUNT(*) FROM asset_note_drawers WHERE asset_id=?1",
            [&drawer.asset_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if count >= 3 {
        return Err("每个资产最多允许 3 个备注抽屉".into());
    }
    drawer.order_index = transaction
        .query_row(
            "SELECT COALESCE(MAX(order_index),-1)+1 FROM asset_note_drawers WHERE asset_id=?1",
            [&drawer.asset_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    drawer.created_at = super::now();
    drawer.updated_at = drawer.created_at;
    transaction
        .execute(
            "INSERT INTO asset_note_drawers(id,asset_id,text,side,offset,width,height,order_index,locked,style_variant,created_at,updated_at,mode,floating_x,floating_y,text_scale) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
            params![
                drawer.id,
                drawer.asset_id,
                drawer.text,
                drawer.side,
                drawer.offset,
                drawer.width,
                drawer.height,
                drawer.order_index,
                drawer.locked as i64,
                drawer.style_variant,
                drawer.created_at,
                drawer.updated_at,
                drawer.mode,
                drawer.floating_x,
                drawer.floating_y,
                drawer.text_scale,
            ],
        )
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(drawer)
}

fn save_record(connection: &Connection, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    let mut drawer = validate(drawer)?;
    drawer.updated_at = super::now();
    let changed = connection
        .execute(
            "UPDATE asset_note_drawers SET text=?1,side=?2,offset=?3,width=?4,height=?5,order_index=?6,locked=?7,style_variant=?8,updated_at=?9,mode=?12,floating_x=?13,floating_y=?14,text_scale=?15 WHERE id=?10 AND asset_id=?11",
            params![
                drawer.text,
                drawer.side,
                drawer.offset,
                drawer.width,
                drawer.height,
                drawer.order_index,
                drawer.locked as i64,
                drawer.style_variant,
                drawer.updated_at,
                drawer.id,
                drawer.asset_id,
                drawer.mode,
                drawer.floating_x,
                drawer.floating_y,
                drawer.text_scale,
            ],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("备注抽屉不存在".into());
    }
    Ok(drawer)
}

fn list_records(connection: &Connection, asset_ids: Vec<String>) -> AppResult<Vec<AssetNoteDrawer>> {
    let mut unique_ids = HashSet::new();
    let asset_ids = asset_ids.into_iter().filter(|id| unique_ids.insert(id.clone()));
    let mut statement = connection
        .prepare("SELECT id,asset_id,text,side,offset,width,height,order_index,locked,style_variant,created_at,updated_at,mode,floating_x,floating_y,text_scale FROM asset_note_drawers WHERE asset_id=?1 ORDER BY order_index,id")
        .map_err(|error| error.to_string())?;
    let mut drawers = Vec::new();
    for asset_id in asset_ids {
        let rows = statement
            .query_map([asset_id], drawer_from_row)
            .map_err(|error| error.to_string())?;
        for row in rows {
            drawers.push(row.map_err(|error| error.to_string())?);
        }
    }
    Ok(drawers)
}

fn delete_record(connection: &Connection, id: &str, asset_id: &str) -> AppResult<()> {
    let changed = connection
        .execute(
            "DELETE FROM asset_note_drawers WHERE id=?1 AND asset_id=?2",
            params![id, asset_id],
        )
        .map_err(|error| error.to_string())?;
    if changed == 0 {
        return Err("备注抽屉不存在".into());
    }
    Ok(())
}

#[tauri::command]
pub fn list_asset_note_drawers(app: AppHandle, asset_ids: Vec<String>) -> AppResult<Vec<AssetNoteDrawer>> {
    list_records(&super::db(&app)?, asset_ids)
}

#[tauri::command]
pub fn create_asset_note_drawer(app: AppHandle, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    insert_record(&mut super::db(&app)?, drawer)
}

#[tauri::command]
pub fn save_asset_note_drawer(app: AppHandle, drawer: AssetNoteDrawer) -> AppResult<AssetNoteDrawer> {
    save_record(&super::db(&app)?, drawer)
}

#[tauri::command]
pub fn delete_asset_note_drawer(app: AppHandle, id: String, asset_id: String) -> AppResult<()> {
    delete_record(&super::db(&app)?, &id, &asset_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connection() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON; CREATE TABLE assets(id TEXT PRIMARY KEY); INSERT INTO assets(id) VALUES('asset-a'),('asset-b');",
            )
            .unwrap();
        migrate(&connection).unwrap();
        connection
    }

    fn drawer(id: &str, asset_id: &str) -> AssetNoteDrawer {
        AssetNoteDrawer {
            id: id.into(),
            asset_id: asset_id.into(),
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

        delete_record(&connection, "drawer-a", "asset-a").unwrap();
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
    fn migration_is_idempotent_and_cascades_when_an_asset_is_deleted() {
        let mut connection = connection();
        insert_record(&mut connection, drawer("drawer-a", "asset-a")).unwrap();
        migrate(&connection).unwrap();
        connection.execute("DELETE FROM assets WHERE id='asset-a'", []).unwrap();
        assert!(list_records(&connection, vec!["asset-a".into()]).unwrap().is_empty());
    }

    #[test]
    fn legacy_migration_preserves_records_and_accepts_old_command_payloads() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE assets(id TEXT PRIMARY KEY); INSERT INTO assets VALUES('asset-a');").unwrap();
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
            connection.execute_batch("PRAGMA foreign_keys=ON; CREATE TABLE assets(id TEXT PRIMARY KEY); INSERT INTO assets VALUES('asset-a');").unwrap();
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
}
