# OAuth Setup Guide for SystemPrompt OS

## Overview

SystemPrompt OS supports OAuth2/OIDC authentication through configurable providers. This guide explains how to set up OAuth providers.

## Environment Variables

Add these to your `.env` file:

```bash
# Base URL for your application
BASE_URL=http://localhost:3000

# OAuth redirect URI base (providers will append their ID)
OAUTH_REDIRECT_URI=http://localhost:3000/oauth2/callback

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (get from GitHub Developer Settings)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API (if required)
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Application type: "Web application"
6. **Authorized redirect URIs**: Add `http://localhost:3000/oauth2/callback/google`
   - This must match EXACTLY (including protocol, port, and path)
   - `localhost` works without domain verification for development
7. Copy the Client ID and Client Secret to your `.env` file

**Note on Authorized Domains**: 
- `localhost` and `127.0.0.1` are automatically authorized for development
- You do NOT need to add localhost to "Authorized domains"
- Only production domains need to be verified

## GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: Your app name
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/oauth2/callback/github`
4. Copy the Client ID and Client Secret to your `.env` file

## Testing OAuth Flow

1. Start the Docker container:
   ```bash
   docker-compose up -d
   ```

2. Test MCP endpoint (should return 401 with OAuth config):
   ```bash
   curl -X POST http://localhost:3000/mcp/core \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```

3. Open OAuth authorization URL in browser:
   ```
   http://localhost:3000/oauth2/authorize?response_type=code&client_id=mcp-client&redirect_uri=YOUR_CALLBACK&scope=openid+email+profile&provider=google
   ```

## Custom Providers

To add custom OAuth providers:

1. Create a YAML file in `src/modules/core/auth/providers/custom/`
2. Use the template at `src/modules/core/auth/providers/template.yaml`
3. Set environment variables for credentials
4. Restart the container

## Common Issues with Localhost

### Google and GitHub Block Localhost

Modern OAuth providers often restrict `localhost` URLs. Here are solutions:

**Option 1: Use ngrok (Recommended)**
```bash
# Install ngrok and create tunnel
ngrok http 3000

# Update .env with ngrok URL
BASE_URL=https://your-ngrok-url.ngrok-free.app
OAUTH_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/oauth2/callback
```

**Option 2: Local Domain**
```bash
# Run setup script
sudo ./scripts/setup-local-domain.sh

# Update .env
BASE_URL=http://systemprompt.local:3000
OAUTH_REDIRECT_URI=http://systemprompt.local:3000/oauth2/callback
```

**Option 3: Use IP Address**
```bash
# Find your local IP
hostname -I | awk '{print $1}'

# Update .env (example)
BASE_URL=http://192.168.1.100:3000
OAUTH_REDIRECT_URI=http://192.168.1.100:3000/oauth2/callback
```

## Troubleshooting

### redirect_uri_mismatch Error

This means the redirect URI in your request doesn't match what's registered in the provider's console.

**Solution:**
- Ensure the redirect URI in Google/GitHub matches exactly: `http://localhost:3000/oauth2/callback/{provider}`
- The URI is case-sensitive and must include the protocol and port

### Provider Not Found

If you get "Unknown provider" error:
- Check that environment variables are set in `.env`
- Verify the provider YAML file exists and is valid
- Check Docker logs: `docker logs systemprompt-coding-agent-mcp-server-1`

### Environment Variables Not Loading

- Restart the container after changing `.env`
- Verify with: `docker exec systemprompt-coding-agent-mcp-server-1 env | grep GOOGLE`