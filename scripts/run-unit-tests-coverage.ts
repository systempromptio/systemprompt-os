#!/usr/bin/env node

/**
 * Script to run unit tests with coverage and save timestamped JSON report
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

async function runTestsWithCoverage() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: YYYY-MM-DDTHH-MM-SS
  const outputDir = path.join(process.cwd(), 'state', 'temp');
  const coverageDir = path.join(outputDir, 'coverage');
  const jsonReportPath = path.join(outputDir, `unit-test-${timestamp}.json`);

  console.log(`Running unit tests with coverage...`);
  console.log(`Coverage will be saved to: ${coverageDir}`);
  console.log(`JSON report will be saved to: ${jsonReportPath}`);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Run tests with coverage
  const testCommand = 'npm test -- --coverage tests/unit --reporter=json --outputFile=coverage-raw.json';
  
  return new Promise((resolve, reject) => {
    exec(testCommand, async (error, stdout, stderr) => {
      if (error && error.code !== 1) { // Exit code 1 might just mean some tests failed
        console.error('Error running tests:', error);
        reject(error);
        return;
      }

      try {
        // Read the raw coverage output
        const rawCoveragePath = path.join(process.cwd(), 'coverage-raw.json');
        let testResults = {};
        let coverageData = {};

        // Try to read test results
        try {
          const rawData = await fs.readFile(rawCoveragePath, 'utf-8');
          testResults = JSON.parse(rawData);
          await fs.unlink(rawCoveragePath); // Clean up temp file
        } catch (e) {
          console.warn('Could not read test results:', e);
        }

        // Try to read coverage summary
        try {
          const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
          const coverageSummary = await fs.readFile(coverageSummaryPath, 'utf-8');
          coverageData = JSON.parse(coverageSummary);
        } catch (e) {
          console.warn('Could not read coverage summary:', e);
        }

        // Create final report
        const report = {
          timestamp,
          date: new Date().toISOString(),
          testResults: {
            ...testResults,
            stdout: stdout.split('\n').filter(line => line.trim()),
            stderr: stderr ? stderr.split('\n').filter(line => line.trim()) : []
          },
          coverage: coverageData,
          summary: {
            totalTests: testResults.numTotalTests || 0,
            passedTests: testResults.numPassedTests || 0,
            failedTests: testResults.numFailedTests || 0,
            totalTestSuites: testResults.numTotalTestSuites || 0,
            passedTestSuites: testResults.numPassedTestSuites || 0,
            failedTestSuites: testResults.numFailedTestSuites || 0,
            duration: testResults.testResults ? 
              testResults.testResults.reduce((acc: number, suite: any) => acc + (suite.duration || 0), 0) : 0
          }
        };

        // Write the final report
        await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));
        
        console.log('\n✅ Test coverage report generated successfully!');
        console.log(`📊 Coverage report: ${coverageDir}/index.html`);
        console.log(`📄 JSON report: ${jsonReportPath}`);
        
        // Print summary
        console.log('\n📈 Test Summary:');
        console.log(`   Total Tests: ${report.summary.totalTests}`);
        console.log(`   Passed: ${report.summary.passedTests}`);
        console.log(`   Failed: ${report.summary.failedTests}`);
        
        resolve(report);
      } catch (err) {
        console.error('Error processing test results:', err);
        reject(err);
      }
    });
  });
}

// Run if called directly
if (require.main === module) {
  runTestsWithCoverage()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runTestsWithCoverage };