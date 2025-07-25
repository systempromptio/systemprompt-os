#!/usr/bin/env node

const coreModules = [
  { name: 'logger', path: './src/modules/core/logger/index.ts' },
  { name: 'database', path: './src/modules/core/database/index.ts' }, 
  { name: 'auth', path: './src/modules/core/auth/index.ts' },
  { name: 'cli', path: './src/modules/core/cli/index.ts' },
  { name: 'modules', path: './src/modules/core/modules/index.ts' }
];

async function testModuleCreation(moduleDef) {
  console.log(`\n=== Testing ${moduleDef.name} module creation ===`);
  const startMem = process.memoryUsage().heapUsed / 1024 / 1024;
  const startTime = Date.now();
  
  try {
    console.log(`Importing ${moduleDef.name}...`);
    const moduleExports = await import(moduleDef.path);
    
    console.log(`Creating ${moduleDef.name} instance...`);
    let moduleInstance;
    if (typeof moduleExports.createModule === 'function') {
      moduleInstance = moduleExports.createModule();
    } else if (typeof moduleExports.default === 'function') {
      moduleInstance = new moduleExports.default();
    } else {
      throw new Error(`No valid constructor found for ${moduleDef.name}`);
    }
    
    console.log(`Initializing ${moduleDef.name}...`);
    if (moduleInstance.initialize && typeof moduleInstance.initialize === 'function') {
      // Set a timeout to catch infinite loops
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout - likely infinite loop')), 5000)
      );
      
      await Promise.race([
        moduleInstance.initialize(),
        timeoutPromise
      ]);
    }
    
    const endTime = Date.now();
    const endMem = process.memoryUsage().heapUsed / 1024 / 1024;
    
    console.log(`✅ ${moduleDef.name} completed successfully`);
    console.log(`   Time: ${endTime - startTime}ms`);
    console.log(`   Memory: ${startMem.toFixed(1)}MB -> ${endMem.toFixed(1)}MB (${(endMem - startMem).toFixed(1)}MB diff)`);
    
    return { success: true, time: endTime - startTime, memoryDiff: endMem - startMem };
  } catch (error) {
    const endTime = Date.now();
    const endMem = process.memoryUsage().heapUsed / 1024 / 1024;
    
    console.error(`❌ ${moduleDef.name} failed:`, error.message);
    console.log(`   Time: ${endTime - startTime}ms`);
    console.log(`   Memory: ${startMem.toFixed(1)}MB -> ${endMem.toFixed(1)}MB (${(endMem - startMem).toFixed(1)}MB diff)`);
    
    return { success: false, error: error.message, time: endTime - startTime, memoryDiff: endMem - startMem };
  }
}

async function main() {
  console.log('Starting core module initialization test...');
  console.log('Initial memory:', (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1), 'MB');
  
  for (const moduleDef of coreModules) {
    const result = await testModuleCreation(moduleDef);
    
    if (!result.success) {
      console.log(`\n🛑 Stopping at ${moduleDef.name} due to failure`);
      break;
    }
    
    if (result.time > 1000) {
      console.log(`\n⚠️  ${moduleDef.name} took ${result.time}ms (too slow)`);
    }
    
    if (result.memoryDiff > 100) {
      console.log(`\n⚠️  ${moduleDef.name} used ${result.memoryDiff.toFixed(1)}MB memory (too much)`);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
  
  console.log('\nTest completed');
}

main().catch(console.error);