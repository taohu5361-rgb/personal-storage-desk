//! Shared asset text and independent detail-view layouts.
use crate::inner_canvas_text::{validate_block, CanvasTextBlock};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
type Result<T> = std::result::Result<T, String>;
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetTextElement {
    pub id: String,
    pub asset_id: String,
    pub style_type: String,
    pub title: String,
    pub content: String,
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
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetTextLayout {
    pub text_id: String,
    pub asset_id: String,
    pub view_mode: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub z_index: i64,
    pub locked: bool,
    pub group_id: Option<String>,
    #[serde(default)]
    pub rotation: f64,
}
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AssetTextChanges {
    #[serde(default)]
    pub creates: Vec<AssetTextElement>,
    #[serde(default)]
    pub updates: Vec<AssetTextElement>,
    #[serde(default)]
    pub layouts: Vec<AssetTextLayout>,
    #[serde(default)]
    pub delete_ids: Vec<String>,
    #[serde(default)]
    pub inner_objects: Vec<crate::AssetInnerCanvasObject>,
}
const VERSION: &str = "20261002_asset_text";
pub fn migrate(c: &Connection) -> Result<()> {
    c.execute_batch("CREATE TABLE IF NOT EXISTS asset_text_migrations(version TEXT PRIMARY KEY);")
        .map_err(|e| e.to_string())?;
    let done: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM asset_text_migrations WHERE version=?1)",
            [VERSION],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if done {
        return Ok(());
    }
    // Reads committed WAL pages as part of a consistent SQLite snapshot.
    if let Some(path) = c.path().filter(|p| !p.is_empty() && *p != ":memory:") {
        let backup = format!("{}.before-asset-text-{}.sqlite3", path, crate::now());
        c.execute("VACUUM INTO ?1", [backup])
            .map_err(|e| format!("文字迁移备份失败：{e}"))?;
    }
    let tx = rusqlite::Transaction::new_unchecked(c, rusqlite::TransactionBehavior::Immediate)
        .map_err(|e| e.to_string())?;
    let done: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM asset_text_migrations WHERE version=?1)",
            [VERSION],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if done {
        return tx.commit().map_err(|e| e.to_string());
    }
    tx.execute_batch(include_str!("../migrations/20261002_asset_text.sql"))
        .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO asset_text_migrations(version) VALUES(?1)",
        [VERSION],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
