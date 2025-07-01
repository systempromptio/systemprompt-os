# Systemprompt Coding Agent - Architecture Documentation

## Fundamental Architecture: Host-Daemon-Docker Bridge

### Overview

**CRITICAL WORKING DIRECTORY**: The daemon MUST execute all commands in `/var/www/html/systemprompt-coding-agent` on the host machine. This is where:
- Git operations are performed
- Claude processes are spawned
- Files are created and modified
- The actual project repository exists

The Systemprompt Coding Agent uses a three-tier architecture:

1. **Host Machine**: Where the actual project files and git repositories exist (`/var/www/html/systemprompt-coding-agent`)
2. **Daemon (Host Bridge)**: A Node.js process running on the host that acts as a bridge
3. **Docker Container (MCP Server)**: The isolated environment running the MCP protocol server

### Critical Design Principle: Git Operations on Host

**IMPORTANT**: All git operations and file manipulations MUST happen on the host machine through the daemon, NOT inside the Docker container.

### Branch Naming Convention

**IMPORTANT**: Git branches MUST include timestamps to ensure uniqueness. Format: `{feature-name}-{timestamp}`
Example: `e2e-test-1751103517466`

### Branch-Based Task Execution Flow

When a task is created with a specific branch:

1. **Task Creation (Docker → Daemon)**
   - MCP server receives `create_task` with branch parameter
   - MCP server requests daemon to prepare the environment

2. **Environment Preparation (Daemon on Host)**
   - Daemon executes on the HOST machine:
     ```bash
     cd /path/to/project  # Navigate to project root on HOST
     git stash           # Save any uncommitted changes
     git checkout -b feature-branch  # Create/switch to the branch
     ```

3. **Agent Process Creation (Daemon on Host)**
   - Daemon spawns Claude process IN THE SAME SHELL SESSION
   - This ensures the AI agent operates on the correct branch
   - Working directory is set to the project root on HOST

4. **Task Execution (AI Agent on Host)**
   - Claude runs with the checked-out branch
   - All file operations happen directly on HOST filesystem
   - Changes are made to the actual project files

5. **Task Completion**
   - Changes remain on the feature branch
   - User can review, commit, and push as needed

### Why This Architecture?

1. **Docker Container Isolation**: The MCP server runs in Docker for consistency and isolation
2. **No Git in Docker**: Docker container has no git - it's just the protocol server
3. **Host File Access**: Daemon provides controlled access to host filesystem
4. **Branch Isolation**: Each task can work on its own git branch
5. **Real File Changes**: AI agents modify actual project files, not container copies

### Implementation Details

#### Daemon Responsibilities
- Execute shell commands on host (git, file operations)
- Spawn AI agent processes (claude) with proper environment
- Maintain working directory context
- Stream output back to Docker container

#### Docker Container Responsibilities
- Run MCP protocol server
- Handle client connections
- Validate requests
- Delegate execution to daemon

#### Communication Flow
```
Client → MCP Server (Docker) → Daemon (Host) → AI Agent Process (Host)
                                      ↓
                                Git Repository (Host)
```

### Key Code Locations

- **Daemon**: `/daemon/src/host-bridge-daemon.ts`
- **Create Task Handler**: `/src/handlers/tools/orchestrator/create-task.ts`
- **Agent Manager**: `/src/services/agent-manager.ts`

### Testing

E2E tests must verify:
1. Branch is created on host before agent starts
2. Agent process runs in the context of that branch
3. File changes appear in the correct branch
4. Git status shows changes in the expected branch

### Common Pitfalls to Avoid

1. **DON'T** try to run git commands inside Docker container
2. **DON'T** copy files between Docker and host unnecessarily  
3. **DON'T** assume Docker container has access to git state
4. **DO** always use daemon for host operations
5. **DO** verify branch context before starting agents
6. **DO** maintain clear separation of concerns

### Example Task Flow

```typescript
// 1. Task created with branch
create_task({
  tool: "CLAUDECODE",
  branch: "feature/add-auth",
  instructions: "Add JWT authentication"
})

// 2. Daemon executes (on HOST):
// $ cd /project/root
// $ git checkout -b feature/add-auth
// $ claude "Add JWT authentication"

// 3. Claude runs on HOST in feature/add-auth branch
// Makes changes directly to project files

// 4. After completion:
// $ git status
// On branch feature/add-auth
// Changes not staged for commit:
//   modified: src/auth.ts
//   new file: src/jwt.ts
```

This architecture ensures that AI agents work with real project files on the correct git branches, while maintaining the benefits of Docker containerization for the MCP server.

## Internet Tunnel Setup for Docker Container

