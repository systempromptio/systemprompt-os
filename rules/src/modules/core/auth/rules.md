# Auth Module Rules

## Overview
The auth module provides authentication and authorization services for the SystemPrompt OS platform. It follows the standard module structure and provides a clean separation of concerns between authentication, session management, token management, and OAuth provider integration.

## Module Structure Requirements

### Core Services Architecture

1. **AuthService** (Primary Service)
   - MUST implement ONLY the methods defined in `auth.service.generated.ts`
   - Methods:
     - `authenticate(email: string, password: string): Promise<unknown>`
     - `createSession(userId: string): Promise<string>`
     - `validateSession(sessionId: string): Promise<unknown>`
     - `revokeSession(sessionId: string): Promise<void>`
     - `listSessions(userId: string): Promise<string[]>`
   - Delegates to specialized services for implementation

2. **SessionService** (Internal Service)
   - Handles all session-related operations
   - NOT exposed in module exports
   - Used internally by AuthService

3. **TokenService** (Internal Service)
   - Manages API tokens and scopes
   - NOT exposed in module exports
   - Accessed via AuthService methods if needed

4. **ProvidersService** (Internal Service)
   - Manages OAuth provider configurations
   - NOT exposed in module exports
   - Used internally for OAuth flows

5. **OAuthService** (Internal Service)
   - Handles OAuth user creation and updates
   - Methods that were in AuthService (createOrUpdateUserFromOAuth, etc.)
   - NOT exposed in module exports

## Type Requirements

### Generated Types (DO NOT MODIFY)
- `database.generated.ts` - Database table types
- `auth.module.generated.ts` - Module interface types
- `auth.service.generated.ts` - Service validation schemas

### Manual Types (RESTRICTED USE)
- `manual.ts` - ONLY for:
  - OAuth provider interfaces (vary by provider)
  - CLI-specific types
  - Internal service interfaces

## Module Exports
The module MUST export ONLY:
```typescript
{
  service: () => AuthService
}
```

NO additional services should be exposed. All functionality must be accessed through AuthService.

## CLI Command Structure
CLI commands MUST:
1. Use ONLY the exported AuthService
2. NOT directly access internal services
3. Use proper error handling and validation
4. Follow consistent option patterns

## Repository Pattern
Each service should have its corresponding repository:
- `auth.repository.ts` - OAuth identities
- `session.repository.ts` - Sessions
- `token.repository.ts` - API tokens
- `auth-code.repository.ts` - Authorization codes

## Inter-Module Communication

### Event-Based Architecture (REQUIRED)
The auth module MUST use event-based communication when interacting with other modules to maintain loose coupling:

1. **User Operations**
   - Use `UserEvents.USER_DATA_REQUEST` to request user information
   - Listen for `UserEvents.USER_DATA_RESPONSE` for user data
   - Use `UserEvents.USER_CREATE_REQUEST` for OAuth user creation
   - Listen for `UserEvents.USER_CREATE_RESPONSE` for creation results

2. **Authentication Events**
   - Emit `AuthEvents.LOGIN_SUCCESS` when authentication succeeds
   - Emit `AuthEvents.LOGIN_FAILED` when authentication fails
   - Emit `AuthEvents.SESSION_CREATED` when new session is created
   - Emit `AuthEvents.SESSION_REVOKED` when session is revoked

3. **Example Implementation**
```typescript
// In OAuthService - Creating user via events
const eventBus = EventBusService.getInstance();
const requestId = randomUUID();

// Listen for response first
const responsePromise = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
  
  eventBus.once<UserCreateResponseEvent>(UserEvents.USER_CREATE_RESPONSE, (event) => {
    if (event.requestId === requestId) {
      clearTimeout(timeout);
      resolve(event.userId);
    }
  });
});

// Emit request
eventBus.emit(UserEvents.USER_CREATE_REQUEST, {
  requestId,
  email: providerData.email,
  username: providerData.email.split('@')[0],
  display_name: providerData.name,
  avatar_url: providerData.avatarUrl
});

const userId = await responsePromise;
```

### Direct Service Imports (ALLOWED)
Only import these core infrastructure services directly:
- `EventBusService` - For event communication
- `LoggerService` - For logging
- `DatabaseService` - For database access

### Forbidden Patterns
- ❌ NEVER import users module directly: `import { getUsersModule } from '@/modules/core/users'`
- ❌ NEVER access other module's repositories or utilities
- ❌ NEVER create circular dependencies

## OAuth Provider Architecture
1. Provider configurations stored in YAML files
2. ProviderFactory creates provider instances
3. Providers implement IIdentityProvider interface
4. OAuth flow handled internally, exposed via AuthService methods

## Session Management
1. Sessions created via AuthService.createSession()
2. Validation via AuthService.validateSession()
3. Revocation via AuthService.revokeSession()
4. Internal SessionService handles database operations

## Token Management
1. API tokens managed internally by TokenService
2. Exposed through AuthService methods as needed
3. Scopes validated at service layer

## Security Requirements
1. All passwords must be hashed using bcrypt
2. Sessions must have expiration times
3. Tokens must be cryptographically secure
4. OAuth state must be validated
5. CSRF protection for OAuth flows

## Testing Requirements
Integration tests must cover:
1. Authentication flows
2. Session lifecycle
3. OAuth provider integration
4. Token management
5. CLI command functionality

## Migration Path
When refactoring from current structure:
1. Move OAuth user methods from AuthService to OAuthService
2. Keep AuthService methods minimal (only generated schema)
3. Update CLI commands to use AuthService methods only
4. Ensure backward compatibility during transition