// Quick test to isolate circular import during bootstrap restart
import { Bootstrap } from './src/bootstrap.ts';

async function testCircularImport() {
  console.log('🔍 Testing for circular import...');
  
  try {
    console.log('1. Creating first bootstrap instance...');
    const bootstrap1 = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    console.log('2. Running first bootstrap...');
    await bootstrap1.bootstrap();
    console.log('✅ First bootstrap successful');
    
    console.log('3. Shutting down first bootstrap...');
    await bootstrap1.shutdown();
    console.log('✅ Shutdown successful');
    
    console.log('4. Creating second bootstrap instance...');
    const bootstrap2 = new Bootstrap({
      skipMcp: true,
      skipDiscovery: true
    });
    
    console.log('5. Running second bootstrap (this is where circular import happens)...');
    await bootstrap2.bootstrap();
    console.log('✅ Second bootstrap successful - no circular import!');
    
    await bootstrap2.shutdown();
    console.log('✅ All tests passed');
    
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCircularImport();