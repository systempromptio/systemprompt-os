# Scripts Directory

This directory contains essential TypeScript scripts for managing the Systemprompt Coding Agent MCP Server. All scripts are written in TypeScript and compiled to JavaScript for execution.

## Overview

The scripts in this directory handle the complete lifecycle of the MCP server system, including setup, startup, monitoring, and shutdown. They manage the interaction between Docker containers, the host bridge daemon, and optional tunnel services.

## Core Scripts

### 🚀 **setup.ts** - Initial Project Setup
Comprehensive setup wizard that prepares your environment for running the MCP server.

**Features:**
- Validates Node.js version (requires v18+)
- Checks Docker and Docker Compose installation
- Detects Claude CLI and Cloudflare tunnel (optional)
- Creates required project directories
- Installs all dependencies (main, daemon, and e2e-test)
- Builds TypeScript projects
- Configures environment variables interactively
- Validates and sets up PROJECT_ROOT directory

**Usage:** `npm run setup`

### ▶️ **start-all.ts** - Main Startup Script
Orchestrates the complete startup process for all services.

**Features:**
- Validates runtime environment
- Performs pre-flight checks (port availability, Docker status)
- Builds and starts the host bridge daemon
- Launches Docker services with proper environment
- Monitors startup progress
- Handles graceful shutdown on Ctrl+C

**Usage:** `npm start`

### ⏹️ **stop-all.ts** - Graceful Shutdown
Stops all running services in the correct order.

**Features:**
- Stops Docker containers via docker-compose
- Terminates the host bridge daemon
- Cleans up PID files
- Handles stale processes gracefully

**Usage:** `npm stop`

### 📊 **status.ts** - System Health Check
Comprehensive status report for all system components.

**Features:**
- Checks daemon process and port status
- Monitors Docker container health
- Tests service connectivity
- Validates environment configuration
- Provides actionable next steps

**Usage:** `npm run status`

### 🌐 **start-tunnel.ts** - Cloudflare Tunnel Support
Starts services with internet-accessible tunnel via Cloudflare.

**Features:**
- Validates cloudflared installation
- Creates secure HTTPS tunnel
- Saves tunnel URL for other processes
- Updates environment with public URL
- Shows local network addresses
- Integrates with standard startup process
- Checks Claude hooks configuration

**Usage:** `npm run tunnel`

### 🔍 **tunnel-status.ts** - Tunnel Status Check
Monitors the health and accessibility of Cloudflare tunnels.

**Features:**
- Detects active tunnel URLs
- Verifies cloudflared process status
- Tests tunnel connectivity
- Cleans up stale tunnel files
- Provides usage instructions

**Usage:** `npm run tunnel:status`

### 📨 **send-push-notification.ts** - Push Notification Testing
Sends test push notifications to mobile devices via Firebase Cloud Messaging.

**Features:**
- Reads push token from .env file
- Customizable notification content
- Support for Android and iOS
- Generates FCM-compatible payload
- Command-line arguments for title/body

**Usage:** `npm run send-push [title] [body]`

## Configuration Files

### 📄 **tsconfig.json**
TypeScript configuration for the scripts directory:
- ES2022 target with ESNext module system
- Node.js module resolution
- Strict type checking enabled
- CommonJS interop for dependencies

## Environment Variables

Scripts use these key environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `PROJECT_ROOT` | Root directory for task execution | ✅ Yes |
| `PORT` | MCP server port (default: 3000) | ❌ No |
| `CLAUDE_PATH` | Path to Claude CLI executable | ❌ No |
| `PUSH_TOKEN` | Firebase push notification token | ❌ No |
| `TUNNEL_URL` | Cloudflare tunnel URL (auto-set) | ❌ No |
| `SKIP_DOCKER_BUILD` | Skip Docker rebuild on start | ❌ No |

## Script Execution Flow

### Standard Startup
```
setup.ts → start-all.ts → [daemon + docker services]
```

### Tunnel Startup
```
start-tunnel.ts → cloudflared → start-all.ts → [services with public URL]
```

### Health Monitoring
```
status.ts → [check daemon] → [check docker] → [test connectivity]
```

## File Locations

- **Daemon PID**: `daemon/logs/daemon.pid`
- **Tunnel URL**: `.tunnel-url` (project root)
- **Environment**: `.env` (project root)
- **Logs**: `logs/` directory

## Error Handling

All scripts include comprehensive error handling:
- Pre-flight validation before operations
- Graceful process cleanup on failure
- Clear error messages with solutions
- Non-zero exit codes for CI/CD integration

## Development

To add a new script:
1. Create TypeScript file in this directory
2. Add npm script entry in root `package.json`
3. Ensure proper error handling and logging
4. Use consistent color coding for output
5. Include help/usage information

## Best Practices

- Always use absolute paths from project root
- Handle missing dependencies gracefully
- Provide clear feedback during long operations
- Clean up resources on exit
- Use TypeScript for type safety
- Follow existing logging conventions

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Run `npm stop` to clean up processes
   - Check for stale PID files in `daemon/logs/`

2. **Docker not running**
   - Start Docker Desktop or `sudo systemctl start docker`

3. **Missing dependencies**
   - Run `npm run setup` to reinstall

4. **Permission errors**
   - Ensure write access to project directory
   - Check Docker group membership

### Debug Mode

Set these environment variables for verbose output:
- `DEBUG=*` - All debug messages
- `NODE_ENV=development` - Development mode