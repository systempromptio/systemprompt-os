# Extension Module

The extension module provides comprehensive management capabilities for SystemPrompt OS extensions and modules, including creation, validation, and lifecycle management.

## Features

- Extension discovery and listing
- Module validation with schema enforcement
- Module generator for creating new modules
- Extension installation and removal
- Detailed extension information
- Support for both modules and servers
- ESLint configuration for module standards
- Automated validation of all core modules

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

Validate module/extension structure and configuration.

```bash
# Validate a specific module/extension directory
systemprompt extension:validate --path ./my-extension

# Validate all core modules
systemprompt extension:validate --all

# Use strict validation
systemprompt extension:validate --path ./my-extension --strict

# Attempt to fix common issues
systemprompt extension:validate --path ./my-extension --fix
```

### extension:create

Create a new module with proper structure and boilerplate.

```bash
# Create a new service module
systemprompt extension:create --name my-module

# Create a daemon module
systemprompt extension:create --name my-daemon --type daemon

# Create with custom description and author
systemprompt extension:create --name my-module --description "My custom module" --author "John Doe"

# Create with function-based style (default is class-based)
systemprompt extension:create --name my-module --style function

# Create in a custom directory
systemprompt extension:create --name my-module --path ./src/modules/custom
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

## Module Validation

The extension module includes comprehensive validation capabilities:

### Validation Features

- **Schema Validation**: Validates module.yaml against JSON Schema
- **Structure Validation**: Checks for required files and directories
- **Implementation Validation**: Verifies module exports and interfaces
- **CLI Command Validation**: Ensures CLI commands are properly implemented
- **Dependency Validation**: Checks module dependencies

### Validation Rules

1. **Required Fields in module.yaml**:
   - `name`: Module identifier (lowercase, alphanumeric with hyphens)
   - `type`: One of: service, daemon, plugin, core, extension
   - `version`: Semantic version (e.g., "1.0.0")
   - `description`: Brief description (10-200 characters)
   - `author`: Module author or organization

2. **Required Files**:
   - `module.yaml`: Module manifest
   - `index.ts`: Module implementation

3. **Recommended Structure**:
   - `README.md`: Documentation
   - `cli/`: CLI commands directory
   - `services/`: Service classes
   - `types/`: TypeScript definitions
   - `tests/`: Test files

### Module Schema

The complete module schema is located at `schemas/module-schema.json` and enforces:
- Proper field types and formats
- Valid module types
- Semantic versioning
- CLI command structure
- API definitions

## ESLint Configuration

The extension module provides ESLint rules for enforcing module standards:
- Module interface implementation
- Naming conventions
- Import restrictions
- Required method implementations
- Documentation requirements

Configuration file: `schemas/.eslintrc.module.json`

## Module Structure

```
extension/
├── module.yaml      # Module configuration
├── index.ts        # Module entry point with ExtensionModule class
├── cli/           # CLI commands
│   ├── list.ts
│   ├── info.ts
│   ├── validate.ts
│   ├── create.ts
│   ├── install.ts
│   └── remove.ts
├── services/      # Services
│   └── module-validator.service.ts
├── schemas/       # Validation schemas and configs
│   ├── module-schema.json
│   └── .eslintrc.module.json
└── tests/         # Test files
    └── unit/
        └── extension.test.ts
```