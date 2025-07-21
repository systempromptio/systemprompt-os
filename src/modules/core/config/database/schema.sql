-- Config Module Database Schema
-- This file defines all tables needed for configuration management

-- Configuration settings table
CREATE TABLE IF NOT EXISTS config_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'string',
  description TEXT,
  encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Providers table for managing external service integrations
CREATE TABLE IF NOT EXISTS config_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSON NOT NULL DEFAULT '{}',
  metadata JSON DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_config_settings_key ON config_settings(key);
CREATE INDEX IF NOT EXISTS idx_config_settings_type ON config_settings(type);
CREATE INDEX IF NOT EXISTS idx_config_providers_name ON config_providers(name);
CREATE INDEX IF NOT EXISTS idx_config_providers_type ON config_providers(type);
CREATE INDEX IF NOT EXISTS idx_config_providers_enabled ON config_providers(enabled);
CREATE INDEX IF NOT EXISTS idx_config_providers_priority ON config_providers(priority);