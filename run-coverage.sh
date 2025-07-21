#!/bin/bash

# Create coverage directory
mkdir -p coverage

# Run vitest with coverage enabled
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run tests/unit \
  --coverage.enabled=true \
  --coverage.provider=v8 \
  --coverage.reporter=text \
  --coverage.reporter=json-summary \
  --coverage.reporter=html \
  --coverage.include="src/**/*.ts" \
  --coverage.exclude="node_modules/**" \
  --coverage.exclude="tests/**" \
  --coverage.exclude="**/*.d.ts" \
  --coverage.exclude="**/*.spec.ts" \
  --coverage.exclude="**/*.test.ts" \
  --coverage.reportsDirectory="./coverage" \
  --coverage.all=true \
  2>&1

# Check if coverage summary was generated
if [ -f "coverage/coverage-summary.json" ]; then
  echo -e "\n\n📊 COVERAGE SUMMARY:"
  cat coverage/coverage-summary.json | jq -r '.total | "\nStatement Coverage: \(.statements.pct)%\nBranch Coverage: \(.branches.pct)%\nFunction Coverage: \(.functions.pct)%\nLine Coverage: \(.lines.pct)%"'
else
  echo "Coverage report generation failed"
fi