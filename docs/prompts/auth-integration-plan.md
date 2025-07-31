# Auth Module Integration Plan for SystemPrompt OS Server

## Executive Summary

This document outlines a comprehensive plan to refactor the server implementation to properly utilize the auth module's service-based architecture. The current implementation has inconsistent auth handling, hardcoded values, and doesn't leverage the full capabilities of the refactored auth module.

## Current State Analysis

### Problems Identified

1. **Fragmented Auth Implementation**
   - Auth logic scattered across multiple files
   - Direct auth module access without proper service usage
   - Hardcoded URLs and client IDs
   - Missing proper OAuth2 flow integration

2. **Service Integration Issues**
   - Auth module properly exposes services but server doesn't use them correctly
   - Providers accessed incorrectly (e.g., `getProviderRegistry()` instead of using `providersService()`)
   - Token validation in middleware doesn't use TokenService

3. **OAuth2 Flow Problems**
   - Multiple OAuth2 implementations (auth.ts, oauth2/authorize.ts)
   - No proper state management for OAuth flows
   - Missing PKCE support validation
   - Hardcoded redirect URIs

4. **Security Concerns**
   - JWT verification using custom implementation instead of auth module services
   - No proper session management integration
   - Cookie handling without using SessionService

## Refactoring Plan

### Phase 1: Centralize Auth Service Usage

#### 1.1 Create Auth Service Adapter
Create a single point of integration between server and auth module services.

```typescript
// src/server/services/auth-adapter.service.ts
export class ServerAuthAdapter {
  private static instance: ServerAuthAdapter;
  private authService?: AuthService;
  private tokenService?: TokenService;
  private sessionService?: SessionService;
  private providersService?: ProvidersService;
  private oauth2ConfigService?: OAuth2ConfigurationService;
  
  static getInstance(): ServerAuthAdapter {
    if (!ServerAuthAdapter.instance) {
      ServerAuthAdapter.instance = new ServerAuthAdapter();
    }
    return ServerAuthAdapter.instance;
  }
  
  initialize(): void {
    const authModule = getAuthModule();
    this.authService = authModule.exports.authService();
    this.tokenService = authModule.exports.tokenService();
    this.sessionService = authModule.exports.sessionService();
    this.providersService = authModule.exports.providersService();
    this.oauth2ConfigService = authModule.exports.oauth2ConfigService();
  }
}
```

#### 1.2 Update Middleware to Use Auth Services
Replace the current JWT-based middleware with service-based validation.

```typescript
// src/server/external/middleware/auth.ts
export const createAuthMiddleware = (options: AuthMiddlewareOptions = {}) => {
  const authAdapter = ServerAuthAdapter.getInstance();
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    
    if (!token) {
      return handleMissingToken(res, options);
    }
    
    const validation = await authAdapter.validateToken(token);
    
    if (!validation.valid) {
      return handleAuthFailure(res, options, validation.reason);
    }
    
    req.user = {
      id: validation.userId,
      scopes: validation.scopes,
      // Additional user data from validation
    };
    
    next();
  };
};
```

### Phase 2: Implement Proper OAuth2 Flow

#### 2.1 Consolidate OAuth2 Endpoints
Merge the scattered OAuth2 implementations into a unified flow using auth services.

```typescript
// src/server/external/rest/oauth2/unified-authorize.ts
export class UnifiedAuthorizeEndpoint {
  private authAdapter: ServerAuthAdapter;
  
  constructor() {
    this.authAdapter = ServerAuthAdapter.getInstance();
  }
  
  async handleAuthorize(req: Request, res: Response): Promise<void> {
    const params = this.validateRequest(req);
    
    // Use auth module's provider service
    const provider = await this.authAdapter.getProvider(params.provider);
    
    if (!provider) {
      return this.renderProviderSelection(req, res, params);
    }
    
    // Generate proper state with auth service
    const state = await this.authAdapter.createAuthorizationState(params);
    
    // Get provider authorization URL
    const authUrl = await provider.getAuthorizationUrl({
      state,
      redirectUri: await this.authAdapter.getProviderCallbackUrl(params.provider),
      scope: params.scope,
      // Additional OIDC params
    });
    
    res.redirect(authUrl);
  }
}
```

#### 2.2 Implement Provider Callback Handler
Properly handle OAuth provider callbacks using auth services.

```typescript
async handleProviderCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;
  
  if (error) {
    return this.handleCallbackError(res, error);
  }
  
  // Validate state using auth service
  const stateData = await this.authAdapter.validateAuthorizationState(state);
  
  if (!stateData) {
    return this.handleInvalidState(res);
  }
  
  // Exchange code for tokens using provider
  const provider = await this.authAdapter.getProvider(stateData.provider);
  const tokens = await provider.exchangeCodeForTokens(code, {
    redirectUri: await this.authAdapter.getProviderCallbackUrl(stateData.provider)
  });
  
  // Get user info from provider
  const userInfo = await provider.getUserInfo(tokens.accessToken);
  
  // Create or update user via auth service
  const authResult = await this.authAdapter.authenticateOAuthUser({
    provider: stateData.provider,
    providerUserId: userInfo.sub,
    email: userInfo.email,
    profile: userInfo
  });
  
  // Create session and tokens
  const session = await this.authAdapter.createSession(authResult.userId);
  const accessToken = await this.authAdapter.createAccessToken({
    userId: authResult.userId,
    sessionId: session.id,
    scopes: stateData.scope.split(' ')
  });
  
  // Complete authorization flow
  const authCode = await this.authAdapter.createAuthorizationCode({
    clientId: stateData.clientId,
    userId: authResult.userId,
    redirectUri: stateData.redirectUri,
    scope: stateData.scope,
    codeChallenge: stateData.codeChallenge
  });
  
  // Redirect back to client
  const redirectUrl = new URL(stateData.redirectUri);
  redirectUrl.searchParams.set('code', authCode);
  if (stateData.state) {
    redirectUrl.searchParams.set('state', stateData.state);
  }
  
  res.redirect(redirectUrl.toString());
}
```

