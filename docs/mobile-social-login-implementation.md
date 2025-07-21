# Mobile & Social Login Implementation Guide

## Overview

This guide provides detailed implementation steps for adding mobile-optimized social login to SystemPrompt's Cloudflare Zero Trust integration.

## Social Provider Setup

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   ```
   Application type: Web application
   Authorized redirect URIs:
   - https://systemprompt.com/auth/callback/google
   - https://systemprompt.com/auth/mobile/google (for mobile)
   ```

### 2. GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App:
   ```
   Application name: SystemPrompt
   Homepage URL: https://systemprompt.com
   Authorization callback URL: https://systemprompt.com/auth/callback/github
   ```

### 3. Microsoft (Azure AD) Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Register new application:
   ```
   Supported account types: Personal Microsoft accounts only
   Redirect URI: https://systemprompt.com/auth/callback/microsoft
   ```

## Implementation Code

### 1. Social Login Routes

```typescript
// src/server/external/auth/routes/social-login.ts

import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { Octokit } from '@octokit/rest';

const router = express.Router();

// Google Login
router.get('/auth/google', (req, res) => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', generateState());
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'select_account');
  
  res.redirect(authUrl.toString());
});

// Google Callback
router.get('/auth/callback/google', async (req, res) => {
  const { code, state } = req.query;
  
  try {
    // Validate state
    if (!validateState(state as string)) {
      throw new Error('Invalid state');
    }
    
    // Exchange code for tokens
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);
    
    // Get user info
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID!
    });
    
    const payload = ticket.getPayload()!;
    
    // Create or update user
    const user = await findOrCreateUser({
      email: payload.email!,
      name: payload.name!,
      picture: payload.picture,
      provider: 'google',
      providerId: payload.sub
    });
    
    // Check access grants
    const grants = await getAccessGrantsForUser(user.email);
    
    // Generate SystemPrompt tokens
    const systemPromptTokens = await generateTokens(user, grants);
    
    // Redirect to dashboard or Cloudflare callback
    res.redirect(`/dashboard?token=${systemPromptTokens.accessToken}`);
    
  } catch (error) {
    console.error('Google auth error:', error);
    res.redirect('/login?error=auth_failed');
  }
});

// GitHub Login
router.get('/auth/github', (req, res) => {
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', process.env.GITHUB_REDIRECT_URI!);
  authUrl.searchParams.set('scope', 'user:email');
  authUrl.searchParams.set('state', generateState());
  
  res.redirect(authUrl.toString());
});

// GitHub Callback
router.get('/auth/callback/github', async (req, res) => {
  const { code, state } = req.query;
  
  try {
    // Validate state
    if (!validateState(state as string)) {
      throw new Error('Invalid state');
    }
    
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI
      })
    });
    
    const { access_token } = await tokenResponse.json();
    
    // Get user info
    const octokit = new Octokit({ auth: access_token });
    const { data: user } = await octokit.users.getAuthenticated();
    const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser();
    
    const primaryEmail = emails.find(e => e.primary)?.email || user.email;
    
    // Create or update user
    const systemUser = await findOrCreateUser({
      email: primaryEmail!,
      name: user.name || user.login,
      picture: user.avatar_url,
      provider: 'github',
      providerId: user.id.toString()
    });
    
    // Rest of flow same as Google...
    
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.redirect('/login?error=auth_failed');
  }
});

export default router;
```

### 2. Mobile-Optimized Login Page

```typescript
// src/client/pages/MobileLogin.tsx

import React, { useEffect, useState } from 'react';
import { FaGoogle, FaGithub, FaMicrosoft } from 'react-icons/fa';

export const MobileLogin: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);
  
  const handleSocialLogin = (provider: string) => {
    if (isMobile) {
      // Use in-app browser for better UX
      window.location.href = `/auth/${provider}?mobile=true`;
    } else {
      // Desktop can use popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        `/auth/${provider}`,
        'auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    }
  };
  
  return (
    <div className="mobile-login">
      <h1>Access Your Container</h1>
      <p>Sign in with your account to access containers shared with you</p>
      
      <div className="social-buttons">
        <button
          className="social-btn google"
          onClick={() => handleSocialLogin('google')}
        >
          <FaGoogle /> Continue with Google
        </button>
        
        <button
          className="social-btn github"
          onClick={() => handleSocialLogin('github')}
        >
          <FaGithub /> Continue with GitHub
        </button>
        
        <button
          className="social-btn microsoft"
          onClick={() => handleSocialLogin('microsoft')}
        >
          <FaMicrosoft /> Continue with Microsoft
        </button>
      </div>
      
      <div className="security-note">
        <p>🔒 Secure authentication via OAuth 2.0</p>
        <p>We never store your password</p>
      </div>
    </div>
  );
};

// CSS for mobile optimization
const styles = `
.mobile-login {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.social-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin: 30px 0;
}

.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s;
}

.social-btn:active {
  transform: scale(0.98);
}

.social-btn.google {
  background: #4285f4;
  color: white;
}

.social-btn.github {
  background: #24292e;
  color: white;
}

.social-btn.microsoft {
  background: #0078d4;
  color: white;
}

.security-note {
  margin-top: 30px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
}

/* Mobile specific styles */
@media (max-width: 480px) {
  .mobile-login {
    padding: 10px;
  }
  
  .social-btn {
    padding: 18px 20px;
    font-size: 17px;
  }
}
`;
```

### 3. Token Generation with Container Access

