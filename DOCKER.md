# Docker Deployment Guide

This guide explains how to deploy SystemPrompt OS using Docker and Docker Compose.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/systemprompt/systemprompt-os.git
   cd systemprompt-os
   ```

2. **Copy the example environment file**
   ```bash
   cp .env.docker.example .env
   ```

3. **Build and start the container**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Local: http://localhost:3000
   - Health check: http://localhost:3000/health

## Configuration

### Environment Variables

Edit your `.env` file to configure:

- **BASE_URL**: Set this to your public URL when using Cloudflare or reverse proxy
- **OAuth Providers**: Add Google/GitHub client credentials for authentication
- **Cloudflare Tunnel**: Add tunnel token for public access without port forwarding

### Volumes

The docker-compose.yml creates these persistent volumes:

- `systemprompt-data`: Application state, database, and configuration
- `systemprompt-logs`: Application logs
- `workspace`: Mounted from local `./workspace` for file operations

## Using with Cloudflare Tunnel

To expose your instance publicly without port forwarding:

1. **Create a Cloudflare Tunnel**
   - Go to https://one.dash.cloudflare.com/
   - Create a new tunnel
   - Copy the tunnel token

2. **Configure the tunnel**
   ```bash
   # In your .env file
   ENABLE_OAUTH_TUNNEL=true
   CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
   ```

3. **Set the BASE_URL**
   ```bash
   # The tunnel URL will be auto-detected, but you can set a custom domain
   BASE_URL=https://your-custom-domain.com
   ```

4. **Restart the container**
   ```bash
   docker-compose restart
   ```

## Production Deployment

### Using Pre-built Images

```bash
# Pull the latest image
docker pull systemprompt/os:latest

# Run with docker-compose
docker-compose up -d
```

### Building Custom Images

```bash
# Build with custom tag
docker build -t my-systemprompt-os:custom .

# Update docker-compose.yml to use your image
# image: my-systemprompt-os:custom
```

### Security Considerations

1. **JWT Keys**: Automatically generated on first run in `/data/state/auth/keys`
2. **Database**: SQLite database stored in `/data/state/systemprompt.db`
3. **File Permissions**: The container runs as non-root user (appuser:1001)

## Monitoring

### View Logs
```bash
# Application logs
docker-compose logs -f systemprompt-os

# Cloudflare tunnel logs (if enabled)
docker exec systemprompt-os cat /data/state/logs/cloudflared.log
```

### Health Check
```bash
# Check container health
docker-compose ps

# Check application health
curl http://localhost:3000/health
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs systemprompt-os

# Check if port is already in use
lsof -i :3000
```

### Permission errors
```bash
# Fix volume permissions
docker-compose down
sudo chown -R 1001:1001 ./workspace
docker-compose up -d
```

### Database issues
```bash
# Reset database (WARNING: deletes all data)
docker-compose down
docker volume rm systemprompt-os_systemprompt-data
docker-compose up -d
```

## Advanced Configuration

### Custom Modules

Mount custom modules as volumes:

```yaml
# In docker-compose.yml
volumes:
  - ./my-custom-modules:/app/custom-modules
  - ./my-mcp-servers:/app/custom-mcp
```

### Multiple Instances

Run multiple instances on different ports:

```bash
# Instance 1
PORT=3001 docker-compose -p instance1 up -d

# Instance 2  
PORT=3002 docker-compose -p instance2 up -d
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name systemprompt.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for real-time features
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Bootstrap Process

The new bootstrap process loads modules in phases:

1. **Core Modules**: logger, database, cli, modules
2. **MCP Servers**: Local and remote MCP server setup
3. **Extension Modules**: Auto-discovered from `/app/modules/extension`

The minimal core ensures fast startup and reliable operation.