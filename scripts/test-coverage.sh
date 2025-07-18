#!/bin/bash

# Generate timestamp
TIMESTAMP=$(date +"%Y-%m-%dT%H-%M-%S")
OUTPUT_DIR="./state/temp"
COVERAGE_DIR="$OUTPUT_DIR/coverage"
JSON_FILE="$OUTPUT_DIR/unit-test-$TIMESTAMP.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "🧪 Running unit tests with coverage..."
echo "📁 Coverage directory: $COVERAGE_DIR"
echo "📄 JSON report: $JSON_FILE"

# Run tests with coverage and capture output
OUTPUT=$(npm test -- --coverage tests/unit --reporter=json 2>&1)
EXIT_CODE=$?

# Extract test summary from output
TOTAL_TESTS=$(echo "$OUTPUT" | grep -oP 'Tests\s+\K\d+(?=\s+passed)' | head -1 || echo "0")
PASSED_TESTS=$(echo "$OUTPUT" | grep -oP '\K\d+(?=\s+passed)' | head -1 || echo "0")
FAILED_TESTS=$(echo "$OUTPUT" | grep -oP '\K\d+(?=\s+failed)' | head -1 || echo "0")
DURATION=$(echo "$OUTPUT" | grep -oP 'Duration\s+\K[0-9.]+(?=s)' | head -1 || echo "0")

# Read coverage summary if it exists
COVERAGE_SUMMARY="{}"
if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
    COVERAGE_SUMMARY=$(cat "$COVERAGE_DIR/coverage-summary.json")
fi

# Create JSON report
cat > "$JSON_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "exitCode": $EXIT_CODE,
  "summary": {
    "totalTests": $TOTAL_TESTS,
    "passedTests": $PASSED_TESTS,
    "failedTests": $FAILED_TESTS,
    "duration": $DURATION
  },
  "coverage": $COVERAGE_SUMMARY,
  "output": $(echo "$OUTPUT" | jq -Rs .)
}
EOF

echo ""
echo "✅ Test coverage report generated!"
echo "📊 Coverage HTML: $COVERAGE_DIR/index.html"
echo "📄 JSON report: $JSON_FILE"
echo ""
echo "📈 Summary:"
echo "   Tests: $PASSED_TESTS passed, $FAILED_TESTS failed, $TOTAL_TESTS total"
echo "   Duration: ${DURATION}s"

exit $EXIT_CODE