import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function runE2ETests() {
  console.log('🚀 Starting E2E test runner...');

  // List of e2e test files to run in order
  const testFiles = [
    'tests/e2e/00-tools-cli.e2e.test.ts',
    'tests/e2e/01-server-external.e2e.test.ts',
    'tests/e2e/02-server-auth.e2e.test.ts',
    'tests/e2e/03-server-mcp.e2e.test.ts',
    'tests/e2e/04-modules-core.e2e.test.ts',
    'tests/e2e/05-google-live-api.e2e.test.ts'
  ];

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };

  for (const testFile of testFiles) {
    if (!fs.existsSync(testFile)) {
      console.log(`❌ Test file not found: ${testFile}`);
      continue;
    }

    console.log(`\n📋 Running: ${testFile}`);
    
    const testName = path.basename(testFile, '.e2e.test.ts');
    const startTime = Date.now();
    
    try {
      // Run vitest for this specific e2e test file
      const vitest = spawn('npx', ['vitest', 'run', testFile], {
        env: {
          ...process.env,
          PORT: '3001',
          BASE_URL: 'http://localhost:3001',
          NODE_ENV: 'test',
          JWT_SECRET: 'test-secret-key-for-e2e-testing',
          LOG_LEVEL: 'debug'
        },
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      vitest.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        process.stdout.write(str);
      });

      vitest.stderr.on('data', (data) => {
        const str = data.toString();
        errorOutput += str;
        process.stderr.write(str);
      });

      await new Promise((resolve) => {
        vitest.on('close', (code) => {
          const duration = Date.now() - startTime;
          const testResult = {
            name: testName,
            file: testFile,
            exitCode: code,
            duration,
            passed: code === 0,
            output: output.slice(-1000), // Last 1000 chars
            error: errorOutput.slice(-1000)
          };

          results.tests.push(testResult);
          results.summary.total++;
          
          if (code === 0) {
            results.summary.passed++;
            console.log(`✅ ${testName} PASSED (${duration}ms)`);
          } else {
            results.summary.failed++;
            console.log(`❌ ${testName} FAILED (${duration}ms)`);
          }
          
          resolve();
        });
      });

    } catch (error) {
      console.error(`💥 Error running ${testFile}:`, error);
      results.tests.push({
        name: testName,
        file: testFile,
        error: error.message,
        passed: false
      });
      results.summary.failed++;
    }
  }

  // Save results
  const resultsPath = 'e2e-test-results.json';
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log('\n📊 Test Summary:');
  console.log(`Total: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`\nResults saved to: ${resultsPath}`);

  process.exit(results.summary.failed > 0 ? 1 : 0);
}

runE2ETests().catch(console.error);