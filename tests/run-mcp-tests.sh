#!/bin/bash

# Run MCP permission tests with coverage

echo "🧪 Running MCP Permission Tests..."
echo "================================"

# Run unit tests
echo ""
echo "📋 Unit Tests:"
npx vitest run --config ./tests/vitest.config.mcp.ts --reporter=verbose tests/unit/server/mcp/core

# Run e2e tests
echo ""
echo "🌐 E2E Tests:"
npx vitest run --config ./tests/vitest.config.mcp.ts --reporter=verbose tests/e2e/mcp-tool-permissions.spec.ts

# Generate coverage report
echo ""
echo "📊 Coverage Report:"
npx vitest run --config ./tests/vitest.config.mcp.ts --coverage

echo ""
echo "✅ MCP Permission Tests Complete!"
echo ""
echo "View detailed coverage report at: coverage/index.html"