-- Initial data for events module

-- Default event handlers for system events
INSERT OR IGNORE INTO event_handlers (id, event_type, executor_type, configuration, priority, enabled)
VALUES 
  ('system-webhook-handler', 'webhook.*', 'webhook', '{}', 100, 1),
  ('system-health-handler', 'system.health.*', 'webhook', '{}', 90, 1);

-- Default event statistics
INSERT OR IGNORE INTO event_stats (event_type, total_count, success_count, failure_count, pending_count)
VALUES 
  ('webhook.triggered', 0, 0, 0, 0),
  ('webhook.delivered', 0, 0, 0, 0),
  ('workflow.started', 0, 0, 0, 0),
  ('workflow.completed', 0, 0, 0, 0),
  ('task.executed', 0, 0, 0, 0);