#!/bin/bash

# Auto-continue script using GNU screen
# This script manages claude sessions in screen and sends 'continue' every 6 hours

LOG_FILE="/var/www/html/systemprompt-os/scripts/auto-continue-screen.log"

# Function to create screen sessions for existing terminals
setup_screen_sessions() {
    echo "[$(date)] Setting up screen sessions..." | tee -a "$LOG_FILE"
    
    # Create screen sessions for each claude process
    screen -dmS claude1 bash -c 'echo "Run your first claude command here"; exec bash'
    screen -dmS claude2 bash -c 'echo "Run your second claude command here"; exec bash'
    screen -dmS claude3 bash -c 'echo "Run your third claude command here"; exec bash'
    
    echo "[$(date)] Screen sessions created. Start claude in each session manually." | tee -a "$LOG_FILE"
    echo "Use: screen -r claude1 (or claude2, claude3) to attach" | tee -a "$LOG_FILE"
}

# Function to send continue to all screen sessions
send_continue_to_screens() {
    echo "[$(date)] Sending 'continue' to all claude screen sessions..." | tee -a "$LOG_FILE"
    
    # List of screen session names
    sessions=("claude1" "claude2" "claude3")
    
    for session in "${sessions[@]}"; do
        # Check if session exists
        if screen -list | grep -q "$session"; then
            # Send the command to the screen session
            screen -S "$session" -X stuff "continue^M"
            echo "[$(date)] Sent 'continue' to $session" | tee -a "$LOG_FILE"
        else
            echo "[$(date)] Screen session $session not found" | tee -a "$LOG_FILE"
        fi
    done
}

# Function to list current screen sessions
list_sessions() {
    echo "[$(date)] Current screen sessions:" | tee -a "$LOG_FILE"
    screen -list | tee -a "$LOG_FILE"
}

# Main execution
case "${1:-run}" in
    setup)
        setup_screen_sessions
        ;;
    test)
        send_continue_to_screens
        ;;
    list)
        list_sessions
        ;;
    run)
        echo "[$(date)] Starting auto-continue with screen sessions" | tee -a "$LOG_FILE"
        echo "Make sure claude is running in screen sessions: claude1, claude2, claude3" | tee -a "$LOG_FILE"
        
        trap 'echo "[$(date)] Stopped by user" | tee -a "$LOG_FILE"; exit 0' SIGINT SIGTERM
        
        while true; do
            send_continue_to_screens
            echo "[$(date)] Sleeping for 6 hours..." | tee -a "$LOG_FILE"
            sleep 21600  # 6 hours
        done
        ;;
    *)
        echo "Usage: $0 [setup|test|list|run]"
        echo "  setup - Create screen sessions"
        echo "  test  - Test sending continue"
        echo "  list  - List current sessions"
        echo "  run   - Run the auto-continue loop (default)"
        ;;
esac