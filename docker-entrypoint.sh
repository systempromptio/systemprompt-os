#!/bin/sh
set -e

# Initialize state directories
echo "Initializing state directories..."

# If /data exists but we can't write to it, it's likely a fresh Docker volume owned by root
# Since we're running as appuser, we need to use a writable location
if [ -d /data ] && [ ! -w /data ]; then
    echo "⚠️  /data exists but is not writable (likely a fresh Docker volume)"
    echo "    Using local directory instead"
    export STATE_PATH="/app/state"
    export DATABASE_FILE="/app/state/systemprompt.db"
    mkdir -p /app/state/tasks /app/state/sessions /app/state/logs /app/state/reports /app/state/auth/keys
elif [ -d /data/state ] && [ -w /data/state ]; then
    echo "✓ State directory is ready and writable at /data/state"
else
    echo "⚠️  Creating state directory in app directory"
    export STATE_PATH="/app/state"
    export DATABASE_FILE="/app/state/systemprompt.db"
    mkdir -p /app/state/tasks /app/state/sessions /app/state/logs /app/state/reports /app/state/auth/keys
fi

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

# Directory writability is already verified above

# Set default environment variables
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export STATE_PATH=${STATE_PATH:-/data/state}
export PROJECTS_PATH=${PROJECTS_PATH:-/data/projects}
export DATABASE_FILE=${DATABASE_FILE:-/data/state/database.db}

# Initialize database - always start fresh for now to avoid schema conflicts
if [ -w "$(dirname "$DATABASE_FILE")" ]; then
    echo "Setting up database at: $DATABASE_FILE"
    # Create directory if needed
    mkdir -p "$(dirname "$DATABASE_FILE")"
    
    # For now, always start with a fresh database to avoid schema migration issues
    if [ -f "$DATABASE_FILE" ]; then
        echo "Removing existing database to ensure clean start..."
        rm -f "$DATABASE_FILE" "$DATABASE_FILE-shm" "$DATABASE_FILE-wal"
    fi
    
    echo "Database will be initialized on first application start"
else
    echo "Warning: Cannot write to database directory $(dirname "$DATABASE_FILE")"
    echo "Database will be created in local directory on first access"
fi

# JWT keys will be generated automatically by the auth module on first run
# No need for manual generation here

# Check and start Cloudflare tunnel if token is provided
if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "Starting Cloudflare tunnel..."
    
    # Start cloudflared in the background
    cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN" > "$STATE_PATH/logs/cloudflared.log" 2>&1 &
    TUNNEL_PID=$!
    
    # Wait a moment for tunnel to establish
    sleep 5
    
    # Check if tunnel is running
    if kill -0 $TUNNEL_PID 2>/dev/null; then
        echo "✓ Cloudflare tunnel started (PID: $TUNNEL_PID)"
        
        # Try to extract the tunnel URL from the logs
        if [ -f "$STATE_PATH/logs/cloudflared.log" ]; then
            TUNNEL_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' "$STATE_PATH/logs/cloudflared.log" | head -n1)
            if [ -n "$TUNNEL_URL" ]; then
                echo "✓ Tunnel URL: $TUNNEL_URL"
                export CLOUDFLARE_TUNNEL_URL="$TUNNEL_URL"
            else
                echo "⚠️  Tunnel is running but URL not yet available"
            fi
        fi
    else
        echo "✗ Failed to start Cloudflare tunnel"
        echo "Check logs at: $STATE_PATH/logs/cloudflared.log"
    fi
else
    echo "- No Cloudflare tunnel token provided"
fi

# Start local MCP server daemon
echo "Starting local MCP server daemon..."

# Start the daemon using built version
if [ -f "/app/build/server/mcp/local/daemon.js" ]; then
    echo "Starting local MCP daemon..."
    cd /app && node --loader ./loader.mjs build/server/mcp/local/daemon.js 2>&1 > "$STATE_PATH/logs/mcp-local.log" &
    echo $! > "$STATE_PATH/mcp-local.pid"
    echo "✓ Local MCP server daemon started (PID: $(cat $STATE_PATH/mcp-local.pid))"
else
    echo "⚠️  Local MCP daemon script not found"
fi



echo "Starting SystemPrompt OS..."
echo "- Environment: $NODE_ENV"
echo "- Port: $PORT"
echo "- State Path: $STATE_PATH"
echo "- Projects Path: $PROJECTS_PATH"
echo "- Base URL: ${BASE_URL:-http://localhost:$PORT}"

# If using Cloudflare tunnel, update BASE_URL
if [ -n "$CLOUDFLARE_TUNNEL_URL" ]; then
    export BASE_URL="$CLOUDFLARE_TUNNEL_URL"
    echo "- Using Cloudflare URL: $BASE_URL"
fi

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