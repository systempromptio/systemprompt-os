# Raspberry Pi Update Management

This guide covers the new CLI-based update system for SystemPrompt on Raspberry Pi.

## Architecture

SystemPrompt uses a clean separation between:
- **Core code**: The main SystemPrompt repository
- **Custom modules**: Your custom modules in a separate git repository
- **Custom MCP servers**: Your custom MCP servers in another git repository

## Initial Setup

### 1. Deploy SystemPrompt

```bash
# Clone and setup
git clone https://github.com/systempromptio/systemprompt-os
cd systemprompt-os
npm install
npm run setup
```

### 2. Initialize Deployment Structure

```bash
# Run from inside the container or with the CLI
systemprompt system:deploy:init
```

This creates:
```
/home/pi/systemprompt-custom/
├── modules/         # Git repo for your custom modules
├── mcp-servers/     # Git repo for your custom MCP servers  
├── config/          # Instance configuration
└── docs/            # Documentation
```

And creates symlinks:
- `./modules/custom` → `/home/pi/systemprompt-custom/modules`
- `./server/mcp/custom` → `/home/pi/systemprompt-custom/mcp-servers`

### 3. Setup Your Custom Repositories

```bash
cd /home/pi/systemprompt-custom/modules
git remote add origin https://github.com/yourusername/my-systemprompt-modules.git
git push -u origin main

cd /home/pi/systemprompt-custom/mcp-servers
git remote add origin https://github.com/yourusername/my-systemprompt-mcp.git
git push -u origin main
```

## Update Commands

All update operations are handled through the `system` module CLI commands:

### Check Update Status

```bash
systemprompt system:update:status
```

Shows:
- Core SystemPrompt branch and update status
- Custom modules branch and update status
- Custom MCP servers branch and update status
- Number of commits behind/ahead

### Update Core SystemPrompt

```bash
# Check what will be updated
systemprompt system:update:status

# Create backup before updating
systemprompt system:backup:create pre-core-update

# Update core
systemprompt system:update:core

# Restart container
docker-compose restart
```

### Update Custom Code

```bash
# Update both custom modules and MCP servers
systemprompt system:update:custom

# Restart to load new custom code
docker-compose restart
```

## Backup Management

### Create Backup

```bash
# Auto-named backup
systemprompt system:backup:create

# Named backup
systemprompt system:backup:create "before-major-update"
```

### List Backups

```bash
systemprompt system:backup:list
```

### Restore Backup

```bash
systemprompt system:backup:restore backup-2024-01-15T10-30-00.000Z
```

## Custom Module Structure

Each custom module in `/home/pi/systemprompt-custom/modules/` should have:

```
my-module/
├── module.yaml      # Module configuration
├── index.ts         # Module implementation
├── cli/             # CLI commands (optional)
│   └── status.ts    # systemprompt my-module:status
└── README.md        # Documentation
```

Example `module.yaml`:
```yaml
name: gpio-controller
type: service
version: 1.0.0
description: Raspberry Pi GPIO control service
dependencies:
  - logger
cli:
  commands:
    - name: read
      description: Read GPIO pin value
    - name: write  
      description: Write to GPIO pin
```

## Custom MCP Server Structure

Each MCP server in `/home/pi/systemprompt-custom/mcp-servers/` should have:

```
my-mcp-server/
├── server.ts        # MCP server implementation
├── package.json     # Dependencies
└── README.md        # Documentation
```

## Update Workflow Example

### Complete Update Process

```bash
# 1. Check status
systemprompt system:update:status

# 2. If updates available, create backup
systemprompt system:backup:create

# 3. Update core if needed
systemprompt system:update:core

# 4. Update custom code if needed
systemprompt system:update:custom

# 5. Restart container
docker-compose restart

# 6. Verify everything is working
systemprompt system:update:status
docker-compose logs -f
```

### Automated Updates

Create a cron job for automated updates:

```bash
# /home/pi/systemprompt-update.sh
#!/bin/bash

cd /home/pi/systemprompt-os

# Check for updates
STATUS=$(systemprompt system:update:status)

if echo "$STATUS" | grep -q "Updates available"; then
    # Create backup
    systemprompt system:backup:create "auto-$(date +%Y%m%d)"
    
    # Update core
    systemprompt system:update:core
    
    # Update custom
    systemprompt system:update:custom
    
    # Restart
    docker-compose restart
fi
```

Add to crontab:
```bash
# Run weekly on Sunday at 3 AM
0 3 * * 0 /home/pi/systemprompt-update.sh >> /var/log/systemprompt-updates.log 2>&1
```

## Best Practices

1. **Always backup before updates**: Use `system:backup:create`
2. **Test custom code separately**: Develop and test before deploying
3. **Use semantic versioning**: Tag your custom repositories
4. **Document your modules**: Include README files
5. **Monitor after updates**: Check logs after restarting

## Troubleshooting

### Custom code not loading

1. Check symlinks exist:
   ```bash
   ls -la modules/custom
   ls -la server/mcp/custom
   ```

2. Verify git repositories:
   ```bash
   cd modules/custom && git status
   cd server/mcp/custom && git status
   ```

3. Check container logs:
   ```bash
   docker-compose logs -f | grep -E "(custom|module|mcp)"
   ```

### Updates failing

1. Check git status:
   ```bash
   git status
   git stash list
   ```

2. Try manual update:
   ```bash
   git fetch origin
   git pull origin main
   ```

3. Restore from backup if needed:
   ```bash
   systemprompt system:backup:restore <backup-name>
   ```

## Security

- Custom repositories should be private
- Use SSH keys for git authentication
- Keep `.env` files out of git
- Review all code before updating
- Use read-only mounts where possible