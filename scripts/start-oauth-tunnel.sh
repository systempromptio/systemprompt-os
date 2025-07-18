#!/bin/bash

echo "Starting OAuth Development Tunnel"
echo "================================"
echo ""
echo "This script helps you test OAuth locally by creating a public URL"
echo ""

# Check if localtunnel is installed
if ! command -v lt &> /dev/null; then
    echo "Installing localtunnel..."
    npm install -g localtunnel
fi

echo "Starting tunnel to localhost:3000..."
echo ""

# Start localtunnel
lt --port 3000 --print-requests &

echo ""
echo "Instructions:"
echo "1. Look for the URL above (like https://xxxx.loca.lt)"
echo "2. Update your .env file:"
echo "   BASE_URL=https://xxxx.loca.lt"
echo "   OAUTH_REDIRECT_URI=https://xxxx.loca.lt/oauth2/callback"
echo ""
echo "3. In Google OAuth Console:"
echo "   - Authorized domains: Add 'loca.lt'"
echo "   - Authorized redirect URIs: Add 'https://xxxx.loca.lt/oauth2/callback/google'"
echo ""
echo "4. In GitHub OAuth App:"
echo "   - Authorization callback URL: 'https://xxxx.loca.lt/oauth2/callback/github'"
echo ""
echo "5. Restart your Docker container"
echo ""
echo "Press Ctrl+C to stop the tunnel"

# Keep script running
wait