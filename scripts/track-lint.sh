#!/bin/bash

# Run lint check and save output
npm run lint:check 2>&1 | tee /tmp/lint.log

# Create temporary file to collect file error counts
temp_file=$(mktemp)

# Extract all filenames that have errors
grep '^/var/www/html/systemprompt-os/src/' /tmp/lint.log | sed 's|^/var/www/html/systemprompt-os/||' | sort -u | while read -r filepath; do
    # Count all error lines that come after this file's header line
    # We need to count lines that have "error" and are associated with this file
    
    # Find the line number where this file appears
    line_num=$(grep -n "^/var/www/html/systemprompt-os/$filepath$" /tmp/lint.log | cut -d: -f1)
    
    if [ -n "$line_num" ]; then
        # Count error lines for this file by looking at the section starting from this line
        # until the next file (or end of file)
        error_count=$(awk -v start="$line_num" -v file="$filepath" '
            NR >= start {
                if (NR > start && /^\/var\/www\/html\/systemprompt-os\/src\//) {
                    # Found next file, stop counting
                    exit
                }
                if (/error/) {
                    count++
                }
            }
            END { print count+0 }
        ' /tmp/lint.log)
        
        # Add to temp file only if it has errors
        if [ "$error_count" -gt 0 ] 2>/dev/null; then
            echo "$error_count $filepath" >> "$temp_file"
        fi
    fi
done

# Sort by error count (descending) and take only the top 10
sort -rn "$temp_file" | head -10 | while read -r error_count filepath; do
    # Add report for this file
    npm run cli -- tasks add --type lint --payload "{\"path\":\"$filepath\",\"errors\":$error_count,\"type\":\"lint\"}" 2>/dev/null
    echo "Added lint report: $error_count errors in $filepath"
done

# Clean up temp file
rm -f "$temp_file"