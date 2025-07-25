#!/usr/bin/env node

// Test the full bootstrap process but skip specific steps to isolate the issue
async function testBootstrapWithSkips() {
  console.log('Testing bootstrap with specific steps skipped...');
  process.env.LOG_MODE = 'cli';
  
  try {
    const { Bootstrap } = await import('./src/bootstrap.ts');
    
    // Create a custom bootstrap class that skips problematic methods
    class TestBootstrap extends Bootstrap {
      constructor(options) {
        super(options);
      }
      
      // Override the registerCliCommands to skip it
      async registerCliCommands() {
        console.log('Skipping registerCliCommands...');
        return Promise.resolve();
      }
      
      // Override registerCoreModulesInDatabase to skip it
      async registerCoreModulesInDatabase() {
        console.log('Skipping registerCoreModulesInDatabase...');
        return Promise.resolve();
      }
      
      // Make the private method public for testing
      async testExecuteCoreModulesPhase() {
        return await super.executeCoreModulesPhase();
      }
    }
    
    console.log('Creating test bootstrap...');
    const bootstrap = new TestBootstrap({
      skipMcp: true,
      skipDiscovery: true,
      environment: 'development',
      cliMode: true,
    });
    
    console.log('Testing executeCoreModulesPhase only...');
    const startTime = Date.now();
    
    // Set timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Core modules phase timeout')), 5000)
    );
    
    await Promise.race([
      bootstrap.testExecuteCoreModulesPhase(),
      timeoutPromise
    ]);
    
    const endTime = Date.now();
    console.log(`✅ Core modules phase completed in ${endTime - startTime}ms`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBootstrapWithSkips().catch(console.error);