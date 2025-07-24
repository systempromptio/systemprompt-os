---
uri: module://auth/resources/oauth2-flow-guide
name: OAuth 2.0 Flow Implementation Guide
description: Complete guide for implementing OAuth 2.0 authentication flows
mimeType: text/markdown
metadata:
  tags: [oauth2, authentication, guide]
  author: system
  lastUpdated: 2024-01-15
---

# OAuth 2.0 Flow Implementation Guide

## Overview

OAuth 2.0 is an authorization framework that enables applications to obtain limited access to user accounts on an HTTP service. It works by delegating user authentication to the service that hosts the user account and authorizing third-party applications to access the user account.

## Grant Types

### 1. Authorization Code Grant
Best for server-side applications where the source code is not publicly exposed.

```javascript
// Step 1: Redirect to authorization server
const authUrl = `https://auth.example.com/oauth/authorize?
  response_type=code&
  client_id=${CLIENT_ID}&
  redirect_uri=${REDIRECT_URI}&
  scope=read:user&
  state=${generateState()}`;

// Step 2: Exchange code for token
async function exchangeCodeForToken(code) {
  const response = await fetch('https://auth.example.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  });
  return response.json();
}
```

### 2. Implicit Grant (Deprecated)
Previously used for browser-based apps, now replaced by Authorization Code with PKCE.

### 3. Client Credentials Grant
For machine-to-machine authentication.

```javascript
async function getClientToken() {
  const response = await fetch('https://auth.example.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'api:access'
    })
  });
  return response.json();
}
```

### 4. PKCE (Proof Key for Code Exchange)
For public clients (SPAs, mobile apps) that cannot securely store secrets.

```javascript
// Generate code verifier and challenge
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(digest));
}
```

## Security Best Practices

1. **Always use HTTPS** for all OAuth endpoints
2. **Validate redirect URIs** to prevent open redirect attacks
3. **Use state parameter** to prevent CSRF attacks
4. **Implement token rotation** for refresh tokens
5. **Set appropriate token expiration times**
6. **Store tokens securely** (encrypted in database, secure cookies)
7. **Implement rate limiting** on token endpoints
8. **Log authentication events** for security monitoring

## Common Pitfalls

- Not validating the state parameter
- Storing tokens in localStorage (use secure httpOnly cookies instead)
- Not implementing token revocation
- Using implicit grant for new applications
- Not handling token expiration gracefully