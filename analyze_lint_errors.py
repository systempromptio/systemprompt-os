#!/usr/bin/env python3

import subprocess
import re
from collections import defaultdict

def get_lint_errors():
    try:
        result = subprocess.run(['npm', 'run', 'lint:check'], 
                              capture_output=True, text=True, cwd='/var/www/html/systemprompt-os')
        output = result.stderr if result.stderr else result.stdout
        
        file_errors = defaultdict(int)
        current_file = None
        
        for line in output.split('\n'):
            # Check if this is a file header line (starts with path)
            if line.startswith('/var/www/html/systemprompt-os/src/'):
                current_file = line.replace('/var/www/html/systemprompt-os/src/', '')
            # Check if this is an error line (contains line:column and error)
            elif current_file and 'error' in line and re.match(r'^\s*\d+:\d+', line):
                file_errors[current_file] += 1
        
        # Sort by error count (descending)
        sorted_files = sorted(file_errors.items(), key=lambda x: x[1], reverse=True)
        
        return sorted_files[:60]
    
    except Exception as e:
        print(f"Error: {e}")
        return []

if __name__ == "__main__":
    files = get_lint_errors()
    
    print("Top 60 files with most lint errors:")
    for i, (file, count) in enumerate(files, 1):
        print(f"{i}. {file} ({count} errors)")