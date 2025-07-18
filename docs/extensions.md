# systemprompt-os Extensions System

## Overview

The extensions system in systemprompt-os provides a powerful way to extend the platform's capabilities without modifying the core codebase. You can add custom MCP servers and modules that integrate seamlessly with the existing system.

## Extension Types

### 1. Local Extensions

Local extensions are implemented as code that lives in the `extensions/` directory. At startup, systemprompt-os automatically:
- Discovers local extension code
- Creates symlinks to the appropriate locations in `src/`
- Loads and initializes the extensions

**Advantages:**
- Full access to systemprompt-os APIs and types
- Can be version controlled with your configuration
- Easy to debug and develop
- No network latency

### 2. Remote Extensions

Remote extensions are external services that implement the MCP protocol or module interfaces. They are accessed via HTTP/HTTPS URLs.

**Advantages:**
- Can be hosted separately from systemprompt-os
- Language-agnostic (any language that can serve HTTP)
- Can scale independently
- Can be shared across multiple systemprompt-os instances

## Directory Structure

```
extensions/
├── servers.yaml            # MCP server definitions
├── modules.yaml            # Module definitions
├── servers/                # Local server implementations
│   ├── my-custom-server/  # Example custom server
│   │   ├── index.ts       # Server implementation
│   │   ├── handlers/      # Request handlers
│   │   └── README.md      # Server documentation
│   └── another-server/    # Another custom server
└── modules/                # Local module implementations
    ├── my-plugin/         # Example plugin module
    │   ├── module.yaml    # Module metadata
    │   ├── index.ts       # Module implementation
    │   └── README.md      # Module documentation
    └── my-daemon/         # Example daemon module
```

## Configuration Files

### servers.yaml

Defines custom MCP servers, both local and remote.

```yaml
# extensions/servers.yaml
servers:
  # Local server example
  - name: my-custom-server
    type: local
    path: ./servers/my-custom-server
    description: "Custom MCP server for specialized operations"
    config:
      # Server-specific configuration
      apiKey: ${MY_API_KEY}
      timeout: 30000
  
  # Remote server example
  - name: github-mcp
    type: remote
    url: https://api.github.com/mcp/v1
    description: "GitHub MCP server for repository operations"
    auth:
      type: bearer
      token: ${GITHUB_TOKEN}
    headers:
      X-GitHub-Api-Version: "2022-11-28"
  
  # Another remote example with OAuth
  - name: slack-mcp
    type: remote
    url: https://slack.com/api/mcp
    description: "Slack MCP server for messaging"
    auth:
      type: oauth2
      clientId: ${SLACK_CLIENT_ID}
      clientSecret: ${SLACK_CLIENT_SECRET}
      scopes: ["chat:write", "channels:read"]
```

### modules.yaml

Defines custom modules that extend systemprompt-os functionality.

```yaml
# extensions/modules.yaml
modules:
  # Local plugin module
  - name: redis-memory
    type: local
    path: ./modules/redis-memory
    moduleType: plugin
    provides: memory
    description: "Redis-based memory provider"
    config:
      host: localhost
      port: 6379
      db: 0
  
  # Local daemon module
  - name: backup-daemon
    type: local
    path: ./modules/backup-daemon
    moduleType: daemon
    description: "Automated backup daemon"
    config:
      interval: 1h
      destination: /backups
      retain: 7
  
  # Remote service module
  - name: analytics-service
    type: remote
    url: https://analytics.example.com/api
    moduleType: service
    description: "Analytics and metrics service"
    auth:
      type: apiKey
      key: ${ANALYTICS_API_KEY}
      header: X-API-Key
```

## Creating Local Extensions

### Local MCP Server

1. Create a directory in `extensions/servers/`:
```bash
mkdir -p extensions/servers/my-server
```

