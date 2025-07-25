#!/usr/bin/env node

async function testCoreModuleSteps() {
  console.log('Testing individual bootstrap steps...');
  process.env.LOG_MODE = 'cli';
  
  try {
    console.log('\n=== Step 1: Test loadCoreModule function directly ===');
    const { loadCoreModule } = await import('./src/bootstrap/module-loader.ts');
    const modules = new Map();
    
    const coreModuleDefs = [
      { name: 'logger', path: './src/modules/core/logger/index.ts', dependencies: [], type: 'self-contained' },
      { name: 'database', path: './src/modules/core/database/index.ts', dependencies: ['logger'], type: 'self-contained' }
    ];
    
    console.log('Loading logger module...');
    const loggerModule = await loadCoreModule(coreModuleDefs[0], modules);
    modules.set('logger', loggerModule);
    console.log('✅ Logger module loaded');
    
    console.log('Loading database module...');
    const databaseModule = await loadCoreModule(coreModuleDefs[1], modules);
    modules.set('database', databaseModule);
    console.log('✅ Database module loaded');
    
    console.log('\n=== Step 2: Test module initialization directly ===');
    const { initializeSingleModule } = await import('./src/bootstrap/module-init-helper.ts');
    const { createConsoleLogger } = await import('./src/utils/console-logger.ts');
    const logger = createConsoleLogger();
    
    console.log('Initializing logger module...');
    await initializeSingleModule('logger', loggerModule, logger);
    console.log('✅ Logger module initialized');
    
    console.log('Initializing database module...');
    await initializeSingleModule('database', databaseModule, logger);
    console.log('✅ Database module initialized');
    
    console.log('\n🎯 All steps completed successfully - no infinite loop in core functionality');
    
  } catch (error) {
    console.error('❌ Step failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCoreModuleSteps().catch(console.error);