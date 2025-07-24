-- Initial configuration data

-- System configuration defaults
INSERT OR IGNORE INTO config_settings (key, value, type, description) VALUES
  ('system.name', 'SystemPrompt OS', 'string', 'System display name'),
  ('system.version', '1.0.0', 'string', 'Current system version'),
  ('system.environment', 'development', 'string', 'Runtime environment'),
  ('system.debug', 'false', 'boolean', 'Enable debug mode'),
  ('system.log_level', 'info', 'string', 'Logging level: error, warn, info, debug'),
  ('api.port', '3000', 'number', 'API server port'),
  ('api.host', 'localhost', 'string', 'API server host'),
  ('api.cors_enabled', 'true', 'boolean', 'Enable CORS support'),
  ('security.jwt_secret', '${JWT_SECRET}', 'string', 'JWT signing secret (from env)'),
  ('security.session_timeout', '86400', 'number', 'Session timeout in seconds'),
  ('security.max_login_attempts', '5', 'number', 'Maximum login attempts before lockout');

-- Default provider configurations
INSERT OR IGNORE INTO config_providers (name, type, enabled, config, priority) VALUES
  ('local', 'authentication', 1, '{"strategy": "local", "passwordMinLength": 8}', 100),
  ('github', 'oauth', 0, '{"clientId": "${GITHUB_CLIENT_ID}", "clientSecret": "${GITHUB_CLIENT_SECRET}", "scope": "user:email"}', 90),
  ('google', 'oauth', 0, '{"clientId": "${GOOGLE_CLIENT_ID}", "clientSecret": "${GOOGLE_CLIENT_SECRET}", "scope": "openid profile email"}', 80);