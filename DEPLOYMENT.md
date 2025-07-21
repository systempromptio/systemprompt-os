# SystemPrompt OS Deployment Guide

## Docker Build and Deploy Process

### 1. Build the Docker Image

```bash
# Build the production image
docker build -t systemprompt-os:latest .

# Or build with a specific version tag
docker build -t systemprompt-os:v1.0.0 .
```

### 2. Run the Container

#### Basic Run (Local Development)
```bash
docker run -d \
  --name systemprompt-os \
  -p 3000:3000 \
  -v systemprompt-data:/data \
  -e DATABASE_FILE=/data/state/systemprompt.db \
  systemprompt-os:latest
```

#### Production Run with OAuth
```bash
docker run -d \
  --name systemprompt-os \
  --restart unless-stopped \
  -p 3000:3000 \
  -v systemprompt-data:/data \
  -v systemprompt-logs:/app/logs \
  -e NODE_ENV=production \
  -e DATABASE_FILE=/data/state/systemprompt.db \
  -e OAUTH_DOMAIN=https://your-domain.com \
  -e GOOGLE_CLIENT_ID=your-google-client-id \
  -e GOOGLE_CLIENT_SECRET=your-google-client-secret \
  -e GITHUB_CLIENT_ID=your-github-client-id \
  -e GITHUB_CLIENT_SECRET=your-github-client-secret \
  systemprompt-os:latest
```

#### Run with Cloudflare Tunnel
```bash
docker run -d \
  --name systemprompt-os \
  --restart unless-stopped \
  -p 3000:3000 \
  -v systemprompt-data:/data \
  -e DATABASE_FILE=/data/state/systemprompt.db \
  -e ENABLE_OAUTH_TUNNEL=true \
  -e CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token \
  -e GOOGLE_CLIENT_ID=your-google-client-id \
  -e GOOGLE_CLIENT_SECRET=your-google-client-secret \
  -e GITHUB_CLIENT_ID=your-github-client-id \
  -e GITHUB_CLIENT_SECRET=your-github-client-secret \
  systemprompt-os:latest
```

### 3. Docker Compose (Recommended for Production)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  systemprompt-os:
    image: systemprompt-os:latest
    container_name: systemprompt-os
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - systemprompt-data:/data
      - systemprompt-logs:/app/logs
      - ./custom-modules:/app/custom-modules  # Optional: custom modules
      - ./custom-mcp:/app/custom-mcp          # Optional: custom MCP servers
    environment:
      - NODE_ENV=production
      - DATABASE_FILE=/data/state/systemprompt.db
      - OAUTH_DOMAIN=${OAUTH_DOMAIN}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      # Optional Cloudflare Tunnel
      - ENABLE_OAUTH_TUNNEL=${ENABLE_OAUTH_TUNNEL:-false}
      - CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  systemprompt-data:
  systemprompt-logs:
```

Create a `.env` file for your environment variables:

```bash
# OAuth Configuration
OAUTH_DOMAIN=https://your-domain.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Optional: Cloudflare Tunnel
ENABLE_OAUTH_TUNNEL=false
CLOUDFLARE_TUNNEL_TOKEN=
```

Then deploy with:
```bash
docker-compose up -d
```

### 4. Initial Setup

After starting the container:

1. Navigate to `http://localhost:3000/setup` (or your domain)
2. Follow the setup wizard to create the admin user
3. Authenticate with Google or GitHub
4. The first user becomes the system administrator

### 5. Container Management

```bash
# View logs
docker logs systemprompt-os

# Follow logs
docker logs -f systemprompt-os

# Stop the container
docker stop systemprompt-os

# Start the container
docker start systemprompt-os

# Restart the container
docker restart systemprompt-os

# Remove the container (data persists in volumes)
docker rm systemprompt-os

# Update to new version
docker pull systemprompt-os:latest
docker stop systemprompt-os
docker rm systemprompt-os
# Then run again with the same volumes
```

### 6. Data Persistence

All persistent data is stored in Docker volumes:
- `/data` - Database, state files, and projects
- `/app/logs` - Application logs

To backup:
```bash
# Backup database
docker run --rm -v systemprompt-data:/data -v $(pwd):/backup alpine tar czf /backup/systemprompt-backup.tar.gz -C /data .

# Restore database
docker run --rm -v systemprompt-data:/data -v $(pwd):/backup alpine tar xzf /backup/systemprompt-backup.tar.gz -C /data
```

### 7. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | production |
| `PORT` | Server port | 3000 |
| `DATABASE_FILE` | SQLite database path | /data/state/systemprompt.db |
| `OAUTH_DOMAIN` | Public URL for OAuth callbacks | http://localhost:3000 |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | - |
| `ENABLE_OAUTH_TUNNEL` | Enable Cloudflare tunnel | false |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel token | - |
| `LOG_LEVEL` | Logging level | info |

### 8. Health Monitoring

The container provides a health endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

### 9. Troubleshooting

If the container fails to start:

1. Check logs: `docker logs systemprompt-os`
2. Ensure ports are not in use: `lsof -i :3000`
3. Verify environment variables are set correctly
4. Check disk space for volumes: `docker system df`
5. Verify Docker daemon is running: `docker ps`

For OAuth issues:
- Ensure `OAUTH_DOMAIN` matches your registered OAuth app callbacks
- Check that client ID and secret are correct
- Verify the domain is accessible from the internet

### 10. Security Considerations

1. Always use HTTPS in production (use a reverse proxy like nginx)
2. Keep OAuth credentials secure (use Docker secrets in production)
3. Regularly update the container to get security patches
4. Use volume backups for disaster recovery
5. Monitor logs for suspicious activity