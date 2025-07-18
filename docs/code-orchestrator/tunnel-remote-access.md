# Tunnel and Remote Access

## Overview

The SystemPrompt Coding Agent includes built-in support for secure remote access through Cloudflare tunnels. This feature allows you to expose your local MCP server to the internet temporarily, enabling access from mobile devices, remote testing, and collaboration scenarios.

## How It Works

```
Your Local Machine          Cloudflare Edge         Remote Client
       │                          │                      │
   MCP Server  ─────tunnel────→  HTTPS URL  ←─────────  Mobile App
  (localhost:3000)          (*.trycloudflare.com)      Web Client
```

## Quick Start

### Basic Usage

```bash
# Start server with public tunnel
npm run tunnel
```

This command:
1. Starts a Cloudflare tunnel
2. Generates a public HTTPS URL
3. Launches the MCP server
4. Displays connection information

### Example Output

```
✅ Tunnel established: https://example-tunnel.trycloudflare.com
✅ Claude hooks are configured

============================================================
✅ 🌍 Your server is now accessible from the internet!
ℹ️  🔗 Public URL: https://example-tunnel.trycloudflare.com
ℹ️  📡 MCP Endpoint: https://example-tunnel.trycloudflare.com/mcp

ℹ️  📝 Claude Hooks endpoint:
   POST https://example-tunnel.trycloudflare.com/tools/create_log
============================================================

============================================================
ℹ️  🏠 Local network access (without tunnel):
ℹ️  📍 http://192.168.1.100:3000
ℹ️  📡 MCP Endpoint: http://192.168.1.100:3000/mcp
============================================================
```

## Tunnel Features

### 1. **Automatic URL Generation**
- Unique HTTPS URL for each session
- No configuration required
- SSL/TLS encryption included

### 2. **Environment Integration**
- Tunnel URL saved to `.tunnel-url` file
- Environment variables updated
- Accessible to all services

### 3. **Multi-Access Options**
- Public HTTPS URL for internet access
- Local network URLs for LAN access
- Both options work simultaneously

### 4. **Claude Hooks Support**
- Automatic endpoint configuration
- Remote logging capability
- Full tool tracking

## Configuration

### Environment Variables

When tunnel is active, these variables are set:

```bash
TUNNEL_URL=https://your-tunnel.trycloudflare.com
TUNNEL_ENABLED=true
PUBLIC_URL=https://your-tunnel.trycloudflare.com
```

### Persistent Storage

Tunnel URL is saved to:
- `.tunnel-url` - Root directory
- `logs/tunnel-url.txt` - Logs directory
- `.env` file - Updated dynamically

### Testing with Tunnel

```bash
# Terminal 1: Start tunnel
npm run tunnel

# Terminal 2: Run tests against tunnel
npm run test:tunnel

# Or manually specify URL
MCP_BASE_URL=https://your-tunnel.trycloudflare.com npm test
```

## Security Considerations

### ⚠️ Important Security Notes

1. **Temporary URLs Only**
   - URLs change on each restart
   - Not suitable for production
   - Treat URLs as sensitive

2. **No Authentication**
   - Anyone with URL has full access
   - Use for testing only
   - Monitor access logs

3. **Data Privacy**
   - Traffic routes through Cloudflare
   - End-to-end encryption provided
   - Consider data sensitivity

### Best Practices

1. **Short Sessions**
   - Only run when needed
   - Shut down after testing
   - Don't leave running overnight

2. **Access Control**
   - Share URLs carefully
   - Monitor active connections
   - Review access logs

3. **Environment Isolation**
   - Use separate test projects
   - Avoid production data
   - Clean up after sessions

## Local Network Access

### Discovering Local IPs

The tunnel script automatically detects and displays:
- All IPv4 network interfaces
- Accessible local addresses
- Direct connection options

### Benefits of Local Access

1. **Faster Performance**
   - No internet round-trip
   - Lower latency
   - Higher throughput

2. **Privacy**
   - Traffic stays on LAN
   - No external routing
   - Complete control

3. **Reliability**
   - No internet dependency
   - Works offline
   - Stable connections

## Advanced Usage

### Custom Port Configuration

```bash
# Use custom port
PORT=8080 npm run tunnel
```

### Programmatic Access

```typescript
import { TunnelStarter } from './scripts/start-tunnel.js';

const tunnel = new TunnelStarter();
const url = await tunnel.startTunnel();
console.log(`Tunnel URL: ${url}`);
```

### Tunnel URL Detection

```typescript
// Read tunnel URL from file
import fs from 'fs';

function getTunnelUrl(): string | null {
  try {
    return fs.readFileSync('.tunnel-url', 'utf8').trim();
  } catch {
    return null;
  }
}

// Or from environment
const tunnelUrl = process.env.TUNNEL_URL;
```

## Integration Points

### 1. **MCP Clients**
Connect any MCP client using:
```
https://your-tunnel.trycloudflare.com/mcp
```

### 2. **Claude Hooks**
Configure hooks to use:
```
POST https://your-tunnel.trycloudflare.com/tools/create_log
```

### 3. **Mobile Apps**
SystemPrompt mobile app auto-detects tunnel URLs from:
- QR code scanning
- Manual URL entry
- Network discovery

### 4. **E2E Testing**
Tests automatically use tunnel when available:
- Checks `.tunnel-url` file
- Falls back to local URL
- Supports CI/CD pipelines

## Troubleshooting

### Common Issues

1. **Cloudflared Not Found**
   ```bash
   # Install cloudflared
   npm run setup
   ```

2. **Tunnel Timeout**
   - Check internet connection
   - Verify port availability
   - Review firewall settings

3. **URL Not Accessible**
   - Confirm tunnel is running
   - Check URL spelling
   - Verify service status

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run tunnel
```

### Log Files

Check logs for issues:
- `logs/tunnel-url.txt` - Current URL
- `logs/server.log` - Server output
- `logs/error.log` - Error details

## Alternatives

### 1. **VPN Access**
For production use:
- Set up VPN server
- Configure client access
- Use internal URLs

### 2. **SSH Tunneling**
For technical users:
```bash
ssh -L 3000:localhost:3000 user@server
```

### 3. **Reverse Proxy**
For permanent setup:
- Nginx with authentication
- Caddy with automatic HTTPS
- Traefik for Docker

### 4. **Tailscale**
For team access:
- Zero-config VPN
- Stable URLs
- Access controls

## Architecture Details

### Tunnel Lifecycle

1. **Initialization**
   - Check cloudflared binary
   - Validate configuration
   - Prepare environment

2. **Tunnel Creation**
   - Spawn cloudflared process
   - Capture output streams
   - Extract public URL

3. **URL Management**
   - Save to filesystem
   - Update environment
   - Notify services

4. **Service Launch**
   - Start MCP server
   - Configure with tunnel URL
   - Enable remote features

5. **Cleanup**
   - Handle shutdown signals
   - Remove URL files
   - Terminate processes

### Process Communication

```
start-tunnel.ts
     │
     ├─→ cloudflared (tunnel process)
     │     └─→ Cloudflare Edge
     │
     └─→ start-all.js (services)
           ├─→ Docker Compose
           └─→ Daemon Process
```

## Future Enhancements

1. **Authentication Layer**
   - OAuth integration
   - API key support
   - Session management

2. **Custom Domains**
   - Bring your own domain
   - Stable URLs
   - SSL certificates

3. **Analytics**
   - Access tracking
   - Usage metrics
   - Performance monitoring

4. **Multi-Tunnel Support**
   - Separate tunnels per service
   - Load balancing
   - Failover capability