#!/bin/bash

# Auto-continue using named pipes (FIFOs)
# Run claude with input from a FIFO, then we can write to the FIFO

FIFO_DIR="/tmp/claude-fifos"
LOG_FILE="/var/www/html/systemprompt-os/scripts/auto-continue-fifo.log"

# Create FIFOs
setup_fifos() {
    mkdir -p "$FIFO_DIR"
    
    for i in 1 2 3; do
        fifo="$FIFO_DIR/claude$i"
        if [ ! -p "$fifo" ]; then
            mkfifo "$fifo"
            echo "[$(date)] Created FIFO: $fifo" | tee -a "$LOG_FILE"
        fi
    done
    
    echo ""
    echo "To use this method:"
    echo "1. In each terminal, run: tail -f $FIFO_DIR/claudeN | claude"
    echo "   (where N is 1, 2, or 3)"
    echo "2. Then run this script with 'run' to send continue every 6 hours"
}

# Send continue to all FIFOs
send_continue() {
    echo "[$(date)] Sending 'continue' to all FIFOs..." | tee -a "$LOG_FILE"
    
    for i in 1 2 3; do
        fifo="$FIFO_DIR/claude$i"
        if [ -p "$fifo" ]; then
            echo "continue" > "$fifo"
            echo "[$(date)] Sent 'continue' to $fifo" | tee -a "$LOG_FILE"
        else
            echo "[$(date)] FIFO $fifo not found" | tee -a "$LOG_FILE"
        fi
    done
}

case "${1:-help}" in
    setup)
        setup_fifos
        ;;
    test)
        send_continue
        ;;
    run)
        echo "[$(date)] Starting auto-continue with FIFOs" | tee -a "$LOG_FILE"
        
        trap 'echo "[$(date)] Stopped by user" | tee -a "$LOG_FILE"; exit 0' SIGINT SIGTERM
        
        while true; do
            send_continue
            echo "[$(date)] Sleeping for 6 hours..." | tee -a "$LOG_FILE"
            sleep 21600
        done
        ;;
    *)
        echo "Usage: $0 [setup|test|run]"
        echo "  setup - Create named pipes"
        echo "  test  - Test sending continue"
        echo "  run   - Run the auto-continue loop"
        ;;
esac