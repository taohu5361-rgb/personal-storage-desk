CREATE TABLE IF NOT EXISTS category_text_blocks (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_category_text_owner ON category_text_blocks(category_id);
