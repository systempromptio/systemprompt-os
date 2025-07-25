/**
 * Test script to identify where bootstrap execution gets stuck
 */

import { Bootstrap } from '@/bootstrap';
import { createConsoleLogger } from '@/utils/console-logger';

console.log('🔍 Testing bootstrap execution phases...');

async function testBootstrapExecution() {
  const logger = createConsoleLogger();
  
  try {
    console.log('Creating Bootstrap instance...');
    const start = performance.now();
    
    const bootstrap = new Bootstrap({
      logger,
      skipMcp: true,
      skipDiscovery: true,
      cliMode: true
    });
    
    const instanceEnd = performance.now();
    console.log(`✅ Bootstrap instance created in ${(instanceEnd - start).toFixed(2)}ms`);
    
    console.log('\nStarting bootstrap process...');
    const bootstrapStart = performance.now();
    
    // Override the bootstrap method to add timing checkpoints
    const originalBootstrap = bootstrap.bootstrap.bind(bootstrap);
    bootstrap.bootstrap = async function() {
      console.log('  📍 Entering bootstrap method...');
      const methodStart = performance.now();
      
      try {
        logger.info('BOOTSTRAP', 'Starting bootstrap process', { category: 'startup' });
        console.log(`  📍 Logger info call completed after ${(performance.now() - methodStart).toFixed(2)}ms`);
        
        console.log('  📍 About to execute core modules phase...');
        const coreStart = performance.now();
        await this.executeCoreModulesPhase();
        const coreEnd = performance.now();
        console.log(`  ✅ Core modules phase completed in ${(coreEnd - coreStart).toFixed(2)}ms`);
        
        console.log('  📍 About to register CLI commands...');
        const cliStart = performance.now();
        await this.registerCliCommands();
        const cliEnd = performance.now();
        console.log(`  ✅ CLI commands registered in ${(cliEnd - cliStart).toFixed(2)}ms`);
        
        const { READY } = await import('@/types/bootstrap').then(m => m.BootstrapPhaseEnum);
        this.currentPhase = READY;
        logger.info('BOOTSTRAP', `Bootstrap completed - ${String(this.modules.size)} modules`, { category: 'startup' });
        
        return this.modules;
      } catch (error) {
        const errorTime = performance.now() - methodStart;
        console.log(`  ❌ Bootstrap failed after ${errorTime.toFixed(2)}ms:`, error.message);
        throw error;
      }
    };
    
    const modules = await bootstrap.bootstrap();
    const bootstrapEnd = performance.now();
    console.log(`✅ Bootstrap completed in ${(bootstrapEnd - bootstrapStart).toFixed(2)}ms`);
    console.log(`📊 Total modules loaded: ${modules.size}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Bootstrap execution failed:`);
    console.log('Error:', error.message);
    if (error.stack) {
      console.log('Stack trace:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    return false;
  }
}

// Set a timeout to kill the process if it hangs
const timeout = setTimeout(() => {
  console.log('❌ Test timed out after 30 seconds - likely infinite loop or memory explosion');
  process.exit(1);
}, 30000);

testBootstrapExecution().then(success => {
  clearTimeout(timeout);
  if (success) {
    console.log('\n✅ Bootstrap execution test completed successfully');
    process.exit(0);
  } else {
    console.log('\n❌ Bootstrap execution test failed');
    process.exit(1);
  }
}).catch(error => {
  clearTimeout(timeout);
  console.error('❌ Test crashed:', error);
  process.exit(1);
});