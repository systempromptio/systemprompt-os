# Extension Module

The extension module provides management capabilities for SystemPrompt OS extensions and modules.

## Features

- Extension discovery and listing
- Extension validation
- Extension installation and removal
- Detailed extension information
- Support for both modules and servers

## CLI Commands

### extension:list

List installed extensions and modules.

```bash
# List all extensions
systemprompt extension:list

# List only modules
systemprompt extension:list --type module

# List only servers
systemprompt extension:list --type server

# Output as JSON
systemprompt extension:list --format json

# Output as table
systemprompt extension:list --format table
```

### extension:info

Show detailed information about an extension.

```bash
systemprompt extension:info --name auth
systemprompt extension:info --name my-custom-module
```

### extension:validate

Validate extension structure and configuration.

```bash
# Validate an extension directory
systemprompt extension:validate --path ./my-extension

# Use strict validation
systemprompt extension:validate --path ./my-extension --strict
```

### extension:install

Install an extension (not fully implemented).

```bash
# Install from registry
systemprompt extension:install --name my-extension

# Install specific version
systemprompt extension:install --name my-extension --version 1.2.0

# Force reinstall
systemprompt extension:install --name my-extension --force
```

### extension:remove

Remove an installed extension.

```bash
# Remove extension
systemprompt extension:remove --name my-extension

# Remove but preserve configuration
systemprompt extension:remove --name my-extension --preserve-config
```

## Extension Structure

### Module Extension

```
my-module/
├── module.yaml      # Module configuration (required)
├── index.ts        # Module entry point (required)
├── cli/           # CLI commands (optional)
│   ├── command1.ts
│   └── command2.ts
├── services/      # Services (optional)
├── tests/         # Tests (recommended)
└── README.md      # Documentation (recommended)
```

### Server Extension

```
my-server/
├── server.yaml     # Server configuration (required)
├── index.ts       # Server entry point (required)
├── handlers/      # Request handlers
└── README.md      # Documentation (recommended)
```

## Extension Configuration

### module.yaml Example

```yaml
name: my-module
type: service
version: 1.0.0
description: My custom module
author: Your Name
dependencies:
  - logger
  - config
cli:
  commands:
    - name: hello
      description: Say hello
      options:
        - name: name
          type: string
          description: Name to greet
```

## Extension Locations

Extensions are discovered from:

1. **Core Modules**: `./src/modules/core/`
2. **Custom Modules**: `./src/modules/custom/`
3. **Extension Modules**: `./extensions/modules/`
4. **Extension Servers**: `./extensions/servers/`

## Creating an Extension

1. Create the extension directory in the appropriate location
2. Add a `module.yaml` or `server.yaml` configuration file
3. Implement the required entry point (`index.ts`)
4. Add CLI commands if needed (modules only)
5. Validate the structure: `systemprompt extension:validate --path ./my-extension`

## Module Structure

```
extension/
├── module.yaml      # Module configuration
├── index.ts        # Module entry point with ExtensionModule class
├── cli/           # CLI commands
│   ├── list.ts
│   ├── info.ts
│   ├── validate.ts
│   ├── install.ts
│   └── remove.ts
└── tests/         # Test files
    └── unit/
        └── extension.test.ts
```