# Type Export Convention

## Overview

This ESLint rule enforces that all TypeScript type definitions (interfaces, types, and enums) must be:
1. Located in a `types/` folder within each module/directory
2. Follow a path structure that mirrors the source files they relate to
3. Be exported from a central `types/index.ts` file

## Rule: `module-structure/enforce-type-exports`

### Configuration

```javascript
"module-structure/enforce-type-exports": ["error", {
  "allowInlineTypes": false,      // Don't allow types defined outside types/ folders
  "enforcePathMatching": true     // Enforce that type paths match source paths
}]
```

## Directory Structure

### ✅ Correct Structure

```
src/modules/auth/
├── services/
│   └── auth.service.ts         # Implementation
├── types/
│   ├── index.ts               # Central export file
│   ├── services/              # Mirrors service structure
│   │   └── auth.types.ts      # Types for auth.service.ts
│   └── auth.types.ts          # General auth types
└── index.ts
```

### ❌ Incorrect Structure

```
src/modules/auth/
├── services/
│   └── auth.service.ts         # Contains inline interfaces ❌
└── index.ts                    # No types folder ❌
```

## Examples

### Good Example - Service with Types

**File:** `src/modules/auth/services/auth.service.ts`
```typescript
import type { IAuthService, AuthResult, TokenPayload } from '../types/index.js';

export class AuthService implements IAuthService {
  async authenticate(username: string, password: string): Promise<AuthResult> {
    // Implementation
  }
}
```

**File:** `src/modules/auth/types/services/auth.types.ts`
```typescript
export interface IAuthService {
  authenticate(username: string, password: string): Promise<AuthResult>;
  validateToken(token: string): Promise<TokenPayload>;
}

export interface IAuthResult {
  success: boolean;
  token?: string;
  user?: IUser;
}

export type AuthResult = IAuthResult;

export enum AuthStatus {
  Success = 'success',
  Failed = 'failed',
  Pending = 'pending'
}
```

**File:** `src/modules/auth/types/index.ts`
```typescript
// Export all types from this module
export * from './services/auth.types.js';
export * from './repositories/user.types.js';
export * from './auth.types.js';
```

### Bad Example - Inline Types

**File:** `src/modules/auth/services/auth.service.ts`
```typescript
// ❌ BAD: Types defined in implementation file
export interface AuthResult {
  success: boolean;
  token?: string;
}

export class AuthService {
  async authenticate(username: string, password: string): Promise<AuthResult> {
    // Implementation
  }
}
```

## Path Matching Convention

The type file path should match the source file path:

| Source File | Type File |
|------------|-----------|
| `services/auth.service.ts` | `types/services/auth.types.ts` |
| `repositories/user.repository.ts` | `types/repositories/user.types.ts` |
| `cli/login.ts` | `types/cli/login.types.ts` |
| `utils/crypto.ts` | `types/utils/crypto.types.ts` |

## Benefits

1. **Separation of Concerns**: Types are separated from implementation
2. **Easy Discovery**: All types for a module are in one place
3. **Better Organization**: Mirror structure makes it easy to find related types
4. **Reusability**: Types can be easily imported and reused
5. **Testing**: Test files can import types without importing implementation
6. **Bundle Size**: Type-only imports are removed during compilation

## Migration Guide

To migrate existing code:

1. Create a `types/` folder in your module
2. Move all interfaces, types, and enums to corresponding files in `types/`
3. Create `types/index.ts` that exports all types
4. Update imports to use `import type` from the types folder
5. Run ESLint to catch any remaining issues

## Exceptions

The following are exceptions to this rule:

1. **Type declaration files** (`.d.ts`) - Can contain type definitions
2. **Test files** - Can define test-specific types inline
3. **Shared types** - Can have types that don't map to specific files (e.g., `types/common.types.ts`)
4. **External type augmentation** - Module augmentation must be in the file being augmented

## FAQ

**Q: What about types used only within a single file?**
A: Even private types should be in the types folder if they're interfaces, type aliases, or enums. This maintains consistency.

**Q: Can I have multiple type files for one source file?**
A: Yes, you can split large type definitions across multiple files, but they should all be in the appropriate types subfolder.

**Q: What about generic/shared types?**
A: Place them in `types/common.types.ts` or `types/shared.types.ts` and export from `types/index.ts`.