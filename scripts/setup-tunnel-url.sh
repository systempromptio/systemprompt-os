#!/bin/bash

# Script to extract and save Cloudflare tunnel URL
# This runs during Docker container startup

set -e

echo "Setting up Cloudflare tunnel URL..."

# Check if tunnel token is set
if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
  echo "No CLOUDFLARE_TUNNEL_TOKEN found, skipping tunnel URL setup"
  exit 0
fi

# Check if URL is already configured
if [ -n "$CLOUDFLARE_TUNNEL_URL" ]; then
  echo "CLOUDFLARE_TUNNEL_URL already configured: $CLOUDFLARE_TUNNEL_URL"
  exit 0
fi

# Extract tunnel ID from token (base64 decode and parse JSON)
TUNNEL_INFO=$(echo "$CLOUDFLARE_TUNNEL_TOKEN" | base64 -d 2>/dev/null || true)
if [ -z "$TUNNEL_INFO" ]; then
  echo "Failed to decode tunnel token"
  exit 0
fi

# Extract tunnel ID using Node.js (more reliable JSON parsing)
TUNNEL_ID=$(node -e "
try {
  const token = Buffer.from('$CLOUDFLARE_TUNNEL_TOKEN', 'base64').toString();
  const data = JSON.parse(token);
  console.log(data.t || '');
} catch (e) {
  console.log('');
}
" 2>/dev/null || true)

if [ -z "$TUNNEL_ID" ]; then
  echo "Could not extract tunnel ID from token"
  exit 0
fi

echo "Found tunnel ID: $TUNNEL_ID"

# Try to get tunnel config using cloudflared
echo "Attempting to retrieve tunnel configuration..."

# Create a temporary config file for cloudflared
TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << EOF
tunnel: $TUNNEL_ID
credentials-file: /dev/null
EOF

# Run cloudflared to test the tunnel and capture output
TUNNEL_OUTPUT=$(timeout 10s cloudflared tunnel --config "$TEMP_CONFIG" run --token "$CLOUDFLARE_TUNNEL_TOKEN" 2>&1 || true)

# Clean up temp file
rm -f "$TEMP_CONFIG"

# Try to extract hostname from output
HOSTNAME=$(echo "$TUNNEL_OUTPUT" | grep -oP 'https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' | head -n1 || true)

if [ -z "$HOSTNAME" ]; then
  echo "Could not determine tunnel URL automatically"
  echo "The tunnel is configured but the URL needs to be set manually"
  echo "Please check your Cloudflare dashboard for tunnel ID: $TUNNEL_ID"
  echo "Then set CLOUDFLARE_TUNNEL_URL in your .env file"
  
  # Set a marker URL so we know the tunnel is connected but URL is unknown
  export CLOUDFLARE_TUNNEL_URL="https://tunnel-$TUNNEL_ID.unknown"
else
  echo "Found tunnel URL: $HOSTNAME"
  export CLOUDFLARE_TUNNEL_URL="$HOSTNAME"
  
  # Optionally save to a file that can be sourced later
  echo "export CLOUDFLARE_TUNNEL_URL=\"$HOSTNAME\"" > /app/.tunnel-url
fi