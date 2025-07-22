#!/usr/bin/env python3
import sys
import os
import fcntl
import termios
import time

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} <pid> 'command'")
    sys.exit(1)

pid = sys.argv[1]
command = sys.argv[2]

# Find the terminal for this process
tty = os.popen(f"ps -p {pid} -o tty=").read().strip()
if not tty or tty == '?':
    print(f"No terminal found for PID {pid}")
    sys.exit(1)

tty_path = f"/dev/{tty}"

try:
    # Open the terminal
    fd = os.open(tty_path, os.O_RDWR)
    
    # Send each character
    for char in command:
        fcntl.ioctl(fd, termios.TIOCSTI, char.encode())
        time.sleep(0.001)  # Small delay between chars
    
    # Try different Enter key combinations
    # First try just CR
    fcntl.ioctl(fd, termios.TIOCSTI, b'\r')
    
    os.close(fd)
    print(f"Sent '{command}' to {tty_path}")
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)