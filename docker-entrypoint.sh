#!/bin/sh
set -e

# Ensure state directories exist with correct permissions
echo "Initializing state directories..."
mkdir -p /data/state/tasks /data/state/sessions /data/state/logs /data/state/reports

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