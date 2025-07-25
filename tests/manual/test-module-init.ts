/**
 * Test script to identify which module initialization is hanging
 */

import { Bootstrap } from '@/bootstrap';
import { createConsoleLogger } from '@/utils/console-logger';

console.log('🔍 Testing individual module initialization...');

async function testModuleInitialization() {
  const logger = createConsoleLogger();
  
  try {
    console.log('Creating Bootstrap instance...');
    const bootstrap = new Bootstrap({
      logger,
      skipMcp: true,
      skipDiscovery: true,
      cliMode: true
    });
    
    // Override the initializeSingleModule method to add detailed timing
    const originalMethod = (bootstrap as any).initializeSingleModule.bind(bootstrap);
    (bootstrap as any).initializeSingleModule = async function(name: string, moduleInstance: any) {
      console.log(`  🔄 Starting initialization of module: ${name}`);
      const start = performance.now();
      
      try {
        await originalMethod(name, moduleInstance);
        const end = performance.now();
        console.log(`  ✅ Module ${name} initialized in ${(end - start).toFixed(2)}ms`);
      } catch (error) {
        const end = performance.now();
        console.log(`  ❌ Module ${name} failed after ${(end - start).toFixed(2)}ms:`, error.message);
        throw error;
      }
    };
    
    console.log('\nStarting bootstrap with detailed module tracking...');
    
    // Set individual timeouts for each module
    let currentModule = 'none';
    const moduleTimeout = setTimeout(() => {
      console.log(`❌ Module initialization timed out. Last module being initialized: ${currentModule}`);
      process.exit(1);
    }, 20000);
    
    const modules = await bootstrap.bootstrap();
    clearTimeout(moduleTimeout);
    
    console.log(`✅ All modules initialized successfully! Total: ${modules.size}`);
    return true;
    
  } catch (error) {
    console.log(`❌ Module initialization failed:`);
    console.log('Error:', error.message);
    return false;
  }
}

testModuleInitialization().then(success => {
  if (success) {
    console.log('\n✅ Module initialization test completed successfully');
    process.exit(0);
  } else {
    console.log('\n❌ Module initialization test failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test crashed:', error);
  process.exit(1);
});