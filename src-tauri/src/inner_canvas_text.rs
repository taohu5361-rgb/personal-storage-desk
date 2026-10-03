use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::AppHandle;

type Result<T> = std::result::Result<T, String>;

pub const DEFAULT_FONT_FAMILY: &str = "system-ui";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CanvasTextBlock {
    pub id: String,
    pub canvas_id: String,
    pub asset_id: String,
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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomFont {
    pub id: String,
    pub name: String,
    pub family: String,
    pub file_path: String,
    pub format: String,
    pub created_at: i64,
}

pub fn migrate(connection: &Connection) -> Result<()> {
    connection
        .execute_batch(include_str!("../migrations/0001_inner_canvas_text.sql"))
        .map_err(|error| error.to_string())
}

#[cfg(test)]
pub fn list_blocks(connection: &Connection) -> Result<Vec<CanvasTextBlock>> {
    let mut statement = connection
        .prepare(
            "SELECT id,canvas_id,asset_id,style_type,title,content,x,y,width,height,z_index,locked,group_id,font_family,font_size,font_weight,text_color,text_align,line_height,border_enabled,border_color,border_width,border_radius,background_color,background_opacity,shadow,created_at,updated_at
             FROM canvas_text_blocks ORDER BY asset_id,z_index,id",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(CanvasTextBlock {
                id: row.get(0)?,
                canvas_id: row.get(1)?,
                asset_id: row.get(2)?,
                style_type: row.get(3)?,
                title: row.get(4)?,
                content: row.get(5)?,
                x: row.get(6)?,
                y: row.get(7)?,
                width: row.get(8)?,
                height: row.get(9)?,
                z_index: row.get(10)?,
                locked: row.get::<_, i64>(11)? != 0,
                group_id: row.get(12)?,
                font_family: row.get(13)?,
                font_size: row.get::<_, i64>(14)?.clamp(8, 128) as u32,
                font_weight: row.get::<_, i64>(15)?.clamp(100, 900) as u32,
                text_color: row.get(16)?,
                text_align: row.get(17)?,
                line_height: row.get(18)?,
                border_enabled: row.get::<_, i64>(19)? != 0,
                border_color: row.get(20)?,
                border_width: row.get(21)?,
                border_radius: row.get(22)?,
                background_color: row.get(23)?,
                background_opacity: row.get(24)?,
                shadow: row.get::<_, i64>(25)? != 0,
                created_at: row.get(26)?,
                updated_at: row.get(27)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())
}

pub fn list_fonts(connection: &Connection) -> Result<Vec<CustomFont>> {
    let mut statement = connection
        .prepare("SELECT id,name,family,file_path,format,created_at FROM custom_fonts ORDER BY name COLLATE NOCASE,id")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(CustomFont {
                id: row.get(0)?,
                name: row.get(1)?,
                family: row.get(2)?,
                file_path: row.get(3)?,
                format: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
pub fn save_blocks_snapshot(
    connection: &mut Connection,
    asset_id: &str,
    blocks: Vec<CanvasTextBlock>,
) -> Result<()> {
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let asset_exists: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM assets WHERE id=?1)",
            [asset_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !asset_exists {
        return Err("找不到文字块所属的资产".into());
    }

    let known_fonts = {
        let mut statement = transaction
            .prepare("SELECT family FROM custom_fonts")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<HashSet<_>>>()
            .map_err(|error| error.to_string())?
    };
    let mut seen = HashSet::with_capacity(blocks.len());
    for mut block in blocks {
        validate_block(&mut block, asset_id, &known_fonts)?;
        if !seen.insert(block.id.clone()) {
            return Err("文字块列表包含重复标识".into());
        }
        transaction
            .execute(
                "INSERT INTO canvas_text_blocks (
                    id,canvas_id,asset_id,style_type,title,content,x,y,width,height,z_index,locked,group_id,
                    font_family,font_size,font_weight,text_color,text_align,line_height,border_enabled,border_color,
                    border_width,border_radius,background_color,background_opacity,shadow,created_at,updated_at
                 ) VALUES (
                    ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28
                 ) ON CONFLICT(id) DO UPDATE SET
                    canvas_id=excluded.canvas_id,asset_id=excluded.asset_id,style_type=excluded.style_type,
                    title=excluded.title,content=excluded.content,x=excluded.x,y=excluded.y,width=excluded.width,
                    height=excluded.height,z_index=excluded.z_index,locked=excluded.locked,group_id=excluded.group_id,
                    font_family=excluded.font_family,font_size=excluded.font_size,font_weight=excluded.font_weight,
                    text_color=excluded.text_color,text_align=excluded.text_align,line_height=excluded.line_height,
                    border_enabled=excluded.border_enabled,border_color=excluded.border_color,
                    border_width=excluded.border_width,border_radius=excluded.border_radius,
                    background_color=excluded.background_color,background_opacity=excluded.background_opacity,
                    shadow=excluded.shadow,updated_at=excluded.updated_at",
                params![
                    block.id,
                    block.canvas_id,
                    block.asset_id,
                    block.style_type,
                    block.title,
                    block.content,
                    block.x,
                    block.y,
                    block.width,
                    block.height,
                    block.z_index,
                    block.locked as i64,
                    block.group_id,
                    block.font_family,
                    block.font_size as i64,
                    block.font_weight as i64,
                    block.text_color,
                    block.text_align,
                    block.line_height,
                    block.border_enabled as i64,
                    block.border_color,
                    block.border_width,
                    block.border_radius,
                    block.background_color,
                    block.background_opacity,
                    block.shadow as i64,
                    block.created_at,
                    block.updated_at
                ],
            )
            .map_err(|error| error.to_string())?;
    }

    let existing_ids = {
        let mut statement = transaction
            .prepare("SELECT id FROM canvas_text_blocks WHERE asset_id=?1")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([asset_id], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())?
    };
    for id in existing_ids {
        if !seen.contains(&id) {
            transaction
                .execute(
                    "DELETE FROM canvas_text_blocks WHERE asset_id=?1 AND id=?2",
                    params![asset_id, id],
                )
                .map_err(|error| error.to_string())?;
        }
    }

    transaction.commit().map_err(|error| error.to_string())
}

pub(crate) fn validate_block(
    block: &mut CanvasTextBlock,
    asset_id: &str,
    known_fonts: &HashSet<String>,
) -> Result<()> {
    if block.id.trim().is_empty()
        || block.id.len() > 200
        || block.asset_id != asset_id
        || block.canvas_id != asset_id
    {
        return Err("文字块标识或画布归属无效".into());
    }
    if !["plain", "card", "sticky", "panel"].contains(&block.style_type.as_str()) {
        return Err("文字块样式类型无效".into());
    }
    if !block.x.is_finite()
        || !block.y.is_finite()
        || !block.width.is_finite()
        || !block.height.is_finite()
        || !(80.0..=10_000.0).contains(&block.width)
        || !(60.0..=10_000.0).contains(&block.height)
        || !(8..=128).contains(&block.font_size)
        || !(100..=900).contains(&block.font_weight)
        || block.font_weight % 100 != 0
        || !block.line_height.is_finite()
        || !(0.8..=3.0).contains(&block.line_height)
        || !block.border_width.is_finite()
        || !(0.0..=12.0).contains(&block.border_width)
        || !block.border_radius.is_finite()
        || !(0.0..=64.0).contains(&block.border_radius)
        || !block.background_opacity.is_finite()
        || !(0.0..=100.0).contains(&block.background_opacity)
    {
        return Err("文字块位置、尺寸或样式数值超出有效范围".into());
    }
    if !["left", "center", "right"].contains(&block.text_align.as_str())
        || !valid_color(&block.text_color)
        || !valid_color(&block.border_color)
        || !valid_color(&block.background_color)
    {
        return Err("文字块颜色或对齐方式无效".into());
    }
    if block.content.len() > 1_000_000 || block.title.len() > 10_000 {
        return Err("文字块内容过长".into());
    }
    if let Some(group_id) = &block.group_id {
        if group_id.trim().is_empty() || group_id.len() > 200 {
            return Err("文字块分组标识无效".into());
        }
    }
    let known_system_fonts = [
        DEFAULT_FONT_FAMILY,
        "Arial",
        "Segoe UI",
        "Georgia",
        "Consolas",
        "sans-serif",
        "serif",
        "monospace",
    ];
    if !known_system_fonts.contains(&block.font_family.as_str())
        && !known_fonts.contains(&block.font_family)
    {
        block.font_family = DEFAULT_FONT_FAMILY.into();
    }
    let timestamp = now_ms();
    if block.created_at <= 0 {
        block.created_at = timestamp;
    }
    block.updated_at = timestamp;
    Ok(())
}

fn valid_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit)
}

pub fn import_font(
    app: &AppHandle,
    connection: &Connection,
    font_id: &str,
) -> Result<Option<CustomFont>> {
    let Some(source) = rfd::FileDialog::new()
        .add_filter("字体文件", &["ttf", "otf", "woff", "woff2"])
        .pick_file()
    else {
        return Ok(None);
    };
    let app_data = crate::app_dir(app)?;
    import_font_file(connection, font_id, &source, &app_data).map(Some)
}

fn import_font_file(
    connection: &Connection,
    font_id: &str,
    source: &Path,
    app_data: &Path,
) -> Result<CustomFont> {
    if !valid_id(font_id) {
        return Err("字体标识无效".into());
    }
    let format = source
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !["ttf", "otf", "woff", "woff2"].contains(&format.as_str()) {
        return Err("仅支持 TTF、OTF、WOFF 和 WOFF2 字体文件".into());
    }
    validate_font_file(&source, &format)?;
    let family = format!("custom-font-{font_id}");
    let already_exists: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM custom_fonts WHERE id=?1 OR family=?2)",
            params![font_id, family],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if already_exists {
        return Err("这个字体标识已经使用".into());
    }

    let font_dir = app_data.join("fonts");
    fs::create_dir_all(&font_dir).map_err(|error| error.to_string())?;
    let destination = font_dir.join(format!("{font_id}.{format}"));
    let temporary = font_dir.join(format!("{font_id}.importing"));
    if let Err(error) = fs::copy(source, &temporary) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    if let Err(error) = fs::rename(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }

    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("自定义字体")
        .trim();
    let name = unique_font_name(
        connection,
        if stem.is_empty() {
            "自定义字体"
        } else {
            stem
        },
    )?;
    let created_at = now_ms();
    let font = CustomFont {
        id: font_id.into(),
        name,
        family,
        file_path: destination.to_string_lossy().into_owned(),
        format,
        created_at,
    };
    if let Err(error) = connection.execute(
        "INSERT INTO custom_fonts(id,name,family,file_path,format,created_at) VALUES(?1,?2,?3,?4,?5,?6)",
        params![font.id, font.name, font.family, font.file_path, font.format, font.created_at],
    ) {
        let _ = fs::remove_file(&destination);
        return Err(error.to_string());
    }
    Ok(font)
}

