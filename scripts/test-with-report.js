#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputDir = path.join(__dirname, '..', 'state', 'temp');
const jsonFile = path.join(outputDir, `unit-test-${timestamp}.json`);

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

console.log('🧪 Running unit tests with coverage...');
console.log(`📄 Report will be saved to: ${jsonFile}`);

let output = '';
let exitCode = 0;
let startTime = Date.now();

try {
  // Run tests with coverage
  output = execSync('npm run test:coverage -- tests/unit', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
} catch (error) {
  output = error.stdout || '';
  exitCode = error.status || 1;
}

const duration = (Date.now() - startTime) / 1000;

// Parse test results from output
const testMatch = output.match(/Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/);
const fileMatch = output.match(/Test Files\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/);

const passedTests = testMatch ? parseInt(testMatch[1]) : 0;
const failedTests = testMatch && testMatch[2] ? parseInt(testMatch[2]) : 0;
const totalTests = testMatch ? parseInt(testMatch[3]) : 0;

const passedFiles = fileMatch ? parseInt(fileMatch[1]) : 0;
const failedFiles = fileMatch && fileMatch[2] ? parseInt(fileMatch[2]) : 0;
const totalFiles = fileMatch ? parseInt(fileMatch[3]) : 0;

// Try to read coverage summary
let coverageSummary = {};
const coverageSummaryPath = path.join(__dirname, '..', 'state', 'temp', 'coverage', 'coverage-summary.json');
try {
  if (fs.existsSync(coverageSummaryPath)) {
    coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read coverage summary:', e.message);
}

// Create report
const report = {
  timestamp,
  date: new Date().toISOString(),
  exitCode,
  duration,
  summary: {
    tests: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests
    },
    testSuites: {
      total: totalFiles,
      passed: passedFiles,
      failed: failedFiles
    }
  },
  coverage: coverageSummary,
  output: output.split('\n')
};

// Write report
fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));

// Print results
console.log('\n✅ Test report generated!');
console.log(`📄 JSON report: ${jsonFile}`);
console.log(`📊 Coverage HTML: ${path.join(outputDir, 'coverage', 'index.html')}`);
console.log('\n📈 Summary:');
console.log(`   Tests: ${passedTests} passed, ${failedTests} failed, ${totalTests} total`);
console.log(`   Test Suites: ${passedFiles} passed, ${failedFiles} failed, ${totalFiles} total`);
console.log(`   Duration: ${duration.toFixed(2)}s`);

// Show coverage summary if available
if (coverageSummary.total) {
  console.log('\n📊 Coverage:');
  const total = coverageSummary.total;
  console.log(`   Statements: ${total.statements.pct}%`);
  console.log(`   Branches: ${total.branches.pct}%`);
  console.log(`   Functions: ${total.functions.pct}%`);
  console.log(`   Lines: ${total.lines.pct}%`);
}

process.exit(exitCode);