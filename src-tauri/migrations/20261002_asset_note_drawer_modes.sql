ALTER TABLE asset_note_drawers ADD COLUMN mode TEXT NOT NULL DEFAULT 'docked-expanded' CHECK (mode IN ('floating', 'docked-expanded', 'docked-collapsed'));
ALTER TABLE asset_note_drawers ADD COLUMN floating_x REAL NOT NULL DEFAULT 0;
ALTER TABLE asset_note_drawers ADD COLUMN floating_y REAL NOT NULL DEFAULT 0;
