#!/bin/sh
set -e

# Ensure state directories exist with correct permissions
echo "Initializing state directories..."
mkdir -p /data/state/tasks /data/state/sessions /data/state/logs /data/state/reports /data/state/auth/keys

# Handle custom code directories
echo "Setting up custom code directories..."

# Check if custom modules are mounted as volumes
if [ -d "/app/custom-modules" ] && [ "$(ls -A /app/custom-modules 2>/dev/null)" ]; then
    echo "✓ Custom modules volume detected"
    # If not already linked, create symlink
    if [ ! -L "/app/modules/custom" ] || [ ! -e "/app/modules/custom" ]; then
        rm -rf /app/modules/custom
        ln -sfn /app/custom-modules /app/modules/custom
        echo "  → Linked /app/modules/custom to volume"
    fi
else
    echo "- No custom modules volume mounted"
fi

# Check if custom MCP servers are mounted as volumes
if [ -d "/app/custom-mcp" ] && [ "$(ls -A /app/custom-mcp 2>/dev/null)" ]; then
    echo "✓ Custom MCP servers volume detected"
    # If not already linked, create symlink
    if [ ! -L "/app/server/mcp/custom" ] || [ ! -e "/app/server/mcp/custom" ]; then
        rm -rf /app/server/mcp/custom
        ln -sfn /app/custom-mcp /app/server/mcp/custom
        echo "  → Linked /app/server/mcp/custom to volume"
    fi
else
    echo "- No custom MCP servers volume mounted"
fi

# Alternative: Check for bind mounts directly to target paths
if mountpoint -q /app/modules/custom 2>/dev/null; then
    echo "✓ Custom modules bind mount detected"
fi

if mountpoint -q /app/server/mcp/custom 2>/dev/null; then
    echo "✓ Custom MCP servers bind mount detected"
fi

# Check if we can write to the directories
if ! touch /data/state/.write-test 2>/dev/null; then
    echo "Warning: Cannot write to /data/state. Falling back to local directory."
    export STATE_PATH="./coding-agent-state"
    mkdir -p ./coding-agent-state/tasks ./coding-agent-state/sessions ./coding-agent-state/logs ./coding-agent-state/reports
else
    rm -f /data/state/.write-test
    echo "✓ State directory is writable: /data/state"
fi

# Set default environment variables
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export STATE_PATH=${STATE_PATH:-/data/state}
export PROJECTS_PATH=${PROJECTS_PATH:-/data/projects}
export DATABASE_FILE=${DATABASE_FILE:-/data/state/database.db}

# Initialize database if not already initialized
if [ ! -f "$DATABASE_FILE" ] || ! /usr/local/bin/systemprompt database:status >/dev/null 2>&1; then
    echo "Initializing database..."
    /usr/local/bin/systemprompt database:schema --action=init
    echo "✓ Database initialized"
fi

# Initialize JWT keys if not already present
JWT_KEY_PATH="$STATE_PATH/auth/keys"

# Ensure key directory exists with secure permissions
mkdir -p "$JWT_KEY_PATH"
chmod 700 "$JWT_KEY_PATH"

if [ ! -f "$JWT_KEY_PATH/private.key" ] || [ ! -f "$JWT_KEY_PATH/public.key" ]; then
    echo "Generating secure RSA-2048 JWT signing keys..."
    
    # Create temporary directory with restricted permissions in memory
    TEMP_KEY_DIR=$(mktemp -d -p /dev/shm 2>/dev/null || mktemp -d)
    chmod 700 "$TEMP_KEY_DIR"
    
    # Generate RSA-2048 keys using the CLI tool
    if /usr/local/bin/systemprompt auth:generatekey --type jwt --algorithm RS256 --format pem --output "$TEMP_KEY_DIR"; then
        # Use atomic move operations to prevent partial writes
        mv -f "$TEMP_KEY_DIR/private.key" "$JWT_KEY_PATH/private.key"
        mv -f "$TEMP_KEY_DIR/public.key" "$JWT_KEY_PATH/public.key"
        
        # Set secure permissions (only readable by owner)
        chmod 400 "$JWT_KEY_PATH/private.key"
        chmod 444 "$JWT_KEY_PATH/public.key"
        
        echo "✓ RSA-2048 JWT keys generated and secured at: $JWT_KEY_PATH"
    else
        echo "✗ Failed to generate JWT keys"
        exit 1
    fi
    
    # Clean up temp directory
    rm -rf "$TEMP_KEY_DIR"
fi

# In production, RSA keys are required and generated above
# No HMAC fallback needed

# Verify key permissions and ownership on every startup
if [ -f "$JWT_KEY_PATH/private.key" ]; then
    chmod 400 "$JWT_KEY_PATH/private.key"
    echo "✓ Private key permissions verified"
fi
if [ -f "$JWT_KEY_PATH/public.key" ]; then
    chmod 444 "$JWT_KEY_PATH/public.key"
    echo "✓ Public key permissions verified"
fi

# Verify keys are readable by checking they exist
if [ -f "$JWT_KEY_PATH/private.key" ] && [ -f "$JWT_KEY_PATH/public.key" ]; then
    echo "✓ JWT RSA keys verified and ready"
else
    echo "✗ JWT keys missing - authentication will not work"
    exit 1
fi

# Check and start Cloudflare tunnel if token is provided
if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "Starting Cloudflare tunnel..."
    
    # Start cloudflared in the background
    cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN" > /data/state/logs/cloudflared.log 2>&1 &
    TUNNEL_PID=$!
    
    # Wait a moment for tunnel to establish
    sleep 5
    
    # Check if tunnel is running
    if kill -0 $TUNNEL_PID 2>/dev/null; then
        echo "✓ Cloudflare tunnel started (PID: $TUNNEL_PID)"
        
        # Try to extract the tunnel URL from the logs
        if [ -f "/data/state/logs/cloudflared.log" ]; then
            TUNNEL_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' /data/state/logs/cloudflared.log | head -n1)
            if [ -n "$TUNNEL_URL" ]; then
                echo "✓ Tunnel URL: $TUNNEL_URL"
                export CLOUDFLARE_TUNNEL_URL="$TUNNEL_URL"
            else
                echo "⚠️  Tunnel is running but URL not yet available"
            fi
        fi
    else
        echo "✗ Failed to start Cloudflare tunnel"
        echo "Check logs at: /data/state/logs/cloudflared.log"
    fi
else
    echo "- No Cloudflare tunnel token provided"
fi



echo "Starting SystemPrompt OS MCP Server..."
echo "- Environment: $NODE_ENV"
echo "- Port: $PORT"
echo "- State Path: $STATE_PATH"
echo "- Projects Path: $PROJECTS_PATH"

# Configure Git to trust the workspace directory
if [ -d "/workspace/.git" ]; then
    echo "Configuring Git safe directory..."
    # Use system config if we can't write to user config
    git config --system --add safe.directory /workspace 2>/dev/null || \
    git config --global --add safe.directory /workspace 2>/dev/null || \
    echo "Warning: Could not configure Git safe directory"
fi

# Execute the main command
exec "$@"