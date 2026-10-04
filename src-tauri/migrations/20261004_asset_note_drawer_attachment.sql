CREATE TABLE asset_note_drawers_attached (
    id TEXT PRIMARY KEY, asset_id TEXT, category_id TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '', side TEXT NOT NULL CHECK (side IN ('left','right','top','bottom')),
    offset REAL NOT NULL DEFAULT 0 CHECK (offset >= 0),
    width REAL NOT NULL DEFAULT 240 CHECK (width >= 180 AND width <= 4000),
    height REAL NOT NULL DEFAULT 150 CHECK (height >= 100 AND height <= 4000),
    order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0,1)),
    style_variant TEXT NOT NULL DEFAULT 'default', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'docked-expanded' CHECK (mode IN ('floating','docked-expanded','docked-collapsed')),
    floating_x REAL NOT NULL DEFAULT 0, floating_y REAL NOT NULL DEFAULT 0,
    text_scale REAL NOT NULL DEFAULT 1.0 CHECK (text_scale >= 0.5 AND text_scale <= 20),
    CHECK (asset_id IS NOT NULL OR mode = 'floating'),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
INSERT INTO asset_note_drawers_attached
SELECT n.id,n.asset_id,a.category_id,n.text,n.side,n.offset,n.width,n.height,n.order_index,n.locked,n.style_variant,n.created_at,n.updated_at,n.mode,n.floating_x,n.floating_y,n.text_scale
FROM asset_note_drawers n JOIN assets a ON a.id=n.asset_id;
DROP TABLE asset_note_drawers;
ALTER TABLE asset_note_drawers_attached RENAME TO asset_note_drawers;
CREATE INDEX idx_asset_note_drawers_asset_order ON asset_note_drawers(asset_id,order_index,side,offset);
CREATE INDEX idx_asset_note_drawers_category ON asset_note_drawers(category_id,order_index,id);
CREATE TRIGGER trg_asset_note_drawers_limit BEFORE INSERT ON asset_note_drawers
WHEN NEW.asset_id IS NOT NULL AND (SELECT COUNT(*) FROM asset_note_drawers WHERE asset_id=NEW.asset_id) >= 3
BEGIN SELECT RAISE(ABORT,'每个资产最多允许 3 个备注抽屉'); END;
CREATE TRIGGER trg_asset_note_drawers_transfer_limit BEFORE UPDATE OF asset_id ON asset_note_drawers
WHEN NEW.asset_id IS NOT NULL AND NEW.asset_id IS NOT OLD.asset_id AND (SELECT COUNT(*) FROM asset_note_drawers WHERE asset_id=NEW.asset_id) >= 3
BEGIN SELECT RAISE(ABORT,'每个资产最多允许 3 个备注抽屉'); END;
CREATE TRIGGER trg_asset_note_drawers_category_move AFTER UPDATE OF category_id ON assets
WHEN NEW.category_id <> OLD.category_id
BEGIN UPDATE asset_note_drawers SET category_id=NEW.category_id WHERE asset_id=NEW.id; END;
