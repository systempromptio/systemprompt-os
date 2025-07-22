#!/bin/bash

# Wrapper script to run claude with input control
# Usage: ./claude-wrapper.sh [session-number]

SESSION=${1:-1}
CONTROL_FIFO="/tmp/claude-control-$SESSION"
LOG_FILE="/tmp/claude-$SESSION.log"

# Create control FIFO if it doesn't exist
[ ! -p "$CONTROL_FIFO" ] && mkfifo "$CONTROL_FIFO"

echo "Starting claude wrapper session $SESSION"
echo "Control FIFO: $CONTROL_FIFO"
echo "To send commands: echo 'command' > $CONTROL_FIFO"

# Use socat to create a PTY that we can control
socat -d -d pty,raw,echo=0 "system:'cat $CONTROL_FIFO & claude',pty,raw,echo=0" 2>&1 | tee "$LOG_FILE"