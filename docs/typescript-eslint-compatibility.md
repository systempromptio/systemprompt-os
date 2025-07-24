# TypeScript and ESLint Compatibility Guide

## Current Setup

- **TypeScript**: 5.8.3
- **ESLint**: 9.31.0 (using flat config)
- **@typescript-eslint**: 8.38.0

## Configuration Files

### TypeScript Configuration
- `tsconfig.json` - Main TypeScript config (very strict settings)
- `tsconfig.eslint.json` - Extended config for ESLint (includes all files)
- `tsconfig.build.json` - Build-specific config

### ESLint Configuration
- `eslint.config.js` - ESLint 9.x flat config (active)
- ~~`.eslintrc.json`~~ - Legacy config (removed)

## Key Compatibility Points

### 1. Parser Configuration
ESLint must use `@typescript-eslint/parser` with correct TypeScript project:
```javascript
parserOptions: {
  project: "./tsconfig.eslint.json",
  tsconfigRootDir: "."
}
```

### 2. File Coverage
- TypeScript (`tsconfig.json`): Only `src/**/*` and specific test files
- ESLint (`tsconfig.eslint.json`): All TypeScript/JavaScript files in project
- This ensures ESLint can check test files, scripts, and config files

### 3. Type-Aware Rules
ESLint rules that need type information:
- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/no-unsafe-call`
- `@typescript-eslint/strict-boolean-expressions`
- `@typescript-eslint/no-floating-promises`

These require proper `parserOptions.project` configuration.

### 4. Module Resolution
TypeScript uses `"module": "NodeNext"` which requires:
- `.js` extensions in relative imports
- Explicit `type` imports with `verbatimModuleSyntax`

## Common Issues and Solutions

### Issue 1: "File not found in any provided project"
**Solution**: Use `tsconfig.eslint.json` that includes all files

### Issue 2: Conflicting naming conventions
**Solution**: Align ESLint and TypeScript naming rules:
```javascript
"@typescript-eslint/naming-convention": [...]
```

### Issue 3: Duplicate type checking
**Solution**: Disable ESLint rules that TypeScript already checks:
- Use TypeScript for type errors
- Use ESLint for style and complexity

### Issue 4: Performance issues
**Solution**: 
- Limit type-aware rules to critical ones
- Use separate tsconfig for ESLint without `composite` projects
- Consider `TIMING=1 eslint` to identify slow rules

## Best Practices

1. **Single Source of Truth**: Use TypeScript for type checking, ESLint for style
2. **Consistent Configuration**: Keep parser versions in sync
3. **Incremental Adoption**: Start with recommended configs, add custom rules gradually
4. **Performance**: Monitor linting time, disable expensive rules if needed
5. **CI/CD**: Run both `tsc --noEmit` and `eslint` in CI

## Verification Commands

```bash
# Check TypeScript compilation
npm run typecheck

# Check ESLint
npm run lint:check

# Check specific file with both
npx tsc --noEmit src/index.ts
npx eslint src/index.ts

# Debug ESLint config
npx eslint --print-config src/index.ts

# Check which files TypeScript includes
npx tsc --listFilesOnly
```

## Module Structure Rules

The custom `eslint-plugin-module-structure` enforces:
- Proper folder structure (cli/, services/, repositories/, etc.)
- Consistent file naming
- Clean architecture imports
- Required files (index.ts, module.yaml)

These rules work alongside TypeScript's type checking to ensure both code correctness and architectural consistency.