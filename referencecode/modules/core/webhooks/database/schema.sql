-- Webhooks module database schema

-- Webhooks configuration table
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'POST',
    events TEXT NOT NULL, -- JSON array
    headers TEXT DEFAULT '{}', -- JSON object
    auth TEXT, -- JSON object
    retry TEXT NOT NULL DEFAULT '{"enabled":true,"max_attempts":3,"strategy":"exponential","initial_delay":1000}', -- JSON object
    timeout INTEGER NOT NULL DEFAULT 30000,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed', 'suspended')),
    metadata TEXT DEFAULT '{}', -- JSON object
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Webhook delivery records table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL,
    headers TEXT NOT NULL, -- JSON object
    payload TEXT NOT NULL, -- JSON object
    attempt INTEGER NOT NULL DEFAULT 1,
    status_code INTEGER,
    response_body TEXT,
    response_headers TEXT, -- JSON object
    duration INTEGER, -- milliseconds
    error TEXT,
    delivered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_webhooks_timestamp 
AFTER UPDATE ON webhooks
BEGIN
    UPDATE webhooks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;