2. Implement the server handler:
```typescript
// extensions/servers/my-server/index.ts
import { RequestHandler } from 'express';
import { MCPRequest, MCPResponse } from '@/domain/mcp/types';

export function createMCPHandler(): RequestHandler {
  return async (req, res) => {
    const request: MCPRequest = req.body;
    
    switch (request.method) {
      case 'tools/list':
        res.json({
          tools: [
            {
              name: 'my_custom_tool',
              description: 'A custom tool from my extension',
              inputSchema: {
                type: 'object',
                properties: {
                  input: { type: 'string' }
                },
                required: ['input']
              }
            }
          ]
        });
        break;
        
      case 'tools/call':
        if (request.params.name === 'my_custom_tool') {
          // Implement tool logic
          res.json({
            content: [{
              type: 'text',
              text: `Processed: ${request.params.arguments.input}`
            }]
          });
        }
        break;
        
      default:
        res.status(404).json({
          error: { message: 'Method not found' }
        });
    }
  };
}

// Optional: Export metadata
export const metadata = {
  name: 'my-server',
  version: '1.0.0',
  description: 'My custom MCP server'
};
```

3. Add to `servers.yaml`:
```yaml
servers:
  - name: my-server
    type: local
    path: ./servers/my-server
    description: "My custom MCP server"
```

### Local Module

1. Create a directory in `extensions/modules/`:
```bash
mkdir -p extensions/modules/my-backup
```

2. Create module metadata:
```yaml
# extensions/modules/my-backup/module.yaml
name: my-backup
type: daemon
version: 1.0.0
description: Custom backup daemon
config:
  interval: 30m
  destination: ./backups
```

3. Implement the module:
```typescript
// extensions/modules/my-backup/index.ts
import { Daemon } from '@/domain/module-system';
import * as fs from 'fs/promises';
import * as path from 'path';

export class BackupDaemon implements Daemon {
  private interval: NodeJS.Timer | null = null;
  
  constructor(private config: any) {}
  
  async initialize(): Promise<void> {
    // Ensure backup directory exists
    await fs.mkdir(this.config.destination, { recursive: true });
  }
  
  async start(): Promise<void> {
    const intervalMs = this.parseInterval(this.config.interval);
    
    this.interval = setInterval(async () => {
      await this.performBackup();
    }, intervalMs);
    
    // Perform initial backup
    await this.performBackup();
  }
  
  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  
  private async performBackup(): Promise<void> {
    const timestamp = new Date().toISOString();
    const backupPath = path.join(
      this.config.destination,
      `backup-${timestamp}.tar.gz`
    );
    
    // Implement backup logic
    console.log(`Creating backup at ${backupPath}`);
  }
  
  private parseInterval(interval: string): number {
    // Parse intervals like "30m", "1h", "24h"
    const match = interval.match(/^(\d+)([mh])$/);
    if (!match) throw new Error(`Invalid interval: ${interval}`);
    
    const [, value, unit] = match;
    const multiplier = unit === 'm' ? 60 * 1000 : 60 * 60 * 1000;
    return parseInt(value) * multiplier;
  }
}

// Export factory function
export default function createDaemon(config: any): Daemon {
  return new BackupDaemon(config);
}
```

4. Add to `modules.yaml`:
```yaml
modules:
  - name: my-backup
    type: local
    path: ./modules/my-backup
    moduleType: daemon
    description: "Custom backup daemon"
```

## Creating Remote Extensions

### Remote MCP Server

Remote MCP servers must implement the MCP protocol over HTTP/HTTPS. Here's an example using Node.js and Express:

```javascript
// remote-server.js
const express = require('express');
const app = express();

app.use(express.json());

// MCP endpoint
app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  
  switch (method) {
    case 'tools/list':
      res.json({
        tools: [{
          name: 'remote_tool',
          description: 'A tool from remote server',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            }
          }
        }]
      });
      break;
      
    case 'tools/call':
      if (params.name === 'remote_tool') {
        // Process the tool call
        const result = await processQuery(params.arguments.query);
        res.json({
          content: [{
            type: 'text',
            text: result
          }]
        });
      }
      break;
      
    default:
      res.status(404).json({
        error: { message: 'Method not found' }
      });
  }
});

app.listen(3000, () => {
  console.log('Remote MCP server running on port 3000');
});
```

Configure in `servers.yaml`:
```yaml
servers:
  - name: my-remote-server
    type: remote
    url: https://my-server.example.com/mcp
    description: "Remote MCP server"
    auth:
      type: bearer
      token: ${REMOTE_SERVER_TOKEN}
```

