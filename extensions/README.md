# SystemPrompt OS Extensions

This directory contains configuration and storage for SystemPrompt OS extensions, including MCP (Model Context Protocol) servers and custom modules.

## Directory Structure

```
extensions/
├── servers.yaml        # MCP server configurations (create from servers.yaml.example)
├── modules.yaml        # Module configurations (create from modules.yaml.example)
├── servers/           # MCP server implementations and data
├── modules/           # Custom module implementations
├── servers.yaml.example # Example MCP server configurations
└── modules.yaml.example # Example module configurations
```

## Getting Started

### MCP Servers

1. Copy `servers.yaml.example` to `servers.yaml`:
   ```bash
   cp servers.yaml.example servers.yaml
   ```

2. Edit `servers.yaml` to configure your MCP servers:
   - Add your authentication tokens
   - Modify server URLs and endpoints
   - Enable/disable servers as needed

3. Set required environment variables:
   ```bash
   export GITHUB_TOKEN="your-github-token"
   export SLACK_BOT_TOKEN="your-slack-token"
   # ... other tokens as needed
   ```

### Modules

1. Copy `modules.yaml.example` to `modules.yaml`:
   ```bash
   cp modules.yaml.example modules.yaml
   ```

2. Edit `modules.yaml` to configure your modules:
   - Enable/disable modules
   - Configure module-specific settings
   - Add custom module paths

3. Install module dependencies:
   ```bash
   # For npm modules
   npm install

   # For Python modules
   pip install -r requirements.txt
   ```

## Configuration Files

### servers.yaml

Defines MCP servers that provide tools and resources to the system. Supports:

- **Local servers**: Run as subprocesses on your machine
- **Remote servers**: Connect to external MCP endpoints
- **Authentication**: Token, basic auth, OAuth, custom headers
- **Environment variables**: Use `${VAR_NAME}` syntax for secrets

### modules.yaml

Defines SystemPrompt OS modules that extend functionality. Supports:

- **Module types**: npm, local, git, python, docker, wasm
- **Configuration**: Module-specific settings and parameters
- **Dependencies**: Automatic dependency management
- **Conditions**: Enable modules based on environment

## Environment Variables

Both configuration files support environment variable substitution:

```yaml
# Use ${VAR_NAME} to reference environment variables
token: "${GITHUB_TOKEN}"

# Use ${VAR_NAME:-default} for default values
port: "${SERVER_PORT:-8080}"
```

## Security Considerations

1. **Never commit credentials**: Keep your actual `servers.yaml` and `modules.yaml` files in `.gitignore`
2. **Use environment variables**: Store sensitive data in environment variables
3. **Verify module sources**: Only install modules from trusted sources
4. **Enable sandboxing**: Use security features for untrusted modules

## Adding Custom Extensions

### Adding a Local MCP Server

1. Create a directory in `servers/`:
   ```bash
   mkdir servers/my-server
   ```

2. Implement your MCP server following the protocol specification

3. Add configuration to `servers.yaml`:
   ```yaml
   my-server:
     type: local
     command: node
     args: ["./servers/my-server/index.js"]
   ```

### Adding a Custom Module

1. Create a directory in `modules/`:
   ```bash
   mkdir modules/my-module
   ```

2. Implement your module with the required interface

3. Add configuration to `modules.yaml`:
   ```yaml
   my-module:
     type: local
     path: "./modules/my-module"
     enabled: true
   ```

## Troubleshooting

### MCP Servers

- Check server logs: `tail -f logs/mcp-servers.log`
- Verify environment variables are set
- Test server connectivity: `npx @modelcontextprotocol/cli test <server-name>`

### Modules

- Check module logs: `tail -f logs/modules.log`
- Verify dependencies are installed
- Run module tests: `npm test` or `pytest`

## Contributing

When contributing new servers or modules:

1. Add comprehensive examples to the `.example` files
2. Document configuration options
3. Include tests for your implementation
4. Update this README with relevant information

## Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [SystemPrompt OS Docs](https://systemprompt.io/docs)
- [Extension Development Guide](https://systemprompt.io/docs/extensions)