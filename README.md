# SystemPrompt Coding Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Twitter Follow](https://img.shields.io/twitter/follow/tyingshoelaces_?style=social)](https://twitter.com/tyingshoelaces_)
[![Discord](https://img.shields.io/discord/1255160891062620252?color=7289da&label=discord)](https://discord.com/invite/wkAbSuPWpr)

**Turn your home computer into an MCP server** • [Website](https://systemprompt.io) • [Documentation](https://docs.systemprompt.io/coding-agent)

---

## 🚀 Quick Start

Get up and running in 3 simple steps:

```bash
# Clone the repository
git clone https://github.com/systempromptio/systemprompt-code-orchestrator.git
cd systemprompt-code-orchestrator

# Install and configure everything automatically
npm i
npm run setup

# Start all services
npm run start
```

That's it! The setup script will:
- ✅ Verify system requirements (Node.js 18+, Docker, Claude CLI)
- ✅ Configure environment variables interactively
- ✅ Install all dependencies
- ✅ Build the TypeScript projects
- ✅ Create necessary directories
- ✅ Set up Docker containers with consistent naming

### Essential Commands

```bash
npm run start    # Start all services (daemon + Docker)
npm run stop     # Stop all services gracefully
npm run status   # Check service health
npm run logs     # View real-time logs
npm run tunnel   # Start with internet tunnel (requires Cloudflare)
```

---

<div align="center">
  <h3>🎁 This MCP Server is 100% Free and Open Source</h3>
  <p>Transform your local machine into a powerful MCP server that can orchestrate AI coding agents</p>
  
  <h3>📱 Works with SystemPrompt Mobile Client</h3>
  <p>Designed for the systemprompt Native Mobile MCP (subscription) but compatible with any MCP client</p>
  <a href="https://apps.apple.com/us/app/systemprompt-mcp-client/id6746670168">
    <img src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us" alt="Download on App Store" height="50">
  </a>
  <a href="https://play.google.com/store/apps/details?id=com.systemprompt.mcp">
    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" height="50">
  </a>
</div>

---

## 📋 Quick Navigation

**Getting Started**: [Quick Start](#quick-start) | [Security](#-security-notice) | [Remote Access](#remote-access-options)  
**Documentation**: [Architecture](#-comprehensive-documentation) | [Tools](#tool-reference) | [Templates](#pre-built-prompts)  
**Components**: [Daemon](docs/daemon.md) | [Docker](docs/docker-architecture.md) | [MCP Server](docs/mcp-server.md) | [Agent Manager](docs/agent-manager.md)  
**Features**: [Tunnel Access](docs/tunnel-remote-access.md) | [Push Notifications](docs/push-notifications.md) | [State Persistence](docs/state-persistence.md)

## What is This?

**SystemPrompt Coding Agent** is a free, open-source MCP server that turns your home computer into a powerful AI orchestration platform. It enables AI coding assistants (Claude Code CLI and Gemini CLI) to perform complex programming tasks autonomously on your local machine.

This server is specifically designed to work seamlessly with the SystemPrompt mobile client (a paid app), but it's fully compatible with any MCP-compliant client.

### 🌟 Three Key Differentiators

**1. Remote-First Architecture**  
Transform your local machine into a remote coding endpoint. Access your development environment from anywhere—no complex networking required. [Learn more →](docs/tunnel-remote-access.md)

**2. Mobile Native Experience**  
Purpose-built for the SystemPrompt mobile app. Start coding tasks with your voice, monitor progress in real-time, and get push notifications when tasks complete. [Learn more →](docs/push-notifications.md)

**3. Full MCP Protocol**  
Leverages every MCP feature: persistent state management, real-time notifications, interactive prompts, and pre-configured task templates. [Learn more →](docs/mcp-server.md)

## Prerequisites

The setup script will check for these automatically:

- **Node.js 18+** - JavaScript runtime
- **Docker & Docker Compose** - Container management
- **Claude Code CLI** - AI coding assistant (optional but recommended)
- **Git** - Version control (optional for git-based features)

## Installation Details

### What the Setup Script Does

When you run `npm run setup`, it will:

1. **Check System Requirements**
   - Verify Node.js version (18+)
   - Check Docker and Docker Compose availability
   - Detect Claude CLI and other tools

2. **Configure Environment**
   - Create `.env` from `.env.example`
   - Prompt for PROJECT_ROOT (defaults to current directory)
   - Set up optional configurations (ports, authentication, etc.)

3. **Install Dependencies**
   - Main project dependencies
   - Daemon dependencies
   - E2E test dependencies

4. **Build Projects**
   - TypeScript compilation for all components
   - Create necessary directories
   - Set proper permissions

### Environment Variables

The setup script will help you configure these:

- `PROJECT_ROOT` - Where AI agents execute tasks (required)
- `PORT` - Server port (default: 3000)
- `COMPOSE_PROJECT_NAME` - Docker project name for consistent container naming
- `CLOUDFLARE_TOKEN` - For tunnel access (optional)
- `PUSH_TOKEN` - For mobile notifications (optional)

## 🚦 Service Management

### Starting Services

```bash
npm run start
```

This command:
- Validates your environment
- Starts the host bridge daemon on port 9876
- Launches Docker containers (MCP server on port 3000)
- Shows real-time logs from both services

### Stopping Services

```bash
npm run stop
```

Gracefully stops:
- Docker containers
- Host bridge daemon
- Cleans up PID files

### Checking Status

```bash
npm run status
```

Shows:
- Daemon status and PID
- Docker container health
- Port availability
- Environment configuration

## 🔒 Security Notice

This server is designed to run on your **local trusted network** or via a **secure Cloudflare tunnel**. AI agents have significant system access to enable meaningful coding tasks:

- ✅ **File System Access**: Read/write files in designated project directories
- ✅ **Process Execution**: Run build tools, tests, and development servers
- ✅ **Git Operations**: Create branches, commits, and manage version control
- ✅ **Docker Integration**: Manage containers for development environments

**Security Best Practices:**
1. Only run on trusted networks or use the Cloudflare tunnel for remote access
2. Review the `PROJECT_ROOT` setting - agents can only modify files within this directory
3. Use the mobile app's authentication features when accessing remotely
4. Regularly review agent activity in the logs

## Remote Access Options

### Option 1: Cloudflare Tunnel (Recommended)

```bash
npm run tunnel
```

- Secure HTTPS access from anywhere
- No port forwarding required
- Automatic SSL certificates
- [Detailed setup guide →](docs/tunnel-remote-access.md)

### Option 2: Local Network

Access directly on your local network:
- Default URL: `http://localhost:3000`
- Or use your machine's local IP: `http://192.168.x.x:3000`

### Option 3: VPN

Use your existing VPN to access your home network securely.

## 🛠️ Tool Reference

The MCP server provides these tools for AI agents:

### create_task
Orchestrates AI coding agents to perform complex programming tasks.

```typescript
create_task({
  tool: "CLAUDECODE",
  instructions: "Build a React component with TypeScript",
  branch: "feature/new-component"  // Optional: work on a specific git branch
})
```

### update_task & end_task
Manage running tasks - add context or stop execution.

### clear_all_state
Reset the server state and clean up resources.

### ask_user
Enable AI agents to request additional information during task execution.

### notify_user
Send real-time updates about task progress.

## Pre-Built Prompts

The server includes task templates for common operations:

- **fix_bug**: Diagnose and fix code issues
- **create_unit_tests**: Generate comprehensive test suites
- **create_react_component**: Build React components with proper patterns
- **create_reddit_post**: Draft technical content

Access these through your MCP client's prompt system.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   MCP Client    │────▶│   MCP Server    │────▶│  Host Bridge    │
│  (Mobile App)   │     │   (Docker)      │     │   (Daemon)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Claude Code    │
                                                 │  (Local CLI)    │
                                                 └─────────────────┘
```

## 📚 Comprehensive Documentation

### Core Components
- [**Daemon Documentation**](docs/daemon.md) - Host bridge architecture
- [**Docker Architecture**](docs/docker-architecture.md) - Container configuration
- [**MCP Server Details**](docs/mcp-server.md) - Protocol implementation
- [**Agent Manager**](docs/agent-manager.md) - AI orchestration system

### Features
- [**Tunnel Setup**](docs/tunnel-remote-access.md) - Remote access configuration
- [**Push Notifications**](docs/push-notifications.md) - Mobile app integration
- [**State Persistence**](docs/state-persistence.md) - Data management

### Development
- [**Testing Guide**](e2e-test/README.md) - E2E test documentation
- [**API Reference**](docs/api.md) - Tool and prompt specifications

## Troubleshooting

### Common Issues

**"Docker daemon is not running"**
- Start Docker Desktop or run: `sudo systemctl start docker`

**"Port already in use"**
- Run `npm run stop` to clean up existing services
- Check for other processes: `lsof -i :3000` or `lsof -i :9876`

**"Claude CLI not found"**
- Install from: https://github.com/anthropics/claude-cli
- Or continue without it (limited functionality)

### Debug Commands

```bash
# View all logs
npm run logs

# Check detailed status
npm run status

# Clean rebuild
npm run clean
npm run setup
```

## Community & Support

- 🌟 [Star on GitHub](https://github.com/systempromptio/systemprompt-code-orchestrator)
- 💬 [Join our Discord](https://discord.com/invite/wkAbSuPWpr)
- 🐦 [Follow on Twitter](https://twitter.com/tyingshoelaces_)
- 📖 [Read the Docs](https://docs.systemprompt.io/coding-agent)

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ by the SystemPrompt team</p>
  <p><a href="https://systemprompt.io">systemprompt.io</a></p>
</div>