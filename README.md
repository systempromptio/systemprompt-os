# SystemPrompt Coding Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Twitter Follow](https://img.shields.io/twitter/follow/tyingshoelaces_?style=social)](https://twitter.com/tyingshoelaces_)
[![Discord](https://img.shields.io/discord/1255160891062620252?color=7289da&label=discord)](https://discord.com/invite/wkAbSuPWpr)

**Turn your home computer into an MCP server** • [Website](https://systemprompt.io) • [Documentation](https://docs.systemprompt.io/coding-agent)

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

## 🚨 Security Notice

**⚠️ CRITICAL: This server grants AI agents full access to your local machine with NO built-in authentication. (yet)**

### Security Implications

- **Full System Access**: AI agents can read, write, and execute code in your `PROJECT_ROOT`
- **No Authentication**: Anyone with your server URL has complete access
- **Remote Code Execution**: AI agents execute commands on your machine

### Mandatory Security Measures

1. **Never expose directly to the internet**
2. **Treat server URLs as passwords**
3. **Use VPN or SSH tunnels for remote access**
4. **Restrict `PROJECT_ROOT` to non-sensitive directories**
5. **Monitor agent activity through logs**

*Zero-trust OAuth authentication coming in v1.0*

## Quick Start

### Prerequisites

The setup script will check for these automatically:

- Node.js 18+ (required)
- Docker & Docker Compose (required)
- Claude Code CLI (optional but recommended - the setup script will guide you)
- Git (optional - for git-based features)

### 🚀 Automated Setup (Recommended)

Get up and running in 3 simple steps:

```bash
# Clone the repository
git clone https://github.com/systempromptio/systemprompt-coding-agent.git
cd systemprompt-coding-agent

# Install and configure everything automatically
npm i
npm run setup

# Start all services
npm run start
```

That's it! The setup script will:
- ✅ Verify system requirements (Node.js 18+, Docker, Claude CLI)
- ✅ Configure environment variables interactively
- ✅ Install all dependencies (main, daemon, and test)
- ✅ Build all TypeScript projects
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

### Manual Setup (Alternative)

If you prefer manual configuration:

```bash
# Clone and setup
git clone https://github.com/systempromptio/systemprompt-coding-agent.git
cd systemprompt-coding-agent
npm install

# Configure manually
cp .env.example .env
nano .env

# Build and run
npm run build
npm run start
```

### Essential Configuration

The setup script will help you configure these automatically:

```env
# Required (setup will prompt for this)
PROJECT_ROOT=/path/to/your/code  # ⚠️ AI agents have FULL access here

# Optional (with defaults)
PORT=3000
COMPOSE_PROJECT_NAME=systemprompt-coding-agent

# Optional (for additional features)
CLOUDFLARE_TOKEN=your_token  # For tunnel access
PUSH_TOKEN=your_token        # For mobile notifications
```

Note: Claude Code CLI uses your authenticated session (no API key needed)

## Remote Access Options

### 🌐 Internet Access via Tunnel

For quick testing or remote access, use the built-in Cloudflare tunnel. [→ Full Tunnel Documentation](docs/tunnel-remote-access.md)

```bash
npm run tunnel
```

This will:
- Create a secure HTTPS tunnel to your local server
- Display both the public URL and local network addresses
- Enable access from anywhere (including mobile devices)

Example output:
```
✅ 🌍 Your server is now accessible from the internet!
ℹ️  🔗 Public URL: https://your-tunnel.trycloudflare.com
ℹ️  📡 MCP Endpoint: https://your-tunnel.trycloudflare.com/mcp

🏠 Local network access (without tunnel):
📍 http://192.168.1.100:3000
📡 MCP Endpoint: http://192.168.1.100:3000/mcp
```

### 🏠 Local Network Access

If you prefer to keep everything on your local network:

1. **Start the server normally:**
   ```bash
   npm start
   ```

2. **Access from devices on the same network:**
   - Find your machine's IP address (shown when using `npm run tunnel`)
   - Connect using: `http://YOUR_IP:3000/mcp`
   - Works great for testing from mobile devices on the same WiFi

### 🔒 Security Considerations

- **Tunnel URLs are temporary** - they change on each restart
- **Local network access** - only devices on your network can connect
- **No authentication yet** - treat URLs as passwords
- For production, use proper authentication and HTTPS

## Core Features

### 🤖 AI Agent Orchestration

- **Multi-Agent Support**: Seamlessly switch between Claude Code and Gemini - [Agent Manager →](docs/agent-manager.md)
- **Task Management**: Create, track, and manage coding tasks - [Task Management →](docs/task-management.md)
- **Git Integration**: Automatic branch creation and management - [Docker Architecture →](docs/docker-architecture.md)
- **Session Isolation**: Each task runs in its own context - [Claude Integration →](docs/claude-code-integration.md)
- **Real-time Streaming**: Watch AI agents work in real-time - [Event System →](docs/event-system-and-logging.md)

### 📱 Mobile-First Design

- **Voice Commands**: "Create a login form with validation"
- **Push Notifications**: Get alerts when tasks complete - [Push Notifications →](docs/push-notifications.md)
- **Quick Actions**: Pre-defined templates for common tasks - [Prompt Templates →](docs/prompt-templates.md)
- **Remote Control**: Manage your dev environment from anywhere - [Tunnel Access →](docs/tunnel-remote-access.md)

### 🔧 MCP Protocol Features

- **Persistent State**: Tasks survive server restarts - [State Persistence →](docs/state-persistence.md)
- **Resource Management**: Expose task data as MCP resources - [Tools & Resources →](docs/tools-and-resources.md)
- **Interactive Prompts**: AI agents can ask for clarification
- **Progress Notifications**: Real-time status updates
- **Structured Data**: Full schema validation - [MCP Server →](docs/mcp-server.md)

### 📲 Push Notifications

The SystemPrompt MCP Native App supports push notifications for real-time updates:

- **Task Status Updates**: Get notified when tasks complete, fail, or need attention
- **Agent Progress**: Real-time updates as AI agents work on your code
- **System Events**: Important alerts and milestones
- **Test Notifications**: Send custom notifications for debugging

[→ Full Push Notifications Documentation](docs/push-notifications.md)

To test push notifications:
```bash
# Add your push token to .env
echo "PUSH_TOKEN=your_token_here" >> .env

# Send a test notification
npm run send-push
```

## Tool Reference

[→ Full Tools and Resources Documentation](docs/tools-and-resources.md)

### Task Orchestration

| Tool | Description | Example |
|------|-------------|---------|
| `create_task` | Start new AI coding session | `{"title": "Add auth", "tool": "CLAUDECODE", "instructions": "..."}` |
| `update_task` | Send additional instructions | `{"process": "session_123", "instructions": "..."}` |
| `end_task` | Complete and cleanup | `{"task_id": "task_123", "status": "completed"}` |
| `report_task` | Generate task reports | `{"task_ids": ["task_123"], "format": "markdown"}` |

### System Management

| Tool | Description | Example |
|------|-------------|---------|
| `check_status` | Verify agent availability | `{"test_sessions": true, "verbose": true}` |
| `update_stats` | Get system statistics | `{"include_tasks": true}` |
| `clean_state` | Cleanup old tasks | `{"keep_recent": true, "dry_run": true}` |

## Pre-Built Prompts

SystemPrompt includes powerful prompt templates for common coding tasks. [→ Full Prompt Templates Documentation](docs/prompt-templates.md)

### 🐛 Bug Fixing
```javascript
{
  "prompt_template": "bug_fix",
  "variables": {
    "bug_description": "Login fails after password reset",
    "error_logs": "401 Unauthorized at auth.js:42"
  }
}
```

### ⚛️ React Components
```javascript
{
  "prompt_template": "react_component",
  "variables": {
    "component_name": "UserDashboard",
    "features": ["data visualization", "real-time updates", "export functionality"]
  }
}
```

### 🧪 Unit Testing
```javascript
{
  "prompt_template": "unit_test",
  "variables": {
    "target_files": ["src/auth/*.js"],
    "framework": "jest",
    "coverage_target": 85
  }
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│        SystemPrompt Mobile App          │
│           (iOS/Android)                 │
└──────────────────┬──────────────────────┘
                   │ Remote MCP
┌──────────────────▼──────────────────────┐
│          Desktop MCP Clients            │
│      (Claude Desktop, Cline, etc.)      │
└──────────────────┬──────────────────────┘
                   │ Local MCP
┌──────────────────▼──────────────────────┐
│       SystemPrompt Coding Agent         │
│  ┌────────────────────────────────────┐ │
│  │     Docker Container State         │ │
│  │  • Tasks  • Sessions  • Resources  │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │        Agent Orchestrator          │ │
│  │  • Claude Code  • Gemini CLI       │ │
│  └────────────────────────────────────┘ │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Your Local Machine              │
│          PROJECT_ROOT                   │
└─────────────────────────────────────────┘
```

## 📚 Comprehensive Documentation

The SystemPrompt Coding Agent is a complex system with multiple interconnected components. Below is the complete technical documentation for understanding and extending the platform.

### Core Architecture

- **[Daemon](docs/daemon.md)** - The host-side bridge that executes commands and manages Claude processes
- **[Docker Architecture](docs/docker-architecture.md)** - How the Docker container and host machine interact
- **[MCP Server](docs/mcp-server.md)** - The Model Context Protocol server implementation

### AI Agent Systems

- **[Agent Manager](docs/agent-manager.md)** - Central orchestrator for all AI agent sessions
- **[Claude Code Integration](docs/claude-code-integration.md)** - How Claude Code CLI is integrated and managed
- **[Task Management](docs/task-management.md)** - Task lifecycle, persistence, and state management

### Protocol & API

- **[Tools and Resources](docs/tools-and-resources.md)** - MCP tools and resources implementation
- **[Event System and Logging](docs/event-system-and-logging.md)** - Real-time event streaming and structured logging

### Additional Features

- **[Testing Framework](docs/testing-framework.md)** - E2E testing setup and best practices
- **[Tunnel and Remote Access](docs/tunnel-remote-access.md)** - Cloudflare tunnel setup for internet access
- **[State Persistence](docs/state-persistence.md)** - How tasks and sessions persist across restarts
- **[Push Notifications](docs/push-notifications.md)** - Mobile push notification integration
- **[Prompt Templates](docs/prompt-templates.md)** - Pre-built prompt system for common tasks

### Architecture Overview

The SystemPrompt Coding Agent uses a sophisticated multi-tier architecture:

1. **Host Machine Layer** - Where your actual code lives and git operations happen
2. **Daemon Bridge** - Secure communication bridge between Docker and host
3. **Docker Container** - Isolated MCP server environment
4. **AI Agents** - Claude Code and Gemini processes that execute on the host

### Key Design Principles

- **Git-First**: All operations happen on real git branches on your host machine
- **Event-Driven**: Real-time streaming of all agent activities
- **Stateful**: Tasks and sessions persist across server restarts
- **Extensible**: Designed to support multiple AI agent types
- **Secure**: Isolated Docker environment with controlled host access

## Production Deployment

### Secure Docker Setup

```yaml
version: '3.8'
services:
  coding-agent:
    image: systemprompt/coding-agent:latest
    environment:
      - NODE_ENV=production
    volumes:
      - ./state:/data/state
      - /projects:/projects:ro  # Read-only
    ports:
      - "127.0.0.1:3000:3000"  # Local only
    security_opt:
      - no-new-privileges:true
    user: "1000:1000"
    restart: unless-stopped
```

### Nginx Reverse Proxy

```nginx
server {
    server_name code.yourdomain.com;
    
    location / {
        auth_basic "Restricted";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
}
```

## Development

### Project Structure
```
systemprompt-coding-agent/
├── src/
│   ├── server.ts           # MCP server setup
│   ├── handlers/           # Protocol handlers
│   ├── services/           # Agent services
│   ├── constants/          # Tool definitions
│   └── types/              # TypeScript types
├── docker-compose.yml
└── package.json
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For security issues, email security@systemprompt.io

## Support

- **Documentation**: [docs.systemprompt.io](https://docs.systemprompt.io)
- **GitHub Issues**: [Report bugs](https://github.com/systempromptio/systemprompt-coding-agent/issues)
- **Discord**: [Join our community](https://discord.com/invite/wkAbSuPWpr)
- **Twitter**: [@tyingshoelaces_](https://twitter.com/tyingshoelaces_)

## License

MIT License - see [LICENSE](LICENSE)

---

<div align="center">
  <strong>Built with ❤️ by <a href="https://systemprompt.io">SystemPrompt.io</a></strong><br>
  <em>AI-Powered Development from Anywhere</em>
</div>