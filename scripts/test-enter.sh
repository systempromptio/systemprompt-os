#!/bin/bash

# Test different ways to send Enter to a terminal

TTY=$1
TEXT=$2

echo "Testing different Enter key methods on $TTY with text: $TEXT"

# Method 1: Just CR
echo -ne "${TEXT}\r" > $TTY
sleep 1

# Method 2: Just LF  
echo -ne "${TEXT}\n" > $TTY
sleep 1

# Method 3: CR+LF
echo -ne "${TEXT}\r\n" > $TTY
sleep 1

# Method 4: Using printf
printf "%s\r" "$TEXT" > $TTY
sleep 1

# Method 5: Terminal escape sequence for Enter
echo -ne "${TEXT}\033[13~" > $TTY