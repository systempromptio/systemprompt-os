# System Management Module

Core module for managing SystemPrompt deployments, updates, and backups.

## Features

- **Update Management**: Update core and custom code from git repositories
- **Backup & Restore**: Create and manage system backups
- **Deployment**: Initialize proper structure for custom code
- **Status Monitoring**: Check update status for all repositories

## CLI Commands

### Update Commands

```bash
# Update core SystemPrompt code
systemprompt system:update:core

# Update custom modules and MCP servers
systemprompt system:update:custom

# Check update status
systemprompt system:update:status
```

### Backup Commands

```bash
# Create a backup
systemprompt system:backup:create [name]

# List backups
systemprompt system:backup:list

# Restore from backup
systemprompt system:backup:restore <name>
```

### Deployment Commands

```bash
# Initialize deployment structure
systemprompt system:deploy:init
```

## Configuration

Configure in `module.yaml`:

```yaml
config:
  backupDir: /home/pi/systemprompt-backups
  customRepoPath: ./modules/custom
  mcpCustomRepoPath: ./server/mcp/custom
  maxBackups: 5
```

## Custom Code Structure

After running `deploy:init`, your custom code structure will be:

```
/home/pi/systemprompt-custom/
├── modules/         # Git repository for custom modules
├── mcp-servers/     # Git repository for custom MCP servers
├── config/          # Instance configuration
└── docs/            # Custom documentation
```

## Update Workflow

1. **Check Status**: `systemprompt system:update:status`
2. **Create Backup**: `systemprompt system:backup:create pre-update`
3. **Update Core**: `systemprompt system:update:core`
4. **Update Custom**: `systemprompt system:update:custom`
5. **Restart**: `docker-compose restart`

## Raspberry Pi Deployment

For Raspberry Pi deployments:

1. Initialize structure: `systemprompt system:deploy:init`
2. Add custom code to `/home/pi/systemprompt-custom/`
3. Commit to git repositories
4. Use update commands to pull changes

## Backup Strategy

- Backups include: configuration, docker-compose, state, and git status
- Automatic cleanup keeps only the latest N backups (configurable)
- Metadata tracks version and git branches at backup time

## Security Notes

- Always backup before updates
- Review git changes before pulling
- Test custom code in development first
- Keep sensitive data in `.env` files (not in git)