## Registry Loading Process

When systemprompt-os starts, the extension registry:

1. **Reads Configuration Files**
   - Loads `extensions/servers.yaml` and `extensions/modules.yaml`
   - Validates configuration schemas
   - Resolves environment variables

2. **Processes Local Extensions**
   - Discovers code in `extensions/servers/` and `extensions/modules/`
   - Creates symlinks:
     - `extensions/servers/xyz` → `src/server/mcp/custom/xyz`
     - `extensions/modules/xyz` → `src/modules/custom/xyz`
   - Loads and initializes the extensions

3. **Registers Remote Extensions**
   - Creates proxy handlers for remote servers
   - Sets up authentication middleware
   - Configures request forwarding

4. **Validates Extensions**
   - Ensures no naming conflicts
   - Verifies required dependencies
   - Checks API compatibility

## Authentication for Remote Extensions

### Bearer Token
```yaml
auth:
  type: bearer
  token: ${API_TOKEN}
```

### API Key
```yaml
auth:
  type: apiKey
  key: ${API_KEY}
  header: X-API-Key  # or 'query' for query parameter
```

### OAuth2
```yaml
auth:
  type: oauth2
  clientId: ${CLIENT_ID}
  clientSecret: ${CLIENT_SECRET}
  tokenUrl: https://oauth.example.com/token
  scopes: ["read", "write"]
```

### Basic Auth
```yaml
auth:
  type: basic
  username: ${USERNAME}
  password: ${PASSWORD}
```

## Environment Variables

Extensions can use environment variables in their configuration:

```yaml
servers:
  - name: my-server
    type: local
    path: ./servers/my-server
    config:
      apiKey: ${MY_API_KEY}
      endpoint: ${MY_API_ENDPOINT:-https://default.example.com}
```

Variables are resolved from:
1. Process environment
2. `.env` file
3. Default values (using `${VAR:-default}` syntax)

## Best Practices

### 1. Naming Conventions
- Use kebab-case for extension names
- Prefix with your organization/namespace to avoid conflicts
- Be descriptive but concise

### 2. Error Handling
- Always validate input parameters
- Return appropriate error codes and messages
- Log errors for debugging

### 3. Documentation
- Include a README.md in each extension directory
- Document configuration options
- Provide usage examples

### 4. Security
- Never hardcode secrets
- Use environment variables for sensitive data
- Validate all inputs
- Implement rate limiting for remote extensions

### 5. Performance
- Cache responses when appropriate
- Use connection pooling for databases
- Implement timeouts
- Monitor resource usage

## Troubleshooting

### Extension Not Loading

1. Check the logs for errors:
```bash
tail -f state/logs/system.log | grep extension
```

2. Verify configuration syntax:
```bash
systemprompt extensions:validate
```

3. Ensure file permissions are correct:
```bash
ls -la extensions/
```

### Symlink Issues

If symlinks aren't created:
1. Check write permissions in `src/`
2. Verify the extension path exists
3. Look for naming conflicts

### Remote Extension Connection Failed

1. Test the endpoint directly:
```bash
curl -X POST https://remote.example.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'
```

2. Check authentication configuration
3. Verify SSL certificates
4. Check firewall rules

## Examples

### Example 1: Database Backup MCP Server

```typescript
// extensions/servers/db-backup/index.ts
import { RequestHandler } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function createMCPHandler(): RequestHandler {
  return async (req, res) => {
    const { method, params } = req.body;
    
    if (method === 'tools/list') {
      res.json({
        tools: [{
          name: 'backup_database',
          description: 'Create a database backup',
          inputSchema: {
            type: 'object',
            properties: {
              database: { type: 'string' },
              compress: { type: 'boolean', default: true }
            },
            required: ['database']
          }
        }]
      });
      return;
    }
    
    if (method === 'tools/call' && params.name === 'backup_database') {
      try {
        const { database, compress = true } = params.arguments;
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `backup-${database}-${timestamp}.sql${compress ? '.gz' : ''}`;
        
        const command = compress
          ? `pg_dump ${database} | gzip > /backups/${filename}`
          : `pg_dump ${database} > /backups/${filename}`;
          
        await execAsync(command);
        
        res.json({
          content: [{
            type: 'text',
            text: `Database backup created: ${filename}`
          }]
        });
      } catch (error) {
        res.status(500).json({
          error: { message: error.message }
        });
      }
      return;
    }
    
    res.status(404).json({
      error: { message: 'Method not found' }
    });
  };
}
```