```typescript
// src/server/auth/token-generator.ts

import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
}

interface AccessGrant {
  container_id: string;
  container_name: string;
  permissions: string[];
  granted_by: string;
  expires_at: Date;
}

export async function generateTokens(user: User, grants: AccessGrant[]) {
  const now = Math.floor(Date.now() / 1000);
  
  // Create ID token for Cloudflare
  const idToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    auth_provider: user.provider,
    tenant_id: user.id,
    
    // Include accessible containers
    accessible_containers: grants.map(grant => ({
      container_id: grant.container_id,
      tunnel_name: `container-${grant.container_id}`,
      permissions: grant.permissions,
      granted_by: grant.granted_by,
      expires_at: grant.expires_at.toISOString()
    })),
    
    // Standard OIDC claims
    iss: process.env.ISSUER_URL,
    aud: process.env.CLOUDFLARE_CLIENT_ID,
    iat: now,
    exp: now + 3600, // 1 hour
    nonce: uuidv4()
  })
  .setProtectedHeader({ alg: 'RS256', kid: 'primary' })
  .sign(privateKey);
  
  // Create access token for API calls
  const accessToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    scope: 'containers:read containers:write',
    iat: now,
    exp: now + 900 // 15 minutes
  })
  .setProtectedHeader({ alg: 'RS256' })
  .sign(privateKey);
  
  // Create refresh token
  const refreshToken = await new SignJWT({
    sub: user.id,
    iat: now,
    exp: now + 2592000 // 30 days
  })
  .setProtectedHeader({ alg: 'RS256' })
  .sign(privateKey);
  
  return {
    idToken,
    accessToken,
    refreshToken,
    expiresIn: 3600
  };
}
```

### 4. JWKS Endpoint Implementation

```typescript
// src/server/auth/jwks.ts

import { createPublicKey } from 'crypto';
import { readFileSync } from 'fs';

// Load public key
const publicKeyPem = readFileSync('./keys/public.pem', 'utf8');
const publicKey = createPublicKey(publicKeyPem);

// Convert to JWK
export function getJWKS() {
  const jwk = publicKey.export({ format: 'jwk' });
  
  return {
    keys: [
      {
        ...jwk,
        kid: 'primary',
        use: 'sig',
        alg: 'RS256'
      }
    ]
  };
}

// Endpoint
router.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});
```

### 5. Database Models

```typescript
// src/models/access-management.ts

import { Model, DataTypes } from 'sequelize';

export class User extends Model {
  id!: string;
  email!: string;
  name!: string;
  picture?: string;
  auth_provider!: string;
  provider_id!: string;
  created_at!: Date;
  last_login!: Date;
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  name: DataTypes.STRING,
  picture: DataTypes.STRING(500),
  auth_provider: DataTypes.STRING(50),
  provider_id: DataTypes.STRING,
  last_login: DataTypes.DATE
}, { sequelize, modelName: 'user' });

export class AccessGrant extends Model {
  id!: string;
  grantor_id!: string;
  grantee_email!: string;
  container_id!: string;
  permissions!: string[];
  created_at!: Date;
  expires_at!: Date;
  revoked_at?: Date;
}

AccessGrant.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  grantor_id: {
    type: DataTypes.UUID,
    references: { model: User, key: 'id' }
  },
  grantee_email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  container_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  permissions: {
    type: DataTypes.JSON,
    defaultValue: ['read']
  },
  expires_at: DataTypes.DATE,
  revoked_at: DataTypes.DATE
}, { 
  sequelize, 
  modelName: 'access_grant',
  indexes: [
    { fields: ['grantee_email'] },
    { fields: ['container_id'] }
  ]
});
```

## Mobile App Integration

### 1. Deep Linking Setup

```typescript
// Mobile app URL scheme registration
// iOS: Info.plist
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>systemprompt</string>
        </array>
    </dict>
</array>

// Android: AndroidManifest.xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="systemprompt" android:host="auth" />
</intent-filter>
```

### 2. Progressive Web App Manifest

```json
// public/manifest.json
{
  "name": "SystemPrompt Container Access",
  "short_name": "SystemPrompt",
  "description": "Manage access to your Docker containers",
  "start_url": "/dashboard",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "shortcuts": [
    {
      "name": "My Containers",
      "url": "/dashboard/containers",
      "icon": "/shortcut-containers.png"
    },
    {
      "name": "Access Grants",
      "url": "/dashboard/grants",
      "icon": "/shortcut-grants.png"
    }
  ]
}
```

## Security Best Practices

1. **State Parameter**: Always use and validate state parameter to prevent CSRF
2. **PKCE**: Implement PKCE for mobile OAuth flows
3. **Token Rotation**: Implement refresh token rotation
4. **Secure Storage**: Use Keychain (iOS) / Keystore (Android) for token storage
5. **Certificate Pinning**: Pin SSL certificates in mobile apps
6. **Biometric Auth**: Add fingerprint/face ID for mobile app access

## Testing

### 1. Test Social Login Flow

```bash
# Test Google login
curl -i https://systemprompt.com/auth/google

# Test callback handling
curl -X GET "https://systemprompt.com/auth/callback/google?code=test&state=test"
```

### 2. Mobile Testing

- Test on real devices (iOS & Android)
- Test deep linking
- Test offline mode
- Test biometric authentication
- Test token refresh flow

## Monitoring

1. Track login success/failure rates by provider
2. Monitor token generation performance
3. Alert on unusual access patterns
4. Log all access grant changes
5. Monitor Cloudflare tunnel health