# OAuth2 Flow Best Practices for SystemPrompt OS

## Overview

This document outlines best practices for implementing OAuth2 flows in SystemPrompt OS, ensuring security, compliance, and optimal user experience.

## OAuth2 Flow Architecture

### 1. Authorization Code Flow with PKCE

Always use Authorization Code flow with PKCE (Proof Key for Code Exchange) for all clients, including SPAs and native apps.

```typescript
// Example PKCE implementation
interface PKCEChallenge {
  codeVerifier: string;  // Random 43-128 character string
  codeChallenge: string; // SHA256(codeVerifier)
  method: 'S256';
}

// Generate PKCE challenge
function generatePKCEChallenge(): PKCEChallenge {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = sha256(codeVerifier);
  return {
    codeVerifier,
    codeChallenge,
    method: 'S256'
  };
}
```

### 2. State Parameter Usage

Always use state parameter for CSRF protection and flow correlation.

```typescript
interface OAuthState {
  // Security
  nonce: string;           // Random value for CSRF protection
  timestamp: number;       // Expiration tracking
  
  // Flow data
  clientId: string;        // Requesting client
  redirectUri: string;     // Where to return user
  scope: string;           // Requested permissions
  
  // PKCE
  codeChallenge?: string;  // PKCE challenge
  challengeMethod?: string; // PKCE method
  
  // Original request
  originalState?: string;  // Client's state parameter
}

// Encode state securely
function encodeState(state: OAuthState): string {
  const jwt = signJWT(state, {
    expiresIn: '10m',  // Short expiration
    audience: 'oauth2-state'
  });
  return jwt;
}
```

## Provider Integration Best Practices

### 1. Provider Configuration

Store provider configurations securely and validate all URLs.

```typescript
interface ProviderConfig {
  id: string;
  displayName: string;
  clientId: string;
  clientSecret: string;  // Encrypted at rest
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  
  // Security settings
  allowedRedirectUris: string[];
  enablePKCE: boolean;
  requireState: boolean;
  
  // Token handling
  tokenEndpointAuthMethod: 'client_secret_post' | 'client_secret_basic';
  useJwtForUserInfo: boolean;
}
```

### 2. Provider Callback Handling

Implement robust error handling for provider callbacks.

```typescript
async function handleProviderCallback(req: Request, res: Response) {
  try {
    // 1. Validate state parameter
    const state = validateState(req.query.state);
    if (!state) {
      throw new OAuth2Error('invalid_state', 'State validation failed');
    }
    
    // 2. Check for provider errors
    if (req.query.error) {
      throw new OAuth2Error(
        req.query.error,
        req.query.error_description || 'Provider returned error'
      );
    }
    
    // 3. Exchange authorization code
    const tokens = await exchangeCodeForTokens({
      code: req.query.code,
      redirectUri: state.redirectUri,
      codeVerifier: state.codeVerifier // PKCE
    });
    
    // 4. Validate tokens
    const validatedTokens = await validateProviderTokens(tokens);
    
    // 5. Get user information
    const userInfo = await getUserInfoFromProvider(validatedTokens.accessToken);
    
    // 6. Create or update local user
    const user = await createOrUpdateUser(userInfo, state.provider);
    
    // 7. Generate authorization code for client
    const authCode = await generateAuthorizationCode({
      userId: user.id,
      clientId: state.clientId,
      scope: state.scope,
      redirectUri: state.redirectUri,
      codeChallenge: state.codeChallenge
    });
    
    // 8. Redirect to client
    const redirectUrl = new URL(state.redirectUri);
    redirectUrl.searchParams.set('code', authCode);
    if (state.originalState) {
      redirectUrl.searchParams.set('state', state.originalState);
    }
    
    res.redirect(redirectUrl.toString());
    
  } catch (error) {
    handleCallbackError(error, res);
  }
}
```

## Token Management Best Practices

### 1. Token Generation

Use secure token generation with proper claims.

