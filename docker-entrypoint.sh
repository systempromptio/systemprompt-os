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


# Unset ANTHROPIC_API_KEY to use authenticated session
unset ANTHROPIC_API_KEY
echo "- Using Claude authenticated session (ANTHROPIC_API_KEY unset)"

echo "Starting Coding Agent MCP Server..."
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