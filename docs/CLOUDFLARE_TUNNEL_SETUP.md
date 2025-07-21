# Cloudflare Tunnel Setup Guide

This guide helps you configure a Cloudflare tunnel for your systemprompt-os instance.

## Prerequisites

1. A Cloudflare account
2. A domain added to Cloudflare (for public hostname)
3. A tunnel token (already configured in your `.env` file)

## Setting Up Public Hostname

Since your tunnel doesn't have any public hostnames configured, you need to add one:

### Step 1: Access Cloudflare Dashboard

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Zero Trust** → **Access** → **Tunnels**

### Step 2: Find Your Tunnel

Look for the tunnel with ID: `f5677ded-3441-4e2a-9e1d-968e7211e5f2`

### Step 3: Configure Public Hostname

1. Click on the tunnel name to open its configuration
2. Go to the **Public Hostname** tab
3. Click **"Add a public hostname"**
4. Configure the following:
   - **Subdomain**: Choose a name (e.g., `systemprompt`, `oauth`, `myapp`)
   - **Domain**: Select one of your Cloudflare-managed domains
   - **Type**: HTTP
   - **URL**: `localhost:3000`

### Step 4: Save Configuration

Click **Save** to create the public hostname.

Your tunnel URL will be: `https://[subdomain].[domain].com`

### Step 5: Update Environment Configuration

Add the tunnel URL to your `.env` file:

```env
CLOUDFLARE_TUNNEL_URL=https://your-subdomain.your-domain.com
```

### Step 6: Restart the Container

```bash
docker-compose restart
```

## Alternative: Using a Subdomain

If you don't have a domain in Cloudflare, you can:

1. Add a domain to Cloudflare (even a free domain works)
2. Or use Cloudflare's quick tunnels instead (remove the token from `.env` and set `ENABLE_OAUTH_TUNNEL=true`)

## OAuth Configuration

Once your tunnel is configured, the OAuth providers will automatically use the public URL for callbacks:

- Google OAuth callback: `https://your-subdomain.your-domain.com/oauth2/callback`
- GitHub OAuth callback: `https://your-subdomain.your-domain.com/oauth2/callback`

Make sure to update these URLs in your OAuth provider configurations (Google Cloud Console and GitHub OAuth Apps).

## Troubleshooting

### Tunnel Connected but No URL

If you see "Tunnel established" but with a placeholder URL, it means the tunnel is connected but no public hostname is configured. Follow the steps above to add one.

### Multiple Domains

If you have multiple domains in Cloudflare, choose the one you want to use for this application. You can add multiple public hostnames to the same tunnel if needed.

### SSL/TLS

Cloudflare automatically handles SSL/TLS for your tunnel. The connection will be encrypted from the user to Cloudflare and from Cloudflare to your application.