### Phase 3: Implement Token Management

#### 3.1 Token Endpoint Refactoring
Update token endpoint to use auth services properly.

```typescript
// src/server/external/rest/oauth2/token.ts
export class TokenEndpoint {
  async handleTokenRequest(req: Request, res: Response): Promise<void> {
    const grantType = req.body.grant_type;
    
    switch (grantType) {
      case 'authorization_code':
        return this.handleAuthorizationCode(req, res);
      case 'refresh_token':
        return this.handleRefreshToken(req, res);
      case 'client_credentials':
        return this.handleClientCredentials(req, res);
      default:
        return this.sendError(res, 'unsupported_grant_type');
    }
  }
  
  private async handleAuthorizationCode(req: Request, res: Response): Promise<void> {
    const { code, client_id, redirect_uri, code_verifier } = req.body;
    
    // Validate authorization code with auth service
    const codeData = await this.authAdapter.validateAuthorizationCode(code, {
      clientId: client_id,
      redirectUri: redirect_uri,
      codeVerifier: code_verifier
    });
    
    if (!codeData) {
      return this.sendError(res, 'invalid_grant');
    }
    
    // Create tokens using auth service
    const tokens = await this.authAdapter.createTokensFromCode(codeData);
    
    res.json({
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope
    });
  }
}
```

### Phase 4: Session Management Integration

#### 4.1 Cookie-Based Session Handling
Integrate SessionService for proper session management.

```typescript
// src/server/external/middleware/session.ts
export const sessionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.cookies?.session_id;
  
  if (sessionId) {
    const session = await authAdapter.getSession(sessionId);
    
    if (session && session.isActive) {
      req.session = session;
      req.userId = session.userId;
      
      // Refresh session activity
      await authAdapter.touchSession(sessionId);
    }
  }
  
  next();
};
```

### Phase 5: Provider Management

#### 5.1 Dynamic Provider Configuration
Enable dynamic provider configuration through auth module.

```typescript
// src/server/external/rest/admin/providers.ts
export class ProviderManagementEndpoint {
  async listProviders(req: Request, res: Response): Promise<void> {
    const providers = await this.authAdapter.getAllProviders();
    res.json(providers);
  }
  
  async createProvider(req: Request, res: Response): Promise<void> {
    const providerConfig = req.body;
    const provider = await this.authAdapter.createProvider(providerConfig);
    res.json(provider);
  }
  
  async updateProvider(req: Request, res: Response): Promise<void> {
    const { providerId } = req.params;
    const updates = req.body;
    const provider = await this.authAdapter.updateProvider(providerId, updates);
    res.json(provider);
  }
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Create ServerAuthAdapter service
- [ ] Update auth middleware to use auth services
- [ ] Create integration tests for auth flow

### Week 2: OAuth2 Flow
- [ ] Consolidate OAuth2 endpoints
- [ ] Implement provider callback handler
- [ ] Add state management for OAuth flows

### Week 3: Token & Session Management
- [ ] Refactor token endpoint
- [ ] Integrate session management
- [ ] Implement refresh token flow

### Week 4: Provider Management & Testing
- [ ] Add provider management endpoints
- [ ] Comprehensive integration testing
- [ ] Performance optimization

## Best Practices

### 1. Service Usage
- Always use auth module services, never access database directly
- Use dependency injection for testability
- Implement proper error handling with service-specific errors

### 2. Security
- Validate all OAuth2 parameters
- Use PKCE for all authorization flows
- Implement proper CSRF protection using state parameter
- Store tokens securely (hashed in database)

### 3. OAuth2 Compliance
- Follow OAuth 2.1 specification
- Support OpenID Connect discovery
- Implement proper error responses per RFC 6749

### 4. Scalability
- Use caching for provider configurations
- Implement connection pooling for auth services
- Consider rate limiting for token endpoints

### 5. Monitoring
- Log all authentication events
- Track OAuth flow completion rates
- Monitor token usage patterns

## Migration Strategy

1. **Parallel Implementation**: Build new implementation alongside existing
2. **Feature Flags**: Use feature flags to gradually roll out new auth flow
3. **Backwards Compatibility**: Maintain existing endpoints during transition
4. **Data Migration**: Migrate existing sessions and tokens to new format
5. **Rollback Plan**: Ensure ability to revert to old implementation if needed

## Testing Strategy

### Unit Tests
- Test each service adapter method
- Mock auth module services
- Test error scenarios

### Integration Tests
- Full OAuth2 flow testing
- Provider callback handling
- Token exchange scenarios

### E2E Tests
- Complete authentication flow
- Multi-provider scenarios
- Session persistence

## Conclusion

This refactoring will create a robust, maintainable authentication system that properly leverages the auth module's service architecture. The implementation will be more secure, scalable, and compliant with OAuth2 standards while providing a better foundation for future enhancements.