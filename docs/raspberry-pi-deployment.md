# Raspberry Pi Deployment & Update Guide

This guide covers deploying SystemPrompt on Raspberry Pi with a clean separation between core code and custom modifications.

## Architecture Overview

SystemPrompt uses a modular architecture with two main extension points:
- **Custom Modules** (`modules/custom/`) - Daemons, services, and plugins
- **Custom MCP Servers** (`server/mcp/custom/`) - Additional MCP protocol servers

## Initial Setup

### 1. Clone and Initialize

```bash
# Clone the repository
git clone https://github.com/systempromptio/systemprompt-os
cd systemprompt-os

# Initialize custom directory structure
./scripts/rpi-update.sh init
```

This creates:
```
/home/pi/systemprompt-custom/
├── modules/custom/      # Your custom modules
├── server/mcp/custom/   # Your custom MCP servers
├── config/              # Instance configuration
└── state/               # Persistent state
```

### 2. First Deployment

```bash
# Install dependencies
npm install

# Setup environment
npm run setup

# Build and start
docker-compose up -d
```

## Update Management

### Core Updates Only

To update SystemPrompt core while preserving custom code:

```bash
./scripts/rpi-update.sh update
```

This will:
1. Backup current state
2. Pull latest core changes from git
3. Preserve your custom modules and MCP servers
4. Rebuild the container
5. Verify health

### Custom Code Updates

To update only your custom code:

```bash
./scripts/rpi-update.sh update-custom
```

### Check Update Status

```bash
./scripts/rpi-update.sh status
```

Shows:
- Current version
- Available updates
- Container status
- Custom code inventory

## Custom Code Structure

### Custom Modules

Each module in `/home/pi/systemprompt-custom/modules/custom/` needs:

```yaml
# module.yaml
name: my-custom-module
type: daemon|service|plugin
version: 1.0.0
description: My custom functionality
config:
  # Module-specific config
```

```typescript
// index.ts
export class MyCustomModule implements DaemonModule {
  async init() { }
  async start() { }
  async stop() { }
}
```

### Custom MCP Servers

MCP servers in `/home/pi/systemprompt-custom/server/mcp/custom/` should:

```typescript
// server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export class MyMCPServer {
  // Implement MCP protocol
}
```

## Docker Considerations

### GPIO Access

For Raspberry Pi GPIO access, modify `docker-compose.yml`:

```yaml
services:
  app:
    devices:
      - /dev/gpiomem:/dev/gpiomem
    cap_add:
      - SYS_RAWIO
```

### ARM Optimization

The Dockerfile is already optimized for ARM, but you can add:

```dockerfile
# For specific Pi optimizations
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
    # ARM64 specific optimizations \
  fi
```

## Backup & Recovery

### Manual Backup

```bash
# Extract custom code from running container
./scripts/rpi-update.sh sync-out
```

### Rollback

If an update fails:

```bash
./scripts/rpi-update.sh rollback
```

## Environment Variables

Create `/home/pi/systemprompt-custom/config/.env.local`:

```env
# Instance identification
INSTANCE_ID=rpi-living-room-001

# Custom features
ENABLE_GPIO=true
GPIO_PINS=17,27,22

# Performance tuning
NODE_OPTIONS=--max-old-space-size=512
```

## Examples

### Example: GPIO LED Module

See `scripts/example-custom-module/heartbeat-gpio/` for a complete GPIO module example.

### Example: GPIO MCP Server

See `scripts/example-custom-mcp/gpio-control/` for a GPIO control MCP server.

## Best Practices

1. **Version Control**: Keep custom code in separate git repository
2. **Documentation**: Document each custom module/server
3. **Testing**: Test custom code before deployment
4. **Monitoring**: Use `./scripts/rpi-update.sh status` regularly
5. **Backups**: Automated backups keep last 5 versions

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs -f

# Verify custom code syntax
docker-compose build --no-cache
```

### GPIO Not Working

1. Verify device mapping in docker-compose.yml
2. Check container has SYS_RAWIO capability
3. Ensure pi user is in gpio group

### Out of Memory

Raspberry Pi specific optimizations:
```env
# In .env
NODE_OPTIONS=--max-old-space-size=256
DOCKER_COMPOSE_HTTP_TIMEOUT=300
```

## Security Considerations

1. **Network**: Use firewall rules to restrict access
2. **Secrets**: Store in `/home/pi/systemprompt-custom/config/secrets/`
3. **Updates**: Review changes before updating
4. **Permissions**: Run as non-root user

## Automated Updates

For unattended updates, create a systemd service:

```ini
# /etc/systemd/system/systemprompt-update.service
[Unit]
Description=SystemPrompt Auto Update

[Service]
Type=oneshot
ExecStart=/home/pi/systemprompt-os/scripts/rpi-update.sh update
User=pi

[Install]
WantedBy=multi-user.target
```

Enable weekly updates:
```bash
# /etc/systemd/system/systemprompt-update.timer
[Unit]
Description=Weekly SystemPrompt Update

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
```

## Support

- GitHub Issues: Report bugs and feature requests
- Discord: Join the community for help
- Documentation: Check docs/ directory for detailed guides