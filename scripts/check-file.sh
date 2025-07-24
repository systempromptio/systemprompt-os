#!/bin/bash

# Check a single file with both ESLint and TypeScript

if [ -z "$1" ]; then
  echo "Usage: ./scripts/check-file.sh <file>"
  exit 1
fi

echo "=== ESLint Check ==="
npx eslint "$1"
ESLINT_EXIT=$?

echo -e "\n=== TypeScript Check ==="
npx tsc --noEmit "$1"
TSC_EXIT=$?

if [ $ESLINT_EXIT -ne 0 ] || [ $TSC_EXIT -ne 0 ]; then
  echo -e "\n❌ Checks failed"
  exit 1
else
  echo -e "\n✅ All checks passed"
  exit 0
fi