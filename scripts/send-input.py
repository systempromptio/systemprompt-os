#!/usr/bin/env python3
import sys
import fcntl
import termios

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} /dev/pts/X 'text to send'")
    sys.exit(1)

tty_path = sys.argv[1]
text = sys.argv[2] + '\n'

try:
    with open(tty_path, 'w') as tty:
        for char in text:
            fcntl.ioctl(tty, termios.TIOCSTI, char.encode())
    print(f"Successfully sent '{text.strip()}' to {tty_path}")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)