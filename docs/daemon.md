# Host Bridge Daemon

## Overview

The Host Bridge Daemon is a critical component of the SystemPrompt Coding Agent architecture that acts as a secure bridge between the Docker container (running the MCP server) and the host machine where the actual project files and development tools reside. It enables AI agents to execute commands and modify files on the host system while maintaining the benefits of Docker containerization.

## Purpose

The daemon serves several essential purposes:

1. **Host System Access**: Provides controlled access to host filesystem and tools from within Docker containers
2. **Tool Execution**: Spawns AI agent processes (Claude, Gemini) on the host machine
3. **Git Operations**: Enables git commands to run on the actual repository on the host
4. **Process Management**: Manages lifecycle of spawned processes and handles graceful shutdowns
5. **Security Boundary**: Acts as a controlled gateway between isolated Docker environment and host system

## Architecture

```
Docker Container          Host Machine
┌─────────────┐          ┌──────────────┐
│ MCP Server  │ ──TCP──> │ Host Bridge  │
│             │  :9876   │   Daemon     │
└─────────────┘          └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │ Claude/      │
                         │ Gemini CLI   │
                         │ Git Commands │
                         └──────────────┘
```

## Configuration

The daemon is configured through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_PATH` | Path to Claude CLI executable | Auto-detected |
| `SHELL_PATH` | Shell to use for command execution | `/bin/bash` |
| `HOST_BRIDGE_PORT` | Port daemon listens on | `9876` |

## How It Works

### 1. Startup Process

```typescript
// The daemon validates environment on startup
const config = EnvironmentValidator.validate();
// Checks for available tools (Claude, etc.)
// Validates shell path
// Creates log directory if needed
```

### 2. Connection Handling

When the MCP server connects to the daemon:

1. TCP connection established on port 9876
2. Daemon assigns unique connection ID
3. Keeps socket alive with keepalive settings
4. Maintains buffer for incoming JSON messages

### 3. Message Protocol

The daemon expects JSON messages with this structure:

```typescript
interface BridgeMessage {
  tool: 'claude' | 'bash' | string;    // Tool to execute
  command: string;                      // Command or prompt
  workingDirectory?: string;            // Optional working directory
  env?: Record<string, string>;         // Optional environment variables
}
```

### 4. Command Execution

When executing commands:

1. **Tool Validation**: Checks if requested tool is available
2. **Process Spawning**: Creates child process with proper arguments
3. **Working Directory**: Sets cwd to specified directory (critical for git operations)
4. **Environment**: Merges provided env vars with process environment
5. **Stream Handling**: Captures stdout/stderr and streams back to client

### 5. Response Types

The daemon sends different response types:

```typescript
interface BridgeResponse {
  type: 'stream' | 'error' | 'complete' | 'pid';
  data?: string;        // For stream/error types
  exitCode?: number;    // For complete type
  pid?: number;         // For pid type
}
```

## Key Features

### Process Management

- Tracks all active processes by connection ID
- Automatically kills processes when client disconnects
- Handles graceful shutdown on SIGTERM/SIGINT
- Prevents zombie processes

### Logging

- Comprehensive logging to `daemon/logs/host-bridge.log`
- Logs all connections, commands, and errors
- Timestamps all log entries
- Maintains separate log stream

### Error Handling

- Validates all inputs before execution
- Handles incomplete JSON messages
- Prevents buffer overflow attacks
- Returns meaningful error messages

## Security Considerations

1. **No Authentication**: Currently no auth between Docker and daemon
2. **Local Only**: Binds to all interfaces (0.0.0.0) - should be restricted in production
3. **Command Injection**: Uses shell execution - inputs must be sanitized
4. **File Access**: Daemon has full access to host filesystem

## Usage Example

### Starting the Daemon

```bash
# Set up environment
export CLAUDE_PATH=/usr/local/bin/claude
export HOST_BRIDGE_PORT=9876

# Start daemon
cd /var/www/html/systemprompt-coding-agent/daemon
npm start
```

### Connecting from Docker

```typescript
// From within Docker container
const socket = net.connect(9876, 'host.docker.internal');

// Send command
socket.write(JSON.stringify({
  tool: 'claude',
  command: 'Add authentication to the login form',
  workingDirectory: '/var/www/html/systemprompt-coding-agent'
}));

// Handle responses
socket.on('data', (data) => {
  const response = JSON.parse(data);
  switch(response.type) {
    case 'stream':
      console.log('Output:', response.data);
      break;
    case 'complete':
      console.log('Finished with code:', response.exitCode);
      break;
  }
});
```

## File Structure

```
daemon/
├── src/
│   └── host-bridge-daemon.ts    # Main daemon implementation
├── logs/
│   ├── host-bridge.log         # Daemon logs
│   ├── daemon.pid              # Process ID file
│   └── claude-hooks.jsonl      # Hook execution logs
├── package.json
└── tsconfig.json
```

## Troubleshooting

### Common Issues

1. **Tool not found**: Check CLAUDE_PATH environment variable
2. **Connection refused**: Ensure daemon is running and port is correct
3. **Permission denied**: Daemon needs access to project directories
4. **Process hangs**: Check if stdin is properly closed

### Debug Mode

Enable verbose logging by checking the log file:
```bash
tail -f daemon/logs/host-bridge.log
```

## Integration with MCP Server

The MCP server integrates with the daemon through the `HostProxyClient` service:

1. Establishes TCP connection to daemon
2. Sends tool execution requests
3. Streams responses back to clients
4. Handles connection failures gracefully

This architecture ensures that AI agents work with real project files on the host while maintaining the isolation and consistency benefits of Docker containers.