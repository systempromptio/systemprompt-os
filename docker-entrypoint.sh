#!/bin/sh
set -e

# Initialize state directories
echo "🚀 Initializing SystemPrompt OS..."

# Ensure state directories exist and are writable
if [ -d /data ] && [ -w /data ]; then
    echo "✓ Using persistent data directory at /data"
    export STATE_PATH="/data/state"
    export DATABASE_FILE="/data/state/systemprompt.db"
    mkdir -p /data/state/tasks /data/state/sessions /data/state/logs /data/state/reports /data/state/auth/keys /data/config
else
    echo "⚠️  /data is not writable, using local app directory"
    export STATE_PATH="/app/state"
    export DATABASE_FILE="/app/state/systemprompt.db"
    mkdir -p /app/state/tasks /app/state/sessions /app/state/logs /app/state/reports /app/state/auth/keys /app/config
fi

# Set default environment variables
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export STATE_PATH=${STATE_PATH:-/data/state}
export PROJECTS_PATH=${PROJECTS_PATH:-/data/projects}
export CONFIG_PATH=${CONFIG_PATH:-/data/config}
export DATABASE_FILE=${DATABASE_FILE:-/data/state/database.db}

# Database setup - keep existing database if present
if [ -w "$(dirname "$DATABASE_FILE")" ]; then
    echo "✓ Database directory is writable: $(dirname "$DATABASE_FILE")"
    mkdir -p "$(dirname "$DATABASE_FILE")"
    
    if [ -f "$DATABASE_FILE" ]; then
        echo "✓ Using existing database at: $DATABASE_FILE"
    else
        echo "✓ Database will be created at: $DATABASE_FILE"
    fi
else
    echo "⚠️  Cannot write to database directory, using fallback location"
fi

# Start Cloudflare tunnel if configured
if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "🌐 Starting Cloudflare tunnel..."
    
    # Create log directory
    mkdir -p "$STATE_PATH/logs"
    
    # Start cloudflared in the background
    cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN" > "$STATE_PATH/logs/cloudflared.log" 2>&1 &
    TUNNEL_PID=$!
    
    # Wait for tunnel to establish
    sleep 5
    
    if kill -0 $TUNNEL_PID 2>/dev/null; then
        echo "✓ Cloudflare tunnel started (PID: $TUNNEL_PID)"
        echo "✓ Tunnel URL: ${BASE_URL}"
    else
        echo "⚠️  Failed to start Cloudflare tunnel"
    fi
fi

# Configure Git safe directory if workspace is mounted
if [ -d "/workspace/.git" ]; then
    git config --global --add safe.directory /workspace 2>/dev/null || true
fi

# Display startup configuration
echo ""
echo "📊 Configuration:"
echo "  • Environment: $NODE_ENV"
echo "  • Port: $PORT"
echo "  • State Path: $STATE_PATH"
echo "  • Projects Path: $PROJECTS_PATH"
echo "  • Base URL: ${BASE_URL:-http://localhost:$PORT}"
echo ""

# Execute the main command
exec "$@"