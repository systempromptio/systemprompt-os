#!/usr/bin/env node

/**
 * Test each bootstrap phase separately to isolate infinite loop issues
 * This test methodically tests each step in executeCoreModulesPhase
 */

async function testBootstrapPhases() {
  console.log('Testing bootstrap phases systematically...');
  process.env.LOG_MODE = 'cli';
  
  try {
    console.log('\n=== Phase 1: Import Bootstrap Classes ===');
    const { Bootstrap } = await import('../../src/bootstrap.ts');
    const { loadCoreModulesInOrder } = await import('../../src/bootstrap/sequential-loader.ts');
    const { loadCoreModule } = await import('../../src/bootstrap/module-loader.ts');
    const { initializeModulesInOrder } = await import('../../src/bootstrap/sequential-loader.ts');
    const { startModulesInOrder } = await import('../../src/bootstrap/sequential-loader.ts');
    console.log('✅ All imports successful');
    
    console.log('\n=== Phase 2: Create Bootstrap Instance ===');
    const bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true,
      environment: 'development',
      cliMode: true,
    });
    console.log('✅ Bootstrap instance created');
    
    console.log('\n=== Phase 3: Test loadCoreModulesInOrder ===');
    const modules = new Map();
    const coreModules = [
      { name: 'logger', path: './src/modules/core/logger/index.ts', dependencies: [], type: 'self-contained', critical: true },
      { name: 'database', path: './src/modules/core/database/index.ts', dependencies: ['logger'], type: 'self-contained', critical: true }
    ];
    
    let phaseStart = Date.now();
    const timeoutPromise = (ms, name) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${name} timeout - likely infinite loop`)), ms)
    );
    
    await Promise.race([
      loadCoreModulesInOrder(coreModules, async (definition) => {
        console.log(`Loading ${definition.name}...`);
        const moduleInstance = await loadCoreModule(definition, modules);
        modules.set(definition.name, moduleInstance);
        console.log(`✅ ${definition.name} loaded`);
      }),
      timeoutPromise(5000, 'loadCoreModulesInOrder')
    ]);
    console.log(`✅ loadCoreModulesInOrder completed in ${Date.now() - phaseStart}ms`);
    
    console.log('\n=== Phase 4: Test initializeModulesInOrder ===');
    phaseStart = Date.now();
    const { createConsoleLogger } = await import('../../src/utils/console-logger.ts');
    const { initializeSingleModule } = await import('../../src/bootstrap/module-init-helper.ts');
    const logger = createConsoleLogger();
    
    const moduleEntries = Array.from(modules.entries());
    await Promise.race([
      initializeModulesInOrder(moduleEntries, async (name, moduleInstance) => {
        console.log(`Initializing ${name}...`);
        await initializeSingleModule(name, moduleInstance, logger);
        console.log(`✅ ${name} initialized`);
      }),
      timeoutPromise(5000, 'initializeModulesInOrder')
    ]);
    console.log(`✅ initializeModulesInOrder completed in ${Date.now() - phaseStart}ms`);
    
    console.log('\n=== Phase 5: Test startModulesInOrder ===');
    phaseStart = Date.now();
    const { startSingleModule } = await import('../../src/bootstrap/module-init-helper.ts');
    const criticalModuleNames = coreModules
      .filter(mod => mod.critical)
      .map(mod => mod.name);
    
    await Promise.race([
      startModulesInOrder(criticalModuleNames, async (name) => {
        const moduleInstance = modules.get(name);
        if (moduleInstance) {
          console.log(`Starting ${name}...`);
          await startSingleModule(name, moduleInstance, logger);
          console.log(`✅ ${name} started`);
        }
      }),
      timeoutPromise(5000, 'startModulesInOrder')
    ]);
    console.log(`✅ startModulesInOrder completed in ${Date.now() - phaseStart}ms`);
    
    console.log('\n🎯 All bootstrap phases completed successfully!');
    return { success: true };
    
  } catch (error) {
    console.error(`❌ Bootstrap phase failed: ${error.message}`);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

async function testFullBootstrapWithTimeouts() {
  console.log('\n=== Testing Full Bootstrap with Individual Step Timeouts ===');
  process.env.LOG_MODE = 'cli';
  
  try {
    const { Bootstrap } = await import('../../src/bootstrap.ts');
    
    console.log('Creating simple bootstrap test...');
    const bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true,
      environment: 'development',
      cliMode: true,
    });
    
    console.log('Testing bootstrap with 5-second timeout...');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Bootstrap timeout')), 5000)
    );
    
    await Promise.race([
      bootstrap.bootstrap(),
      timeoutPromise
    ]);
    console.log('🎯 Full bootstrap completed successfully!');
    
  } catch (error) {
    console.error(`❌ Full bootstrap failed: ${error.message}`);
    console.error('Stack:', error.stack);
  }
}

async function main() {
  const result1 = await testBootstrapPhases();
  
  if (result1.success) {
    await testFullBootstrapWithTimeouts();
  }
}

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testBootstrapPhases, testFullBootstrapWithTimeouts, main };