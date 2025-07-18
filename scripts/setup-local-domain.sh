#!/bin/bash

# Setup local domain for OAuth development
# This works around localhost restrictions

echo "Setting up local domain for OAuth development..."

# Check if running as root/sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run with sudo: sudo $0"
    exit 1
fi

# Local domain name
LOCAL_DOMAIN="systemprompt.local"

# Check if already exists
if grep -q "$LOCAL_DOMAIN" /etc/hosts; then
    echo "✓ $LOCAL_DOMAIN already configured in /etc/hosts"
else
    echo "Adding $LOCAL_DOMAIN to /etc/hosts..."
    echo "127.0.0.1 $LOCAL_DOMAIN" >> /etc/hosts
    echo "✓ Added $LOCAL_DOMAIN pointing to 127.0.0.1"
fi

echo ""
echo "Configuration complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file:"
echo "   BASE_URL=http://$LOCAL_DOMAIN:3000"
echo "   OAUTH_REDIRECT_URI=http://$LOCAL_DOMAIN:3000/oauth2/callback"
echo ""
echo "2. Update OAuth providers:"
echo "   Google: Add redirect URI: http://$LOCAL_DOMAIN:3000/oauth2/callback/google"
echo "   GitHub: Set callback URL: http://$LOCAL_DOMAIN:3000/oauth2/callback/github"
echo ""
echo "3. Restart your Docker container"
echo "4. Access your app at: http://$LOCAL_DOMAIN:3000"