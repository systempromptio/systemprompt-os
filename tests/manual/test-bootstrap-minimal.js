#!/usr/bin/env node

/**
 * Minimal bootstrap test that progressively adds components to isolate the memory issue
 */

class MinimalBootstrap {
  constructor() {
    this.modules = new Map();
    this.logger = null;
  }

  async testStep1_ImportAndCreate() {
    console.log('\n=== Step 1: Import and Create Bootstrap ===');
    const { Bootstrap } = await import('../../src/bootstrap.ts');
    
    const bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true,
      environment: 'development',
      cliMode: true,
    });
    
    console.log('✅ Bootstrap created successfully');
    return bootstrap;
  }

  async testStep2_ExecuteCoreModulesOnly() {
    console.log('\n=== Step 2: Execute Core Modules Phase Only ===');
    const { Bootstrap } = await import('../../src/bootstrap.ts');
    
    // Create a custom bootstrap that only does core modules
    class TestBootstrap extends Bootstrap {
      async bootstrap() {
        this.logger.info('Starting minimal bootstrap test', { category: 'test' });
        
        // Only run core modules phase
        await this.executeCoreModulesPhase();
        
        this.logger.info('Minimal bootstrap completed', { category: 'test' });
        return this.modules;
      }
    }
    
    const bootstrap = new TestBootstrap({
      skipMcp: true,
      skipDiscovery: true,
      environment: 'development',
      cliMode: true,
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Core modules timeout')), 3000)
    );
    
    await Promise.race([
      bootstrap.bootstrap(),
      timeoutPromise
    ]);
    
    console.log('✅ Core modules phase completed');
    return bootstrap;
  }

  async testStep3_WithCliRegistration() {
    console.log('\n=== Step 3: With CLI Registration ===');
    const { Bootstrap } = await import('../../src/bootstrap.ts');
    
    // Test with CLI registration added
    class TestBootstrap extends Bootstrap {
      async bootstrap() {
        this.logger.info('Starting bootstrap with CLI', { category: 'test' });
        
        await this.executeCoreModulesPhase();
        await this.registerCliCommands();
        
        this.logger.info('Bootstrap with CLI completed', { category: 'test' });
        return this.modules;
      }
    }
    
    const bootstrap = new TestBootstrap({
      skipMcp: true,
      skipDiscovery: true,
      environment: 'development',
      cliMode: true,
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('CLI registration timeout')), 5000)
    );
    
    await Promise.race([
      bootstrap.bootstrap(),
      timeoutPromise
    ]);
    
    console.log('✅ CLI registration completed');
    return bootstrap;
  }
}

async function main() {
  console.log('Starting minimal bootstrap isolation test...');
  process.env.LOG_MODE = 'cli';
  
  const tester = new MinimalBootstrap();
  
  try {
    await tester.testStep1_ImportAndCreate();
    await tester.testStep2_ExecuteCoreModulesOnly();
    await tester.testStep3_WithCliRegistration();
    
    console.log('\n🎯 All minimal bootstrap tests passed!');
    console.log('The issue is not in core bootstrap - likely in module discovery or MCP setup');
    
  } catch (error) {
    console.error(`\n❌ Minimal bootstrap test failed: ${error.message}`);
    console.error('Stack:', error.stack);
  }
}

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };