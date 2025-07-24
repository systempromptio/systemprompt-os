# ESLint Plugin Module Structure

A custom ESLint plugin for enforcing consistent folder structure and architectural boundaries in SystemPrompt OS modules.

## Rules

### 1. `module-structure/enforce-module-structure`
Ensures files are placed in the correct folders based on their purpose.

### 2. `module-structure/enforce-file-naming`
Enforces consistent file naming conventions:
- `kebab-case` for most files
- Proper suffixes (`.service.ts`, `.repository.ts`, etc.)
- Migration files with numeric prefixes

### 3. `module-structure/enforce-import-restrictions`
Prevents architectural violations by restricting imports between layers:
- CLI → Services → Repositories → Database
- Types and Utils can be imported by any layer
- Enforces clean architecture principles

### 4. `module-structure/enforce-required-files`
Ensures modules have required files:
- `index.ts` - Module entry point
- `module.yaml` - Module configuration
- `index.ts` in types folders

## Configuration

The plugin is integrated into the main `eslint.config.js` file and runs automatically with:

```bash
npm run lint
npm run lint:check
```

## Module Structure

```
src/modules/<module-name>/
├── index.ts              # Required
├── module.yaml           # Required
├── README.md             # Optional
├── cli/                  # Command-line interfaces
├── services/             # Business logic
├── repositories/         # Data access
├── types/                # TypeScript definitions
│   └── index.ts          # Required in types folder
├── database/             # Database schemas
├── utils/                # Utilities
├── prompts/              # MCP prompts
├── resources/            # MCP resources
├── tools/                # MCP tools
├── executors/            # Task executors
├── providers/            # External providers
├── schemas/              # JSON schemas
├── models/               # Data models
├── interfaces/           # Interface contracts
├── adapters/             # Adapters
└── migrations/           # Database migrations
```

## Import Hierarchy

The plugin enforces a clean architecture with proper dependency flow:

```
CLI
 ↓
Services
 ↓
Repositories
 ↓
Database

All layers can import from:
- Types
- Utils (except Types can't import Utils)
```