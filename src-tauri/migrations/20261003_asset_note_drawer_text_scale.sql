CREATE TABLE asset_note_drawers_scaled (
    id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, text TEXT NOT NULL DEFAULT '',
    side TEXT NOT NULL CHECK (side IN ('left','right','top','bottom')),
    offset REAL NOT NULL DEFAULT 0 CHECK (offset >= 0),
    width REAL NOT NULL DEFAULT 240 CHECK (width >= 180 AND width <= 4000),
    height REAL NOT NULL DEFAULT 150 CHECK (height >= 100 AND height <= 4000),
    order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0,1)),
    style_variant TEXT NOT NULL DEFAULT 'default', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'docked-expanded' CHECK (mode IN ('floating','docked-expanded','docked-collapsed')),
    floating_x REAL NOT NULL DEFAULT 0, floating_y REAL NOT NULL DEFAULT 0,
    text_scale REAL NOT NULL DEFAULT 1.0 CHECK (text_scale >= 0.5 AND text_scale <= 20),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);
INSERT INTO asset_note_drawers_scaled SELECT id,asset_id,text,side,offset,width,height,order_index,locked,style_variant,created_at,updated_at,mode,floating_x,floating_y,text_scale FROM asset_note_drawers;
DROP TABLE asset_note_drawers;
ALTER TABLE asset_note_drawers_scaled RENAME TO asset_note_drawers;
