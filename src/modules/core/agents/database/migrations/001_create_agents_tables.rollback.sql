-- Rollback migration: Drop agents tables

DROP TRIGGER IF EXISTS update_agents_timestamp;
DROP INDEX IF EXISTS idx_agent_logs_timestamp;
DROP INDEX IF EXISTS idx_agent_logs_level;
DROP INDEX IF EXISTS idx_agent_logs_agent_id;
DROP INDEX IF EXISTS idx_agent_tasks_priority;
DROP INDEX IF EXISTS idx_agent_tasks_status;
DROP INDEX IF EXISTS idx_agent_tasks_agent_id;
DROP INDEX IF EXISTS idx_agents_status;
DROP INDEX IF EXISTS idx_agents_type;
DROP INDEX IF EXISTS idx_agents_name;

DROP TABLE IF EXISTS agent_logs;
DROP TABLE IF EXISTS agent_tasks;
DROP TABLE IF EXISTS agents;