```typescript
interface TokenClaims {
  // Standard claims
  iss: string;    // Issuer
  sub: string;    // Subject (user ID)
  aud: string;    // Audience (client ID)
  exp: number;    // Expiration
  iat: number;    // Issued at
  jti: string;    // JWT ID (unique identifier)
  
  // Custom claims
  scope: string;  // Granted scopes
  tokenType: 'access' | 'refresh';
  sessionId?: string;
  clientId: string;
}

function generateAccessToken(user: User, client: Client, scopes: string[]): string {
  const claims: TokenClaims = {
    iss: getIssuer(),
    sub: user.id,
    aud: client.id,
    exp: Date.now() / 1000 + 3600, // 1 hour
    iat: Date.now() / 1000,
    jti: generateTokenId(),
    scope: scopes.join(' '),
    tokenType: 'access',
    clientId: client.id
  };
  
  return signJWT(claims);
}
```

### 2. Token Storage

Store tokens securely with proper hashing.

```typescript
interface StoredToken {
  id: string;
  tokenHash: string;      // SHA256 hash of token
  userId: string;
  clientId: string;
  type: 'access' | 'refresh';
  scope: string;
  expiresAt: Date;
  isRevoked: boolean;
  lastUsedAt?: Date;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
  };
}

async function storeToken(token: string, metadata: TokenMetadata): Promise<void> {
  const tokenHash = sha256(token);
  
  await tokenService.createToken({
    tokenHash,
    userId: metadata.userId,
    clientId: metadata.clientId,
    type: metadata.type,
    scope: metadata.scope,
    expiresAt: new Date(metadata.exp * 1000),
    isRevoked: false,
    metadata: {
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress
    }
  });
}
```

### 3. Token Validation

Implement comprehensive token validation.

```typescript
async function validateToken(token: string): Promise<TokenValidationResult> {
  try {
    // 1. Verify JWT signature
    const decoded = verifyJWT(token);
    
    // 2. Check token in database
    const tokenHash = sha256(token);
    const storedToken = await tokenService.findByHash(tokenHash);
    
    if (!storedToken) {
      return { valid: false, reason: 'Token not found' };
    }
    
    // 3. Check revocation
    if (storedToken.isRevoked) {
      return { valid: false, reason: 'Token revoked' };
    }
    
    // 4. Check expiration
    if (storedToken.expiresAt < new Date()) {
      return { valid: false, reason: 'Token expired' };
    }
    
    // 5. Validate claims
    if (decoded.sub !== storedToken.userId) {
      return { valid: false, reason: 'Invalid token claims' };
    }
    
    // 6. Update last used
    await tokenService.updateLastUsed(storedToken.id);
    
    return {
      valid: true,
      userId: storedToken.userId,
      clientId: storedToken.clientId,
      scopes: storedToken.scope.split(' ')
    };
    
  } catch (error) {
    return { valid: false, reason: 'Token validation failed' };
  }
}
```

## Security Best Practices

### 1. HTTPS Everywhere

Always use HTTPS in production for all OAuth2 endpoints.

```typescript
// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

### 2. Rate Limiting

Implement rate limiting on sensitive endpoints.

```typescript
const rateLimits = {
  authorize: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: 'Too many authorization attempts'
  }),
  
  token: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: 'Too many token requests'
  }),
  
  callback: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 callbacks per window
    message: 'Too many callback attempts'
  })
};
```

### 3. Input Validation

Validate all inputs strictly.

```typescript
const schemas = {
  authorize: z.object({
    response_type: z.enum(['code']),
    client_id: z.string().uuid(),
    redirect_uri: z.string().url(),
    scope: z.string().regex(/^[\w\s]+$/),
    state: z.string().min(8),
    code_challenge: z.string().length(43),
    code_challenge_method: z.enum(['S256'])
  }),
  
  token: z.object({
    grant_type: z.enum(['authorization_code', 'refresh_token']),
    code: z.string().when('grant_type', {
      is: 'authorization_code',
      then: z.string().length(32)
    }),
    refresh_token: z.string().when('grant_type', {
      is: 'refresh_token',
      then: z.string()
    }),
    client_id: z.string().uuid(),
    code_verifier: z.string().min(43).max(128)
  })
};
```

### 4. Secure Headers

Set security headers for all responses.

```typescript
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // CSP
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});
```

## Error Handling Best Practices

### 1. OAuth2 Error Responses

Return proper OAuth2 error responses.

```typescript
class OAuth2Error extends Error {
  constructor(
    public error: string,
    public errorDescription?: string,
    public errorUri?: string,
    public statusCode: number = 400
  ) {
    super(errorDescription || error);
  }
  
