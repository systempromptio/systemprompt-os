/**
 * Test script to identify circular import issues in bootstrap process
 */

console.log('🔍 Testing bootstrap import with timing...');

async function testBootstrapImport() {
  const start = performance.now();
  
  try {
    console.log('Importing bootstrap types...');
    const typesStart = performance.now();
    const types = await import('@/types/bootstrap');
    const typesEnd = performance.now();
    console.log(`✅ Types imported in ${(typesEnd - typesStart).toFixed(2)}ms`);
    console.log(`   Exports: ${Object.keys(types).join(', ')}`);
    
    console.log('\nImporting bootstrap module...');
    const bootstrapStart = performance.now();
    const bootstrap = await import('@/bootstrap');
    const bootstrapEnd = performance.now();
    console.log(`✅ Bootstrap imported in ${(bootstrapEnd - bootstrapStart).toFixed(2)}ms`);
    console.log(`   Exports: ${Object.keys(bootstrap).join(', ')}`);
    
    const totalEnd = performance.now();
    console.log(`\n🎉 Total import time: ${(totalEnd - start).toFixed(2)}ms`);
    
    // Test creating a Bootstrap instance (but don't run bootstrap)
    console.log('\nTesting Bootstrap class instantiation...');
    const instantiationStart = performance.now();
    const { Bootstrap } = bootstrap;
    const instance = new Bootstrap({ skipMcp: true, skipDiscovery: true });
    const instantiationEnd = performance.now();
    console.log(`✅ Bootstrap instantiated in ${(instantiationEnd - instantiationStart).toFixed(2)}ms`);
    
  } catch (error) {
    const errorEnd = performance.now();
    console.log(`❌ Import failed after ${(errorEnd - start).toFixed(2)}ms:`);
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
  
  return true;
}

testBootstrapImport().then(success => {
  if (success) {
    console.log('\n✅ Bootstrap import test completed successfully');
    process.exit(0);
  } else {
    console.log('\n❌ Bootstrap import test failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test crashed:', error);
  process.exit(1);
});