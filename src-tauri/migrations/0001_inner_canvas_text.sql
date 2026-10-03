CREATE TABLE IF NOT EXISTS canvas_text_blocks (
    id TEXT PRIMARY KEY,
    canvas_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    style_type TEXT NOT NULL DEFAULT 'plain'
        CHECK(style_type IN ('plain', 'card', 'sticky', 'panel')),
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL DEFAULT 280,
    height REAL NOT NULL DEFAULT 160,
    z_index INTEGER NOT NULL DEFAULT 0,
    locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0, 1)),
    group_id TEXT,
    font_family TEXT NOT NULL DEFAULT 'system-ui',
    font_size INTEGER NOT NULL DEFAULT 16,
    font_weight INTEGER NOT NULL DEFAULT 400,
    text_color TEXT NOT NULL DEFAULT '#334155',
    text_align TEXT NOT NULL DEFAULT 'left'
        CHECK(text_align IN ('left', 'center', 'right')),
    line_height REAL NOT NULL DEFAULT 1.5,
    border_enabled INTEGER NOT NULL DEFAULT 0 CHECK(border_enabled IN (0, 1)),
    border_color TEXT NOT NULL DEFAULT '#d6dbe3',
    border_width REAL NOT NULL DEFAULT 1,
    border_radius REAL NOT NULL DEFAULT 0,
    background_color TEXT NOT NULL DEFAULT '#ffffff',
    background_opacity REAL NOT NULL DEFAULT 0,
    shadow INTEGER NOT NULL DEFAULT 0 CHECK(shadow IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canvas_text_blocks_asset_z
    ON canvas_text_blocks(asset_id, z_index, id);

CREATE TABLE IF NOT EXISTS custom_fonts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    family TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    format TEXT NOT NULL CHECK(format IN ('ttf', 'otf', 'woff', 'woff2')),
    created_at INTEGER NOT NULL
);

-- Move legacy plain text into the dedicated table without losing its layout.
INSERT OR IGNORE INTO canvas_text_blocks (
    id, canvas_id, asset_id, style_type, title, content,
    x, y, width, height, z_index, locked, group_id,
    font_family, font_size, font_weight, text_color, text_align, line_height,
    border_enabled, border_color, border_width, border_radius,
    background_color, background_opacity, shadow, created_at, updated_at
)
SELECT
    'legacy-' || asset_id || '-' || object_id,
    asset_id,
    asset_id,
    'plain',
    '',
    text_value,
    x,
    y,
    width,
    height,
    z_index,
    locked,
    group_id,
    'system-ui',
    CASE WHEN font_size BETWEEN 10 AND 128 THEN font_size ELSE 16 END,
    CASE WHEN bold <> 0 THEN 700 ELSE 400 END,
    '#334155',
    'left',
    1.5,
    0,
    '#d6dbe3',
    1,
    0,
    '#ffffff',
    0,
    0,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM asset_inner_canvas
WHERE object_type = 'text';

DELETE FROM asset_inner_canvas
WHERE object_type = 'text'
  AND EXISTS (
      SELECT 1 FROM canvas_text_blocks
      WHERE id = 'legacy-' || asset_inner_canvas.asset_id || '-' || asset_inner_canvas.object_id
  );
