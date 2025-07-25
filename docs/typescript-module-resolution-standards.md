# TypeScript Module Resolution Standards

## Overview

This document establishes the module resolution standards for the SystemPrompt OS project to ensure consistent behavior across development, build, and production environments.

## Module Resolution Configuration

### TypeScript Configuration

The project uses the following TypeScript module settings in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**Key Points:**
- `module: "ES2022"` - Uses modern ES modules
- `moduleResolution: "bundler"` - Allows imports without file extensions, matching modern bundler behavior
- Path aliases map `@/*` to `src/*` for cleaner imports

### Import Standards

1. **No File Extensions**: When importing TypeScript files, do NOT include file extensions
   ```typescript
   // ✅ Correct
   import { MyService } from '@/modules/core/services/my-service';
   
   // ❌ Incorrect
   import { MyService } from '@/modules/core/services/my-service.ts';
   import { MyService } from '@/modules/core/services/my-service.js';
   ```

2. **Use Path Aliases**: Always use the `@/` alias for imports from the src directory
   ```typescript
   // ✅ Correct
   import { DatabaseService } from '@/modules/core/database/services/database.service';
   
   // ❌ Incorrect
   import { DatabaseService } from '../../../database/services/database.service';
   ```

3. **Type-Only Imports**: Use `import type` for type-only imports
   ```typescript
   // ✅ Correct
   import type { IUser } from '@/types/user';
   
   // ❌ Incorrect (if only using types)
   import { IUser } from '@/types/user';
   ```

## Environment-Specific Handling

### Development Environment
- Uses `tsx --tsconfig-paths` which handles path resolution automatically
- No additional configuration needed

### Build Process
1. TypeScript compiles with `tsconfig.build.json` (relaxed strict settings for gradual migration)
2. `tsc-alias` post-processes the output to resolve path aliases
3. Configuration in `tsc-alias.json`:
   ```json
   {
     "resolve": {
       "alias": {
         "@/*": "./build/*"
       }
     }
   }
   ```

### Production Runtime
- Uses custom Node.js loader (`loader.mjs`) to resolve paths at runtime
- Handles path alias resolution for the compiled JavaScript

### Docker Environment
- Uses the built output with the custom loader
- Same behavior as production runtime

## Type Checking

For strict type checking during development:
```bash
npx tsc --noEmit
```

This uses the main `tsconfig.json` with all strict checks enabled.

## Migration Notes

The project previously used `"moduleResolution": "NodeNext"` which required `.js` extensions in imports. We migrated to `"bundler"` resolution for the following reasons:

1. **Developer Experience**: No need to use `.js` extensions when importing `.ts` files
2. **Tooling Compatibility**: Better support from bundlers and development tools
3. **Consistency**: Matches how most modern TypeScript projects work

## Troubleshooting

### Module Resolution Errors (TS2307)

If you encounter "Cannot find module" errors:

1. **Check Import Path**: Ensure you're using the correct path alias (`@/`)
2. **No Extensions**: Remove any `.ts` or `.js` extensions from imports
3. **File Exists**: Verify the imported file actually exists at the expected location

### Build Failures

If the build fails with module errors:

1. **Clean Build**: Run `rm -rf build` and rebuild
2. **Check tsc-alias**: Ensure `tsc-alias` is installed and configured
3. **Verify Paths**: Check that `tsconfig.build.json` extends the main config

## Best Practices

1. **Consistent Imports**: Use path aliases consistently throughout the codebase
2. **Organize by Feature**: Group related modules together
3. **Barrel Exports**: Use index.ts files to re-export from folders
4. **Type Safety**: Leverage TypeScript's strict mode for better type checking

## Future Considerations

- Consider migrating to a bundler (like esbuild or swc) for faster builds
- Evaluate whether path aliases provide enough value vs. complexity
- Monitor TypeScript's evolving module resolution strategies