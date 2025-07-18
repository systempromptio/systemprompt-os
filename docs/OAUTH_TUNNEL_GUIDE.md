# OAuth with Automatic Tunnel Support

SystemPrompt OS now includes automatic tunnel support for OAuth development, solving the localhost restriction issues with Google and GitHub OAuth.

## How It Works

1. **Automatic Detection**: The auth module detects when OAuth providers are configured
2. **Tunnel Creation**: Automatically creates a public URL using Cloudflare Tunnel
3. **Dynamic Configuration**: Updates OAuth redirect URIs to use the tunnel URL
4. **Seamless Integration**: No manual configuration needed for development

## Quick Start

### 1. Enable OAuth Tunnel

In your `.env` file:
```bash
# Enable automatic tunnel for OAuth
ENABLE_OAUTH_TUNNEL=true

# Add your OAuth credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id  
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 2. Start the Application

```bash
docker-compose up -d
```

The auth module will:
- Detect OAuth providers are configured
- Start a Cloudflare tunnel automatically
- Update redirect URIs to use the tunnel URL
- Log the public URL for OAuth configuration

### 3. Check Tunnel Status

```bash
docker exec systemprompt-coding-agent-mcp-server-1 systemprompt auth tunnel:status
```

This shows:
- Current tunnel status
- Public URL for OAuth
- URLs to add to your OAuth providers

### 4. Configure OAuth Providers

Using the URLs from the tunnel status, update:

**Google OAuth Console:**
- Authorized domains: Add the tunnel domain (e.g., `xxx.trycloudflare.com`)
- Authorized redirect URIs: Add `https://xxx.trycloudflare.com/oauth2/callback/google`

**GitHub OAuth App:**
- Authorization callback URL: `https://xxx.trycloudflare.com/oauth2/callback/github`

## Using a Permanent Domain

For production or stable development, use a permanent domain:

### Option 1: Cloudflare Tunnel (Recommended)

1. Create a Cloudflare tunnel:
   ```bash
   cloudflared tunnel create systemprompt-oauth
   cloudflared tunnel route dns systemprompt-oauth oauth.yourdomain.com
   ```

2. Get your tunnel token:
   ```bash
   cloudflared tunnel info systemprompt-oauth
   ```

3. Update `.env`:
   ```bash
   OAUTH_DOMAIN=https://oauth.yourdomain.com
   CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
   ```

### Option 2: Direct Domain

If you have a server with a domain:

```bash
# In .env
OAUTH_DOMAIN=https://oauth.yourdomain.com
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_OAUTH_TUNNEL` | Enable automatic tunnel in development | `false` |
| `OAUTH_DOMAIN` | Use a permanent domain instead of tunnel | - |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token for persistent Cloudflare tunnel | - |
| `BASE_URL` | Override base URL (set automatically by tunnel) | `http://localhost:3000` |

## Troubleshooting

### Tunnel Not Starting

1. Check if cloudflared is installed:
   ```bash
   docker exec systemprompt-coding-agent-mcp-server-1 cloudflared --version
   ```

2. Check logs:
   ```bash
   docker logs systemprompt-coding-agent-mcp-server-1 | grep -i tunnel
   ```

### OAuth Still Using Localhost

The tunnel updates environment variables at runtime. If providers were already initialized:

1. Restart the container after tunnel starts
2. Or wait for provider reload

### Domain Authorization Issues

- Cloudflare tunnel domains change each time
- For stable development, use a permanent domain
- Some tunnel domains may need verification in Google Console

## Architecture

The tunnel service:
- Runs as part of the auth module
- Starts before provider initialization  
- Updates BASE_URL and OAUTH_REDIRECT_URI dynamically
- Supports both temporary and permanent tunnels
- Falls back to localhost if tunnel fails

## Security Notes

- Tunnels expose your local service publicly
- Use only for development and testing
- For production, use proper domains with SSL
- Tunnel URLs are random but public
- Anyone with the URL can access your service