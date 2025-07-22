#!/bin/bash

# Auto-continue script for claude processes
# NOTE: Sending input to interactive CLIs requires one of these approaches:
# 1. Run this script with sudo (for TIOCSTI ioctl)
# 2. Use tmux/screen to manage the sessions
# 3. Use named pipes (FIFOs) for input

# Target claude processes
declare -A PROCESS_MAP=(
    [93984]="claude on pts/16"
    [71007]="claude on pts/20"
    [73639]="claude on pts/19"
)

LOG_FILE="/var/www/html/systemprompt-os/scripts/auto-continue.log"

# Function to check if process is still running
is_process_running() {
    kill -0 $1 2>/dev/null
}

# Function to get terminal device for a process
get_terminal_for_pid() {
    ps -p $1 -o tty= | sed 's/^/\/dev\//'
}

# Function to send continue to a process
send_continue() {
    echo "[$(date)] Starting continue cycle..." | tee -a "$LOG_FILE"
    
    for pid in "${!PROCESS_MAP[@]}"; do
        desc="${PROCESS_MAP[$pid]}"
        
        if is_process_running "$pid"; then
            echo "[$(date)] Process $pid ($desc) is active" | tee -a "$LOG_FILE"
            
            # Get the terminal device
            tty=$(get_terminal_for_pid $pid)
            
            # Try different methods to send input
            
            # Method 1: Direct write to terminal (appears as output, not input)
            echo "continue" > "$tty" 2>/dev/null
            
            # Method 2: Try Python with TIOCSTI (requires sudo)
            if command -v python3 &> /dev/null && [ -f "/var/www/html/systemprompt-os/scripts/send-input.py" ]; then
                python3 /var/www/html/systemprompt-os/scripts/send-input.py "$tty" "continue" 2>/dev/null
                if [ $? -eq 0 ]; then
                    echo "[$(date)] Sent 'continue' via TIOCSTI to PID $pid ($desc)" | tee -a "$LOG_FILE"
                    continue
                fi
            fi
            
            # Method 3: Try compiled C program (requires sudo)
            if [ -x "/var/www/html/systemprompt-os/scripts/send-keys" ]; then
                /var/www/html/systemprompt-os/scripts/send-keys "$tty" "continue" 2>/dev/null
                if [ $? -eq 0 ]; then
                    echo "[$(date)] Sent 'continue' via send-keys to PID $pid ($desc)" | tee -a "$LOG_FILE"
                    continue
                fi
            fi
            
            echo "[$(date)] Sent 'continue' as output to $tty for PID $pid (may need sudo for input)" | tee -a "$LOG_FILE"
            
        else
            echo "[$(date)] Process $pid ($desc) is no longer running" | tee -a "$LOG_FILE"
        fi
    done
    
    echo "[$(date)] Continue cycle complete" | tee -a "$LOG_FILE"
}

# Main execution
echo "[$(date)] Starting auto-continue for claude processes" | tee -a "$LOG_FILE"
echo "Target PIDs: ${!PROCESS_MAP[@]}" | tee -a "$LOG_FILE"
echo "Will send 'continue' every 6 hours" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE"
echo ""
echo "NOTE: For proper input simulation, run with: sudo $0" | tee -a "$LOG_FILE"
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "WARNING: Not running as root. Input may appear as output instead of being typed." | tee -a "$LOG_FILE"
fi

# Initial status check
echo "[$(date)] Initial process check:" | tee -a "$LOG_FILE"
for pid in "${!PROCESS_MAP[@]}"; do
    if is_process_running "$pid"; then
        tty=$(get_terminal_for_pid $pid)
        echo "  PID $pid (${PROCESS_MAP[$pid]}): RUNNING on $tty" | tee -a "$LOG_FILE"
    else
        echo "  PID $pid (${PROCESS_MAP[$pid]}): NOT RUNNING" | tee -a "$LOG_FILE"
    fi
done

trap 'echo "[$(date)] Stopped by user" | tee -a "$LOG_FILE"; exit 0' SIGINT SIGTERM

# Main loop
while true; do
    send_continue
    echo "[$(date)] Sleeping for 6 hours..." | tee -a "$LOG_FILE"
    sleep 21600  # 6 hours
done