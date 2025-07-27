import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const TEST_CONFIG = {
  domains: {
    'tools-cli': 'tests/e2e/00-tools-cli.e2e.test.ts',
    'server-external': 'tests/e2e/01-server-external.e2e.test.ts',
    'server-auth': 'tests/e2e/02-server-auth.e2e.test.ts',
    'server-mcp': 'tests/e2e/03-server-mcp.e2e.test.ts',
    'modules-core': 'tests/e2e/04-modules-core.e2e.test.ts',
    'google-live-api': 'tests/e2e/05-google-live-api.e2e.test.ts'
  },
  sequential: ['tools-cli', 'server-external', 'server-auth', 'server-mcp', 'modules-core', 'google-live-api']
};

class TestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      totalDuration: 0,
      success: true,
      domains: [],
      summary: {
        totalTests: 0,
        totalPassed: 0,
        totalFailed: 0,
        totalSkipped: 0
      }
    };
    this.startTime = Date.now();
  }

  async runDomain(domain, testFile) {
    console.log(`\n🔧 Running tests for domain: ${domain}`);
    console.log(`📁 Test file: ${testFile}`);
    
    const domainStart = Date.now();
    const result = {
      domain,
      tests: [],
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };

    try {
      // First, start the Docker containers if needed
      if (domain !== 'tools-cli') {
        await this.ensureDockerRunning();
      }

      // Run the tests
      const { success, output } = await this.runCommand(
        'npx',
        ['vitest', 'run', testFile, '--reporter=json'],
        {
          PORT: '3001',
          BASE_URL: 'http://localhost:3001',
          NODE_ENV: 'test',
          JWT_SECRET: 'test-secret-key-for-e2e-testing',
          LOG_LEVEL: 'debug'
        }
      );

      // Parse test results
      if (output) {
        try {
          const jsonMatch = output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const testResults = JSON.parse(jsonMatch[0]);
            result.tests = this.extractTestResults(testResults, domain);
            result.totalTests = result.tests.length;
            result.passed = result.tests.filter(t => t.status === 'passed').length;
            result.failed = result.tests.filter(t => t.status === 'failed').length;
            result.skipped = result.tests.filter(t => t.status === 'skipped').length;
          }
        } catch (e) {
          // Fallback to simple parsing
          result.totalTests = (output.match(/✓/g) || []).length + (output.match(/×/g) || []).length;
          result.passed = (output.match(/✓/g) || []).length;
          result.failed = (output.match(/×/g) || []).length;
        }
      }

      if (!success || result.failed > 0) {
        this.results.success = false;
      }

    } catch (error) {
      console.error(`❌ Error running domain ${domain}:`, error.message);
      result.failed = 1;
      result.totalTests = 1;
      result.tests = [{
        name: 'Domain execution',
        status: 'failed',
        duration: 0,
        error: error.message
      }];
      this.results.success = false;
    }

    result.duration = Date.now() - domainStart;
    this.results.domains.push(result);
    
    // Update summary
    this.results.summary.totalTests += result.totalTests;
    this.results.summary.totalPassed += result.passed;
    this.results.summary.totalFailed += result.failed;
    this.results.summary.totalSkipped += result.skipped;

    console.log(`✅ Domain ${domain} complete: ${result.passed}/${result.totalTests} passed`);
    
    return result;
  }

  async ensureDockerRunning() {
    // Check if containers are running
    const { success, output } = await this.runCommand('docker', ['ps', '--format', '{{.Names}}']);
    
    if (!output.includes('systemprompt-e2e')) {
      console.log('🐳 Starting Docker containers...');
      
      // Build the Docker image
      await this.runCommand('docker', ['build', '-t', 'systemprompt-os:e2e', '.']);
      
      // Start the container
      await this.runCommand('docker', [
        'run', '-d',
        '--name', 'systemprompt-e2e',
        '-p', '3001:3001',
        '-e', 'PORT=3001',
        '-e', 'BASE_URL=http://localhost:3001',
        '-e', 'NODE_ENV=test',
        '-e', 'JWT_SECRET=test-secret-key-for-e2e-testing',
        '-e', 'LOG_LEVEL=debug',
        'systemprompt-os:e2e'
      ]);
      
      // Wait for container to be ready
      console.log('⏳ Waiting for container to be ready...');
      await this.waitForHealth('http://localhost:3001/health', 30);
    }
  }

  async waitForHealth(url, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          console.log('✅ Container is healthy');
          return true;
        }
      } catch (e) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Container failed to become healthy');
  }

  runCommand(command, args, env = {}) {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output + errorOutput,
          code
        });
      });
    });
  }

  extractTestResults(vitestResults, domain) {
    const tests = [];
    
    // Extract test results from vitest JSON output
    if (vitestResults.testResults) {
      for (const file of vitestResults.testResults) {
        if (file.assertionResults) {
          for (const test of file.assertionResults) {
            tests.push({
              name: test.title,
              status: test.status,
              duration: test.duration || 0,
              error: test.failureMessages ? test.failureMessages[0] : undefined
            });
          }
        }
      }
    }

    return tests;
  }

  async saveResults() {
    this.results.totalDuration = Date.now() - this.startTime;
    
    // Save to multiple locations
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const paths = [
      'state/temp/e2e-test-latest.json',
      `state/temp/e2e-test-${timestamp}.json`
    ];

    for (const filePath of paths) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(this.results, null, 2));
    }

    console.log(`\n📊 Results saved to: ${paths.join(', ')}`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`✅ Passed: ${this.results.summary.totalPassed}`);
    console.log(`❌ Failed: ${this.results.summary.totalFailed}`);
    console.log(`⏭️  Skipped: ${this.results.summary.totalSkipped}`);
    console.log(`⏱️  Duration: ${(this.results.totalDuration / 1000).toFixed(2)}s`);
    console.log(`🎯 Success: ${this.results.success ? 'YES' : 'NO'}`);
    console.log('='.repeat(80));

    if (!this.results.success) {
      console.log('\n❌ FAILED TESTS:');
      for (const domain of this.results.domains) {
        if (domain.failed > 0) {
          console.log(`\n${domain.domain}:`);
          for (const test of domain.tests) {
            if (test.status === 'failed') {
              console.log(`  ❌ ${test.name}`);
              if (test.error) {
                console.log(`     Error: ${test.error}`);
              }
            }
          }
        }
      }
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    // Stop and remove Docker container
    await this.runCommand('docker', ['stop', 'systemprompt-e2e']);
    await this.runCommand('docker', ['rm', 'systemprompt-e2e']);
    
    console.log('✅ Cleanup complete');
  }

  async run(domains = null) {
    console.log('🚀 Starting E2E Test Runner');
    console.log(`📅 ${new Date().toISOString()}`);
    
    try {
      // Determine which domains to run
      const domainsToRun = domains || TEST_CONFIG.sequential;
      
      // Run tests for each domain
      for (const domain of domainsToRun) {
        if (TEST_CONFIG.domains[domain]) {
          await this.runDomain(domain, TEST_CONFIG.domains[domain]);
        } else {
          console.error(`❌ Unknown domain: ${domain}`);
        }
      }

      // Save results
      await this.saveResults();
      
      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('💥 Fatal error:', error);
      this.results.success = false;
    } finally {
      // Cleanup
      await this.cleanup();
    }

    // Exit with appropriate code
    process.exit(this.results.success ? 0 : 1);
  }
}

// Run the test runner
const runner = new TestRunner();
const domains = process.argv.slice(2);
runner.run(domains.length > 0 ? domains : null).catch(console.error);