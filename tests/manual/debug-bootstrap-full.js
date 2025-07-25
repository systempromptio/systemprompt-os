#!/usr/bin/env node

async function testBootstrapPhases() {
  console.log('Testing full bootstrap process with detailed timing...');
  const totalStart = Date.now();
  let currentMem = process.memoryUsage().heapUsed / 1024 / 1024;
  
  try {
    console.log('\n=== Phase 1: Import Bootstrap ===');
    let phaseStart = Date.now();
    const { Bootstrap } = await import('./src/bootstrap.ts');
    console.log(`✅ Bootstrap imported: ${Date.now() - phaseStart}ms`);
    console.log(`Memory: ${currentMem.toFixed(1)}MB -> ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    currentMem = process.memoryUsage().heapUsed / 1024 / 1024;
    
    console.log('\n=== Phase 2: Create Bootstrap Instance ===');
    phaseStart = Date.now();
    const bootstrap = new Bootstrap({
      skipMcp: true,
      environment: 'development',
      cliMode: true,
    });
    console.log(`✅ Bootstrap instance created: ${Date.now() - phaseStart}ms`);
    console.log(`Memory: ${currentMem.toFixed(1)}MB -> ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    currentMem = process.memoryUsage().heapUsed / 1024 / 1024;
    
    console.log('\n=== Phase 3: Run Bootstrap (with timeout) ===');
    phaseStart = Date.now();
    
    // Set a timeout to catch infinite loops in bootstrap process
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Bootstrap timeout - likely infinite loop in bootstrap process')), 10000)
    );
    
    const modules = await Promise.race([
      bootstrap.bootstrap(),
      timeoutPromise
    ]);
    
    const bootstrapTime = Date.now() - phaseStart;
    console.log(`✅ Bootstrap completed: ${bootstrapTime}ms`);
    console.log(`Memory: ${currentMem.toFixed(1)}MB -> ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Modules loaded: ${modules.size}`);
    
    const totalTime = Date.now() - totalStart;
    console.log(`\n🎯 Total time: ${totalTime}ms`);
    
    if (totalTime < 1000) {
      console.log('✅ Bootstrap completed under 1 second!');
    } else {
      console.log('❌ Bootstrap took longer than 1 second');
    }
    
    return { success: true, totalTime, bootstrapTime };
    
  } catch (error) {
    const totalTime = Date.now() - totalStart;
    console.error(`❌ Bootstrap failed after ${totalTime}ms:`, error.message);
    
    return { success: false, error: error.message, totalTime };
  }
}

async function main() {
  process.env.LOG_MODE = 'cli';
  const result = await testBootstrapPhases();
  
  if (!result.success) {
    console.log('\n🛑 Bootstrap failed - investigating specific phase...');
    process.exit(1);
  }
}

main().catch(console.error);