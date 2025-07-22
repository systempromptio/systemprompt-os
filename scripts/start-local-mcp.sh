#!/bin/bash
# Start local MCP daemon

echo "Starting Local MCP Server daemon..."

# Use directories writable by the app user
LOG_DIR="/app/logs"
PID_DIR="/app/state"

# Ensure directories exist
mkdir -p "$LOG_DIR" "$PID_DIR"

# Start the daemon in the background
node /app/build/server/mcp/local/daemon.js > "$LOG_DIR/mcp-local.log" 2>&1 &

# Save the PID
echo $! > "$PID_DIR/mcp-local.pid"

echo "Local MCP Server daemon started with PID $(cat $PID_DIR/mcp-local.pid)"