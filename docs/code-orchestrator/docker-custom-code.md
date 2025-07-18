# Docker Custom Code Integration

This document explains how the Docker setup handles custom modules and MCP servers, addressing symlink limitations and providing flexible mounting options.

## Architecture Overview

The Docker setup supports custom code through:
1. **Volume mounts** - Preferred method, avoids symlink issues
2. **Bind mounts** - Direct mounting of host directories
3. **Dynamic symlinks** - Created at runtime in entrypoint

## Dockerfile Changes

The Dockerfile now:
- Pre-creates custom directories (`/app/modules/custom`, `/app/server/mcp/custom`)
- Creates intermediate mount points (`/app/custom-modules`, `/app/custom-mcp`)
- Adds placeholder files to ensure directories exist

## Entrypoint Handling

The `docker-entrypoint.sh` script:
1. Checks for mounted custom code volumes
2. Creates symlinks dynamically at runtime
3. Verifies bind mounts
4. Provides clear logging of custom code detection

## Mounting Options

### Option 1: Using Named Volumes (Recommended)

```yaml
# docker-compose.yml
volumes:
  custom_modules:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /home/pi/systemprompt-custom/modules
```

Benefits:
- Docker manages the volume lifecycle
- Better permission handling
- Works across different Docker versions

### Option 2: Direct Bind Mounts

```yaml
# docker-compose.yml
services:
  app:
    volumes:
      - /home/pi/systemprompt-custom/modules:/app/modules/custom:ro
      - /home/pi/systemprompt-custom/mcp-servers:/app/server/mcp/custom:ro
```

Benefits:
- Simpler configuration
- Direct mapping
- No intermediate volumes

### Option 3: Intermediate Mount Points

```yaml
# docker-compose.yml (default in docker-compose.rpi.yml)
services:
  app:
    volumes:
      - custom_modules:/app/custom-modules:ro
      - custom_mcp:/app/custom-mcp:ro
```

The entrypoint script creates symlinks:
- `/app/modules/custom` → `/app/custom-modules`
- `/app/server/mcp/custom` → `/app/custom-mcp`

Benefits:
- Works around Docker symlink limitations
- Flexible runtime configuration
- Better error handling

## Raspberry Pi Specific Configuration

The `docker-compose.rpi.yml` includes:

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: ${CONTAINER_MEMORY:-1G}
```

### GPIO Access (Optional)
```yaml
devices:
  - /dev/gpiomem:/dev/gpiomem
cap_add:
  - SYS_RAWIO
```

### Memory Optimization
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=${NODE_MEMORY:-512}
```

## Usage

### Initial Setup

```bash
# Create custom directories
mkdir -p /home/pi/systemprompt-custom/{modules,mcp-servers}

# Initialize as git repositories
cd /home/pi/systemprompt-custom/modules
git init
git remote add origin <your-modules-repo>

cd /home/pi/systemprompt-custom/mcp-servers
git init
git remote add origin <your-mcp-repo>
```

### Running with Custom Code

```bash
# Use the Raspberry Pi optimized compose file
docker-compose -f docker-compose.rpi.yml up -d

# Check custom code detection
docker-compose logs | grep "custom"
```

### Updating Custom Code

```bash
# Pull updates in custom repositories
cd /home/pi/systemprompt-custom/modules
git pull

cd /home/pi/systemprompt-custom/mcp-servers
git pull

# Restart container to load changes
docker-compose -f docker-compose.rpi.yml restart
```

## Troubleshooting

### Custom Code Not Loading

1. Check volume mounts:
```bash
docker inspect systemprompt-os | grep -A 10 Mounts
```

2. Verify symlinks inside container:
```bash
docker exec systemprompt-os ls -la /app/modules/custom
docker exec systemprompt-os ls -la /app/server/mcp/custom
```

3. Check entrypoint logs:
```bash
docker-compose logs | grep -E "(custom|volume|mount)"
```

### Permission Issues

1. Ensure directories are readable:
```bash
chmod -R 755 /home/pi/systemprompt-custom
```

2. Check Docker user:
```bash
# In .env
DOCKER_USER=1000
DOCKER_GROUP=1000
```

### Symlink Issues

If symlinks aren't working:
1. Use direct bind mounts instead
2. Or use the intermediate mount point approach
3. Check Docker version compatibility

## Best Practices

1. **Use read-only mounts** (`:ro`) for custom code
2. **Test locally** before deploying to Pi
3. **Version control** all custom code
4. **Document dependencies** in your custom modules
5. **Monitor logs** after deployment

## Security Considerations

- Custom code runs with same permissions as main app
- Use read-only mounts to prevent modifications
- Review all custom code before deployment
- Consider using separate containers for untrusted code