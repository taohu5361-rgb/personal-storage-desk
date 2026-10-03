CREATE TABLE asset_text_elements (
id TEXT PRIMARY KEY,
asset_id TEXT NOT NULL,
style_type TEXT NOT NULL,
title TEXT NOT NULL,
content TEXT NOT NULL,
font_family TEXT NOT NULL,
font_size INTEGER NOT NULL,
font_weight INTEGER NOT NULL,
text_color TEXT NOT NULL,
text_align TEXT NOT NULL,
line_height REAL NOT NULL,
border_enabled INTEGER NOT NULL,
border_color TEXT NOT NULL,
border_width REAL NOT NULL,
border_radius REAL NOT NULL,
background_color TEXT NOT NULL,
background_opacity REAL NOT NULL,
shadow INTEGER NOT NULL,
created_at INTEGER NOT NULL,
updated_at INTEGER NOT NULL, FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
CREATE TABLE asset_text_layouts (
text_id TEXT NOT NULL, asset_id TEXT NOT NULL, view_mode TEXT NOT NULL CHECK(view_mode IN ('standard','canvas')),
x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,z_index INTEGER NOT NULL,locked INTEGER NOT NULL CHECK(locked IN(0,1)),group_id TEXT,
PRIMARY KEY(text_id,view_mode),FOREIGN KEY(text_id) REFERENCES asset_text_elements(id) ON DELETE CASCADE,FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE);
CREATE INDEX idx_asset_text_elements_asset ON asset_text_elements(asset_id);
CREATE INDEX idx_asset_text_layouts_asset_view ON asset_text_layouts(asset_id,view_mode);
INSERT INTO asset_text_elements (id,asset_id,style_type,title,content,font_family,font_size,font_weight,text_color,text_align,line_height,border_enabled,border_color,border_width,border_radius,background_color,background_opacity,shadow,created_at,updated_at) SELECT id,asset_id,style_type,title,content,font_family,font_size,font_weight,text_color,text_align,line_height,border_enabled,border_color,border_width,border_radius,background_color,background_opacity,shadow,created_at,updated_at FROM canvas_text_blocks;
INSERT INTO asset_text_layouts(text_id,asset_id,view_mode,x,y,width,height,z_index,locked,group_id)
SELECT id,asset_id,'canvas',x,y,width,height,z_index,locked,group_id FROM canvas_text_blocks;