### Example 2: Notification Module

```typescript
// extensions/modules/notifications/index.ts
import { Plugin } from '@/domain/module-system';
import nodemailer from 'nodemailer';

export class NotificationPlugin implements Plugin {
  private transporter: nodemailer.Transporter;
  
  constructor(private config: any) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
  }
  
  async initialize(): Promise<void> {
    // Verify SMTP connection
    await this.transporter.verify();
  }
  
  async sendNotification(to: string, subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject,
      text: body,
      html: body
    });
  }
  
  // Plugin interface methods
  async execute(action: string, params: any): Promise<any> {
    switch (action) {
      case 'send':
        await this.sendNotification(params.to, params.subject, params.body);
        return { success: true };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
}

export default function createPlugin(config: any): Plugin {
  return new NotificationPlugin(config);
}
```

Configuration:
```yaml
# extensions/modules.yaml
modules:
  - name: notifications
    type: local
    path: ./modules/notifications
    moduleType: plugin
    provides: notifications
    config:
      smtp:
        host: smtp.gmail.com
        port: 587
        secure: false
        user: ${SMTP_USER}
        pass: ${SMTP_PASS}
      from: "systemprompt-os <noreply@example.com>"
```

## Integration with Core System

Extensions integrate seamlessly with the core system:

1. **MCP Servers** appear in the server registry and can be accessed via:
   - `/mcp/{server-name}` HTTP endpoint
   - WebSocket connections
   - Internal API calls

2. **Modules** integrate based on their type:
   - **Plugins**: Available through the plugin registry
   - **Services**: Accessible via dependency injection
   - **Daemons**: Managed by the process supervisor

3. **CLI Commands**: Extensions can provide CLI commands that are auto-discovered:
   ```bash
   systemprompt my-extension:command
   ```

4. **Events**: Extensions can emit and listen to system events:
   ```typescript
   eventBus.emit('extension.my-event', { data: 'value' });
   eventBus.on('system.startup', async () => {
     // Initialize extension
   });
   ```

## Testing Extensions

### Unit Testing

Extensions should include unit tests that follow the standard naming convention:
- Source: `extensions/servers/my-server/index.ts`
- Test: `extensions/servers/my-server/tests/unit/index.spec.ts`

### E2E Testing

When adding extensions that introduce new domains, follow the domain-based E2E testing pattern:

1. **Create a new domain test file** in `tests/e2e/`:
   - Pattern: `XX-extension-name.e2e.test.ts`
   - Example: `05-extension-weather.e2e.test.ts`

2. **Import in the main orchestrator**:
   ```typescript
   // tests/e2e/index.e2e.test.ts
   import './05-extension-weather.e2e.test';
   ```

3. **Structure your domain tests**:
   ```typescript
   describe('[05] Weather Extension Domain', () => {
     describe('Weather API', () => {
       it('should fetch current weather', async () => {
         // Test implementation
       });
     });
   });
   ```

### Testing Best Practices for Extensions

1. **Test in isolation**: Unit tests should not depend on external services
2. **Mock dependencies**: Use the mocks folder with proper naming conventions
3. **E2E coverage**: Test critical paths and integration points
4. **Docker compatibility**: Ensure extensions work in the containerized environment
5. **Error scenarios**: Test failure cases and error handling

## Conclusion

The extensions system in systemprompt-os provides a powerful and flexible way to extend the platform's capabilities. Whether you're adding custom tools, integrating with external services, or implementing new functionality, extensions allow you to do so without modifying the core codebase.

Start with local extensions for rapid development and testing, then consider remote extensions for production deployments or when you need language-agnostic implementations. The combination of both approaches gives you the flexibility to build exactly what you need while maintaining the integrity of the core system.