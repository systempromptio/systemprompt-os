-- Initialize resources database
-- This file is run when the module is first loaded

-- Insert default resources
INSERT OR IGNORE INTO resources (uri, name, description, mime_type, content_type, content, metadata) VALUES
  (
    'system://status',
    'System Status',
    'Current system status and health information',
    'application/json',
    'text',
    '{"status": "operational", "version": "1.0.0", "uptime": "{{uptime}}", "timestamp": "{{timestamp}}"}',
    '{"dynamic": true}'
  ),
  (
    'config://environment',
    'Environment Configuration', 
    'Current environment configuration settings',
    'application/json',
    'text',
    '{"environment": "development", "debug": true, "modules": ["auth", "database", "logger", "prompts", "resources"]}',
    NULL
  ),
  (
    'docs://getting-started',
    'Getting Started Guide',
    'Quick start guide for new users',
    'text/markdown',
    'text',
    '# Getting Started\n\nWelcome to SystemPrompt OS!\n\n## Quick Start\n\n1. List available prompts: `systemprompt prompts list`\n2. List available resources: `systemprompt resources list`\n3. Get help: `systemprompt --help`\n\n## Next Steps\n\n- Explore the available modules\n- Create custom prompts and resources\n- Build your own modules',
    NULL
  ),
  (
    'template://greeting',
    'Greeting Template',
    'A customizable greeting message template',
    'text/plain',
    'template',
    'Hello {{name}}! Welcome to {{system}}. Today is {{date}}.',
    '{"variables": ["name", "system", "date"]}'
  );