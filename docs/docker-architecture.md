# Docker Architecture

## Overview

The SystemPrompt Coding Agent uses Docker to provide a consistent, isolated environment for the MCP server while maintaining access to the host system through the daemon bridge. This architecture ensures portability, security, and ease of deployment across different environments.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Host Machine                           │
│  ┌─────────────────┐        ┌──────────────────────────┐  │
│  │  Project Files  │        │     Host Bridge Daemon    │  │
│  │  /var/www/html  │        │      (Port 9876)         │  │
│  └────────┬────────┘        └────────────▲─────────────┘  │
│           │                               │                 │
│      Volume Mount                    TCP Connection         │
│           │                               │                 │
│  ┌────────▼──────────────────────────────┴──────────────┐  │
│  │              Docker Container (mcp-server)            │  │
│  │  ┌─────────────────┐    ┌─────────────────────────┐ │  │
│  │  │   MCP Server    │    │   File System Access    │ │  │
│  │  │  (Port 3000)    │    │    /workspace/*        │ │  │
│  │  └─────────────────┘    └─────────────────────────┘ │  │
│  │                                                       │  │
│  │  Environment: Alpine Linux, Node.js 18               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Dockerfile

The Dockerfile creates a secure, minimal container image:

```dockerfile
FROM node:18-alpine
```

**Base Image Features:**
- Alpine Linux for minimal size (~50MB base)
- Node.js 18 for modern JavaScript support
- Security-focused with minimal attack surface

**Key Packages:**
- `tini`: Proper signal handling and zombie process reaping
- `git`: For repository operations
- `bash`: Shell scripting support
- `coreutils`: Full Unix utilities

**Security Measures:**
- Non-root user (`appuser`) for runtime
- Read-only mounts where possible
- Minimal exposed ports (3000 only)

### 2. Docker Compose Configuration

The `docker-compose.yml` orchestrates the container deployment:

#### Port Mapping
```yaml
ports:
  - "3000:3000"  # MCP server accessible on host
```

#### Network Configuration
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```
Enables container-to-host communication for daemon access.

#### Volume Mounts

1. **State Storage**
   ```yaml
   - coding-agent-state:/data/state
   ```
   Persistent storage for tasks, sessions, and logs.

2. **Workspace Mount**
   ```yaml
   - ${HOST_FILE_ROOT}:/workspace:rw
   ```
   Direct access to project files on host.

3. **Claude Authentication**
   ```yaml
   - ${HOME}/.claude.json:/home/appuser/.claude.json:ro
   ```
   Read-only mount for Claude CLI credentials.

4. **Daemon Logs**
   ```yaml
   - ./daemon/logs:/workspace/daemon/logs:rw
   ```
   Shared logging between daemon and container.

### 3. Docker Entrypoint

The `docker-entrypoint.sh` script handles container initialization:

1. **Directory Setup**
   - Creates required state directories
   - Verifies write permissions
   - Falls back to local storage if needed

2. **Environment Configuration**
   - Sets default values
   - Configures tunnel URLs
   - Unsets API keys (uses authenticated session)

3. **Git Configuration**
   - Marks workspace as safe directory
   - Handles permission issues gracefully

## Environment Variables

### Core Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Server port | `3000` |
| `STATE_PATH` | State storage location | `/data/state` |
| `PROJECTS_PATH` | Projects directory | `/data/projects` |

### Host Integration
| Variable | Description | Default |
|----------|-------------|---------|
| `HOST_FILE_ROOT` | Host project directory | `/var/www/html/systemprompt-coding-agent` |
| `CLAUDE_PROXY_HOST` | Daemon hostname | `host.docker.internal` |
| `CLAUDE_PROXY_PORT` | Daemon port | `9876` |

### Feature Flags
| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_AVAILABLE` | Claude CLI available | `false` |
| `GIT_AVAILABLE` | Git operations enabled | `false` |
| `TUNNEL_ENABLED` | Tunnel active | `false` |

## Volume Management

### Named Volume: `coding-agent-state`

Persistent storage for:
- **Tasks**: Task definitions and status
- **Sessions**: Active session data
- **Logs**: Execution logs and events
- **Reports**: Generated task reports

```bash
# Inspect volume
docker volume inspect coding-agent-state

# Backup volume
docker run --rm -v coding-agent-state:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/state-backup.tar.gz -C /data .
```

## Security Considerations

### 1. User Permissions
- Container runs as non-root user (`appuser`)
- Limited write access to specific directories
- Read-only mounts for sensitive files

### 2. Network Isolation
- Only port 3000 exposed
- Host access through controlled daemon connection
- No direct internet access from container

### 3. File System Access
- Workspace mounted with specific permissions
- State directories isolated in Docker volume
- Docker socket mounted read-only (optional)

## Build and Deployment

### Building the Image

```bash
# Build with Docker Compose
docker-compose build

# Build standalone
docker build -t systemprompt/coding-agent .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 \
  -t systemprompt/coding-agent .
```

### Running the Container

```bash
# Start with Docker Compose (recommended)
docker-compose up -d

# View logs
docker-compose logs -f mcp-server

# Stop gracefully
docker-compose down
```

### Development Mode

```yaml
# docker-compose.override.yml
services:
  mcp-server:
    environment:
      - NODE_ENV=development
    volumes:
      - ./src:/app/src:ro
      - ./build:/app/build:rw
```

## Container Lifecycle

### Startup Sequence

1. **Entrypoint Execution**
   - Initialize directories
   - Set environment variables
   - Configure Git

2. **Server Initialization**
   - Load state from volumes
   - Connect to daemon
   - Start HTTP server

3. **Health Check**
   - Verify daemon connectivity
   - Check state persistence
   - Confirm port binding

### Shutdown Process

1. **Graceful Shutdown**
   - SIGTERM received
   - Complete active requests
   - Save state to volumes
   - Close daemon connections

2. **Tini Process Manager**
   - Forwards signals properly
   - Prevents zombie processes
   - Ensures clean exit

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Fix volume permissions
   docker-compose down
   docker volume rm coding-agent-state
   docker-compose up -d
   ```

2. **Cannot Connect to Daemon**
   ```bash
   # Check host resolution
   docker exec mcp-server ping host.docker.internal
   
   # Verify daemon is running
   nc -zv localhost 9876
   ```

3. **State Not Persisting**
   ```bash
   # Check volume mount
   docker exec mcp-server ls -la /data/state
   
   # Verify write permissions
   docker exec mcp-server touch /data/state/test
   ```

### Debug Commands

```bash
# Interactive shell
docker exec -it mcp-server sh

# View environment
docker exec mcp-server env | sort

# Check processes
docker exec mcp-server ps aux

# Network debugging
docker exec mcp-server netstat -an
```

## Performance Optimization

### Image Size
- Alpine base reduces size by ~70%
- Multi-stage builds (if needed)
- Minimal dependencies

### Resource Limits

```yaml
# docker-compose.yml
services:
  mcp-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 512M
```

### Caching Strategy
- NPM cache persisted between builds
- Layer optimization for faster rebuilds
- Volume mounts for development

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Build and push Docker image
  run: |
    docker buildx create --use
    docker buildx build \
      --platform linux/amd64,linux/arm64 \
      --tag ${{ env.REGISTRY }}/coding-agent:${{ github.sha }} \
      --push .
```

### Deployment Strategies

1. **Rolling Updates**
   - Build new image
   - Update compose file
   - `docker-compose up -d`

2. **Blue-Green Deployment**
   - Run new container on different port
   - Test functionality
   - Switch traffic
   - Remove old container

This Docker architecture provides a robust, secure, and scalable foundation for the SystemPrompt Coding Agent, ensuring consistent behavior across different deployment environments while maintaining the flexibility needed for AI-powered development workflows.