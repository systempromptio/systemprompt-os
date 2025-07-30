import { Bootstrap } from './src/bootstrap.ts';

console.log('Testing minimal bootstrap with only logger, database, events...');

async function testMinimalBootstrap() {
  try {
    // Set minimal environment
    process.env.LOG_LEVEL = 'debug';
    process.env.NODE_ENV = 'test';
    
    const bootstrap = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    console.log('Starting bootstrap...');
    const modules = await bootstrap.bootstrap();
    
    console.log('Bootstrap completed. Loaded modules:');
    for (const [name, module] of modules) {
      console.log(`  - ${name}: ${module.status}`);
    }
    
    await bootstrap.shutdown();
    console.log('Shutdown complete');
    
  } catch (error) {
    console.error('Bootstrap failed:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testMinimalBootstrap();