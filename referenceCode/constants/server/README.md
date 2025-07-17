# Server Configuration Constants

Server-level configuration and metadata for the SystemPrompt Coding Agent MCP server, defining capabilities, protocol version, and runtime settings.

## Overview

This directory contains the core server configuration that defines how the MCP server presents itself to clients and what capabilities it offers. It follows the MCP specification for server implementation metadata.

## Files

### 📄 `server-config.ts`

Complete MCP server configuration including:

#### Server Implementation (`serverConfig`)
```typescript
export const serverConfig: Implementation = {
  name: "systemprompt-coding-agent",
  version: "0.01",
  metadata: {
    name: "SystemPrompt Coding Agent",
    description: "MCP server for orchestrating Claude Code CLI...",
    icon: "code",
    color: "blue",
    serverStartTime: Date.now(),
    environment: process.env.NODE_ENV || "production",
    customData: {
      serverType: "coding-agent-orchestrator",
      implementationFeatures: [
        "task-orchestration",
        "agent-management",
        "state-persistence",
        "real-time-notifications"
      ]
    }
  }
};
```

#### Server Capabilities (`serverCapabilities`)
```typescript
export const serverCapabilities: ServerCapabilities = {
  tools: {}, // Tools defined separately
  prompts: {}, // Prompts available
  resources: {}, // Resources exposed
  notifications: true // Real-time updates
};
```

#### Additional Configuration (`SERVER_CONFIG`)
```typescript
export const SERVER_CONFIG = {
  SESSION_TIMEOUT_MS: 1800000, // 30 minutes
  REQUEST_SIZE_LIMIT: "10mb",
  RATE_LIMIT: {
    window: 60000, // 1 minute
    max: 100 // requests per window
  },
  PROTOCOL_VERSION: "2025-06-18",
  FEATURES: {
    asyncTaskExecution: true,
    multiAgentSupport: true,
    branchBasedExecution: true,
    statePersistence: true
  }
};
```

## MCP Protocol Version

The server implements MCP protocol version **2025-06-18** (latest stable) as defined in the specification.

## Capabilities Explained

### Tools ✅
The server provides tools for:
- **Task Management**: Create, update, monitor tasks
- **Agent Control**: Manage Claude Code and Gemini sessions
- **State Operations**: Clean, persist, restore state
- **System Utilities**: Check status, get prompts

### Prompts ✅
Dynamic prompt generation for:
- Bug fixing workflows
- Unit test creation
- React component development
- Custom coding patterns

### Resources ✅
Structured data access:
- Task outputs and logs
- Resource templates
- Task history
- System state

### Notifications ✅
Real-time updates for:
- Task status changes
- Agent progress
- Resource updates
- System events

## Server Metadata

### Implementation Features

The server advertises these features:
- **task-orchestration**: Manages coding tasks
- **agent-management**: Controls AI agents
- **state-persistence**: Saves task state
- **real-time-notifications**: WebSocket updates
- **branch-execution**: Git branch integration
- **multi-tool-support**: Multiple agent types

### Environment Information

Runtime data included:
```typescript
{
  serverStartTime: Date.now(),
  environment: process.env.NODE_ENV,
  nodeVersion: process.version,
  platform: process.platform
}
```

## Configuration Details

### Session Management
- **Timeout**: 30 minutes of inactivity
- **Cleanup**: Automatic on disconnect
- **Persistence**: Optional state saving

### Rate Limiting
- **Window**: 1 minute rolling
- **Limit**: 100 requests per window
- **Per-client**: Individual tracking

### Request Handling
- **Size Limit**: 10MB per request
- **Timeout**: 5 minutes for long operations
- **Compression**: gzip supported

## Usage

### Import Configuration

```typescript
import { 
  serverConfig, 
  serverCapabilities,
  SERVER_CONFIG 
} from '@/constants/server/server-config';

// Initialize MCP server
const server = new Server(serverConfig, serverCapabilities);

// Use additional config
app.use(express.json({ limit: SERVER_CONFIG.REQUEST_SIZE_LIMIT }));
```

### Accessing Metadata

```typescript
// Get server info
const serverInfo = {
  ...serverConfig,
  uptime: Date.now() - serverConfig.metadata.serverStartTime,
  capabilities: Object.keys(serverCapabilities)
};
```

## Customization

### Adding Features

To add new features:

1. **Update Capabilities**
   ```typescript
   export const serverCapabilities = {
     ...existing,
     myFeature: { enabled: true }
   };
   ```

2. **Update Metadata**
   ```typescript
   customData: {
     implementationFeatures: [
       ...existing,
       "my-new-feature"
     ]
   }
   ```

3. **Update Config**
   ```typescript
   FEATURES: {
     ...existing,
     myFeature: true
   }
   ```

### Environment-Specific Config

```typescript
const isDev = process.env.NODE_ENV === 'development';

export const SERVER_CONFIG = {
  SESSION_TIMEOUT_MS: isDev ? 3600000 : 1800000,
  RATE_LIMIT: {
    max: isDev ? 1000 : 100
  }
};
```

## Best Practices

1. **Version Management**: Update version on releases
2. **Feature Flags**: Use config for toggling features
3. **Environment Vars**: Override defaults via env
4. **Type Safety**: Always use TypeScript types
5. **Documentation**: Keep metadata descriptive

## Security Considerations

- Rate limiting prevents abuse
- Request size limits prevent DoS
- Session timeouts limit resource usage
- Environment isolation for secrets

## Monitoring

The configuration exposes metrics:
- Server uptime
- Active features
- Protocol version
- Environment status

## Future Enhancements

Planned additions:
- OAuth 2.1 authentication config
- Advanced rate limiting rules
- Feature deprecation notices
- Client version requirements

This configuration forms the foundation of how the MCP server presents itself and operates within the Model Context Protocol ecosystem.