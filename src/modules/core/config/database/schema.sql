-- Config module schema
-- Stores configuration key-value pairs

CREATE TABLE IF NOT EXISTS configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_configs_key ON configs(key);

-- Trigger to update updated_at on modifications
CREATE TRIGGER IF NOT EXISTS update_configs_updated_at
AFTER UPDATE ON configs
BEGIN
  UPDATE configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;