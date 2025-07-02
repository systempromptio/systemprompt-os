# Host Bridge Daemon

A TypeScript daemon that bridges Docker containers to host machine CLI tools, enabling the MCP server to execute commands like Claude, Gemini, and other tools installed on the host system.

## Overview

The Host Bridge Daemon solves a critical architectural challenge: Docker containers are isolated from the host system and cannot directly access CLI tools. This daemon acts as a secure proxy, allowing containerized services to execute specific host commands while maintaining security boundaries.

## Architecture

```
┌─────────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Docker Container      │     │  Host Bridge Daemon  │     │   Host System   │
│   (MCP Server)          │────▶│  (Port 9876)         │────▶│  CLI Tools      │
│                         │◀────│                      │◀────│  (Claude, etc)  │
└─────────────────────────┘     └──────────────────────┘     └─────────────────┘
         JSON/TCP                    Process Spawn                Execution
```

### Key Components

1. **TCP Server**: Listens on port 9876 for incoming connections
2. **Message Handler**: Validates and processes JSON command requests
3. **Process Manager**: Spawns and manages CLI tool processes
4. **Stream Handler**: Captures and relays stdout/stderr in real-time
5. **Security Layer**: Validates tools and paths before execution

## Features

- **Tool Validation**: Only whitelisted tools can be executed
- **Real-time Streaming**: Output is streamed back as it's generated
- **Process Management**: Tracks PIDs and handles process lifecycle
- **Error Handling**: Comprehensive error reporting and recovery
- **Logging**: Detailed logs for debugging and monitoring
- **Security**: Path validation and command sanitization

## Installation

The daemon is installed as part of the main project setup:

```bash
# From project root
npm run setup
```

For standalone installation:

```bash
cd daemon
npm install
npm run build
```

## Usage

### Starting the Daemon

The daemon is automatically started by the main startup script:

```bash
# From project root
npm start
```

To run manually:

```bash
cd daemon
node dist/host-bridge-daemon.js
```

### Stopping the Daemon

```bash
# From project root
npm stop
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_PATH` | Path to Claude CLI executable | Auto-detected |
| `GEMINI_PATH` | Path to Gemini CLI executable | Auto-detected |
| `SHELL_PATH` | Shell for command execution | `/bin/bash` |
| `CLAUDE_PROXY_PORT` | Port for daemon to listen on | `9876` |
| `HOST_BRIDGE_PORT` | Alternative port variable | `9876` |
| `CLAUDE_AVAILABLE` | Whether Claude is available | Auto-detected |

### File Locations

- **PID File**: `daemon/logs/daemon.pid`
- **Log File**: `daemon/logs/host-bridge.log`
- **Claude Hooks Log**: `daemon/logs/claude-hooks.jsonl`

## Protocol

The daemon uses a JSON-based protocol over TCP.

### Request Format

```json
{
  "tool": "claude",
  "command": "Create a hello world script",
  "workingDirectory": "/path/to/project",
  "env": {
    "CUSTOM_VAR": "value"
  }
}
```

### Response Format

The daemon sends multiple response types during execution:

#### Process Started
```json
{
  "type": "pid",
  "pid": 12345
}
```

#### Output Stream
```json
{
  "type": "stream",
  "data": "Creating hello.js..."
}
```

#### Error Stream
```json
{
  "type": "error",
  "data": "Error: File not found"
}
```

#### Completion
```json
{
  "type": "complete",
  "exitCode": 0
}
```

## Supported Tools

### Claude CLI
- **Command**: `claude`
- **Flags**: `--no-color` (automatically added)
- **Features**: Full Claude AI capabilities

### Gemini CLI (Optional)
- **Command**: `gemini`
- **Status**: Detected if available

### Adding New Tools

Tools can be added by setting environment variables:

```bash
export MYTOOL_PATH=/usr/local/bin/mytool
```

Then modify the daemon code to recognize the new tool.

## Security

### Implemented Measures

1. **Tool Whitelisting**: Only pre-approved tools can be executed
2. **Path Validation**: Working directories are validated
3. **No Shell Injection**: Commands are passed as arguments, not evaluated
4. **Process Isolation**: Each command runs in its own process
5. **Limited Permissions**: Runs with daemon user permissions

### Best Practices

- Never expose the daemon port to public networks
- Regularly update tool whitelists
- Monitor logs for suspicious activity
- Use Docker networks for container-daemon communication

## Development

### Building from Source

```bash
cd daemon
npm install
npm run build
```

### Running in Development

```bash
cd daemon
npm run dev  # If available, or:
npx tsx src/host-bridge-daemon.ts
```

### Testing

Test the daemon connection:

```bash
# Check if daemon is listening
nc -zv localhost 9876

# Send a test command
echo '{"tool":"claude","command":"--version"}' | nc localhost 9876
```

## Troubleshooting

### Common Issues

1. **Daemon won't start**
   - Check if port 9876 is already in use
   - Verify Claude CLI is installed and in PATH
   - Check logs in `daemon/logs/`

2. **Connection refused**
   - Ensure daemon is running: `npm run status`
   - Check firewall settings
   - Verify Docker network configuration

3. **Tool not found**
   - Check environment variables
   - Verify tool path exists
   - Ensure tool is executable

### Debug Mode

Enable verbose logging:

```bash
DEBUG=* node dist/host-bridge-daemon.js
```

### Log Analysis

View recent daemon activity:

```bash
tail -f daemon/logs/host-bridge.log
```

Check Claude hooks (if configured):

```bash
tail -f daemon/logs/claude-hooks.jsonl
```

## Integration

### Docker Compose

The daemon is integrated with Docker services:

```yaml
services:
  mcp-server:
    environment:
      - DAEMON_HOST=host.docker.internal
      - DAEMON_PORT=9876
```

### MCP Server Connection

The MCP server connects to the daemon via:

```typescript
const client = new HostProxyClient({
  host: 'host.docker.internal',
  port: 9876
});
```

## Monitoring

### Health Check

```bash
# From project root
npm run status
```

### Metrics

The daemon tracks:
- Active connections
- Command execution count
- Error rates
- Response times

## Contributing

When modifying the daemon:

1. Maintain backward compatibility
2. Add tests for new features
3. Update this documentation
4. Follow TypeScript best practices
5. Ensure security measures remain intact

## License

Part of the Systemprompt Coding Agent project.