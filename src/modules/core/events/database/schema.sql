-- Events module schema
-- Stores event history for auditing

CREATE TABLE IF NOT EXISTS event_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  event_data TEXT,
  emitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_history_name ON event_history(event_name);
CREATE INDEX IF NOT EXISTS idx_event_history_emitted_at ON event_history(emitted_at);