The MCP server runs in a Docker container and can be exposed to the internet via Cloudflare tunnel. This allows remote access to the local Docker container through an HTTPS URL.

### Key Requirements:
1. **Docker Container**: MCP server runs on port 3000 inside Docker, mapped to host port 3000
2. **Cloudflare Tunnel**: Creates HTTPS tunnel pointing to `http://localhost:3000` (the Docker container)
3. **Test Connection**: E2E tests must connect to the Docker container via the HTTPS tunnel URL

### Usage:
```bash
# Terminal 1: Start server with tunnel
npm run tunnel

# Terminal 2: Run tests against tunnel URL
npm run test:tunnel
```

### How It Works:
1. `npm run tunnel` starts cloudflared pointing to localhost:3000 (Docker container)
2. Tunnel URL is saved to `.tunnel-url` file
3. Docker container receives TUNNEL_URL environment variable
4. Tests automatically detect and use the HTTPS tunnel URL
5. All requests go: Internet → Cloudflare → Tunnel → Docker Container

### Environment Variables:
- `TUNNEL_URL`: The HTTPS URL of the Cloudflare tunnel
- `TUNNEL_ENABLED`: Set to "true" when tunnel is active
- `PUBLIC_URL`: Alias for TUNNEL_URL
- `MCP_BASE_URL`: Override for test connections

### Test URL Detection Priority:
1. `MCP_BASE_URL` environment variable (if set)
2. `.tunnel-url` file (created by tunnel script)
3. `TUNNEL_URL` environment variable
4. Falls back to `http://127.0.0.1:3000` if no tunnel
## Claude Event System

The SystemPrompt Coding Agent captures strongly-typed events from Claude processes to provide detailed insights into tool usage, execution flow, and performance.

### Architecture

```
Host Machine                    Docker Container
------------                    ----------------
Claude Process                  MCP Server
    ↓                              ↓
Daemon captures  →→→→→→→→→→→→  Event Parser
stdout/stderr                   processes stream
                                   ↓
                                Strongly-typed Events
                                   ↓
                                Task Logs
```

### Event Types

The system captures these strongly-typed Claude events:

- **process:start**: When Claude process starts (includes PID, command, working directory)
- **process:end**: When Claude process ends (includes exit code, duration)
- **tool:start**: When Claude starts using a tool (includes tool name, parameters)
- **tool:end**: When Claude finishes using a tool (includes duration, success status, result)
- **message**: Assistant messages and explanations
- **stream**: Raw stdout/stderr data
- **error**: Error events with stack traces

### How It Works

1. **Claude Process** runs on the host machine via the daemon
2. **Daemon** captures stdout/stderr and process metadata
3. **Event Parser** extracts structured events from the output stream
4. **MCP Server** emits strongly-typed events and logs them to tasks
5. **Task Logs** contain rich, structured event data

### Event Structure

All events follow a consistent structure defined in `src/types/claude-events.ts`:

```typescript
interface ClaudeEventBase {
  type: string;
  timestamp: string;
  sessionId: string;
  taskId?: string;
}
```

Specific event types extend this base with additional fields.

### Usage

The Claude Code service automatically emits events:

```typescript
// Listen for Claude events
claudeService.on('claude:event', (event: ClaudeEvent) => {
  switch (event.type) {
    case 'tool:start':
      console.log(`Tool ${event.toolName} started`);
      break;
    case 'tool:end':
      console.log(`Tool ${event.toolName} completed in ${event.duration}ms`);
      break;
  }
});
```

### Implementation Files

- `src/types/claude-events.ts` - Strongly-typed event definitions
- `src/services/claude-code/event-parser.ts` - Stream parser that extracts events
- `src/services/claude-code/host-proxy-client.ts` - Enhanced to emit events
- `src/services/claude-code/claude-code-service.ts` - Event emission and logging

## Push Notifications Support

The SystemPrompt MCP Native App supports push notifications for real-time updates about task status, agent progress, and important events.

### Features

- **Real-time Task Updates**: Get notified when tasks complete, fail, or require attention
- **Agent Progress**: Receive updates as Claude agents work on your tasks
- **Custom Notifications**: Send test notifications for debugging

### Setup

1. **Firebase Configuration**: The app uses Firebase Cloud Messaging (FCM) for push notifications
2. **Push Token**: The app automatically generates a push token on first launch
3. **Token Storage**: Store your push token in `.env` file:
   ```
   PUSH_TOKEN=your_push_token_here
   ```

### Testing Push Notifications

Use the included script to send test notifications:

```bash
npm run send-push
```

This will send a test notification to your device using the token from `.env`.

### Integration

Push notifications are automatically sent for:
- Task completion
- Task failures
- Agent milestones
- System alerts

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

