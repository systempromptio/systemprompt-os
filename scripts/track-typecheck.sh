#!/bin/bash

# Clear error reports first
rm -f error-reports.json

# Run typecheck and save output
npm run typecheck 2>&1 | tee /tmp/typecheck.log

# Create temporary file to collect file error counts
temp_file=$(mktemp)

# Process each file that has errors by extracting just the file path (before the first parenthesis)
grep '^src/' /tmp/typecheck.log | sed 's/(.*//' | sort -u | while read -r filepath; do
    # Count errors for this specific file
    error_count=$(grep -c "^$filepath(" /tmp/typecheck.log || echo 0)
    
    # Store in temp file for sorting
    echo "$error_count $filepath" >> "$temp_file"
done

# Sort by error count (descending) and take only the top 10
sort -rn "$temp_file" | head -10 | while read -r error_count filepath; do
    # Add report for this file
    npm run cli -- tasks add --type typecheck --payload "{\"path\":\"$filepath\",\"errors\":$error_count,\"type\":\"typecheck\"}" 2>/dev/null
    
    echo "Added typecheck report: $error_count errors in $filepath"
done

# Clean up temp file
rm -f "$temp_file"