pub fn delete_font_record(connection: &mut Connection, font_id: &str) -> Result<Option<PathBuf>> {
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let font: Option<(String, String)> = transaction
        .query_row(
            "SELECT file_path,family FROM custom_fonts WHERE id=?1",
            [font_id],
            |row| Ok((row.get(0)?,row.get(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((file_path,family)) = font else {
        return Ok(None);
    };
    let has_asset_text: bool = transaction.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='asset_text_elements')",[],|r|r.get(0)).map_err(|e|e.to_string())?;
    if has_asset_text { transaction.execute("UPDATE asset_text_elements SET font_family=?1,updated_at=?2 WHERE font_family=?3",params![DEFAULT_FONT_FAMILY,now_ms(),family]).map_err(|e|e.to_string())?; }
    else {transaction.execute("UPDATE canvas_text_blocks SET font_family=?1,updated_at=?2 WHERE font_family=?3",params![DEFAULT_FONT_FAMILY,now_ms(),family]).map_err(|e|e.to_string())?;}
    let has_category_text: bool = transaction.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='category_text_blocks')",[],|r|r.get(0)).map_err(|e|e.to_string())?;
    if has_category_text {transaction.execute("UPDATE category_text_blocks SET payload=json_set(payload,'$.fontFamily',?1,'$.updatedAt',?2) WHERE json_extract(payload,'$.fontFamily')=?3",params![DEFAULT_FONT_FAMILY,now_ms(),family]).map_err(|e|e.to_string())?;}
    transaction
        .execute("DELETE FROM custom_fonts WHERE id=?1", [font_id])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
    Ok(Some(PathBuf::from(file_path)))
}

fn unique_font_name(connection: &Connection, base: &str) -> Result<String> {
    let mut suffix = 1_u32;
    loop {
        let candidate = if suffix == 1 {
            base.to_string()
        } else {
            format!("{base} ({suffix})")
        };
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM custom_fonts WHERE name=?1 COLLATE NOCASE)",
                [&candidate],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !exists {
            return Ok(candidate);
        }
        suffix += 1;
    }
}

fn validate_font_file(path: &Path, format: &str) -> Result<()> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if metadata.len() < 4 || metadata.len() > 100 * 1024 * 1024 {
        return Err("字体文件必须在 4 字节到 100 MB 之间".into());
    }
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut signature = [0_u8; 4];
    file.read_exact(&mut signature)
        .map_err(|error| error.to_string())?;
    let valid = match format {
        "ttf" => signature == [0, 1, 0, 0] || &signature == b"true" || &signature == b"typ1",
        "otf" => &signature == b"OTTO",
        "woff" => &signature == b"wOFF",
        "woff2" => &signature == b"wOF2",
        _ => false,
    };
    if !valid {
        return Err("文件扩展名与字体文件格式不匹配".into());
    }
    Ok(())
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
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

    #[test]
    fn migration_moves_legacy_text_into_the_dedicated_table() {
        let connection = test_db();
        connection
            .execute(
                "INSERT INTO asset_inner_canvas(asset_id,object_id,object_type,text_value,x,y,width,height,font_size,bold)
                 VALUES('asset-a','old-note','text','保留内容',12,24,300,140,22,1)",
                [],
            )
            .unwrap();

        migrate(&connection).unwrap();

        let blocks = list_blocks(&connection).unwrap();
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].content, "保留内容");
        assert_eq!(
            (blocks[0].x, blocks[0].y, blocks[0].width, blocks[0].height),
            (12.0, 24.0, 300.0, 140.0)
        );
        assert_eq!(blocks[0].font_weight, 700);
        let old_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM asset_inner_canvas WHERE object_type='text'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(old_count, 0);
    }

    #[test]
    fn snapshot_preserves_world_coordinates_and_deletes_removed_blocks() {
        let mut connection = test_db();
        migrate(&connection).unwrap();
        let mut first = block("asset-a", "text-a");
        first.x = -340.5;
        first.y = 818.25;
        save_blocks_snapshot(&mut connection, "asset-a", vec![first.clone()]).unwrap();

        let saved = list_blocks(&connection).unwrap();
        assert_eq!(
            (saved[0].x, saved[0].y, saved[0].width),
            (-340.5, 818.25, 280.0)
        );
        assert!(saved[0].updated_at >= 1);

        save_blocks_snapshot(&mut connection, "asset-a", Vec::new()).unwrap();
        assert!(list_blocks(&connection).unwrap().is_empty());
    }

    #[test]
    fn removing_a_font_falls_back_existing_blocks_before_removing_the_record() {
        let mut connection = test_db();
        migrate(&connection).unwrap();
        connection
            .execute(
                "INSERT INTO custom_fonts(id,name,family,file_path,format,created_at)
                 VALUES('font-a','Test Font','custom-font-font-a','C:/fonts/test.woff2','woff2',1)",
                [],
            )
            .unwrap();
        let mut item = block("asset-a", "text-a");
        item.font_family = "custom-font-font-a".into();
        save_blocks_snapshot(&mut connection, "asset-a", vec![item]).unwrap();

        let path = delete_font_record(&mut connection, "font-a").unwrap();

        assert_eq!(path, Some(PathBuf::from("C:/fonts/test.woff2")));
        assert_eq!(
            list_blocks(&connection).unwrap()[0].font_family,
            DEFAULT_FONT_FAMILY
        );
        assert!(list_fonts(&connection).unwrap().is_empty());
    }

    #[test]
    fn imported_font_is_copied_registered_and_can_be_removed_with_fallback() {
        let mut connection = test_db();
        migrate(&connection).unwrap();
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("demo.woff2");
        fs::write(&source, b"wOF2fake-font-data").unwrap();

        let font = import_font_file(&connection, "font-demo", &source, temp.path()).unwrap();

        assert_eq!(font.format, "woff2");
        assert_eq!(font.name, "demo");
        assert!(Path::new(&font.file_path).is_file());
        assert_eq!(list_fonts(&connection).unwrap()[0].family, font.family);

        let mut item = block("asset-a", "text-demo");
        item.font_family = font.family.clone();
        save_blocks_snapshot(&mut connection, "asset-a", vec![item]).unwrap();
        let path = delete_font_record(&mut connection, &font.id)
            .unwrap()
            .unwrap();
        fs::remove_file(path).unwrap();
        assert_eq!(
            list_blocks(&connection).unwrap()[0].font_family,
            DEFAULT_FONT_FAMILY
        );
        assert!(list_fonts(&connection).unwrap().is_empty());
    }

    #[test]
    fn text_blocks_restore_all_styles_after_reopening_the_database() {
        let temp = tempfile::tempdir().unwrap();
        let database_path = temp.path().join("inner-canvas.sqlite3");
        {
            let mut connection = Connection::open(&database_path).unwrap();
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
                 INSERT INTO assets(id) VALUES('asset-restart');",
            )
            .unwrap();
            migrate(&connection).unwrap();
            let mut saved = block("asset-restart", "text-restart");
            saved.style_type = "panel".into();
            saved.title = "参数记录".into();
            saved.x = -752.25;
            saved.y = 1034.5;
            saved.width = 512.0;
            saved.height = 288.0;
            saved.font_family = "Georgia".into();
            saved.font_size = 23;
            saved.font_weight = 700;
            saved.text_color = "#112233".into();
            saved.text_align = "center".into();
            saved.line_height = 1.7;
            saved.border_enabled = true;
            saved.border_color = "#abcdef".into();
            saved.border_width = 2.5;
            saved.border_radius = 12.0;
            saved.background_color = "#fedcba".into();
            saved.background_opacity = 73.0;
            saved.shadow = true;
            save_blocks_snapshot(&mut connection, "asset-restart", vec![saved]).unwrap();
        }

        let connection = Connection::open(&database_path).unwrap();
        migrate(&connection).unwrap();
        let restored = list_blocks(&connection).unwrap();
        assert_eq!(restored.len(), 1);
        let restored = &restored[0];
        assert_eq!(restored.style_type, "panel");
        assert_eq!(restored.title, "参数记录");
        assert_eq!(restored.content, "第一行\nsecond line");
        assert_eq!(
            (restored.x, restored.y, restored.width, restored.height),
            (-752.25, 1034.5, 512.0, 288.0)
        );
        assert_eq!(
            (
                restored.font_family.as_str(),
                restored.font_size,
                restored.font_weight
            ),
            ("Georgia", 23, 700)
        );
        assert_eq!(
            (
                restored.text_color.as_str(),
                restored.text_align.as_str(),
                restored.line_height
            ),
            ("#112233", "center", 1.7)
        );
        assert!(restored.border_enabled && restored.shadow);
        assert_eq!(
            (
                restored.border_color.as_str(),
                restored.border_width,
                restored.border_radius
            ),
            ("#abcdef", 2.5, 12.0)
        );
        assert_eq!(
            (
                restored.background_color.as_str(),
                restored.background_opacity
            ),
            ("#fedcba", 73.0)
        );
    }
}
