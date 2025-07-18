# Quick OAuth Fix for Localhost Restrictions

## The Problem
Google and GitHub now restrict `localhost` redirect URIs for security reasons.

## Immediate Solutions

### 1. Use Your Computer's IP Address (Fastest)

Find your local IP:
```bash
# On Linux/Mac
hostname -I | awk '{print $1}'

# On Windows
ipconfig | findstr IPv4
```

Example result: `192.168.1.100`

Then:
1. Update `.env`:
   ```
   BASE_URL=http://192.168.1.100:3000
   OAUTH_REDIRECT_URI=http://192.168.1.100:3000/oauth2/callback
   ```

2. Restart Docker:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. In Google OAuth Console, add:
   - Redirect URI: `http://192.168.1.100:3000/oauth2/callback/google`

4. In GitHub OAuth Settings, set:
   - Authorization callback URL: `http://192.168.1.100:3000/oauth2/callback/github`

5. Access your app at: `http://192.168.1.100:3000`

### 2. Use a Free Tunnel Service

**With localtunnel (no signup required):**
```bash
# Install
npm install -g localtunnel

# Start tunnel
lt --port 3000

# You'll get a URL like: https://gentle-pig-42.loca.lt
```

**With bore.pub (no signup required):**
```bash
# Install
cargo install bore-cli

# Or download binary from https://github.com/ekzhang/bore/releases

# Start tunnel
bore local 3000 --to bore.pub

# You'll get: https://bore.pub:XXXXX
```

### 3. For Production Apps

Consider using a proper domain or subdomain with SSL certificate.

## Why This Happens

- **Security**: Preventing OAuth phishing attacks
- **Best Practice**: Production apps should use proper domains
- **Development Impact**: Makes local testing harder

## Notes

- IP addresses work but may change on network restart
- Tunnels give you a stable URL but add latency
- Some corporate networks block tunnel services