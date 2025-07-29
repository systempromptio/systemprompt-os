-- Events module database schema for event audit and persistence

-- Events audit table for tracking all events
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    event_data TEXT, -- JSON data, justified for flexible event payload storage
    emitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    module_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Event subscriptions table for tracking active listeners
CREATE TABLE IF NOT EXISTS event_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    subscriber_module TEXT NOT NULL,
    handler_name TEXT,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_emitted_at ON events(emitted_at);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_event_name ON event_subscriptions(event_name);
CREATE INDEX IF NOT EXISTS idx_event_subscriptions_active ON event_subscriptions(active);