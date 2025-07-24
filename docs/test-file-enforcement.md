# Test File Enforcement

## Overview

The `enforce-test-files` ESLint rule ensures that every functional file has a corresponding test file. This helps maintain test coverage and encourages test-driven development.

## Rule: `module-structure/enforce-test-files`

### Configuration

```javascript
"module-structure/enforce-test-files": ["warn", {
  "testDir": "tests/unit",
  "testSuffixes": [".spec.ts", ".test.ts"],
  "enforceStrictPath": true,
  "excludePatterns": [
    "index.ts",
    "types/**",
    "**/*.types.ts",
    "**/*.interface.ts",
    "database/migrations/**"
  ],
  "includePatterns": [
    "services/**/*.service.ts",
    "repositories/**/*.repository.ts",
    "utils/**/*.ts",
    "cli/**/*.ts"
  ]
}]
```

## Test File Structure

### Strict Path Mode (default)

When `enforceStrictPath: true`, test files must mirror the exact source structure:

| Source File | Test File |
|------------|-----------|
| `src/modules/auth/services/auth.service.ts` | `tests/unit/modules/auth/services/auth.service.spec.ts` |
| `src/modules/auth/utils/crypto.ts` | `tests/unit/modules/auth/utils/crypto.spec.ts` |
| `src/server/middleware.ts` | `tests/unit/server/middleware.spec.ts` |

### Non-Strict Path Mode

When `enforceStrictPath: false`, test files can be anywhere in the test directory as long as they have the correct name.

## Include/Exclude Patterns

### Files That MUST Have Tests (includePatterns)

- `services/**/*.service.ts` - All service files
- `repositories/**/*.repository.ts` - All repository files
- `utils/**/*.ts` - All utility files
- `cli/**/*.ts` - All CLI command files
- `adapters/**/*.adapter.ts` - All adapter files
- `executors/**/*.executor.ts` - All executor files

### Files That DON'T Need Tests (excludePatterns)

- `index.ts` - Module index files
- `types/**` - Type definition folders
- `**/*.types.ts` - Type definition files
- `**/*.interface.ts` - Interface files
- `**/*.d.ts` - Declaration files
- `module.yaml` - Module configuration
- `database/schema.sql` - Database schemas
- `database/migrations/**` - Migration files
- `database/models/**` - Database models

## Examples

### ✅ Good: Service with Test

**Source:** `src/modules/users/services/user.service.ts`
```typescript
export class UserService {
  async findById(id: string): Promise<User> {
    // Implementation
  }
}
```

**Test:** `tests/unit/modules/users/services/user.service.spec.ts`
```typescript
import { UserService } from '@/modules/users/services/user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const user = await service.findById('123');
      expect(user.id).toBe('123');
    });
  });
});
```

### ❌ Bad: Service without Test

**Source:** `src/modules/auth/services/token.service.ts`
```typescript
export class TokenService {
  generateToken(userId: string): string {
    // Implementation
  }
}
```

**ESLint Error:**
```
error  File "src/modules/auth/services/token.service.ts" is missing a corresponding test file at "tests/unit/modules/auth/services/token.service.spec.ts"  module-structure/enforce-test-files
```

## Test File Naming

Test files can use either suffix:
- `.spec.ts` (preferred)
- `.test.ts`

The base name must match the source file:
- `user.service.ts` → `user.service.spec.ts` ✅
- `user.service.ts` → `user.spec.ts` ❌
- `user.service.ts` → `user-service.spec.ts` ❌

## Benefits

1. **Ensures Test Coverage**: Every functional file has at least a test file
2. **Maintains Structure**: Test organization mirrors source organization
3. **Easy Navigation**: Find tests by following the same path
4. **Prevents Regression**: Encourages adding tests when adding features
5. **CI/CD Integration**: Can fail builds for missing tests

## Customization

### Changing Severity

```javascript
// Error level - fail the build
"module-structure/enforce-test-files": "error"

// Warning level - show warnings but don't fail
"module-structure/enforce-test-files": "warn"

// Disable the rule
"module-structure/enforce-test-files": "off"
```

### Custom Patterns

```javascript
"module-structure/enforce-test-files": ["warn", {
  "includePatterns": [
    "controllers/**/*.controller.ts",
    "middlewares/**/*.middleware.ts",
    "validators/**/*.validator.ts"
  ],
  "excludePatterns": [
    "**/*.mock.ts",
    "**/*.stub.ts",
    "config/**"
  ]
}]
```

## Integration with CI/CD

```yaml
# GitHub Actions example
- name: Check for missing tests
  run: |
    npx eslint . --rule 'module-structure/enforce-test-files: error'
```

## FAQ

**Q: What if a file is pure configuration or constants?**
A: Add it to `excludePatterns` or create a simple test that verifies the exports.

**Q: Can I have multiple test files for one source file?**
A: Yes, but at least one must follow the naming convention.

**Q: What about integration or e2e tests?**
A: This rule only checks for unit tests. Configure separate rules for other test types.

**Q: How do I temporarily skip this rule?**
A: Use ESLint disable comments: `// eslint-disable-next-line module-structure/enforce-test-files`