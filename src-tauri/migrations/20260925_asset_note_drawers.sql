CREATE TABLE IF NOT EXISTS asset_note_drawers (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    side TEXT NOT NULL CHECK (side IN ('left', 'right', 'top', 'bottom')),
    offset REAL NOT NULL DEFAULT 0 CHECK (offset >= 0),
    width REAL NOT NULL DEFAULT 240 CHECK (width >= 180 AND width <= 420),
    height REAL NOT NULL DEFAULT 150 CHECK (height >= 100 AND height <= 320),
    order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
    style_variant TEXT NOT NULL DEFAULT 'default',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asset_note_drawers_asset_order
    ON asset_note_drawers(asset_id, order_index, side, offset);

CREATE TRIGGER IF NOT EXISTS trg_asset_note_drawers_limit
BEFORE INSERT ON asset_note_drawers
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM asset_note_drawers WHERE asset_id = NEW.asset_id) >= 3
BEGIN
    SELECT RAISE(ABORT, '每个资产最多允许 3 个备注抽屉');
END;