  toJSON() {
    return {
      error: this.error,
      error_description: this.errorDescription,
      error_uri: this.errorUri
    };
  }
}

// Standard OAuth2 errors
const errors = {
  invalidRequest: (desc?: string) => 
    new OAuth2Error('invalid_request', desc),
  
  unauthorizedClient: (desc?: string) => 
    new OAuth2Error('unauthorized_client', desc),
  
  accessDenied: (desc?: string) => 
    new OAuth2Error('access_denied', desc),
  
  unsupportedResponseType: (desc?: string) => 
    new OAuth2Error('unsupported_response_type', desc),
  
  invalidScope: (desc?: string) => 
    new OAuth2Error('invalid_scope', desc),
  
  serverError: (desc?: string) => 
    new OAuth2Error('server_error', desc, undefined, 500),
  
  temporarilyUnavailable: (desc?: string) => 
    new OAuth2Error('temporarily_unavailable', desc, undefined, 503)
};
```

### 2. Logging and Monitoring

Log all authentication events for security monitoring.

```typescript
interface AuthEvent {
  type: 'login' | 'logout' | 'token_issued' | 'token_revoked' | 'auth_failed';
  userId?: string;
  clientId?: string;
  provider?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

async function logAuthEvent(event: AuthEvent): Promise<void> {
  // Log to structured logging system
  logger.info('auth_event', event);
  
  // Store in database for analysis
  await authEventService.create(event);
  
  // Send to monitoring system
  if (event.type === 'auth_failed') {
    await alertingService.sendAlert({
      type: 'auth_failure',
      severity: 'medium',
      details: event
    });
  }
}
```

## Testing OAuth2 Flows

### 1. Unit Tests

Test individual components thoroughly.

```typescript
describe('OAuth2 Authorization', () => {
  it('should generate valid PKCE challenge', () => {
    const challenge = generatePKCEChallenge();
    expect(challenge.codeVerifier).toHaveLength(128);
    expect(challenge.codeChallenge).toHaveLength(43);
    expect(challenge.method).toBe('S256');
  });
  
  it('should validate state parameter correctly', async () => {
    const state = createState({ clientId: 'test', redirectUri: 'http://localhost' });
    const encoded = encodeState(state);
    const decoded = await validateState(encoded);
    expect(decoded.clientId).toBe('test');
  });
});
```

### 2. Integration Tests

Test complete flows end-to-end.

```typescript
describe('OAuth2 Flow Integration', () => {
  it('should complete authorization code flow with PKCE', async () => {
    // 1. Initiate authorization
    const pkce = generatePKCEChallenge();
    const authResponse = await request(app)
      .get('/oauth2/authorize')
      .query({
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'openid email',
        code_challenge: pkce.codeChallenge,
        code_challenge_method: 'S256'
      });
    
    expect(authResponse.status).toBe(302);
    const location = new URL(authResponse.headers.location);
    expect(location.hostname).toBe('provider.example.com');
    
    // 2. Simulate provider callback
    const callbackResponse = await request(app)
      .get('/oauth2/callback')
      .query({
        code: 'provider-auth-code',
        state: extractState(location)
      });
    
    expect(callbackResponse.status).toBe(302);
    const clientRedirect = new URL(callbackResponse.headers.location);
    const authCode = clientRedirect.searchParams.get('code');
    
    // 3. Exchange code for tokens
    const tokenResponse = await request(app)
      .post('/oauth2/token')
      .send({
        grant_type: 'authorization_code',
        code: authCode,
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        code_verifier: pkce.codeVerifier
      });
    
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.body).toHaveProperty('access_token');
    expect(tokenResponse.body).toHaveProperty('refresh_token');
  });
});
```

## Conclusion

Following these best practices ensures a secure, compliant, and maintainable OAuth2 implementation. Regular security audits and keeping up with OAuth2 specification updates are essential for maintaining a robust authentication system.