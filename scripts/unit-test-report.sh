#!/bin/bash

# Unit Test Report Script
# Generates a report of failing unit tests with file paths and error counts

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUTPUT_DIR="${SCRIPT_DIR}/output"
OUTPUT_FILE="${OUTPUT_DIR}/unit-test-report.txt"

# Create output directory if it doesn't exist
mkdir -p "${OUTPUT_DIR}"

# Function to output to both console and file
output() {
    echo "$@" | tee -a "${OUTPUT_FILE}"
}

# Clear previous report
> "${OUTPUT_FILE}"

output "========================================="
output "Unit Test Failure Report"
output "Generated: $(date)"
output "========================================="
output ""

# Run unit tests and capture output
output "Running unit tests..."
npm run test:unit -- --reporter=json --outputFile=test-results.json 2>/dev/null || true

# Check if test results file exists
if [ ! -f "test-results.json" ]; then
    output "Error: Could not generate test results"
    exit 1
fi

# Parse results using Node.js and write to file
node -e '
const fs = require("fs");
const outputFile = process.argv[1];
const results = JSON.parse(fs.readFileSync("test-results.json", "utf8"));

function output(text) {
    console.log(text);
    fs.appendFileSync(outputFile, text + "\n");
}

if (!results.testResults) {
    output("No test results found");
    process.exit(0);
}

const failingFiles = results.testResults
    .filter(file => file.status === "failed")
    .map(file => ({
        path: file.name,
        errors: file.assertionResults.filter(test => test.status === "failed").length,
        total: file.assertionResults.length
    }))
    .sort((a, b) => b.errors - a.errors);

if (failingFiles.length === 0) {
    output("✅ All unit tests are passing!");
    process.exit(0);
}

output(`Found ${failingFiles.length} files with failing tests:\n`);
output("File Path                                                    | Failures | Total Tests");
output("-----------------------------------------------------------|----------|------------");

failingFiles.forEach(file => {
    const filePath = file.path.padEnd(60, " ");
    const errors = file.errors.toString().padStart(8, " ");
    const total = file.total.toString().padStart(11, " ");
    output(`${filePath} | ${errors} | ${total}`);
});

output(`\nTotal failing files: ${failingFiles.length}`);
output(`Total failures: ${failingFiles.reduce((sum, f) => sum + f.errors, 0)}`);

// Also write a JSON summary for easier parsing
const summary = {
    timestamp: new Date().toISOString(),
    totalFailingFiles: failingFiles.length,
    totalFailures: failingFiles.reduce((sum, f) => sum + f.errors, 0),
    failingFiles: failingFiles
};
fs.writeFileSync(outputFile.replace(".txt", ".json"), JSON.stringify(summary, null, 2));
' "${OUTPUT_FILE}"

# Clean up
rm -f test-results.json

output ""
output "========================================="
output "Report complete"
output "========================================="
output ""
output "Report saved to: ${OUTPUT_FILE}"
output "JSON summary saved to: ${OUTPUT_FILE%.txt}.json"