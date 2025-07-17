#!/bin/bash
# Verify no JavaScript artifacts in source directories

echo "🔍 Checking for JavaScript artifacts in source directories..."

JS_FILES=$(find src tools modules -name "*.js" -o -name "*.js.map" -o -name "*.d.ts" -o -name "*.d.ts.map" 2>/dev/null | wc -l)

if [ "$JS_FILES" -gt 0 ]; then
    echo "❌ Found $JS_FILES JavaScript artifacts in source directories!"
    echo "These files should not exist:"
    find src tools modules -name "*.js" -o -name "*.js.map" -o -name "*.d.ts" -o -name "*.d.ts.map" 2>/dev/null | head -20
    echo ""
    echo "Run 'npm run clean:artifacts' to remove them."
    exit 1
else
    echo "✅ No JavaScript artifacts found in source directories"
fi

# Check if dist directory exists and has content
if [ -d "dist" ]; then
    DIST_FILES=$(find dist -name "*.js" 2>/dev/null | wc -l)
    echo "📦 Found $DIST_FILES JavaScript files in dist/ (this is correct)"
else
    echo "📦 No dist/ directory found (run 'npm run build' to create it)"
fi