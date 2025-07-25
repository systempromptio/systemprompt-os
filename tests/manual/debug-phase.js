#!/usr/bin/env node

async function testBootstrapStepByStep() {
  console.log('Testing bootstrap step by step...');
  process.env.LOG_MODE = 'cli';
  
  try {
    const { Bootstrap } = await import('./src/bootstrap.ts');
    console.log('✅ Bootstrap imported');
    
    const bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true, // Skip discovery to isolate core module issue
      environment: 'development',
      cliMode: true,
    });
    console.log('✅ Bootstrap instance created');
    
    console.log('\n=== Testing executeCoreModulesPhase ===');
    const startTime = Date.now();
    
    // Set timeout for just the core modules phase
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Core modules phase timeout - infinite loop detected')), 5000)
    );
    
    // We'll call the bootstrap method which includes executeCoreModulesPhase
    await Promise.race([
      bootstrap.bootstrap(),
      timeoutPromise
    ]);
    
    const endTime = Date.now();
    console.log(`✅ Bootstrap completed in ${endTime - startTime}ms`);
    
  } catch (error) {
    console.error('❌ Bootstrap step failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testBootstrapStepByStep().catch(console.error);