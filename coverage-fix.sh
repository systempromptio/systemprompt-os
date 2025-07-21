#!/bin/bash

# Create coverage directory
mkdir -p coverage/.tmp

# Run vitest in background
echo "Running tests with coverage..."
npx vitest run tests/unit --coverage &
VITEST_PID=$!

# Wait a bit for coverage files to be created
sleep 3

# Copy coverage files before they're deleted
echo "Capturing coverage files..."
cp -r coverage/.tmp coverage-backup 2>/dev/null || true

# Wait for vitest to complete
wait $VITEST_PID

# Check if we have backup files
if [ -d "coverage-backup" ] && [ "$(ls -A coverage-backup)" ]; then
    echo "Restoring coverage files..."
    mkdir -p coverage/.tmp
    cp -r coverage-backup/* coverage/.tmp/
    
    # Generate coverage report from the files
    echo "Generating coverage report..."
    npx c8 report --reporter=text --reporter=text-summary --temp-directory=coverage/.tmp
    
    # Clean up
    rm -rf coverage-backup
else
    echo "No coverage files were captured. Vitest coverage may have failed."
fi