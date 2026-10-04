mod canvas_transform;
mod asset_text;
mod category_text;
use base64::{engine::general_purpose::STANDARD, Engine};
use image::ImageFormat;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Child, Command},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

type Result<T> = std::result::Result<T, String>;

mod asset_note_drawers;
mod inner_canvas_text;
use inner_canvas_text::CustomFont;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Workspace {
    id: String,
    name: String,
    description: String,
    cover_path: String,
    notes: String,
    created_at: i64,
    updated_at: i64,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ScriptCategory {
    id: String,
    name: String,
    description: String,
    scripts: Value,
    created_at: i64,
    updated_at: i64,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Category {
    id: String,
    workspace_id: String,
    name: String,
    description: String,
    icon: String,
    created_at: i64,
    updated_at: i64,
    viewport_x: f64,
    viewport_y: f64,
    zoom: f64,
    #[serde(default)]
    canvas_color: String,
    #[serde(default)]
    canvas_pattern: String,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Asset {
    id: String,
    category_id: String,
    workspace_id: String,
    name: String,
    description: String,
    storage_mode: String,
    source_file_path: String,
    original_file_path: String,
    cover_storage_mode: String,
    cover_source_path: String,
    cover_original_path: String,
    cover_image_path: String,
    preview_path: String,
    thumbnail_path: String,
    file_path: String,
    tags: Vec<String>,
    notes: String,
    created_at: i64,
    updated_at: i64,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i64,
    locked: bool,
    group_id: Option<String>,
    detail_view_mode: Option<String>,
    missing: bool,
    #[serde(default)]
    rotation: f64,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CanvasGroup {
    id: String,
    category_id: String,
    name: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i64,
    locked: bool,
    collapsed: bool,
    border_color: String,
    background_color: String,
    background_opacity: i64,
    created_at: i64,
    updated_at: i64,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Prompt {
    id: String,
    asset_id: String,
    prompt_type: String,
    positive_prompt: String,
    negative_prompt: String,
    natural_prompt: String,
    content: String,
    selected_image_path: String,
    sample_storage_mode: String,
    sample_source_path: String,
    sample_original_path: String,
    sample_image_path: String,
    sample_file_name: String,
    metadata_json: String,
    title: String,
    notes: String,
    created_at: i64,
    updated_at: i64,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AssetInnerCanvasObject {
    asset_id: String,
    object_id: String,
    object_type: String,
    source_prompt_id: Option<String>,
    field_key: String,
    text_value: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i64,
    locked: bool,
    group_id: Option<String>,
    font_size: u32,
    bold: bool,
    #[serde(default)]
    rotation: f64,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AssetInnerCanvasViewport {
    asset_id: String,
    viewport_x: f64,
    viewport_y: f64,
    zoom: f64,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AssetInnerCanvasAppearance {
    asset_id: String,
    color: String,
    pattern: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromptContentUpdate {
    id: String,
    prompt_type: String,
    title: String,
    positive_prompt: String,
    negative_prompt: String,
    natural_prompt: String,
    content: String,
    notes: String,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Settings {
    startup_page: String,
    restore_workspace: bool,
    auto_save: bool,
    auto_save_interval: u32,
    confirm_delete: bool,
    close_behavior: String,
    theme: String,
    ui_scale: u32,
    ui_density: String,
    canvas_background: String,
    canvas_background_color: String,
    background_opacity: u32,
    asset_name_display: String,
    show_asset_tags: bool,
    show_image_shadow: bool,
    show_selection_border: bool,
    new_asset_max_edge: u32,
    immersive_shortcut: String,
    show_performance: bool,
    verbose_logs: bool,
    last_page: String,
    default_import_mode: String,
    ask_import_mode: bool,
    managed_asset_dir: String,
    auto_preview: bool,
    auto_thumbnail: bool,
    preview_max_edge: u32,
    thumbnail_max_edge: u32,
    migration_completed: bool,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ShortcutBinding {
    action_id: String,
    shortcut: String,
    is_custom: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct State {
    workspaces: Vec<Workspace>,
    script_categories: Vec<ScriptCategory>,
    categories: Vec<Category>,
    assets: Vec<Asset>,
    groups: Vec<CanvasGroup>,
    prompts: Vec<Prompt>,
    inner_canvas_objects: Vec<AssetInnerCanvasObject>,
    inner_canvas_viewports: Vec<AssetInnerCanvasViewport>,
    inner_canvas_appearances: Vec<AssetInnerCanvasAppearance>,
    category_text_blocks: Vec<category_text::CategoryTextBlock>,
    asset_text_elements: Vec<asset_text::AssetTextElement>,
    asset_text_layouts: Vec<asset_text::AssetTextLayout>,
    custom_fonts: Vec<CustomFont>,
    settings: Settings,
    shortcut_bindings: Vec<ShortcutBinding>,
    cache_bytes: u64,
    database_path: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssetInput {
    id: String,
    category_id: String,
    workspace_id: String,
    name: String,
    description: String,
    storage_mode: String,
    selected_file_path: String,
    source_file_path: String,
    original_file_path: String,
    cover_storage_mode: String,
    selected_cover_path: String,
    cover_source_path: String,
    cover_original_path: String,
    use_source_as_cover: bool,
    file_path: String,
    tags: Vec<String>,
    notes: String,
    created_at: i64,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i64,
    locked: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Layout {
    asset_id: String,
    category_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i64,
    locked: bool,
    #[serde(default)]
    rotation: f64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CanvasGroupInput {
    id: String,
    category_id: String,
    name: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i64,
    locked: bool,
    collapsed: bool,
    border_color: String,
    background_color: String,
    background_opacity: i64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewCanvasGroup {
    group: CanvasGroupInput,
    asset_ids: Vec<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Legacy {
    workspaces: Vec<Value>,
    script_categories: Vec<Value>,
    categories: Vec<Value>,
    assets: Vec<Value>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationResult {
    success: bool,
    migrated: usize,
    errors: Vec<String>,
    log_path: String,
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
fn app_dir(app: &AppHandle) -> Result<PathBuf> {
    #[cfg(debug_assertions)]
    if let Some(path)=std::env::var_os("CREATIVE_CLOTH_TEST_DATA_DIR") {
        let p=PathBuf::from(path);
        if !p.is_absolute() {return Err("测试数据目录必须使用绝对路径".into());}
        fs::create_dir_all(&p).map_err(|e|e.to_string())?;
        return Ok(p);
    }
    let p = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}
fn db_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app_dir(app)?.join("script-collection.sqlite3"))
}
fn db(app: &AppHandle) -> Result<Connection> {
    let c = Connection::open(db_path(app)?).map_err(|e| e.to_string())?;
    c.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e|e.to_string())?;
    init(&c, app)?;
    inner_canvas_text::migrate(&c)?;
    asset_text::migrate(&c)?;
    category_text::migrate(&c)?;
    canvas_transform::migrate(&c)?;
    Ok(c)
}
fn init(c: &Connection, app: &AppHandle) -> Result<()> {
    c.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',cover_path TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS script_categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',scripts TEXT NOT NULL DEFAULT '[]',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',icon TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,category_id TEXT NOT NULL,workspace_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',storage_mode TEXT NOT NULL CHECK(storage_mode IN('managed','reference')),source_path TEXT NOT NULL DEFAULT '',original_path TEXT NOT NULL DEFAULT '',preview_path TEXT NOT NULL DEFAULT '',thumbnail_path TEXT NOT NULL DEFAULT '',file_path TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '[]',notes TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT,FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS asset_prompts(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL,prompt_type TEXT NOT NULL,positive_prompt TEXT NOT NULL DEFAULT '',negative_prompt TEXT NOT NULL DEFAULT '',natural_prompt TEXT NOT NULL DEFAULT '',content TEXT NOT NULL DEFAULT '',image_path TEXT NOT NULL DEFAULT '',title TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS asset_inner_canvas(asset_id TEXT NOT NULL,object_id TEXT NOT NULL,object_type TEXT NOT NULL CHECK(object_type IN('sample','prompt','note','text')),source_prompt_id TEXT,field_key TEXT NOT NULL DEFAULT '',text_value TEXT NOT NULL DEFAULT '',x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,z_index INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0,group_id TEXT,font_size INTEGER NOT NULL DEFAULT 14,bold INTEGER NOT NULL DEFAULT 0,rotation REAL NOT NULL DEFAULT 0,PRIMARY KEY(asset_id,object_id),FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE,FOREIGN KEY(source_prompt_id) REFERENCES asset_prompts(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS asset_inner_canvas_viewports(asset_id TEXT PRIMARY KEY,viewport_x REAL NOT NULL DEFAULT 80,viewport_y REAL NOT NULL DEFAULT 70,zoom REAL NOT NULL DEFAULT 1,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS canvas_groups(id TEXT PRIMARY KEY,category_id TEXT NOT NULL,name TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,z_index INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0,collapsed INTEGER NOT NULL DEFAULT 0,border_color TEXT NOT NULL DEFAULT '#6A8CC7',background_color TEXT NOT NULL DEFAULT '#6A8CC7',background_opacity INTEGER NOT NULL DEFAULT 4,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS canvas_layout(asset_id TEXT PRIMARY KEY,category_id TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,z_index INTEGER NOT NULL,locked INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS category_viewports(category_id TEXT PRIMARY KEY,viewport_x REAL NOT NULL DEFAULT 80,viewport_y REAL NOT NULL DEFAULT 70,zoom REAL NOT NULL DEFAULT 1,FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS category_canvas_preferences(category_id TEXT PRIMARY KEY,color TEXT NOT NULL,pattern TEXT NOT NULL,FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS asset_inner_canvas_preferences(asset_id TEXT PRIMARY KEY,color TEXT NOT NULL,pattern TEXT NOT NULL,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS shortcut_bindings(action_id TEXT PRIMARY KEY,shortcut TEXT NOT NULL,is_custom INTEGER NOT NULL DEFAULT 1);").map_err(|e|e.to_string())?;
    asset_note_drawers::migrate(c)?;
    let _ = c.execute(
        "ALTER TABLE assets ADD COLUMN detail_view_mode TEXT CHECK(detail_view_mode IS NULL OR detail_view_mode IN('standard','canvas'))",
        [],
    );
    c.execute(
        "CREATE INDEX IF NOT EXISTS idx_asset_inner_canvas_source_prompt ON asset_inner_canvas(source_prompt_id)",
        [],
    )
    .map_err(|e| e.to_string())?;
    let _ = c.execute(
        "ALTER TABLE canvas_layout ADD COLUMN group_id TEXT REFERENCES canvas_groups(id) ON DELETE SET NULL",
        [],
    );
    c.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_canvas_groups_category ON canvas_groups(category_id); CREATE INDEX IF NOT EXISTS idx_canvas_layout_group ON canvas_layout(group_id);",
    )
    .map_err(|e| e.to_string())?;
    let _ = c.execute(
        "ALTER TABLE assets ADD COLUMN cover_storage_mode TEXT NOT NULL DEFAULT 'managed'",
        [],
    );
    let _ = c.execute(
        "ALTER TABLE assets ADD COLUMN cover_source_path TEXT NOT NULL DEFAULT ''",
        [],
    );
    let _ = c.execute(
        "ALTER TABLE assets ADD COLUMN cover_original_path TEXT NOT NULL DEFAULT ''",
        [],
    );
    c.execute("UPDATE assets SET cover_storage_mode=storage_mode,cover_source_path=CASE WHEN storage_mode='reference' THEN source_path ELSE cover_source_path END,cover_original_path=CASE WHEN storage_mode='managed' THEN original_path ELSE cover_original_path END WHERE cover_source_path='' AND cover_original_path='' AND (preview_path<>'' OR thumbnail_path<>'')", []).map_err(|e|e.to_string())?;
    let _ = c.execute("ALTER TABLE asset_prompts ADD COLUMN sample_storage_mode TEXT NOT NULL DEFAULT 'reference'", []);
    let _ = c.execute(
        "ALTER TABLE asset_prompts ADD COLUMN sample_source_path TEXT NOT NULL DEFAULT ''",
        [],
    );
    let _ = c.execute(
        "ALTER TABLE asset_prompts ADD COLUMN sample_original_path TEXT NOT NULL DEFAULT ''",
        [],
    );
    let _ = c.execute(
        "ALTER TABLE asset_prompts ADD COLUMN sample_file_name TEXT NOT NULL DEFAULT ''",
        [],
    );
    let _ = c.execute(
        "ALTER TABLE asset_prompts ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'",
        [],
    );
    c.execute("UPDATE asset_prompts SET sample_source_path=image_path WHERE sample_source_path='' AND sample_original_path='' AND image_path<>''", []).map_err(|e|e.to_string())?;
    let managed = app_dir(app)?.join("assets").to_string_lossy().to_string();
    for (k, v) in [
        ("default_import_mode", "managed".into()),
        ("ask_import_mode", "true".into()),
        ("managed_asset_dir", managed),
        ("auto_preview", "true".into()),
        ("auto_thumbnail", "true".into()),
        ("preview_max_edge", "2048".into()),
        ("thumbnail_max_edge", "600".into()),
        ("migration_completed", "false".into()),
        ("startup_page", "home".into()),
        ("restore_workspace", "true".into()),
        ("auto_save", "true".into()),
        ("auto_save_interval", "30".into()),
        ("confirm_delete", "true".into()),
        ("close_behavior", "exit".into()),
        ("theme", "system".into()),
        ("ui_scale", "100".into()),
        ("ui_density", "standard".into()),
        ("canvas_background", "dots".into()),
        ("canvas_background_color", "#f7f7f7".into()),
        ("background_opacity", "100".into()),
        ("asset_name_display", "always".into()),
        ("show_asset_tags", "true".into()),
        ("show_image_shadow", "true".into()),
        ("show_selection_border", "true".into()),
        ("new_asset_max_edge", "420".into()),
        ("immersive_shortcut", "Tab".into()),
        ("show_performance", "false".into()),
        ("verbose_logs", "false".into()),
        ("last_page", "home".into()),
    ] {
        c.execute(
            "INSERT OR IGNORE INTO app_settings(key,value) VALUES(?1,?2)",
            params![k, v],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn setting(c: &Connection, k: &str) -> String {
    c.query_row("SELECT value FROM app_settings WHERE key=?1", [k], |r| {
        r.get(0)
    })
    .unwrap_or_default()
}
fn settings(c: &Connection) -> Settings {
    Settings {
        startup_page: setting(c, "startup_page"),
        restore_workspace: setting(c, "restore_workspace") == "true",
        auto_save: setting(c, "auto_save") == "true",
        auto_save_interval: setting(c, "auto_save_interval").parse().unwrap_or(30),
        confirm_delete: setting(c, "confirm_delete") == "true",
        close_behavior: setting(c, "close_behavior"),
        theme: setting(c, "theme"),
        ui_scale: setting(c, "ui_scale").parse().unwrap_or(100),
        ui_density: setting(c, "ui_density"),
        canvas_background: setting(c, "canvas_background"),
        canvas_background_color: setting(c, "canvas_background_color"),
        background_opacity: setting(c, "background_opacity").parse().unwrap_or(100),
        asset_name_display: setting(c, "asset_name_display"),
        show_asset_tags: setting(c, "show_asset_tags") == "true",
        show_image_shadow: setting(c, "show_image_shadow") == "true",
        show_selection_border: setting(c, "show_selection_border") == "true",
        new_asset_max_edge: setting(c, "new_asset_max_edge").parse().unwrap_or(420),
        immersive_shortcut: setting(c, "immersive_shortcut"),
        show_performance: setting(c, "show_performance") == "true",
        verbose_logs: setting(c, "verbose_logs") == "true",
        last_page: setting(c, "last_page"),
        default_import_mode: setting(c, "default_import_mode"),
        ask_import_mode: setting(c, "ask_import_mode") == "true",
        managed_asset_dir: setting(c, "managed_asset_dir"),
        auto_preview: setting(c, "auto_preview") == "true",
        auto_thumbnail: setting(c, "auto_thumbnail") == "true",
        preview_max_edge: setting(c, "preview_max_edge").parse().unwrap_or(2048),
        thumbnail_max_edge: setting(c, "thumbnail_max_edge").parse().unwrap_or(600),
        migration_completed: setting(c, "migration_completed") == "true",
    }
}
fn valid_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].bytes().all(|b| b.is_ascii_hexdigit())
}
#[tauri::command]
fn get_startup_theme(app: AppHandle) -> Result<String> {
    let value = setting(&db(&app)?, "theme");
    Ok(if ["system", "light", "dark"].contains(&value.as_str()) {
        value
    } else {
        "system".into()
    })
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<()> {
    let window = app.get_webview_window("main").ok_or("主窗口不可用")?;
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(target_os = "windows")]
fn windows_uses_dark_apps() -> bool {
    Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
            "/v",
            "AppsUseLightTheme",
        ])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| {
            String::from_utf8_lossy(&output.stdout)
                .to_ascii_lowercase()
                .lines()
                .any(|line| line.contains("appsuselighttheme") && line.trim_end().ends_with("0x0"))
        })
        .unwrap_or(false)
}
fn native_theme_color(theme: &str) -> tauri::webview::Color {
    #[cfg(target_os = "windows")]
    let dark = theme == "dark" || (theme == "system" && windows_uses_dark_apps());
    #[cfg(not(target_os = "windows"))]
    let dark = theme == "dark";
    if dark {
        tauri::webview::Color(23, 24, 27, 255)
    } else {
        tauri::webview::Color(246, 246, 246, 255)
    }
}
fn dir_size(p: &Path) -> u64 {
    fs::read_dir(p)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .map(|e| {
            if e.path().is_dir() {
                dir_size(&e.path())
            } else {
                e.metadata().map(|m| m.len()).unwrap_or(0)
            }
        })
        .sum()
}
fn all<T, F>(c: &Connection, sql: &str, mut f: F) -> Result<Vec<T>>
where
    F: FnMut(&rusqlite::Row) -> rusqlite::Result<T>,
{
    let mut s = c.prepare(sql).map_err(|e| e.to_string())?;
    let rows = s.query_map([], |r| f(r)).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

fn shortcut_bindings(c: &Connection) -> Result<Vec<ShortcutBinding>> {
    all(
        c,
        "SELECT action_id,shortcut,is_custom FROM shortcut_bindings ORDER BY action_id",
        |r| {
            Ok(ShortcutBinding {
                action_id: r.get(0)?,
                shortcut: r.get(1)?,
                is_custom: r.get::<_, i64>(2)? != 0,
            })
        },
    )
}

#[tauri::command]
fn load_app_state(app: AppHandle) -> Result<State> {
    let c = db(&app)?;
    let workspaces=all(&c,"SELECT id,name,description,cover_path,notes,created_at,updated_at FROM workspaces ORDER BY created_at",|r|Ok(Workspace{id:r.get(0)?,name:r.get(1)?,description:r.get(2)?,cover_path:r.get(3)?,notes:r.get(4)?,created_at:r.get(5)?,updated_at:r.get(6)?}))?;
    let script_categories=all(&c,"SELECT id,name,description,scripts,created_at,updated_at FROM script_categories ORDER BY created_at",|r|Ok(ScriptCategory{id:r.get(0)?,name:r.get(1)?,description:r.get(2)?,scripts:serde_json::from_str(&r.get::<_,String>(3)?).unwrap_or(Value::Array(vec![])),created_at:r.get(4)?,updated_at:r.get(5)?}))?;
    let categories=all(&c,"SELECT c.id,c.workspace_id,c.name,c.description,c.icon,c.created_at,c.updated_at,COALESCE(v.viewport_x,80),COALESCE(v.viewport_y,70),COALESCE(v.zoom,1),COALESCE(p.color,''),COALESCE(p.pattern,'') FROM categories c LEFT JOIN category_viewports v ON v.category_id=c.id LEFT JOIN category_canvas_preferences p ON p.category_id=c.id ORDER BY c.created_at",|r|Ok(Category{id:r.get(0)?,workspace_id:r.get(1)?,name:r.get(2)?,description:r.get(3)?,icon:r.get(4)?,created_at:r.get(5)?,updated_at:r.get(6)?,viewport_x:r.get(7)?,viewport_y:r.get(8)?,zoom:r.get(9)?,canvas_color:r.get(10)?,canvas_pattern:r.get(11)?}))?;
    let assets=all(&c,"SELECT a.id,a.category_id,a.workspace_id,a.name,a.description,a.storage_mode,a.source_path,a.original_path,a.cover_storage_mode,a.cover_source_path,a.cover_original_path,a.preview_path,a.thumbnail_path,a.file_path,a.tags,a.notes,a.created_at,a.updated_at,COALESCE(l.x,90),COALESCE(l.y,90),COALESCE(l.width,280),COALESCE(l.height,210),COALESCE(l.z_index,1),COALESCE(l.locked,0),l.group_id,a.detail_view_mode,COALESCE(l.rotation,0) FROM assets a LEFT JOIN canvas_layout l ON l.asset_id=a.id ORDER BY a.created_at",|r|{let mode:String=r.get(5)?;let source:String=r.get(6)?;let original:String=r.get(7)?;let cover_mode:String=r.get(8)?;let cover_source:String=r.get(9)?;let cover_original:String=r.get(10)?;let missing={let actual=if mode=="managed"{&original}else{&source};!actual.is_empty()&&!Path::new(actual).exists()};let cover=if cover_mode=="managed"{cover_original.clone()}else{cover_source.clone()};Ok(Asset{id:r.get(0)?,category_id:r.get(1)?,workspace_id:r.get(2)?,name:r.get(3)?,description:r.get(4)?,storage_mode:mode,source_file_path:source,original_file_path:original,cover_storage_mode:cover_mode,cover_source_path:cover_source,cover_original_path:cover_original,cover_image_path:cover,preview_path:r.get(11)?,thumbnail_path:r.get(12)?,file_path:r.get(13)?,tags:serde_json::from_str(&r.get::<_,String>(14)?).unwrap_or_default(),notes:r.get(15)?,created_at:r.get(16)?,updated_at:r.get(17)?,x:r.get(18)?,y:r.get(19)?,width:r.get(20)?,height:r.get(21)?,z_index:r.get(22)?,locked:r.get::<_,i64>(23)?!=0,group_id:r.get(24)?,detail_view_mode:r.get(25)?,rotation:r.get(26)?,missing})})?;
    let groups=all(&c,"SELECT id,category_id,name,x,y,width,height,z_index,locked,collapsed,border_color,background_color,background_opacity,created_at,updated_at FROM canvas_groups ORDER BY z_index,id",|r|Ok(CanvasGroup{id:r.get(0)?,category_id:r.get(1)?,name:r.get(2)?,x:r.get(3)?,y:r.get(4)?,width:r.get(5)?,height:r.get(6)?,z_index:r.get(7)?,locked:r.get::<_,i64>(8)?!=0,collapsed:r.get::<_,i64>(9)?!=0,border_color:r.get(10)?,background_color:r.get(11)?,background_opacity:r.get(12)?,created_at:r.get(13)?,updated_at:r.get(14)?}))?;
    let prompts = all(
        &c,
        "SELECT id,asset_id,prompt_type,positive_prompt,negative_prompt,natural_prompt,content,title,notes,created_at,updated_at,sample_storage_mode,sample_source_path,sample_original_path,sample_file_name,metadata_json FROM asset_prompts ORDER BY created_at",
        |r| {
            let mode: String = r.get(11)?;
            let source: String = r.get(12)?;
            let original: String = r.get(13)?;
            let image = if mode == "managed" {
                original.clone()
            } else {
                source.clone()
            };
            Ok(Prompt {
                id: r.get(0)?,
                asset_id: r.get(1)?,
                prompt_type: r.get(2)?,
                positive_prompt: r.get(3)?,
                negative_prompt: r.get(4)?,
                natural_prompt: r.get(5)?,
                content: r.get(6)?,
                title: r.get(7)?,
                notes: r.get(8)?,
                created_at: r.get(9)?,
                updated_at: r.get(10)?,
                selected_image_path: String::new(),
                sample_storage_mode: mode,
                sample_source_path: source,
                sample_original_path: original,
                sample_image_path: image,
                sample_file_name: r.get(14)?,
                metadata_json: r.get(15)?,
            })
        },
    )?;
    let inner_canvas_objects = all(
        &c,
        "SELECT asset_id,object_id,object_type,source_prompt_id,field_key,text_value,x,y,width,height,z_index,locked,group_id,font_size,bold,rotation FROM asset_inner_canvas ORDER BY z_index,object_id",
        |r| Ok(AssetInnerCanvasObject {
            asset_id: r.get(0)?,
            object_id: r.get(1)?,
            object_type: r.get(2)?,
            source_prompt_id: r.get(3)?,
            field_key: r.get(4)?,
            text_value: r.get(5)?,
            x: r.get(6)?,
            y: r.get(7)?,
            width: r.get(8)?,
            height: r.get(9)?,
            z_index: r.get(10)?,
            locked: r.get::<_, i64>(11)? != 0,
            group_id: r.get(12)?,
            font_size: r.get::<_, i64>(13)?.clamp(10, 64) as u32,
            bold: r.get::<_, i64>(14)? != 0,
            rotation: r.get(15)?,
        }),
    )?;
    let inner_canvas_viewports = all(
        &c,
        "SELECT asset_id,viewport_x,viewport_y,zoom FROM asset_inner_canvas_viewports",
        |r| {
            Ok(AssetInnerCanvasViewport {
                asset_id: r.get(0)?,
                viewport_x: r.get(1)?,
                viewport_y: r.get(2)?,
                zoom: r.get(3)?,
            })
        },
    )?;
    let inner_canvas_appearances = all(&c, "SELECT asset_id,color,pattern FROM asset_inner_canvas_preferences", |r| Ok(AssetInnerCanvasAppearance { asset_id: r.get(0)?, color: r.get(1)?, pattern: r.get(2)? }))?;
    let category_text_blocks = category_text::list(&c)?;
    let asset_text_elements = asset_text::list_elements(&c)?;
    let asset_text_layouts = asset_text::list_layouts(&c)?;
    let custom_fonts = inner_canvas_text::list_fonts(&c)?;
    Ok(State {
        workspaces,
        script_categories,
        categories,
        assets,
        groups,
        prompts,
        inner_canvas_objects,
        inner_canvas_viewports,
        inner_canvas_appearances,
        category_text_blocks,
        asset_text_elements,
        asset_text_layouts,
        custom_fonts,
        settings: settings(&c),
        shortcut_bindings: shortcut_bindings(&c)?,
        cache_bytes: dir_size(&app_dir(&app)?.join("cache")),
        database_path: db_path(&app)?.to_string_lossy().into(),
    })
}

#[tauri::command]
fn pick_asset_file() -> Option<String> {
    rfd::FileDialog::new()
        .pick_file()
        .map(|p| p.to_string_lossy().into())
}
#[tauri::command]
fn pick_script_file() -> Option<String> {
    // Do not constrain this picker to a hard-coded extension list. Categories
    // and launchers are user-defined, so an uncommon executable file must still
    // be selectable.
    rfd::FileDialog::new()
        .pick_file()
        .map(|p| p.to_string_lossy().into())
}

#[tauri::command]
fn launch_script(file_path: String, launch_command: String, launch_args: String) -> Result<()> {
    start_script(&file_path, &launch_command, &launch_args).map(|_| ())
}

fn start_script(file_path: &str, launch_command: &str, launch_args: &str) -> Result<Child> {
    let file_path = file_path.trim();
    let launch_command = launch_command.trim();
    let launch_args = launch_args.trim();
    if file_path.is_empty() && launch_command.is_empty() {
        return Err("脚本文件路径或启动命令不能为空".into());
    }
    if launch_command.is_empty() && !Path::new(file_path).exists() {
        return Err(format!("脚本文件不存在：{file_path}"));
    }

    #[cfg(target_os = "windows")]
    {
        let parsed_args = parse_launch_args(launch_args);
        let mut command = if !launch_command.is_empty() {
            let mut value = Command::new("cmd.exe");
            value.args(["/D", "/S", "/C", &format!("{launch_command} {launch_args}")]);
            value
        } else {
            let extension = Path::new(file_path)
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            match extension.as_str() {
                "ps1" => {
                    let mut value = Command::new("powershell.exe");
                    value.args([
                        "-NoLogo",
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        file_path,
                    ]);
                    value.args(&parsed_args);
                    value
                }
                "py" => {
                    let mut value = Command::new("py.exe");
                    value.arg(file_path).args(&parsed_args);
                    value
                }
                "bat" | "cmd" => {
                    let mut value = Command::new("cmd.exe");
                    value.args(["/D", "/C", file_path]).args(&parsed_args);
                    value
                }
                _ => {
                    let mut value = Command::new(file_path);
                    value.args(&parsed_args);
                    value
                }
            }
        };
        if !file_path.is_empty() {
            if let Some(parent) = Path::new(file_path).parent() {
                command.current_dir(parent);
            }
        }
        return command
            .spawn()
            .map_err(|error| format!("启动失败：{error}"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let executable = if launch_command.is_empty() {
            file_path
        } else {
            launch_command
        };
        Command::new(executable)
            .args(launch_args.split_whitespace())
            .spawn()
            .map_err(|error| format!("启动失败：{error}"))
    }
}

fn parse_launch_args(value: &str) -> Vec<String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for character in value.chars() {
        match character {
            '"' => quoted = !quoted,
            character if character.is_whitespace() && !quoted => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            character => current.push(character),
        }
    }
    if !current.is_empty() {
        args.push(current);
    }
    args
}
#[tauri::command]
fn pick_cover_image() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter(
            "封面图片",
            &["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"],
        )
        .pick_file()
        .map(|p| p.to_string_lossy().into())
}
#[tauri::command]
fn save_clipboard_sample_image(
    app: AppHandle,
    bytes: Vec<u8>,
    extension: String,
) -> Result<String> {
    if bytes.is_empty() {
        return Err("剪贴板中没有可用图片".into());
    }
    image::load_from_memory(&bytes).map_err(|_| "剪贴板内容不是受支持的图片".to_string())?;
    let ext = match extension.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg",
        "webp" => "webp",
        _ => "png",
    };
    let path = app_dir(&app)?
        .join("imports")
        .join(format!("clipboard-{}.{}", now(), ext));
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, bytes).map_err(|e| format!("剪贴板图片保存失败：{e}"))?;
    Ok(path.to_string_lossy().into())
}
#[tauri::command]
fn pick_directory() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|p| p.to_string_lossy().into())
}
#[tauri::command]
fn save_workspace(app: AppHandle, item: Workspace) -> Result<Workspace> {
    let c = db(&app)?;
    c.execute("INSERT INTO workspaces VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET name=?2,description=?3,cover_path=?4,notes=?5,updated_at=?7",params![item.id,item.name,item.description,item.cover_path,item.notes,item.created_at,item.updated_at]).map_err(|e|e.to_string())?;
    Ok(item)
}
#[tauri::command]
fn delete_workspace(app: AppHandle, id: String, delete_managed: bool) -> Result<()> {
    let mut c = db(&app)?;
    // Collect before removing the database rows.  Reference paths are deliberately
    // never selected here, so this command can never remove a user's source file.
    let managed: Vec<(String, String)> = c
        .prepare(
            "SELECT id,original_path FROM assets WHERE workspace_id=?1 AND storage_mode='managed'",
        )
        .map_err(|e| e.to_string())?
        .query_map([&id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    delete_workspace_rows(&mut c, &id)?;
    drop(c);

    let managed_root = PathBuf::from(settings(&db(&app)?).managed_asset_dir);
    for (asset_id, path) in managed {
        let _ = fs::remove_dir_all(app_dir(&app)?.join("cache").join(&asset_id));
        if delete_managed && !path.is_empty() {
            if let Some(parent) = Path::new(&path).parent() {
                if parent.starts_with(&managed_root) {
                    fs::remove_dir_all(parent)
                        .map_err(|e| format!("模型记录已删除，但托管副本删除失败：{e}"))?;
                }
            }
        }
    }
    Ok(())
}
fn delete_workspace_rows(c: &mut Connection, id: &str) -> Result<()> {
    let tx = c.transaction().map_err(|e| e.to_string())?;
    // Deleting an entire workspace explicitly removes its categories and notes.
    tx.execute("DELETE FROM asset_note_drawers WHERE category_id IN (SELECT id FROM categories WHERE workspace_id=?1)", [id]).map_err(|e|e.to_string())?;
    tx.execute(
        "DELETE FROM asset_prompts WHERE asset_id IN (SELECT id FROM assets WHERE workspace_id=?1)",
        [id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM canvas_layout WHERE asset_id IN (SELECT id FROM assets WHERE workspace_id=?1)",
        [id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM category_viewports WHERE category_id IN (SELECT id FROM categories WHERE workspace_id=?1)", [id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM assets WHERE workspace_id=?1", [id])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM categories WHERE workspace_id=?1", [id])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM workspaces WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_script_category(app: AppHandle, item: ScriptCategory) -> Result<ScriptCategory> {
    let c = db(&app)?;
    c.execute("INSERT INTO script_categories VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET name=?2,description=?3,scripts=?4,updated_at=?6",params![item.id,item.name,item.description,item.scripts.to_string(),item.created_at,item.updated_at]).map_err(|e|e.to_string())?;
    Ok(item)
}
#[tauri::command]
fn save_category(app: AppHandle, item: Category) -> Result<Category> {
    let c = db(&app)?;
    c.execute("INSERT INTO categories VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET name=?3,description=?4,icon=?5,updated_at=?7",params![item.id,item.workspace_id,item.name,item.description,item.icon,item.created_at,item.updated_at]).map_err(|e|e.to_string())?;
    c.execute(
        "INSERT INTO category_viewports VALUES(?1,?2,?3,?4) ON CONFLICT(category_id) DO NOTHING",
        params![item.id, item.viewport_x, item.viewport_y, item.zoom],
    )
    .map_err(|e| e.to_string())?;
    Ok(item)
}
#[tauri::command]
fn delete_category(app: AppHandle, id: String) -> Result<()> {
    let c = db(&app)?;
    let n: i64 = c
        .query_row(
            "SELECT COUNT(*) FROM assets WHERE category_id=?1",
            [&id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if n > 0 {
        return Err(format!("该分类中仍有 {n} 个资产，请先移动或删除资产。"));
    }
    c.execute("DELETE FROM categories WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn cache_image(src: &Path, dst: &Path, max: u32) -> Result<String> {
    let img = image::open(src).map_err(|e| format!("无法读取图片：{e}"))?;
    let out = img.thumbnail(max, max);
    if let Some(p) = dst.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?
    }
    out.save_with_format(dst, ImageFormat::WebP)
        .map_err(|e| format!("缓存生成失败：{e}"))?;
    Ok(dst.to_string_lossy().into())
}
struct PreparedFiles {
    source_file: String,
    original_file: String,
    cover_source: String,
    cover_original: String,
    preview: String,
    thumbnail: String,
}

fn copy_exact(source: &Path, destination: &Path, label: &str) -> Result<()> {
    if source == destination {
        return Ok(());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("无法创建{label}目录：{e}"))?;
    }
    fs::copy(source, destination).map_err(|e| format!("{label}复制失败：{e}"))?;
    let source_size = fs::metadata(source).map_err(|e| e.to_string())?.len();
    let destination_size = fs::metadata(destination).map_err(|e| e.to_string())?.len();
    if source_size != destination_size {
        return Err(format!("{label}复制校验失败"));
    }
    Ok(())
}

fn prepare_files(app: &AppHandle, c: &Connection, a: &AssetInput) -> Result<PreparedFiles> {
    if a.storage_mode != "managed" && a.storage_mode != "reference" {
        return Err("存储方式无效".into());
    }
    if a.cover_storage_mode != "managed" && a.cover_storage_mode != "reference" {
        return Err("封面存储方式无效".into());
    }
    let selected = if !a.selected_file_path.is_empty() {
        a.selected_file_path.clone()
    } else if a.storage_mode == "reference" {
        a.source_file_path.clone()
    } else {
        a.original_file_path.clone()
    };
    if selected.is_empty() || !Path::new(&selected).exists() {
        return Err("请选择存在的原始文件".into());
    }
    let cfg = settings(c);
    let root = PathBuf::from(&cfg.managed_asset_dir).join(&a.id);
    fs::create_dir_all(&root).map_err(|e| format!("无法创建托管目录：{e}"))?;
    let (source_file, original_file) = if a.storage_mode == "reference" {
        (selected.clone(), String::new())
    } else {
        let ext = Path::new(&selected)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("bin");
        let original = root.join(format!("original.{ext}"));
        copy_exact(Path::new(&selected), &original, "原始资产文件")?;
        (String::new(), original.to_string_lossy().into())
    };

    let selected_cover = if a.use_source_as_cover {
        selected.clone()
    } else if !a.selected_cover_path.is_empty() {
        a.selected_cover_path.clone()
    } else if a.cover_storage_mode == "reference" {
        a.cover_source_path.clone()
    } else {
        a.cover_original_path.clone()
    };
    if selected_cover.is_empty() {
        return Ok(PreparedFiles {
            source_file,
            original_file,
            cover_source: String::new(),
            cover_original: String::new(),
            preview: String::new(),
            thumbnail: String::new(),
        });
    }
    if !Path::new(&selected_cover).exists() {
        return Err("选择的封面图片不存在".into());
    }
    image::image_dimensions(&selected_cover).map_err(|_| "封面文件不是受支持的图片".to_string())?;
    let (cover_source, cover_original, cover_path) = if a.cover_storage_mode == "reference" {
        (selected_cover.clone(), String::new(), selected_cover)
    } else {
        let ext = Path::new(&selected_cover)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("png");
        let cover = root.join(format!("cover.{ext}"));
        copy_exact(Path::new(&selected_cover), &cover, "封面图片")?;
        (
            String::new(),
            cover.to_string_lossy().into(),
            cover.to_string_lossy().into(),
        )
    };
    let cache = app_dir(app)?.join("cache").join(&a.id);
    let preview = if cfg.auto_preview {
        cache_image(
            Path::new(&cover_path),
            &cache.join("preview.webp"),
            cfg.preview_max_edge,
        )
        .unwrap_or_default()
    } else {
        String::new()
    };
    let thumb = if cfg.auto_thumbnail {
        cache_image(
            Path::new(&cover_path),
            &cache.join("thumbnail.webp"),
            cfg.thumbnail_max_edge,
        )
        .unwrap_or_default()
    } else {
        String::new()
    };
    Ok(PreparedFiles {
        source_file,
        original_file,
        cover_source,
        cover_original,
        preview,
        thumbnail: thumb,
    })
}
#[tauri::command]
fn save_asset(app: AppHandle, item: AssetInput) -> Result<Asset> {
    let c = db(&app)?;
    let prepared = prepare_files(&app, &c, &item)?;
    let t = now();
    c.execute("INSERT INTO assets(id,category_id,workspace_id,name,description,storage_mode,source_path,original_path,preview_path,thumbnail_path,file_path,tags,notes,created_at,updated_at,cover_storage_mode,cover_source_path,cover_original_path) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18) ON CONFLICT(id) DO UPDATE SET category_id=?2,workspace_id=?3,name=?4,description=?5,storage_mode=?6,source_path=?7,original_path=?8,preview_path=?9,thumbnail_path=?10,file_path=?11,tags=?12,notes=?13,updated_at=?15,cover_storage_mode=?16,cover_source_path=?17,cover_original_path=?18",params![item.id,item.category_id,item.workspace_id,item.name,item.description,item.storage_mode,prepared.source_file,prepared.original_file,prepared.preview,prepared.thumbnail,item.file_path,serde_json::to_string(&item.tags).unwrap_or("[]".into()),item.notes,item.created_at,t,item.cover_storage_mode,prepared.cover_source,prepared.cover_original]).map_err(|e|e.to_string())?;
    c.execute("INSERT INTO canvas_layout(asset_id,category_id,x,y,width,height,z_index,locked) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(asset_id) DO UPDATE SET group_id=CASE WHEN canvas_layout.category_id<>excluded.category_id THEN NULL ELSE canvas_layout.group_id END,category_id=excluded.category_id,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,z_index=excluded.z_index,locked=excluded.locked",params![item.id,item.category_id,item.x,item.y,item.width,item.height,item.z_index,item.locked as i64]).map_err(|e|e.to_string())?;
    drop(c);
    load_app_state(app)?
        .assets
        .into_iter()
        .find(|x| x.id == item.id)
        .ok_or("资产保存后读取失败".into())
}
#[tauri::command]
fn save_canvas_layout(app: AppHandle, items: Vec<Layout>) -> Result<()> {
    let mut c = db(&app)?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    for i in items {
        canvas_transform::validate(&canvas_transform::GeometryPatch{id:i.asset_id.clone(),x:i.x,y:i.y,width:i.width,height:i.height,rotation:i.rotation})?;
        tx.execute("INSERT INTO canvas_layout(asset_id,category_id,x,y,width,height,z_index,locked,rotation) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(asset_id) DO UPDATE SET group_id=CASE WHEN canvas_layout.category_id<>excluded.category_id THEN NULL ELSE canvas_layout.group_id END,category_id=excluded.category_id,x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,z_index=excluded.z_index,locked=excluded.locked,rotation=excluded.rotation",params![i.asset_id,i.category_id,i.x,i.y,i.width,i.height,i.z_index,i.locked as i64,i.rotation]).map_err(|e|e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_canvas_transform(app: AppHandle, category_id: String, assets: Vec<canvas_transform::GeometryPatch>, texts: Vec<canvas_transform::GeometryPatch>, groups: Vec<canvas_transform::GeometryPatch>, text_changes: Option<category_text::CategoryTextChanges>) -> Result<()> {
    canvas_transform::save(&mut db(&app)?, &category_id, assets, texts, groups, text_changes)
}
fn validate_canvas_group(item: &CanvasGroupInput) -> Result<()> {
    if item.id.trim().is_empty() || item.category_id.trim().is_empty() {
        return Err("分组或画布分类标识不能为空".into());
    }
    if !item.x.is_finite()
        || !item.y.is_finite()
        || !item.width.is_finite()
        || !item.height.is_finite()
        || item.width < 80.0
        || item.height < 60.0
        || item.width > 100_000.0
        || item.height > 100_000.0
    {
        return Err("分组位置或尺寸无效".into());
    }
    if !valid_hex_color(&item.border_color)
        || !valid_hex_color(&item.background_color)
        || !(0..=100).contains(&item.background_opacity)
    {
        return Err("分组颜色或透明度无效".into());
    }
    Ok(())
}
#[tauri::command]
fn create_canvas_group(app: AppHandle, item: NewCanvasGroup) -> Result<()> {
    let mut c = db(&app)?;
    create_canvas_group_in_db(&mut c, item)
}
fn create_canvas_group_in_db(c: &mut Connection, item: NewCanvasGroup) -> Result<()> {
    validate_canvas_group(&item.group)?;
    let mut seen = std::collections::HashSet::new();
    if item.asset_ids.len() < 2 || item.asset_ids.iter().any(|id| !seen.insert(id)) {
        return Err("创建分组需要至少两个不同的资产".into());
    }
    let tx = c.transaction().map_err(|e| e.to_string())?;
    for asset_id in &item.asset_ids {
        let row: Option<(String, Option<String>)> = tx
            .query_row(
                "SELECT a.category_id,l.group_id FROM assets a LEFT JOIN canvas_layout l ON l.asset_id=a.id WHERE a.id=?1",
                [asset_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let Some((category_id, group_id)) = row else {
            return Err("所选资产已经不存在".into());
        };
        if category_id != item.group.category_id {
            return Err("所选资产必须来自同一张画布".into());
        }
        if group_id.is_some() {
            return Err("所选资产包含已有分组成员，请先移出原分组。".into());
        }
    }
    let t = now();
    tx.execute(
        "INSERT INTO canvas_groups(id,category_id,name,x,y,width,height,z_index,locked,collapsed,border_color,background_color,background_opacity,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)",
        params![
            item.group.id,
            item.group.category_id,
            if item.group.name.trim().is_empty() { "新分组" } else { item.group.name.trim() },
            item.group.x,
            item.group.y,
            item.group.width,
            item.group.height,
            item.group.z_index,
            item.group.locked as i64,
            item.group.collapsed as i64,
            item.group.border_color,
            item.group.background_color,
            item.group.background_opacity,
            t
        ],
    )
    .map_err(|e| e.to_string())?;
    for asset_id in item.asset_ids {
        tx.execute(
            "INSERT INTO canvas_layout(asset_id,category_id,x,y,width,height,z_index,locked,group_id) SELECT a.id,a.category_id,COALESCE(l.x,90),COALESCE(l.y,90),COALESCE(l.width,280),COALESCE(l.height,210),COALESCE(l.z_index,1),COALESCE(l.locked,0),?1 FROM assets a LEFT JOIN canvas_layout l ON l.asset_id=a.id WHERE a.id=?2 AND a.category_id=?3 ON CONFLICT(asset_id) DO UPDATE SET group_id=excluded.group_id",
            params![item.group.id, asset_id, item.group.category_id],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_canvas_groups(app: AppHandle, items: Vec<CanvasGroupInput>) -> Result<()> {
    let mut c = db(&app)?;
    save_canvas_groups_in_db(&mut c, items)
}
fn save_canvas_groups_in_db(c: &mut Connection, items: Vec<CanvasGroupInput>) -> Result<()> {
    let tx = c.transaction().map_err(|e| e.to_string())?;
    for item in items {
        validate_canvas_group(&item)?;
        let changed = tx.execute(
            "UPDATE canvas_groups SET name=?1,x=?2,y=?3,width=?4,height=?5,z_index=?6,locked=?7,collapsed=?8,border_color=?9,background_color=?10,background_opacity=?11,updated_at=?12 WHERE id=?13 AND category_id=?14",
            params![
                if item.name.trim().is_empty() { "新分组" } else { item.name.trim() },
                item.x,
                item.y,
                item.width,
                item.height,
                item.z_index,
                item.locked as i64,
                item.collapsed as i64,
                item.border_color,
                item.background_color,
                item.background_opacity,
                now(),
                item.id,
                item.category_id
            ],
        )
        .map_err(|e| e.to_string())?;
        if changed != 1 {
            return Err("要保存的分组已不存在或不属于当前画布".into());
        }
    }
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
fn add_canvas_group_member(app: AppHandle, group_id: String, asset_id: String) -> Result<()> {
    let mut c = db(&app)?;
    add_canvas_group_member_in_db(&mut c, &group_id, &asset_id)
}
fn add_canvas_group_member_in_db(c: &mut Connection, group_id: &str, asset_id: &str) -> Result<()> {
    let tx = c.transaction().map_err(|e| e.to_string())?;
    let (category_id, locked): (String, i64) = tx
        .query_row(
            "SELECT category_id,locked FROM canvas_groups WHERE id=?1",
            [group_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or("分组已经不存在")?;
    if locked != 0 {
        return Err("请先解锁分组，再向其中添加资产".into());
    }
    let row: Option<(String, Option<String>)> = tx
        .query_row(
            "SELECT a.category_id,l.group_id FROM assets a LEFT JOIN canvas_layout l ON l.asset_id=a.id WHERE a.id=?1",
            [asset_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some((asset_category, current_group)) = row else {
        return Err("资产已经不存在".into());
    };
    if asset_category != category_id {
        return Err("只能将同一张画布中的资产加入分组".into());
    }
    if current_group.as_deref() == Some(group_id) {
        return Ok(());
    }
    if current_group.is_some() {
        return Err("资产已经属于其他分组，请先将它移出".into());
    }
    tx.execute(
        "INSERT INTO canvas_layout(asset_id,category_id,x,y,width,height,z_index,locked,group_id) SELECT a.id,a.category_id,COALESCE(l.x,90),COALESCE(l.y,90),COALESCE(l.width,280),COALESCE(l.height,210),COALESCE(l.z_index,1),COALESCE(l.locked,0),?1 FROM assets a LEFT JOIN canvas_layout l ON l.asset_id=a.id WHERE a.id=?2 AND a.category_id=?3 ON CONFLICT(asset_id) DO UPDATE SET group_id=excluded.group_id",
        params![group_id, asset_id, category_id],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
fn remove_canvas_group_member(app: AppHandle, group_id: String, asset_id: String) -> Result<()> {
    remove_canvas_group_member_in_db(&db(&app)?, &group_id, &asset_id)?;
    Ok(())
}
fn remove_canvas_group_member_in_db(c: &Connection, group_id: &str, asset_id: &str) -> Result<()> {
    c.execute(
        "UPDATE canvas_layout SET group_id=NULL WHERE asset_id=?1 AND group_id=?2",
        params![asset_id, group_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn delete_canvas_group(app: AppHandle, id: String) -> Result<()> {
    let mut c = db(&app)?;
    delete_canvas_group_in_db(&mut c, &id)
}
fn delete_canvas_group_in_db(c: &mut Connection, id: &str) -> Result<()> {
    let tx = c.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE canvas_layout SET group_id=NULL WHERE group_id=?1",
        [&id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM canvas_groups WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_viewport(
    app: AppHandle,
    category_id: String,
    viewport_x: f64,
    viewport_y: f64,
    zoom: f64,
) -> Result<()> {
    let c = db(&app)?;
    c.execute("INSERT INTO category_viewports VALUES(?1,?2,?3,?4) ON CONFLICT(category_id) DO UPDATE SET viewport_x=?2,viewport_y=?3,zoom=?4",params![category_id,viewport_x,viewport_y,zoom]).map_err(|e|e.to_string())?;
    Ok(())
}
fn insert_default_inner_canvas_object(c: &Connection, item: &AssetInnerCanvasObject) -> Result<()> {
    c.execute(
        "INSERT OR IGNORE INTO asset_inner_canvas(asset_id,object_id,object_type,source_prompt_id,field_key,text_value,x,y,width,height,z_index,locked,group_id,font_size,bold) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
        params![item.asset_id,item.object_id,item.object_type,item.source_prompt_id,item.field_key,item.text_value,item.x,item.y,item.width,item.height,item.z_index,item.locked as i64,item.group_id,item.font_size as i64,item.bold as i64],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
fn default_inner_canvas_object(
    asset_id: &str,
    prompt_id: &str,
    suffix: &str,
    object_type: &str,
    field_key: &str,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    z_index: i64,
) -> AssetInnerCanvasObject {
    AssetInnerCanvasObject {
        asset_id: asset_id.into(),
        object_id: format!("{prompt_id}:{suffix}"),
        object_type: object_type.into(),
        source_prompt_id: Some(prompt_id.into()),
        field_key: field_key.into(),
        text_value: String::new(),
        x,
        y,
        width,
        height,
        z_index,
        locked: false,
        group_id: None,
        font_size: 14,
        bold: false,
        rotation: 0.0,
    }
}
#[tauri::command]
fn save_asset_detail_view_mode(app: AppHandle, asset_id: String, mode: String) -> Result<()> {
    let c = db(&app)?;
    save_asset_detail_view_mode_record(&c, &asset_id, &mode)
}
fn save_asset_detail_view_mode_record(c: &Connection, asset_id: &str, mode: &str) -> Result<()> {
    if !["standard", "canvas"].contains(&mode) {
        return Err("资产详情显示方式无效".into());
    }
    let changed = c
        .execute(
            "UPDATE assets SET detail_view_mode=?2,updated_at=?3 WHERE id=?1",
            params![asset_id, mode, now()],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("找不到当前资产".into());
    }
    Ok(())
}
#[tauri::command]
fn ensure_asset_inner_canvas(app: AppHandle, asset_id: String) -> Result<()> {
    let mut c = db(&app)?;
    ensure_asset_inner_canvas_records(&mut c, &asset_id)
}
fn ensure_asset_inner_canvas_records(c: &mut Connection, asset_id: &str) -> Result<()> {
    let exists: i64 = c
        .query_row("SELECT COUNT(*) FROM assets WHERE id=?1", [asset_id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("找不到当前资产".into());
    }
    let prompts = {
        let mut statement = c
            .prepare("SELECT id,prompt_type,image_path FROM asset_prompts WHERE asset_id=?1 ORDER BY created_at,id")
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([asset_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|e| e.to_string())?
    };
    let tx = c.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR IGNORE INTO asset_inner_canvas_viewports(asset_id) VALUES(?1)",
        [&asset_id],
    )
    .map_err(|e| e.to_string())?;
    let mut y = 100.0;
    for (index, (prompt_id, prompt_type, image_path)) in prompts.into_iter().enumerate() {
        let (image_width, image_height) = Path::new(&image_path)
            .exists()
            .then(|| image::image_dimensions(&image_path).ok())
            .flatten()
            .unwrap_or((4, 3));
        let ratio = (image_width as f64 / image_height.max(1) as f64).max(0.05);
        let long_edge = 420.0;
        let sample_width = if ratio >= 1.0 {
            long_edge
        } else {
            long_edge * ratio
        };
        let sample_height = if ratio >= 1.0 {
            long_edge / ratio
        } else {
            long_edge
        };
        let x = 100.0;
        let text_x = x + sample_width + 48.0;
        let mut z = (index as i64) * 10;
        let sample = default_inner_canvas_object(
            &asset_id,
            &prompt_id,
            "sample",
            "sample",
            "sampleImagePath",
            x,
            y,
            sample_width,
            sample_height,
            z,
        );
        insert_default_inner_canvas_object(&tx, &sample)?;
        z += 1;
        let mut notes_y = y + 300.0;
        match prompt_type.as_str() {
            "positive-negative" => {
                insert_default_inner_canvas_object(
                    &tx,
                    &default_inner_canvas_object(
                        &asset_id,
                        &prompt_id,
                        "positive",
                        "prompt",
                        "positivePrompt",
                        text_x,
                        y,
                        390.0,
                        230.0,
                        z,
                    ),
                )?;
                z += 1;
                insert_default_inner_canvas_object(
                    &tx,
                    &default_inner_canvas_object(
                        &asset_id,
                        &prompt_id,
                        "negative",
                        "prompt",
                        "negativePrompt",
                        text_x,
                        y + 250.0,
                        390.0,
                        230.0,
                        z,
                    ),
                )?;
                z += 1;
                notes_y = y + 500.0;
            }
            "natural" => {
                insert_default_inner_canvas_object(
                    &tx,
                    &default_inner_canvas_object(
                        &asset_id,
                        &prompt_id,
                        "natural",
                        "prompt",
                        "naturalPrompt",
                        text_x,
                        y,
                        430.0,
                        430.0,
                        z,
                    ),
                )?;
                z += 1;
                notes_y = y + 450.0;
            }
            "five-point" => {
                insert_default_inner_canvas_object(
                    &tx,
                    &default_inner_canvas_object(
                        &asset_id, &prompt_id, "content", "prompt", "content", text_x, y, 430.0,
                        430.0, z,
                    ),
                )?;
                z += 1;
                notes_y = y + 450.0;
            }
            _ => {}
        }
        insert_default_inner_canvas_object(
            &tx,
            &default_inner_canvas_object(
                &asset_id, &prompt_id, "notes", "note", "notes", text_x, notes_y, 390.0, 150.0, z,
            ),
        )?;
        y += sample_height.max(notes_y - y + 150.0) + 70.0;
    }
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
fn save_asset_inner_canvas_layout(
    app: AppHandle,
    asset_id: String,
    objects: Vec<AssetInnerCanvasObject>,
) -> Result<()> {
    let mut c = db(&app)?;
    save_asset_inner_canvas_layout_records(&mut c, &asset_id, objects)
}
fn save_asset_inner_canvas_layout_records(
    c: &mut Connection,
    asset_id: &str,
    objects: Vec<AssetInnerCanvasObject>,
) -> Result<()> {
    let tx = c.transaction().map_err(|e| e.to_string())?;
    write_asset_inner_canvas_layout_records(&tx, asset_id, objects)?;
    tx.commit().map_err(|e| e.to_string())
}
fn write_asset_inner_canvas_layout_records(c: &Connection, asset_id: &str, objects: Vec<AssetInnerCanvasObject>) -> Result<()> {
    for item in objects {
        if item.asset_id != asset_id {
            return Err("内画布对象不能跨资产保存".into());
        }
        if item.object_id.trim().is_empty()
            || !["sample", "prompt", "note", "text"].contains(&item.object_type.as_str())
            || !item.rotation.is_finite()
            || !item.x.is_finite()
            || !item.y.is_finite()
            || !item.width.is_finite()
            || !item.height.is_finite()
            || !(40.0..=10_000.0).contains(&item.width)
            || !(32.0..=10_000.0).contains(&item.height)
            || !(10..=64).contains(&item.font_size)
        {
            return Err("内画布对象位置或尺寸无效".into());
        }
        let valid_source = match item.object_type.as_str() {
            "sample" => item.source_prompt_id.is_some() && item.field_key == "sampleImagePath",
            "prompt" => {
                item.source_prompt_id.is_some()
                    && [
                        "positivePrompt",
                        "negativePrompt",
                        "naturalPrompt",
                        "content",
                    ]
                    .contains(&item.field_key.as_str())
            }
            "note" => item.source_prompt_id.is_some() && item.field_key == "notes",
            "text" => item.source_prompt_id.is_none(),
            _ => false,
        };
        if !valid_source {
            return Err("内画布对象与资产案例的关联无效".into());
        }
        if let Some(prompt_id) = &item.source_prompt_id {
            let belongs_to_asset: i64 = c
                .query_row(
                    "SELECT COUNT(*) FROM asset_prompts WHERE id=?1 AND asset_id=?2",
                    params![prompt_id, asset_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            if belongs_to_asset == 0 {
                return Err("内画布对象不能引用其他资产的样图案例".into());
            }
        }
        c.execute(
            "INSERT INTO asset_inner_canvas(asset_id,object_id,object_type,source_prompt_id,field_key,text_value,x,y,width,height,z_index,locked,group_id,font_size,bold,rotation) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16) ON CONFLICT(asset_id,object_id) DO UPDATE SET object_type=?3,source_prompt_id=?4,field_key=?5,text_value=CASE WHEN ?3='text' THEN ?6 ELSE asset_inner_canvas.text_value END,x=?7,y=?8,width=?9,height=?10,z_index=?11,locked=?12,group_id=?13,font_size=?14,bold=?15,rotation=?16",
            params![item.asset_id,item.object_id,item.object_type,item.source_prompt_id,item.field_key,item.text_value,item.x,item.y,item.width,item.height,item.z_index,item.locked as i64,item.group_id,item.font_size as i64,item.bold as i64,item.rotation],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
fn delete_asset_inner_canvas_text(
    app: AppHandle,
    asset_id: String,
    object_id: String,
) -> Result<()> {
    let c = db(&app)?;
    c.execute(
        "DELETE FROM asset_inner_canvas WHERE asset_id=?1 AND object_id=?2 AND object_type='text'",
        params![asset_id, object_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn save_asset_inner_canvas_viewport(
    app: AppHandle,
    asset_id: String,
    viewport_x: f64,
    viewport_y: f64,
    zoom: f64,
) -> Result<()> {
    save_asset_inner_canvas_viewport_record(&db(&app)?, &asset_id, viewport_x, viewport_y, zoom)
}
fn save_asset_inner_canvas_viewport_record(
    c: &Connection,
    asset_id: &str,
    viewport_x: f64,
    viewport_y: f64,
    zoom: f64,
) -> Result<()> {
    if !viewport_x.is_finite() || !viewport_y.is_finite() || !(0.1..=5.0).contains(&zoom) {
        return Err("资产内画布视口无效".into());
    }
    c.execute(
            "INSERT INTO asset_inner_canvas_viewports(asset_id,viewport_x,viewport_y,zoom) VALUES(?1,?2,?3,?4) ON CONFLICT(asset_id) DO UPDATE SET viewport_x=?2,viewport_y=?3,zoom=?4",
            params![asset_id, viewport_x, viewport_y, zoom],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn save_category_text_changes(app: AppHandle, category_id: String, changes: category_text::CategoryTextChanges) -> Result<()> {
    category_text::save(&mut db(&app)?, &category_id, changes)
}

#[tauri::command]
fn save_asset_text_changes(app: AppHandle, asset_id: String, view_mode: String, changes: asset_text::AssetTextChanges) -> Result<()> {
    asset_text::save_changes(&mut db(&app)?, &asset_id, &view_mode, changes)
}

#[tauri::command]
fn import_custom_font(app: AppHandle, font_id: String) -> Result<Option<CustomFont>> {
    let connection = db(&app)?;
    inner_canvas_text::import_font(&app, &connection, &font_id)
}

#[tauri::command]
fn delete_custom_font(app: AppHandle, font_id: String) -> Result<()> {
    let mut connection = db(&app)?;
    if let Some(path) = inner_canvas_text::delete_font_record(&mut connection, &font_id)? {
        match fs::remove_file(path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("字体已移除并已回退文字块，但文件清理失败：{error}")),
        }
    }
    Ok(())
}
#[tauri::command]
fn save_canvas_appearance(
    app: AppHandle,
    category_id: String,
    color: String,
    pattern: String,
) -> Result<()> {
    if !valid_hex_color(&color) || !["dots", "grid", "solid"].contains(&pattern.as_str()) {
        return Err("画布背景设置无效".into());
    }
    db(&app)?.execute("INSERT INTO category_canvas_preferences(category_id,color,pattern) VALUES(?1,?2,?3) ON CONFLICT(category_id) DO UPDATE SET color=?2,pattern=?3",params![category_id,color,pattern]).map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
fn save_asset_inner_canvas_appearance(app: AppHandle, asset_id: String, color: Option<String>, pattern: Option<String>) -> Result<()> {
    let c = db(&app)?;
    match (color, pattern) {
        (None, None) => { c.execute("DELETE FROM asset_inner_canvas_preferences WHERE asset_id=?1", [&asset_id]).map_err(|e| e.to_string())?; }
        (Some(color), Some(pattern)) if valid_hex_color(&color) && ["dots", "grid", "solid"].contains(&pattern.as_str()) => {
            c.execute("INSERT INTO asset_inner_canvas_preferences(asset_id,color,pattern) VALUES(?1,?2,?3) ON CONFLICT(asset_id) DO UPDATE SET color=?2,pattern=?3", params![asset_id,color,pattern]).map_err(|e|e.to_string())?;
        }
        _ => return Err("画布背景设置无效".into()),
    }
    Ok(())
}
#[tauri::command]
fn delete_asset(app: AppHandle, id: String, delete_managed: bool) -> Result<()> {
    let c = db(&app)?;
    let row: Option<String> = c
        .query_row("SELECT storage_mode FROM assets WHERE id=?1", [&id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(mode) = row else {
        return Ok(());
    };
    if mode == "managed" && !delete_managed {
        return Err("该资产包含脚本集合器自己的托管副本，请确认删除。".into());
    }
    let managed_root = PathBuf::from(settings(&c).managed_asset_dir).join(&id);
    let tx = c.unchecked_transaction().map_err(|e|e.to_string())?;
    asset_note_drawers::detach_for_asset_delete(&tx, &id)?;
    tx.execute("DELETE FROM assets WHERE id=?1", [&id]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e|e.to_string())?;
    drop(c);
    let _ = fs::remove_dir_all(app_dir(&app)?.join("cache").join(&id));
    if managed_root.exists() {
        fs::remove_dir_all(managed_root)
            .map_err(|e| format!("记录已删除，但托管文件删除失败：{e}"))?
    }
    Ok(())
}
#[tauri::command]
fn relink_asset(app: AppHandle, id: String, source_file_path: String) -> Result<()> {
    if !Path::new(&source_file_path).exists() {
        return Err("选择的文件不存在".into());
    }
    let c = db(&app)?;
    c.execute(
        "UPDATE assets SET source_path=?2,updated_at=?3 WHERE id=?1 AND storage_mode='reference'",
        params![id, source_file_path, now()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn save_prompt(app: AppHandle, item: Prompt) -> Result<Prompt> {
    let c = db(&app)?;
    if item.selected_image_path.is_empty() || !Path::new(&item.selected_image_path).exists() {
        return Err("请选择一张样图图片".into());
    }
    image::image_dimensions(&item.selected_image_path)
        .map_err(|_| "样图必须是 PNG、JPG、JPEG 或 WEBP 图片".to_string())?;
    let asset_mode: String = c
        .query_row(
            "SELECT storage_mode FROM assets WHERE id=?1",
            [&item.asset_id],
            |r| r.get(0),
        )
        .map_err(|_| "找不到当前资产".to_string())?;
    let imports_root = app_dir(&app)?.join("imports");
    let clipboard_image = Path::new(&item.selected_image_path).starts_with(&imports_root);
    let sample_mode = if asset_mode == "managed" || clipboard_image {
        "managed"
    } else {
        "reference"
    };
    let cfg = settings(&c);
    let (source, original) = if sample_mode == "managed" {
        let ext = Path::new(&item.selected_image_path)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("png");
        let destination = PathBuf::from(&cfg.managed_asset_dir)
            .join(&item.asset_id)
            .join("samples")
            .join(&item.id)
            .join(format!("original.{ext}"));
        copy_exact(
            Path::new(&item.selected_image_path),
            &destination,
            "样图原图",
        )?;
        (String::new(), destination.to_string_lossy().into())
    } else {
        (item.selected_image_path.clone(), String::new())
    };
    let active_path = if sample_mode == "managed" {
        original.clone()
    } else {
        source.clone()
    };
    c.execute("INSERT INTO asset_prompts(id,asset_id,prompt_type,positive_prompt,negative_prompt,natural_prompt,content,image_path,title,notes,created_at,updated_at,sample_storage_mode,sample_source_path,sample_original_path,sample_file_name,metadata_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17) ON CONFLICT(id) DO UPDATE SET prompt_type=?3,positive_prompt=?4,negative_prompt=?5,natural_prompt=?6,content=?7,image_path=?8,title=?9,notes=?10,updated_at=?12,sample_storage_mode=?13,sample_source_path=?14,sample_original_path=?15,sample_file_name=?16,metadata_json=?17",params![item.id,item.asset_id,item.prompt_type,item.positive_prompt,item.negative_prompt,item.natural_prompt,item.content,active_path,item.title,item.notes,item.created_at,item.updated_at,sample_mode,source,original,item.sample_file_name,item.metadata_json]).map_err(|e|e.to_string())?;
    if clipboard_image && sample_mode == "managed" {
        let _ = fs::remove_file(&item.selected_image_path);
    }
    drop(c);
    load_app_state(app)?
        .prompts
        .into_iter()
        .find(|prompt| prompt.id == item.id)
        .ok_or("样图案例保存后读取失败".into())
}
#[tauri::command]
fn update_prompt_content(app: AppHandle, item: PromptContentUpdate) -> Result<()> {
    update_prompt_content_record(&db(&app)?, item)
}
fn update_prompt_content_record(c: &Connection, item: PromptContentUpdate) -> Result<()> {
    if !["positive-negative", "natural", "five-point", "none"].contains(&item.prompt_type.as_str())
    {
        return Err("Prompt 类型无效".into());
    }
    let changed = c
        .execute(
            "UPDATE asset_prompts SET prompt_type=?2,title=?3,positive_prompt=?4,negative_prompt=?5,natural_prompt=?6,content=?7,notes=?8,updated_at=?9 WHERE id=?1",
            params![item.id,item.prompt_type,item.title,item.positive_prompt,item.negative_prompt,item.natural_prompt,item.content,item.notes,now()],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("找不到要编辑的样图案例".into());
    }
    Ok(())
}
#[tauri::command]
fn save_settings(app: AppHandle, item: Settings) -> Result<Settings> {
    if item.default_import_mode != "managed" && item.default_import_mode != "reference" {
        return Err("默认导入方式无效".into());
    }
    if !["home", "scripts", "last"].contains(&item.startup_page.as_str())
        || !["system", "light", "dark"].contains(&item.theme.as_str())
        || !["compact", "standard", "comfortable"].contains(&item.ui_density.as_str())
        || !["dots", "grid", "solid"].contains(&item.canvas_background.as_str())
        || !valid_hex_color(&item.canvas_background_color)
        || !["always", "interaction", "hidden"].contains(&item.asset_name_display.as_str())
        || !["exit", "tray"].contains(&item.close_behavior.as_str())
        || !(75..=150).contains(&item.ui_scale)
        || !(0..=100).contains(&item.background_opacity)
        || !(5..=3600).contains(&item.auto_save_interval)
        || !(100..=1600).contains(&item.new_asset_max_edge)
        || !(128..=8192).contains(&item.preview_max_edge)
        || !(64..=4096).contains(&item.thumbnail_max_edge)
    {
        return Err("设置值超出允许范围".into());
    }
    fs::create_dir_all(&item.managed_asset_dir).map_err(|e| format!("托管目录不可用：{e}"))?;
    let mut c = db(&app)?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    for (k, v) in [
        ("startup_page", item.startup_page.clone()),
        ("restore_workspace", item.restore_workspace.to_string()),
        ("auto_save", item.auto_save.to_string()),
        ("auto_save_interval", item.auto_save_interval.to_string()),
        ("confirm_delete", item.confirm_delete.to_string()),
        ("close_behavior", item.close_behavior.clone()),
        ("theme", item.theme.clone()),
        ("ui_scale", item.ui_scale.to_string()),
        ("ui_density", item.ui_density.clone()),
        ("canvas_background", item.canvas_background.clone()),
        (
            "canvas_background_color",
            item.canvas_background_color.clone(),
        ),
        ("background_opacity", item.background_opacity.to_string()),
        ("asset_name_display", item.asset_name_display.clone()),
        ("show_asset_tags", item.show_asset_tags.to_string()),
        ("show_image_shadow", item.show_image_shadow.to_string()),
        (
            "show_selection_border",
            item.show_selection_border.to_string(),
        ),
        ("new_asset_max_edge", item.new_asset_max_edge.to_string()),
        ("immersive_shortcut", item.immersive_shortcut.clone()),
        ("show_performance", item.show_performance.to_string()),
        ("verbose_logs", item.verbose_logs.to_string()),
        ("default_import_mode", item.default_import_mode.clone()),
        ("ask_import_mode", item.ask_import_mode.to_string()),
        ("managed_asset_dir", item.managed_asset_dir.clone()),
        ("auto_preview", item.auto_preview.to_string()),
        ("auto_thumbnail", item.auto_thumbnail.to_string()),
        ("preview_max_edge", item.preview_max_edge.to_string()),
        ("thumbnail_max_edge", item.thumbnail_max_edge.to_string()),
        ("migration_completed", item.migration_completed.to_string()),
    ] {
        tx.execute(
            "INSERT INTO app_settings VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=?2",
            params![k, v],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_background_color(Some(native_theme_color(&item.theme)));
    }
    Ok(item)
}

#[tauri::command]
fn save_shortcut(
    app: AppHandle,
    action_id: String,
    shortcut: String,
    reassign: bool,
    conflict_action_id: Option<String>,
) -> Result<Vec<ShortcutBinding>> {
    if action_id.trim().is_empty() || shortcut.len() > 64 {
        return Err("快捷键数据无效".into());
    }
    if reassign && conflict_action_id.as_deref() == Some(action_id.as_str()) {
        return Err("不能将快捷键重新分配给同一功能".into());
    }
    let mut c = db(&app)?;
    let tx = c.transaction().map_err(|e| e.to_string())?;
    if reassign {
        if let Some(conflict_id) = conflict_action_id {
            tx.execute(
                "INSERT INTO shortcut_bindings(action_id,shortcut,is_custom) VALUES(?1,'',1) ON CONFLICT(action_id) DO UPDATE SET shortcut='',is_custom=1",
                [&conflict_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.execute(
        "INSERT INTO shortcut_bindings(action_id,shortcut,is_custom) VALUES(?1,?2,1) ON CONFLICT(action_id) DO UPDATE SET shortcut=?2,is_custom=1",
        params![action_id, shortcut],
    )
    .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    shortcut_bindings(&c)
}

#[tauri::command]
fn reset_shortcut(app: AppHandle, action_id: String) -> Result<Vec<ShortcutBinding>> {
    let c = db(&app)?;
    c.execute(
        "DELETE FROM shortcut_bindings WHERE action_id=?1",
        [action_id],
    )
    .map_err(|e| e.to_string())?;
    shortcut_bindings(&c)
}

#[tauri::command]
fn reset_shortcuts(app: AppHandle) -> Result<Vec<ShortcutBinding>> {
    let c = db(&app)?;
    c.execute("DELETE FROM shortcut_bindings", [])
        .map_err(|e| e.to_string())?;
    shortcut_bindings(&c)
}
#[tauri::command]
fn clear_preview_cache(app: AppHandle) -> Result<()> {
    let p = app_dir(&app)?.join("cache");
    clear_cache_directory(&p)?;
    let c = db(&app)?;
    c.execute("UPDATE assets SET preview_path='',thumbnail_path=''", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}
fn clear_cache_directory(p: &Path) -> Result<()> {
    fs::create_dir_all(p).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(p).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            continue;
        }
        clear_cache_child(&entry.path())?;
    }
    Ok(())
}
fn clear_cache_child(p: &Path) -> Result<()> {
    for name in ["preview.webp", "thumbnail.webp"] {
        let path = p.join(name);
        if let Ok(meta) = fs::symlink_metadata(&path) {
            if meta.file_type().is_file() {
                fs::remove_file(path).map_err(|e| e.to_string())?;
            }
        }
    }
    // Keep directories containing unexpected files; no original or user file is touched.
    if fs::read_dir(p).map_err(|e| e.to_string())?.next().is_none() {
        fs::remove_dir(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
fn regenerate_thumbnails(app: AppHandle) -> Result<usize> {
    let c = db(&app)?;
    let cfg = settings(&c);
    let rows = all(
        &c,
        "SELECT id,cover_storage_mode,cover_source_path,cover_original_path FROM assets",
        |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        },
    )?;
    let mut n = 0;
    for (id, mode, source, original) in rows {
        let src = if mode == "managed" { original } else { source };
        if Path::new(&src).exists() {
            let dst = app_dir(&app)?
                .join("cache")
                .join(&id)
                .join("thumbnail.webp");
            if let Ok(path) = cache_image(Path::new(&src), &dst, cfg.thumbnail_max_edge) {
                c.execute(
                    "UPDATE assets SET thumbnail_path=?2 WHERE id=?1",
                    params![id, path],
                )
                .map_err(|e| e.to_string())?;
                n += 1
            }
        }
    }
    Ok(n)
}

#[tauri::command]
fn regenerate_previews(app: AppHandle) -> Result<usize> {
    let c = db(&app)?;
    let cfg = settings(&c);
    let rows = all(
        &c,
        "SELECT id,cover_storage_mode,cover_source_path,cover_original_path FROM assets",
        |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        },
    )?;
    let mut count = 0;
    for (id, mode, source, original) in rows {
        let src = if mode == "managed" { original } else { source };
        if !Path::new(&src).is_file() {
            continue;
        }
        let cache = app_dir(&app)?.join("cache").join(&id);
        if let Ok(path) = cache_image(
            Path::new(&src),
            &cache.join("preview.webp"),
            cfg.preview_max_edge,
        ) {
            c.execute(
                "UPDATE assets SET preview_path=?2 WHERE id=?1",
                params![id, path],
            )
            .map_err(|e| e.to_string())?;
            count += 1;
        }
        if let Ok(path) = cache_image(
            Path::new(&src),
            &cache.join("thumbnail.webp"),
            cfg.thumbnail_max_edge,
        ) {
            c.execute(
                "UPDATE assets SET thumbnail_path=?2 WHERE id=?1",
                params![id, path],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(count)
}

#[tauri::command]
fn database_info(app: AppHandle) -> Result<Value> {
    let c = db(&app)?;
    let count = |table: &str| -> Result<i64> {
        c.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
            .map_err(|e| e.to_string())
    };
    let path = db_path(&app)?;
    Ok(
        serde_json::json!({"path":path,"bytes":fs::metadata(&path).map(|m|m.len()).unwrap_or(0),"categories":count("categories")?,"assets":count("assets")?,"samples":count("asset_prompts")?}),
    )
}

#[tauri::command]
fn open_directory(path: String) -> Result<()> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("目录不存在".into());
    }
    Command::new("explorer.exe")
        .arg(dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn backup_database(app: AppHandle) -> Result<String> {
    let Some(path) = rfd::FileDialog::new()
        .set_file_name("script-collection-backup.sqlite3")
        .save_file()
    else {
        return Ok(String::new());
    };
    if path == db_path(&app)? {
        return Err("备份位置不能是正在使用的数据库".into());
    }
    let c = db(&app)?;
    let stage = path.with_extension("backup.tmp");
    if stage.exists() {
        fs::remove_file(&stage).map_err(|e| e.to_string())?;
    }
    c.execute("VACUUM INTO ?1", [stage.to_string_lossy().as_ref()])
        .map_err(|e| e.to_string())?;
    fs::copy(&stage, &path).map_err(|e| e.to_string())?;
    fs::remove_file(stage).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into())
}

#[tauri::command]
fn restore_database(app: AppHandle) -> Result<bool> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("SQLite", &["sqlite3", "db"])
        .pick_file()
    else {
        return Ok(false);
    };
    let candidate = Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let integrity: String = candidate
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if integrity != "ok" {
        return Err(format!("备份完整性检查失败：{integrity}"));
    }
    candidate
        .query_row("SELECT COUNT(*) FROM app_settings", [], |r| {
            r.get::<_, i64>(0)
        })
        .map_err(|_| "所选文件不是脚本集合器数据库".to_string())?;
    drop(candidate);
    let target = db_path(&app)?;
    let current = db(&app)?;
    current
        .execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
        .map_err(|e| e.to_string())?;
    drop(current);
    let safety = target.with_extension("before-restore.sqlite3");
    fs::copy(&target, &safety).map_err(|e| e.to_string())?;
    let stage = target.with_extension("restore.tmp");
    fs::copy(&path, &stage).map_err(|e| e.to_string())?;
    fs::copy(&stage, &target).map_err(|e| e.to_string())?;
    fs::remove_file(stage).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn check_database(app: AppHandle) -> Result<String> {
    db(&app)?
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn check_missing_references(app: AppHandle) -> Result<Vec<String>> {
    let c = db(&app)?;
    let rows = all(
        &c,
        "SELECT name,source_path FROM assets WHERE storage_mode='reference'",
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
    )?;
    Ok(rows
        .into_iter()
        .filter(|(_, p)| !Path::new(p).is_file())
        .map(|(n, p)| format!("{n}：{p}"))
        .collect())
}

#[tauri::command]
fn clean_orphan_previews(app: AppHandle) -> Result<usize> {
    let c = db(&app)?;
    let root = app_dir(&app)?.join("cache");
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            if !entry.path().is_dir() {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            let exists: i64 = c
                .query_row("SELECT COUNT(*) FROM assets WHERE id=?1", [&id], |r| {
                    r.get(0)
                })
                .map_err(|e| e.to_string())?;
            if exists == 0 {
                clear_cache_child(&entry.path())?;
                count += 1;
            }
        }
    }
    Ok(count)
}

#[tauri::command]
fn rebuild_database_indexes(app: AppHandle) -> Result<()> {
    db(&app)?
        .execute_batch("REINDEX; ANALYZE;")
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_canvas_layout(app: AppHandle) -> Result<()> {
    let c = db(&app)?;
    c.execute("DELETE FROM canvas_layout", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_last_page(app: AppHandle, page: String) -> Result<()> {
    if page.len() > 500 || page.contains('\\') {
        return Err("页面路径无效".into());
    }
    db(&app)?
        .execute(
            "UPDATE app_settings SET value=?1 WHERE key='last_page'",
            [page],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn diagnostic_log(app: AppHandle, event: String) -> Result<()> {
    if event.len() > 200
        || !event
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_:- ".contains(c))
    {
        return Err("日志事件无效".into());
    }
    if !settings(&db(&app)?).verbose_logs {
        return Ok(());
    }
    let path = app_dir(&app)?.join("diagnostics.log");
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{} {}", now(), event).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_devtools(app: AppHandle) -> Result<()> {
    app.get_webview_window("main")
        .ok_or("主窗口不可用")?
        .open_devtools();
    Ok(())
}

#[tauri::command]
fn reset_interface_settings(app: AppHandle) -> Result<()> {
    let c = db(&app)?;
    for (key, value) in [
        ("theme", "system"),
        ("ui_scale", "100"),
        ("ui_density", "standard"),
        ("canvas_background", "dots"),
        ("background_opacity", "100"),
        ("canvas_background_color", "#f7f7f7"),
        ("asset_name_display", "always"),
        ("show_asset_tags", "true"),
        ("show_image_shadow", "true"),
        ("show_selection_border", "true"),
        ("new_asset_max_edge", "420"),
        ("immersive_shortcut", "Tab"),
    ] {
        c.execute(
            "UPDATE app_settings SET value=?2 WHERE key=?1",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn s(v: &Value, k: &str) -> String {
    v.get(k)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}
fn num(v: &Value, k: &str, d: f64) -> f64 {
    v.get(k).and_then(Value::as_f64).unwrap_or(d)
}
#[tauri::command]
fn migrate_legacy_data(app: AppHandle, payload: Legacy) -> Result<MigrationResult> {
    let c = db(&app)?;
    if settings(&c).migration_completed {
        let _ = fs::remove_file(app_dir(&app)?.join("migration.log"));
        return Ok(MigrationResult {
            success: true,
            migrated: 0,
            errors: vec![],
            log_path: String::new(),
        });
    }
    let mut errors = vec![];
    let mut migrated = 0;
    let needs_recovery_workspace = payload.workspaces.is_empty()
        && (!payload.categories.is_empty() || !payload.assets.is_empty());
    if needs_recovery_workspace {
        let t = now();
        if let Err(e) = save_workspace(
            app.clone(),
            Workspace {
                id: "migrated-workspace".into(),
                name: "已迁移资产库".into(),
                description: "从旧版本恢复的资产库".into(),
                cover_path: String::new(),
                notes: String::new(),
                created_at: t,
                updated_at: t,
            },
        ) {
            errors.push(format!("迁移工作区：{e}"));
        } else {
            migrated += 1;
        }
    }
    for v in payload.workspaces {
        let id = s(&v, "id");
        if id.is_empty() {
            continue;
        }
        let mut cover = s(&v, "cover");
        if cover.starts_with("data:") {
            match write_data_url(&app, &format!("workspace-{id}"), &cover) {
                Ok(p) => cover = p,
                Err(e) => errors.push(e),
            }
        }
        let t = v
            .get("createdAt")
            .and_then(Value::as_i64)
            .unwrap_or_else(now);
        let item = Workspace {
            id,
            name: s(&v, "name"),
            description: s(&v, "description"),
            cover_path: cover,
            notes: s(&v, "notes"),
            created_at: t,
            updated_at: t,
        };
        if let Err(e) = save_workspace(app.clone(), item) {
            errors.push(e)
        } else {
            migrated += 1
        }
    }
    for v in payload.script_categories {
        let id = s(&v, "id");
        if id.is_empty() {
            continue;
        }
        let item = ScriptCategory {
            id,
            name: s(&v, "name"),
            description: s(&v, "description"),
            scripts: v.get("scripts").cloned().unwrap_or(Value::Array(vec![])),
            created_at: now(),
            updated_at: now(),
        };
        if let Err(e) = save_script_category(app.clone(), item) {
            errors.push(e)
        } else {
            migrated += 1
        }
    }
    drop(c);
    let c = db(&app)?;
    let fallback_workspace: String = c
        .query_row(
            "SELECT id FROM workspaces ORDER BY created_at LIMIT 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or_default();
    for v in payload.categories {
        let id = s(&v, "id");
        if id.is_empty() {
            continue;
        }
        let mut workspace_id = {
            let value = s(&v, "modelId");
            if value.is_empty() {
                fallback_workspace.clone()
            } else {
                value
            }
        };
        let workspace_exists: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)",
                [&workspace_id],
                |r| r.get(0),
            )
            .unwrap_or(false);
        if !workspace_exists {
            workspace_id = fallback_workspace.clone();
        }
        let item = Category {
            id,
            name: s(&v, "name"),
            description: s(&v, "description"),
            icon: s(&v, "icon"),
            workspace_id,
            created_at: v
                .get("createdAt")
                .and_then(Value::as_i64)
                .unwrap_or_else(now),
            updated_at: now(),
            viewport_x: num(&v, "viewportX", 80.0),
            viewport_y: num(&v, "viewportY", 70.0),
            zoom: num(&v, "zoom", 1.0),
            canvas_color: String::new(),
            canvas_pattern: String::new(),
        };
        if let Err(e) = save_category(app.clone(), item) {
            errors.push(e)
        } else {
            migrated += 1
        }
    }
    drop(c);
    let c = db(&app)?;
    for v in payload.assets {
        let id = s(&v, "id");
        if id.is_empty() {
            continue;
        }
        let cover = s(&v, "cover");
        let selected = if cover.starts_with("data:") {
            match write_data_url(&app, &id, &cover) {
                Ok(p) => p,
                Err(e) => {
                    errors.push(e);
                    continue;
                }
            }
        } else {
            cover
        };
        let tags = v
            .get("tags")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        let mut asset_workspace = {
            let value = s(&v, "modelId");
            if value.is_empty() {
                fallback_workspace.clone()
            } else {
                value
            }
        };
        let workspace_exists: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)",
                [&asset_workspace],
                |r| r.get(0),
            )
            .unwrap_or(false);
        if !workspace_exists {
            asset_workspace = fallback_workspace.clone();
        }
        let mut category_id = s(&v, "categoryId");
        let category_exists: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",
                [&category_id],
                |r| r.get(0),
            )
            .unwrap_or(false);
        if !category_exists {
            category_id = c
                .query_row(
                    "SELECT id FROM categories WHERE workspace_id=?1 ORDER BY created_at LIMIT 1",
                    [&asset_workspace],
                    |r| r.get(0),
                )
                .unwrap_or_default();
        }
        let item = AssetInput {
            id,
            category_id,
            workspace_id: asset_workspace,
            name: s(&v, "name"),
            description: s(&v, "description"),
            storage_mode: "managed".into(),
            selected_file_path: selected.clone(),
            source_file_path: String::new(),
            original_file_path: String::new(),
            cover_storage_mode: "managed".into(),
            selected_cover_path: selected,
            cover_source_path: String::new(),
            cover_original_path: String::new(),
            use_source_as_cover: false,
            file_path: s(&v, "filePath"),
            tags,
            notes: s(&v, "notes"),
            created_at: v
                .get("createdAt")
                .and_then(Value::as_i64)
                .unwrap_or_else(now),
            x: num(&v, "x", 90.0),
            y: num(&v, "y", 90.0),
            width: num(&v, "width", 280.0),
            height: num(&v, "height", 210.0),
            z_index: num(&v, "zIndex", 1.0) as i64,
            locked: v.get("locked").and_then(Value::as_bool).unwrap_or(false),
        };
        if let Err(e) = save_asset(app.clone(), item) {
            errors.push(e)
        } else {
            migrated += 1
        }
    }
    let log = app_dir(&app)?.join("migration.log");
    if errors.is_empty() {
        c.execute(
            "UPDATE app_settings SET value='true' WHERE key='migration_completed'",
            [],
        )
        .map_err(|e| e.to_string())?;
        let _ = fs::remove_file(&log);
    } else {
        let _ = fs::write(&log, errors.join("\n"));
    }
    Ok(MigrationResult {
        success: errors.is_empty(),
        migrated,
        errors,
        log_path: log.to_string_lossy().into(),
    })
}
fn write_data_url(app: &AppHandle, id: &str, data: &str) -> Result<String> {
    let (comma, raw) = data.split_once(',').ok_or("旧图片数据格式无效")?;
    let bytes = STANDARD
        .decode(raw)
        .map_err(|e| format!("旧图片解码失败：{e}"))?;
    let ext = if comma.contains("png") {
        "png"
    } else if comma.contains("webp") {
        "webp"
    } else {
        "jpg"
    };
    let p = app_dir(app)?
        .join("migration")
        .join(id)
        .join(format!("source.{ext}"));
    if let Some(d) = p.parent() {
        fs::create_dir_all(d).map_err(|e| e.to_string())?
    }
    fs::write(&p, bytes).map_err(|e| e.to_string())?;
    Ok(p.to_string_lossy().into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inner_canvas_test_db() -> Connection {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON;
                 CREATE TABLE assets(id TEXT PRIMARY KEY,detail_view_mode TEXT,updated_at INTEGER NOT NULL DEFAULT 0);
                 CREATE TABLE asset_prompts(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL,prompt_type TEXT NOT NULL,positive_prompt TEXT NOT NULL DEFAULT '',negative_prompt TEXT NOT NULL DEFAULT '',natural_prompt TEXT NOT NULL DEFAULT '',content TEXT NOT NULL DEFAULT '',image_path TEXT NOT NULL DEFAULT '',title TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
                 CREATE TABLE asset_inner_canvas(asset_id TEXT NOT NULL,object_id TEXT NOT NULL,object_type TEXT NOT NULL CHECK(object_type IN('sample','prompt','note','text')),source_prompt_id TEXT,field_key TEXT NOT NULL DEFAULT '',text_value TEXT NOT NULL DEFAULT '',x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,z_index INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0,group_id TEXT,font_size INTEGER NOT NULL DEFAULT 14,bold INTEGER NOT NULL DEFAULT 0,rotation REAL NOT NULL DEFAULT 0,PRIMARY KEY(asset_id,object_id),FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE,FOREIGN KEY(source_prompt_id) REFERENCES asset_prompts(id) ON DELETE CASCADE);
                 CREATE TABLE asset_inner_canvas_viewports(asset_id TEXT PRIMARY KEY,viewport_x REAL NOT NULL DEFAULT 80,viewport_y REAL NOT NULL DEFAULT 70,zoom REAL NOT NULL DEFAULT 1,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
                 CREATE TABLE canvas_layout(asset_id TEXT PRIMARY KEY,x REAL NOT NULL,y REAL NOT NULL);",
            )
            .unwrap();
        connection
            .execute_batch(
                "INSERT INTO assets(id,detail_view_mode) VALUES('asset-a',NULL),('asset-b',NULL);
                 INSERT INTO asset_prompts(id,asset_id,prompt_type,image_path,title,positive_prompt) VALUES
                   ('sample-a1','asset-a','positive-negative','image-one.png','正负案例','原始正向词'),
                   ('sample-a2','asset-a','natural','image-two.png','自然语言案例','');
                 INSERT INTO canvas_layout(asset_id,x,y) VALUES('asset-a',9,17);",
            )
            .unwrap();
        connection
    }

    #[test]
    fn inner_canvas_modes_layout_and_prompts_share_asset_records_without_touching_outer_canvas() {
        let mut connection = inner_canvas_test_db();
        let temp = tempfile::tempdir().unwrap();
        let wide_sample = temp.path().join("wide-sample.png");
        image::RgbImage::new(8, 4).save(&wide_sample).unwrap();
        connection
            .execute(
                "UPDATE asset_prompts SET image_path=?2 WHERE id=?1",
                params!["sample-a1", wide_sample.to_string_lossy()],
            )
            .unwrap();
        save_asset_detail_view_mode_record(&connection, "asset-a", "standard").unwrap();
        save_asset_detail_view_mode_record(&connection, "asset-b", "canvas").unwrap();
        ensure_asset_inner_canvas_records(&mut connection, "asset-a").unwrap();
        ensure_asset_inner_canvas_records(&mut connection, "asset-b").unwrap();

        let modes: (String, String) = connection
            .query_row(
                "SELECT (SELECT detail_view_mode FROM assets WHERE id='asset-a'),(SELECT detail_view_mode FROM assets WHERE id='asset-b')",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(modes, ("standard".into(), "canvas".into()));
        let case_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM asset_inner_canvas WHERE asset_id='asset-a'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(case_count, 7);
        let original_ratio_size: (f64, f64) = connection
            .query_row(
                "SELECT width,height FROM asset_inner_canvas WHERE asset_id='asset-a' AND object_id='sample-a1:sample'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(original_ratio_size, (420.0, 210.0));

        let sample = AssetInnerCanvasObject {
            asset_id: "asset-a".into(),
            object_id: "sample-a1:sample".into(),
            object_type: "sample".into(),
            source_prompt_id: Some("sample-a1".into()),
            field_key: "sampleImagePath".into(),
            text_value: String::new(),
            x: 320.0,
            y: 540.0,
            width: 420.0,
            height: 315.0,
            z_index: 12,
            locked: true,
            group_id: Some("inner-group-a".into()),
            font_size: 14,
            bold: false,
        rotation: 0.0,
        };
        let text = AssetInnerCanvasObject {
            asset_id: "asset-a".into(),
            object_id: "inner-text-a".into(),
            object_type: "text".into(),
            source_prompt_id: None,
            field_key: String::new(),
            text_value: "使用心得".into(),
            x: 850.0,
            y: 600.0,
            width: 280.0,
            height: 170.0,
            z_index: 20,
            locked: false,
            group_id: None,
            font_size: 18,
            bold: true,
        rotation: 0.0,
        };
        save_asset_inner_canvas_layout_records(&mut connection, "asset-a", vec![sample, text])
            .unwrap();
        save_asset_inner_canvas_viewport_record(&connection, "asset-a", -180.0, -260.0, 1.4)
            .unwrap();
        update_prompt_content_record(
            &connection,
            PromptContentUpdate {
                id: "sample-a1".into(),
                prompt_type: "positive-negative".into(),
                title: "正负案例".into(),
                positive_prompt: "修改后的正向词".into(),
                negative_prompt: "负向词".into(),
                natural_prompt: String::new(),
                content: String::new(),
                notes: "样图备注".into(),
            },
        )
        .unwrap();
        ensure_asset_inner_canvas_records(&mut connection, "asset-a").unwrap();

        let sample_layout: (f64, f64, i64, i64, String) = connection
            .query_row(
                "SELECT x,y,z_index,locked,group_id FROM asset_inner_canvas WHERE asset_id='asset-a' AND object_id='sample-a1:sample'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .unwrap();
        assert_eq!(sample_layout, (320.0, 540.0, 12, 1, "inner-group-a".into()));
        let viewport: (f64, f64, f64) = connection
            .query_row(
                "SELECT viewport_x,viewport_y,zoom FROM asset_inner_canvas_viewports WHERE asset_id='asset-a'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(viewport, (-180.0, -260.0, 1.4));
        let text_value: (String, i64, i64) = connection
            .query_row(
                "SELECT text_value,font_size,bold FROM asset_inner_canvas WHERE asset_id='asset-a' AND object_id='inner-text-a'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(text_value, ("使用心得".into(), 18, 1));
        let shared_prompt: (String, String, i64) = connection
            .query_row(
                "SELECT positive_prompt,image_path,(SELECT COUNT(*) FROM asset_prompts WHERE asset_id='asset-a') FROM asset_prompts WHERE id='sample-a1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(
            shared_prompt,
            (
                "修改后的正向词".into(),
                wide_sample.to_string_lossy().into_owned(),
                2
            )
        );
        let prompt_reference: (String, String, String) = connection
            .query_row(
                "SELECT source_prompt_id,field_key,text_value FROM asset_inner_canvas WHERE asset_id='asset-a' AND object_id='sample-a1:positive'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(
            prompt_reference,
            ("sample-a1".into(), "positivePrompt".into(), String::new())
        );
        let copied_prompt_content: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM asset_inner_canvas WHERE asset_id='asset-a' AND object_type='prompt' AND text_value<>''",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(copied_prompt_content, 0);
        let outer_layout: (f64, f64) = connection
            .query_row(
                "SELECT x,y FROM canvas_layout WHERE asset_id='asset-a'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(outer_layout, (9.0, 17.0));
    }

    fn test_group_input(id: &str, name: &str) -> CanvasGroupInput {
        CanvasGroupInput {
            id: id.into(),
            category_id: "category-1".into(),
            name: name.into(),
            x: 90.0,
            y: 100.0,
            width: 500.0,
            height: 400.0,
            z_index: 1,
            locked: false,
            collapsed: false,
            border_color: "#6A8CC7".into(),
            background_color: "#6A8CC7".into(),
            background_opacity: 4,
        }
    }

    fn open_group_test_db(path: &Path) -> Connection {
        let connection = Connection::open(path).unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON;
                 CREATE TABLE categories(id TEXT PRIMARY KEY);
                 CREATE TABLE assets(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id));
                 CREATE TABLE canvas_groups(
                    id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,
                    z_index INTEGER NOT NULL DEFAULT 0,locked INTEGER NOT NULL DEFAULT 0,collapsed INTEGER NOT NULL DEFAULT 0,
                    border_color TEXT NOT NULL DEFAULT '#6A8CC7',background_color TEXT NOT NULL DEFAULT '#6A8CC7',
                    background_opacity INTEGER NOT NULL DEFAULT 4,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
                 CREATE TABLE canvas_layout(
                    asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
                    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                    x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,z_index INTEGER NOT NULL,
                    locked INTEGER NOT NULL DEFAULT 0,group_id TEXT REFERENCES canvas_groups(id) ON DELETE SET NULL);
                 INSERT INTO categories(id) VALUES('category-1');
                 INSERT INTO assets(id,category_id) VALUES
                    ('asset-a','category-1'),('asset-b','category-1'),('asset-c','category-1'),
                    ('asset-d','category-1'),('asset-e','category-1');
                 INSERT INTO canvas_layout(asset_id,category_id,x,y,width,height,z_index,locked) VALUES
                    ('asset-a','category-1',10,20,200,150,1,0),('asset-b','category-1',230,40,200,150,2,0),
                    ('asset-c','category-1',340,220,200,150,3,0),('asset-d','category-1',600,50,200,150,4,0),
                    ('asset-e','category-1',610,260,200,150,5,0);",
            )
            .unwrap();
        connection
    }

    #[test]
    fn canvas_groups_and_members_survive_reopen_and_ungroup_preserves_assets() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("canvas-groups.sqlite3");
        let mut connection = open_group_test_db(&path);

        let mut group = test_group_input("group-1", "新分组");
        group.x = 100.0;
        group.y = 110.0;
        create_canvas_group_in_db(
            &mut connection,
            NewCanvasGroup {
                group,
                asset_ids: vec!["asset-a".into(), "asset-b".into(), "asset-c".into()],
            },
        )
        .unwrap();

        let duplicate_membership = create_canvas_group_in_db(
            &mut connection,
            NewCanvasGroup {
                group: test_group_input("group-2", "不应创建"),
                asset_ids: vec!["asset-b".into(), "asset-d".into()],
            },
        );
        assert!(duplicate_membership.unwrap_err().contains("已有分组成员"));

        let mut saved = test_group_input("group-1", "柔光风格");
        saved.x = 120.0;
        saved.y = 140.0;
        saved.width = 620.0;
        saved.height = 470.0;
        saved.z_index = 12;
        saved.locked = true;
        saved.collapsed = true;
        saved.border_color = "#AABBCC".into();
        saved.background_color = "#CCDDEE".into();
        saved.background_opacity = 8;
        save_canvas_groups_in_db(&mut connection, vec![saved]).unwrap();
        connection
            .execute(
                "UPDATE canvas_layout SET x=777,y=888 WHERE asset_id='asset-b'",
                [],
            )
            .unwrap();
        add_canvas_group_member_in_db(&mut connection, "group-1", "asset-d").unwrap_err();
        let mut unlocked = test_group_input("group-1", "柔光风格");
        unlocked.x = 120.0;
        unlocked.y = 140.0;
        unlocked.width = 620.0;
        unlocked.height = 470.0;
        unlocked.z_index = 12;
        unlocked.collapsed = true;
        unlocked.border_color = "#AABBCC".into();
        unlocked.background_color = "#CCDDEE".into();
        unlocked.background_opacity = 8;
        save_canvas_groups_in_db(&mut connection, vec![unlocked]).unwrap();
        add_canvas_group_member_in_db(&mut connection, "group-1", "asset-d").unwrap();
        remove_canvas_group_member_in_db(&connection, "group-1", "asset-a").unwrap();
        let mut locked = test_group_input("group-1", "柔光风格");
        locked.x = 120.0;
        locked.y = 140.0;
        locked.width = 620.0;
        locked.height = 470.0;
        locked.z_index = 12;
        locked.locked = true;
        locked.collapsed = true;
        locked.border_color = "#AABBCC".into();
        locked.background_color = "#CCDDEE".into();
        locked.background_opacity = 8;
        save_canvas_groups_in_db(&mut connection, vec![locked]).unwrap();
        drop(connection);

        let mut reopened = open_group_test_db_without_seed(&path);
        let group_state: (String, f64, f64, f64, f64, i64, i64, String, String, i64) = reopened
            .query_row(
                "SELECT name,x,y,width,height,z_index,locked,border_color,background_color,background_opacity FROM canvas_groups WHERE id='group-1'",
                [],
                |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?,row.get(3)?,row.get(4)?,row.get(5)?,row.get(6)?,row.get(7)?,row.get(8)?,row.get(9)?)),
            )
            .unwrap();
        assert_eq!(
            group_state,
            (
                "柔光风格".into(),
                120.0,
                140.0,
                620.0,
                470.0,
                12,
                1,
                "#AABBCC".into(),
                "#CCDDEE".into(),
                8
            )
        );
        let members: Vec<(String, Option<String>, f64, f64)> = {
            let mut statement = reopened
                .prepare("SELECT asset_id,group_id,x,y FROM canvas_layout ORDER BY asset_id")
                .unwrap();
            statement
                .query_map([], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                })
                .unwrap()
                .collect::<std::result::Result<_, _>>()
                .unwrap()
        };
        assert_eq!(members.len(), 5);
        assert_eq!(
            members.iter().find(|row| row.0 == "asset-a").unwrap().1,
            None
        );
        for asset_id in ["asset-b", "asset-c", "asset-d"] {
            assert_eq!(
                members
                    .iter()
                    .find(|row| row.0 == asset_id)
                    .unwrap()
                    .1
                    .as_deref(),
                Some("group-1")
            );
        }
        assert_eq!(
            members.iter().find(|row| row.0 == "asset-e").unwrap().1,
            None
        );
        let moved_asset = members.iter().find(|row| row.0 == "asset-b").unwrap();
        assert_eq!((moved_asset.2, moved_asset.3), (777.0, 888.0));

        delete_canvas_group_in_db(&mut reopened, "group-1").unwrap();
        drop(reopened);
        let reopened_after_ungroup = open_group_test_db_without_seed(&path);
        let remaining_groups: i64 = reopened_after_ungroup
            .query_row("SELECT COUNT(*) FROM canvas_groups", [], |row| row.get(0))
            .unwrap();
        let remaining_assets: i64 = reopened_after_ungroup
            .query_row("SELECT COUNT(*) FROM assets", [], |row| row.get(0))
            .unwrap();
        let grouped_assets: i64 = reopened_after_ungroup
            .query_row(
                "SELECT COUNT(*) FROM canvas_layout WHERE group_id IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            (remaining_groups, remaining_assets, grouped_assets),
            (0, 5, 0)
        );
        let moved_position: (f64, f64) = reopened_after_ungroup
            .query_row(
                "SELECT x,y FROM canvas_layout WHERE asset_id='asset-b'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(moved_position, (777.0, 888.0));
    }

    fn open_group_test_db_without_seed(path: &Path) -> Connection {
        Connection::open(path).unwrap()
    }

    #[test]
    fn clearing_preview_cache_preserves_managed_and_referenced_originals() {
        let temp = tempfile::tempdir().unwrap();
        let managed = temp.path().join("assets/item/original.png");
        let reference = temp.path().join("user-photo.png");
        let cached = temp.path().join("cache/item/preview.webp");
        for (path, bytes) in [
            (&managed, b"managed".as_slice()),
            (&reference, b"reference".as_slice()),
            (&cached, b"preview".as_slice()),
        ] {
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, bytes).unwrap();
        }
        clear_cache_directory(&temp.path().join("cache")).unwrap();
        assert!(!cached.exists());
        assert_eq!(fs::read(managed).unwrap(), b"managed");
        assert_eq!(fs::read(reference).unwrap(), b"reference");
    }
    use image::{ImageBuffer, Rgb};
    use std::io::Read;

    fn large_png(path: &Path, seed: u32) {
        let mut state = seed;
        let image = ImageBuffer::from_fn(3200, 3200, |_x, _y| {
            state = state.wrapping_mul(1664525).wrapping_add(1013904223);
            Rgb([(state >> 16) as u8, (state >> 8) as u8, state as u8])
        });
        image.save_with_format(path, ImageFormat::Png).unwrap();
        assert!(fs::metadata(path).unwrap().len() > 25 * 1024 * 1024);
    }

    fn bytes(path: &Path) -> Vec<u8> {
        let mut result = Vec::new();
        fs::File::open(path)
            .unwrap()
            .read_to_end(&mut result)
            .unwrap();
        result
    }

    #[test]
    fn two_large_managed_originals_are_exact_and_reference_is_not_copied() {
        let temp = tempfile::tempdir().unwrap();
        for index in 0..2 {
            let source = temp.path().join(format!("source-{index}.png"));
            let original = temp.path().join(format!("assets/{index}/original.png"));
            large_png(&source, 42 + index);
            fs::create_dir_all(original.parent().unwrap()).unwrap();
            fs::copy(&source, &original).unwrap();
            assert_eq!(bytes(&source), bytes(&original));
        }
        let reference = temp.path().join("reference.png");
        large_png(&reference, 99);
        let recorded_path = reference.to_string_lossy().to_string();
        assert!(Path::new(&recorded_path).exists());
        assert!(!temp.path().join("assets/reference/original.png").exists());
    }

    #[test]
    fn managed_asset_copy_accepts_arbitrary_file_extensions() {
        let temp = tempfile::tempdir().unwrap();
        for extension in ["safetensors", "gguf", "json", "py", "png"] {
            let source = temp.path().join(format!("source.{extension}"));
            let destination = temp.path().join(format!("managed/original.{extension}"));
            let contents = format!("binary-test-{extension}").into_bytes();
            fs::write(&source, &contents).unwrap();
            copy_exact(&source, &destination, "测试资产").unwrap();
            assert_eq!(bytes(&source), bytes(&destination));
        }
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn configured_script_is_actually_started() {
        let temp = tempfile::tempdir().unwrap();
        let script = temp.path().join("launch-test.cmd");
        let marker = temp.path().join("marker.txt");
        fs::write(&script, "@echo launched>\"%~dp0marker.txt\"\r\n").unwrap();
        let mut child = start_script(script.to_str().unwrap(), "", "").unwrap();
        assert!(child.wait().unwrap().success());
        assert_eq!(fs::read_to_string(marker).unwrap().trim(), "launched");
    }
}

#[derive(Default)]
struct AssetTextCloseGuard(std::sync::atomic::AtomicBool);
#[derive(Default)]
struct ExitLifecycle {
    ready: std::sync::atomic::AtomicBool,
    requested: std::sync::atomic::AtomicBool,
}
fn request_exit_once(app: &AppHandle) {
    if !app.state::<ExitLifecycle>().requested.swap(true, std::sync::atomic::Ordering::SeqCst) {
        app.exit(0);
    }
}
fn main_window_exists(app: &AppHandle) -> bool {
    let Some(window) = app.get_webview_window("main") else { return false; };
    #[cfg(target_os = "windows")]
    {
        #[link(name = "user32")]
        extern "system" { fn IsWindow(hwnd: *mut std::ffi::c_void) -> i32; }
        window.hwnd().map(|hwnd| unsafe { IsWindow(hwnd.0 as _) != 0 }).unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    { let _ = window; true }
}
#[tauri::command]
fn set_asset_text_close_guard(app: AppHandle, enabled: bool) {
    app.state::<AssetTextCloseGuard>().0.store(enabled,std::sync::atomic::Ordering::SeqCst);
}
#[tauri::command]
fn finish_window_close(app: AppHandle) -> Result<()> {
    let close_behavior = setting(&db(&app)?, "close_behavior");
    if close_behavior=="tray" {
        let window=app.get_webview_window("main").ok_or("主窗口不可用")?;
        window.hide().map_err(|e|e.to_string())?;
    } else {request_exit_once(&app);}
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AssetTextCloseGuard::default())
        .manage(ExitLifecycle::default())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let theme =
                    get_startup_theme(app.handle().clone()).unwrap_or_else(|_| "system".into());
                window.set_background_color(Some(native_theme_color(&theme)))?;
            }
            let icon = app.default_window_icon().ok_or("缺少托盘图标")?.clone();
            let restore = tauri::menu::MenuItem::with_id(app, "restore", "显示窗口", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&restore])?;
            tauri::tray::TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("脚本集合器：左键恢复，右键打开菜单")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "restore" {
                        if let Err(error) = show_main_window(app.clone()) {
                            eprintln!("托盘恢复窗口失败：{error}");
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(event,
                        tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } | tauri::tray::TrayIconEvent::DoubleClick {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        }
                    ) {
                        if let Err(error) = show_main_window(tray.app_handle().clone()) {
                            eprintln!("托盘恢复窗口失败：{error}");
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.app_handle().state::<AssetTextCloseGuard>().0.load(std::sync::atomic::Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = tauri::Emitter::emit(window, "app-close-requested", ());
                } else {
                    api.prevent_close();
                    let _ = finish_window_close(window.app_handle().clone());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_asset_text_close_guard,
            finish_window_close,
            load_app_state,
            asset_note_drawers::list_asset_note_drawers,
            asset_note_drawers::list_category_note_drawers,
            asset_note_drawers::transfer_asset_note_drawer,
            asset_note_drawers::create_asset_note_drawer,
            asset_note_drawers::save_asset_note_drawer,
            asset_note_drawers::delete_asset_note_drawer,
            get_startup_theme,
            show_main_window,
            pick_asset_file,
            pick_script_file,
            pick_cover_image,
            save_clipboard_sample_image,
            pick_directory,
            save_workspace,
            delete_workspace,
            save_script_category,
            launch_script,
            save_category,
            delete_category,
            save_asset,
            save_asset_detail_view_mode,
            ensure_asset_inner_canvas,
            save_asset_inner_canvas_layout,
            delete_asset_inner_canvas_text,
            save_asset_inner_canvas_viewport,
            save_category_text_changes,
            save_asset_text_changes,
            import_custom_font,
            delete_custom_font,
            save_canvas_layout,
            save_canvas_transform,
            create_canvas_group,
            save_canvas_groups,
            add_canvas_group_member,
            remove_canvas_group_member,
            delete_canvas_group,
            save_viewport,
            save_canvas_appearance,
            save_asset_inner_canvas_appearance,
            delete_asset,
            relink_asset,
            save_prompt,
            update_prompt_content,
            save_settings,
            save_shortcut,
            reset_shortcut,
            reset_shortcuts,
            clear_preview_cache,
            regenerate_thumbnails,
            regenerate_previews,
            database_info,
            open_directory,
            backup_database,
            restore_database,
            check_database,
            check_missing_references,
            clean_orphan_previews,
            rebuild_database_indexes,
            clear_canvas_layout,
            save_last_page,
            open_devtools,
            reset_interface_settings,
            diagnostic_log,
            migrate_legacy_data
        ])
        .build(tauri::generate_context!())
        .expect("启动脚本集合器失败")
        .run(|app, event| {
            match event {
                tauri::RunEvent::Ready => {
                    app.state::<ExitLifecycle>().ready.store(true, std::sync::atomic::Ordering::SeqCst);
                }
                tauri::RunEvent::WindowEvent { label, event: tauri::WindowEvent::Destroyed, .. } if label == "main" => {
                    request_exit_once(app);
                }
                tauri::RunEvent::MainEventsCleared if app.state::<ExitLifecycle>().ready.load(std::sync::atomic::Ordering::SeqCst) => {
                    // A hidden/minimized window is valid. A missing native window
                    // cannot be restored from the tray and must not leave an orphan.
                    if !main_window_exists(app) { request_exit_once(app); }
                }
                tauri::RunEvent::Exit => { app.remove_tray_by_id("main-tray"); }
                _ => {}
            }
        });
}