pub fn list_elements(c: &Connection) -> Result<Vec<AssetTextElement>> {
    let mut stmt=c.prepare("SELECT id,asset_id,style_type,title,content,font_family,font_size,font_weight,text_color,text_align,line_height,border_enabled,border_color,border_width,border_radius,background_color,background_opacity,shadow,created_at,updated_at FROM asset_text_elements ORDER BY asset_id,created_at,id").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(AssetTextElement {
                id: r.get(0)?,
                asset_id: r.get(1)?,
                style_type: r.get(2)?,
                title: r.get(3)?,
                content: r.get(4)?,
                font_family: r.get(5)?,
                font_size: r.get(6)?,
                font_weight: r.get(7)?,
                text_color: r.get(8)?,
                text_align: r.get(9)?,
                line_height: r.get(10)?,
                border_enabled: r.get::<_, i64>(11)? != 0,
                border_color: r.get(12)?,
                border_width: r.get(13)?,
                border_radius: r.get(14)?,
                background_color: r.get(15)?,
                background_opacity: r.get(16)?,
                shadow: r.get::<_, i64>(17)? != 0,
                created_at: r.get(18)?,
                updated_at: r.get(19)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}
pub fn list_layouts(c: &Connection) -> Result<Vec<AssetTextLayout>> {
    let mut stmt=c.prepare("SELECT text_id,asset_id,view_mode,x,y,width,height,z_index,locked,group_id,rotation FROM asset_text_layouts ORDER BY asset_id,view_mode,z_index,text_id").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(AssetTextLayout {
                text_id: r.get(0)?,
                asset_id: r.get(1)?,
                view_mode: r.get(2)?,
                x: r.get(3)?,
                y: r.get(4)?,
                width: r.get(5)?,
                height: r.get(6)?,
                z_index: r.get(7)?,
                locked: r.get::<_, i64>(8)? != 0,
                group_id: r.get(9)?,
                rotation: r.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}
fn owner(c: &Connection, id: &str) -> Result<Option<String>> {
    c.query_row(
        "SELECT asset_id FROM asset_text_elements WHERE id=?1",
        [id],
        |r| r.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}
fn validate_element(
    e: AssetTextElement,
    asset_id: &str,
    fonts: &HashSet<String>,
) -> Result<AssetTextElement> {
    let mut b = CanvasTextBlock {
        id: e.id,
        canvas_id: asset_id.into(),
        asset_id: e.asset_id,
        style_type: e.style_type,
        title: e.title,
        content: e.content,
        x: 0.0,
        y: 0.0,
        width: 280.0,
        height: 160.0,
        z_index: 0,
        locked: false,
        group_id: None,
        font_family: e.font_family,
        font_size: e.font_size,
        font_weight: e.font_weight,
        text_color: e.text_color,
        text_align: e.text_align,
        line_height: e.line_height,
        border_enabled: e.border_enabled,
        border_color: e.border_color,
        border_width: e.border_width,
        border_radius: e.border_radius,
        background_color: e.background_color,
        background_opacity: e.background_opacity,
        shadow: e.shadow,
        created_at: e.created_at,
        updated_at: e.updated_at,
    };
    validate_block(&mut b, asset_id, fonts)?;
    Ok(AssetTextElement {
        id: b.id,
        asset_id: b.asset_id,
        style_type: b.style_type,
        title: b.title,
        content: b.content,
        font_family: b.font_family,
        font_size: b.font_size,
        font_weight: b.font_weight,
        text_color: b.text_color,
        text_align: b.text_align,
        line_height: b.line_height,
        border_enabled: b.border_enabled,
        border_color: b.border_color,
        border_width: b.border_width,
        border_radius: b.border_radius,
        background_color: b.background_color,
        background_opacity: b.background_opacity,
        shadow: b.shadow,
        created_at: b.created_at,
        updated_at: b.updated_at,
    })
}
pub fn save_changes(
    c: &mut Connection,
    asset_id: &str,
    view_mode: &str,
    changes: AssetTextChanges,
) -> Result<()> {
    if !["standard", "canvas"].contains(&view_mode) {
        return Err("文字视图无效".into());
    }
    let tx = c.transaction().map_err(|e| e.to_string())?;
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM assets WHERE id=?1)",
            [asset_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err("找不到文字所属资产".into());
    }
    let fonts = crate::inner_canvas_text::list_fonts(&tx)?
        .into_iter()
        .map(|f| f.family)
        .collect();
    let mut seen = HashSet::new();
    for (create, element) in changes
        .creates
        .into_iter()
        .map(|e| (true, e))
        .chain(changes.updates.into_iter().map(|e| (false, e)))
    {
        let mut e = validate_element(element, asset_id, &fonts)?;
        if !seen.insert(e.id.clone()) {
            return Err("文字更新标识重复".into());
        }
        let existing = owner(&tx, &e.id)?;
        if create && existing.is_some() {
            return Err("文字标识已存在".into());
        }
        if !create && existing.as_deref() != Some(asset_id) {
            return Err("文字不存在或属于其他资产".into());
        }
        e.updated_at = crate::now();
        tx.execute("INSERT INTO asset_text_elements (id,asset_id,style_type,title,content,font_family,font_size,font_weight,text_color,text_align,line_height,border_enabled,border_color,border_width,border_radius,background_color,background_opacity,shadow,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20) ON CONFLICT(id) DO UPDATE SET style_type=excluded.style_type,title=excluded.title,content=excluded.content,font_family=excluded.font_family,font_size=excluded.font_size,font_weight=excluded.font_weight,text_color=excluded.text_color,text_align=excluded.text_align,line_height=excluded.line_height,border_enabled=excluded.border_enabled,border_color=excluded.border_color,border_width=excluded.border_width,border_radius=excluded.border_radius,background_color=excluded.background_color,background_opacity=excluded.background_opacity,shadow=excluded.shadow,updated_at=excluded.updated_at",params![e.id,e.asset_id,e.style_type,e.title,e.content,e.font_family,e.font_size,e.font_weight,e.text_color,e.text_align,e.line_height,e.border_enabled as i64,e.border_color,e.border_width,e.border_radius,e.background_color,e.background_opacity,e.shadow as i64,e.created_at,e.updated_at]).map_err(|e|e.to_string())?;
    }
    let mut seen_layouts = HashSet::new();
    for l in changes.layouts {
        if l.asset_id != asset_id
            || l.view_mode != view_mode
            || owner(&tx, &l.text_id)?.as_deref() != Some(asset_id)
        {
            return Err("文字布局不能跨资产或跨视图保存".into());
        }
        if !seen_layouts.insert(l.text_id.clone())
            || !l.rotation.is_finite()
            || !l.x.is_finite()
            || !l.y.is_finite()
            || !l.width.is_finite()
            || !l.height.is_finite()
            || !(80.0..=10000.0).contains(&l.width)
            || !(60.0..=10000.0).contains(&l.height)
            || l.group_id
                .as_ref()
                .is_some_and(|id| id.trim().is_empty() || id.len() > 200)
            || (view_mode == "standard" && (l.x < 0.0 || l.y < 0.0))
        {
            return Err("文字布局数值无效".into());
        }
        tx.execute("INSERT INTO asset_text_layouts(text_id,asset_id,view_mode,x,y,width,height,z_index,locked,group_id,rotation) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11) ON CONFLICT(text_id,view_mode) DO UPDATE SET x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,z_index=excluded.z_index,locked=excluded.locked,group_id=excluded.group_id,rotation=excluded.rotation",params![l.text_id,l.asset_id,l.view_mode,l.x,l.y,l.width,l.height,l.z_index,l.locked as i64,l.group_id,l.rotation]).map_err(|e|e.to_string())?;
    }
    for id in changes.delete_ids {
        if owner(&tx, &id)?.as_deref() != Some(asset_id) {
            return Err("删除的文字不存在或属于其他资产".into());
        }
        tx.execute(
            "DELETE FROM asset_text_elements WHERE id=?1 AND asset_id=?2",
            params![id, asset_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if !changes.inner_objects.is_empty() {
        if view_mode != "canvas" {
            return Err("标准详情不能修改内画布对象".into());
        }
        crate::write_asset_inner_canvas_layout_records(&tx, asset_id, changes.inner_objects)?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::inner_canvas_text::DEFAULT_FONT_FAMILY;
    fn setup(connection: Connection) -> Connection {
        connection.execute_batch(
            "PRAGMA foreign_keys=ON;
             CREATE TABLE assets(id TEXT PRIMARY KEY);
             CREATE TABLE asset_inner_canvas(
                asset_id TEXT NOT NULL,object_id TEXT NOT NULL,object_type TEXT NOT NULL,
                source_prompt_id TEXT,field_key TEXT NOT NULL DEFAULT '',text_value TEXT NOT NULL DEFAULT '',
                x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,
                z_index INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0,group_id TEXT,
                font_size INTEGER NOT NULL DEFAULT 14,bold INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(asset_id,object_id));
             INSERT INTO assets(id) VALUES('asset-a'),('asset-b');",
        )
        .unwrap();
        connection
    }

    fn block(asset_id: &str, id: &str) -> CanvasTextBlock {
        CanvasTextBlock {
            id: id.into(),
            canvas_id: asset_id.into(),
            asset_id: asset_id.into(),
            style_type: "plain".into(),
            title: String::new(),
            content: "第一行\nsecond line".into(),
            x: 120.0,
            y: -40.0,
            width: 280.0,
            height: 160.0,
            z_index: 3,
            locked: false,
            group_id: None,
            font_family: DEFAULT_FONT_FAMILY.into(),
            font_size: 18,
            font_weight: 400,
            text_color: "#334155".into(),
            text_align: "left".into(),
            line_height: 1.5,
            border_enabled: false,
            border_color: "#d6dbe3".into(),
            border_width: 1.0,
            border_radius: 0.0,
            background_color: "#ffffff".into(),
            background_opacity: 0.0,
            shadow: false,
            created_at: 1,
            updated_at: 1,
        }
    }

    fn seed(c: &mut Connection) {
        crate::inner_canvas_text::migrate(c).unwrap();
        let mut blocks = Vec::new();
        for style in ["plain", "card", "sticky", "panel"] {
            let mut b = block("asset-a", style);
            b.style_type = style.into();
            b.title = "标题".into();
            b.font_size = 32;
            b.background_opacity = 75.0;
            b.group_id = Some("mixed".into());
            blocks.push(b);
        }
        crate::inner_canvas_text::save_blocks_snapshot(c, "asset-a", blocks).unwrap();
        migrate(c).unwrap();
        crate::canvas_transform::migrate(c).unwrap();
    }
    fn standard(c: &Connection) -> Vec<AssetTextLayout> {
        list_elements(c)
            .unwrap()
            .iter()
            .enumerate()
            .map(|(i, e)| AssetTextLayout {
                text_id: e.id.clone(),
                asset_id: e.asset_id.clone(),
                view_mode: "standard".into(),
                x: 20.0,
                y: 300.0 + i as f64 * 200.0,
                width: 350.0,
                height: 180.0,
                z_index: i as i64,
                locked: false,
                group_id: None,
                rotation: 0.0,
            })
            .collect()
    }
    #[test]
    fn migration_preserves_styles_layout_ids_and_deleted_text_stays_deleted() {
        let mut c = setup(Connection::open_in_memory().unwrap());
        seed(&mut c);
        let elements = list_elements(&c).unwrap();
        assert_eq!(elements.len(), 4);
        assert!(elements.iter().all(|e| e.content == "第一行\nsecond line"
            && e.title == "标题"
            && e.font_size == 32
            && e.background_opacity == 75.0));
        assert!(list_layouts(&c)
            .unwrap()
            .iter()
            .all(|l| l.x == 120.0 && l.y == -40.0 && l.group_id.as_deref() == Some("mixed")));
        save_changes(
            &mut c,
            "asset-a",
            "canvas",
            AssetTextChanges {
                delete_ids: vec!["plain".into()],
                ..Default::default()
            },
        )
        .unwrap();
        migrate(&c).unwrap();
        crate::canvas_transform::migrate(&c).unwrap();
        assert_eq!(list_elements(&c).unwrap().len(), 3);
        assert_eq!(list_layouts(&c).unwrap().len(), 3);
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM canvas_text_blocks", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            4
        );
    }
    #[test]
    fn content_shared_but_all_layout_fields_are_independent() {
        let mut c = setup(Connection::open_in_memory().unwrap());
        seed(&mut c);
        let canvas = list_layouts(&c).unwrap();
        let layouts = standard(&c);
        save_changes(
            &mut c,
            "asset-a",
            "standard",
            AssetTextChanges {
                layouts,
                ..Default::default()
            },
        )
        .unwrap();
        let mut e = list_elements(&c).unwrap().remove(0);
        e.content = "标准详情更新".into();
        e.text_color = "#ffffff".into();
        let mut layouts = list_layouts(&c)
            .unwrap()
            .into_iter()
            .filter(|l| l.view_mode == "standard")
            .collect::<Vec<_>>();
        layouts[0].x = 90.0;
        layouts[0].width = 480.0;
        layouts[0].locked = true;
        layouts[0].group_id = Some("standard-group".into());
        save_changes(
            &mut c,
            "asset-a",
            "standard",
            AssetTextChanges {
                updates: vec![e.clone()],
                layouts,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(
            list_elements(&c)
                .unwrap()
                .iter()
                .find(|x| x.id == e.id)
                .unwrap()
                .content,
            e.content
        );
        assert_eq!(
            list_layouts(&c)
                .unwrap()
                .into_iter()
                .filter(|l| l.view_mode == "canvas")
                .collect::<Vec<_>>(),
            canvas
        );
    }
    #[test]
    fn cross_asset_view_and_failed_mixed_write_roll_back_everything() {
        let mut c = setup(Connection::open_in_memory().unwrap());
        seed(&mut c);
        let before = list_elements(&c).unwrap();
        let mut e = before[0].clone();
        e.content = "must rollback".into();
        let mut invalid = standard(&c);
        invalid[0].asset_id = "asset-b".into();
        assert!(save_changes(
            &mut c,
            "asset-a",
            "standard",
            AssetTextChanges {
                updates: vec![e.clone()],
                layouts: invalid,
                ..Default::default()
            }
        )
        .is_err());
        assert_eq!(list_elements(&c).unwrap(), before);
        assert!(save_changes(
            &mut c,
            "asset-b",
            "canvas",
            AssetTextChanges {
                updates: vec![e.clone()],
                ..Default::default()
            }
        )
        .is_err());
        let mut invalid = standard(&c);
        invalid[0].view_mode = "canvas".into();
        assert!(save_changes(
            &mut c,
            "asset-a",
            "standard",
            AssetTextChanges {
                updates: vec![e],
                layouts: invalid,
                ..Default::default()
            }
        )
        .is_err());
        assert_eq!(list_elements(&c).unwrap(), before);
        assert!(save_changes(
            &mut c,
            "asset-b",
            "canvas",
            AssetTextChanges {
                delete_ids: vec![before[0].id.clone()],
                ..Default::default()
            }
        )
        .is_err());
    }
    #[test]
    fn consistent_backup_contains_wal_and_restart_does_not_reimport() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("text.sqlite3");
        let mut c = setup(Connection::open(&path).unwrap());
        c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;")
            .unwrap();
        seed(&mut c);
        let backup = std::fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().path())
            .find(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .contains("before-asset-text")
            })
            .unwrap();
        let b = Connection::open(&backup).unwrap();
        assert_eq!(
            b.query_row("SELECT COUNT(*) FROM canvas_text_blocks", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            4
        );
        let layouts = standard(&c);
        save_changes(
            &mut c,
            "asset-a",
            "standard",
            AssetTextChanges {
                layouts,
                delete_ids: vec!["plain".into()],
                ..Default::default()
            },
        )
        .unwrap();
        drop(c);
        let c = Connection::open(path).unwrap();
        migrate(&c).unwrap();
        crate::canvas_transform::migrate(&c).unwrap();
        assert_eq!(list_elements(&c).unwrap().len(), 3);
        assert_eq!(list_layouts(&c).unwrap().len(), 6);
    }
    #[test]
    fn deleting_custom_font_updates_shared_elements_and_asset_delete_cascades() {
        let mut c = setup(Connection::open_in_memory().unwrap());
        seed(&mut c);
        c.execute("INSERT INTO custom_fonts(id,name,family,file_path,format,created_at) VALUES('font','test','CustomTest','font.ttf','ttf',1)",[]).unwrap();
        let mut e = list_elements(&c).unwrap().remove(0);
        e.font_family = "CustomTest".into();
        save_changes(
            &mut c,
            "asset-a",
            "canvas",
            AssetTextChanges {
                updates: vec![e],
                ..Default::default()
            },
        )
        .unwrap();
        crate::inner_canvas_text::delete_font_record(&mut c, "font").unwrap();
        assert!(list_elements(&c)
            .unwrap()
            .iter()
            .all(|e| e.font_family == "system-ui"));
        c.execute("DELETE FROM assets WHERE id='asset-a'", [])
            .unwrap();
        assert!(list_elements(&c).unwrap().is_empty());
        assert!(list_layouts(&c).unwrap().is_empty());
    }
    #[test]
    fn mixed_group_layouts_commit_and_roll_back_together() {
        let mut c = setup(Connection::open_in_memory().unwrap());
        seed(&mut c);
        c.execute_batch("CREATE TABLE asset_prompts(id TEXT PRIMARY KEY,asset_id TEXT); INSERT INTO asset_prompts VALUES('prompt','asset-a');").unwrap();
        let object = crate::AssetInnerCanvasObject {
            asset_id: "asset-a".into(),
            object_id: "prompt-object".into(),
            object_type: "prompt".into(),
            source_prompt_id: Some("prompt".into()),
            field_key: "naturalPrompt".into(),
            text_value: String::new(),
            x: 450.0,
            y: 70.0,
            width: 390.0,
            height: 180.0,
            z_index: 2,
            locked: false,
            group_id: Some("mixed-new".into()),
            font_size: 14,
            bold: false,
            rotation: 0.0,
        };
        let mut layout = list_layouts(&c).unwrap().remove(0);
        layout.group_id = Some("mixed-new".into());
        save_changes(
            &mut c,
            "asset-a",
            "canvas",
            AssetTextChanges {
                layouts: vec![layout.clone()],
                inner_objects: vec![object.clone()],
                ..Default::default()
            },
        )
        .unwrap();
        let group: String = c
            .query_row(
                "SELECT group_id FROM asset_inner_canvas WHERE object_id='prompt-object'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(group, "mixed-new");
        let before = list_elements(&c).unwrap();
        let mut element = before[0].clone();
        element.content = "rollback".into();
        layout.x = 999.0;
        let mut invalid = object;
        invalid.source_prompt_id = Some("foreign-prompt".into());
        assert!(save_changes(
            &mut c,
            "asset-a",
            "canvas",
            AssetTextChanges {
                updates: vec![element],
                layouts: vec![layout.clone()],
                inner_objects: vec![invalid],
                ..Default::default()
            }
        )
        .is_err());
        assert_eq!(list_elements(&c).unwrap(), before);
        assert_ne!(
            list_layouts(&c)
                .unwrap()
                .iter()
                .find(|l| l.text_id == layout.text_id)
                .unwrap()
                .x,
            999.0
        );
    }
}
