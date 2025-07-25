#!/usr/bin/env python3

import subprocess
import re
from collections import defaultdict

def get_typescript_errors():
    try:
        result = subprocess.run(['npm', 'run', 'typecheck'], 
                              capture_output=True, text=True, cwd='/var/www/html/systemprompt-os')
        output = result.stderr
        
        errors = []
        
        for line in output.split('\n'):
            # Match TypeScript error format: src/file.ts(line,col): error TSxxxx: message
            if 'error TS' in line and line.startswith('src/'):
                match = re.match(r'^(src/[^(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$', line)
                if match:
                    file_path, line_num, col_num, error_code, message = match.groups()
                    errors.append({
                        'file': file_path,
                        'line': int(line_num),
                        'column': int(col_num),
                        'code': error_code,
                        'message': message
                    })
        
        return errors
    
    except Exception as e:
        print(f"Error: {e}")
        return []

def categorize_errors(errors):
    categories = defaultdict(list)
    
    for error in errors:
        code = error['code']
        if code in ['TS6133']:
            categories['Unused Variables'].append(error)
        elif code in ['TS18047', 'TS18046']:
            categories['Null/Undefined Issues'].append(error)
        elif code in ['TS2416', 'TS2322', 'TS2375', 'TS2412']:
            categories['Type Assignment Issues'].append(error)
        elif code in ['TS2724', 'TS2552']:
            categories['Import/Export Issues'].append(error)
        elif code in ['TS2345', 'TS2769']:
            categories['Function Argument Issues'].append(error)
        elif code in ['TS2561']:
            categories['Object Property Issues'].append(error)
        else:
            categories['Other'].append(error)
    
    return categories

if __name__ == "__main__":
    errors = get_typescript_errors()
    categories = categorize_errors(errors)
    
    print(f"Total TypeScript errors: {len(errors)}")
    print("\n=== TYPESCRIPT ERROR CATEGORIES ===")
    
    for category, error_list in categories.items():
        print(f"\n{category} ({len(error_list)} errors):")
        for error in error_list[:10]:  # Show first 10 of each category
            print(f"  - {error['file']}:{error['line']} - {error['message'][:80]}...")
            
    print("\n=== FILES WITH MOST TYPESCRIPT ERRORS ===")
    file_counts = defaultdict(int)
    for error in errors:
        file_counts[error['file']] += 1
    
    sorted_files = sorted(file_counts.items(), key=lambda x: x[1], reverse=True)
    for i, (file, count) in enumerate(sorted_files[:20], 1):
        print(f"{i}. {file} ({count} errors)")