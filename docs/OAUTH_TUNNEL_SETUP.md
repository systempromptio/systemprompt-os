# OAuth Development with Tunneling Services

## Quick Setup with ngrok

1. Install ngrok:
   ```bash
   # macOS
   brew install ngrok/ngrok/ngrok
   
   # Linux
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install ngrok
   ```

2. Start your app and create tunnel:
   ```bash
   # Start your Docker container
   docker-compose up -d
   
   # Create tunnel to port 3000
   ngrok http 3000
   ```

3. You'll get a URL like: `https://abc123.ngrok-free.app`

4. Update your `.env`:
   ```bash
   BASE_URL=https://abc123.ngrok-free.app
   OAUTH_REDIRECT_URI=https://abc123.ngrok-free.app/oauth2/callback
   ```

5. Add to Google OAuth:
   - Authorized domains: `ngrok-free.app` (might need verification)
   - Redirect URI: `https://abc123.ngrok-free.app/oauth2/callback/google`

6. Add to GitHub OAuth:
   - Authorization callback URL: `https://abc123.ngrok-free.app/oauth2/callback/github`

## Alternative: Cloudflare Tunnel

1. Install cloudflared:
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared
   
   # Linux
   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. Create tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. Use the provided URL in your OAuth configuration

## Important Notes

- These URLs change each time you restart the tunnel
- Free ngrok has limitations (requests per minute)
- Consider paid ngrok for stable subdomain
- Update both `.env` and OAuth provider settings when URL changes