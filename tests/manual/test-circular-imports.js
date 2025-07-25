#!/usr/bin/env node

/**
 * Test script to identify circular import issues in bootstrap process
 */

import { performance } from 'perf_hooks';

console.log('🔍 Testing for circular imports in bootstrap...');

const modules = [
  '@/types/bootstrap',
  '@/bootstrap/module-loader',
  '@/bootstrap/sequential-loader',
  '@/modules/core/logger/services/logger.service',
  '@/modules/core/database/services/database.service',
  '@/modules/core/modules/services/module-scanner.service',
  '@/bootstrap',
];

async function testImport(modulePath) {
  const start = performance.now();
  try {
    console.log(`Importing ${modulePath}...`);
    const relativePath = modulePath.replace('@/', '');
    const resolvedPath = new URL(`../../src/${relativePath}.ts`, import.meta.url).href;
    const module = await import(resolvedPath);
    const end = performance.now();
    console.log(`✅ ${modulePath} loaded in ${(end - start).toFixed(2)}ms`);
    return { success: true, time: end - start, exports: Object.keys(module) };
  } catch (error) {
    const end = performance.now();
    console.log(`❌ ${modulePath} failed after ${(end - start).toFixed(2)}ms:`, error.message);
    return { success: false, time: end - start, error: error.message };
  }
}

async function main() {
  const results = [];
  
  for (const modulePath of modules) {
    const result = await testImport(modulePath);
    results.push({ module: modulePath, ...result });
    
    // Break if we hit a problematic module
    if (!result.success || result.time > 5000) {
      console.log(`\n❌ Found problematic module: ${modulePath}`);
      break;
    }
    
    // Small delay to prevent overwhelming
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Results summary:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.module}: ${result.time.toFixed(2)}ms`);
    if (result.exports) {
      console.log(`   Exports: ${result.exports.slice(0, 5).join(', ')}${result.exports.length > 5 ? '...' : ''}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});