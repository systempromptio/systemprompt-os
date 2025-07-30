#!/usr/bin/env node

/**
 * Debug script to isolate auth module loading issues
 */

import { pathToFileURL } from 'url';
import { join } from 'path';

const authModulePath = join(process.cwd(), 'src/modules/core/auth/index.ts');
const moduleUrl = pathToFileURL(authModulePath).href;

console.log('🔍 Attempting to load auth module from:', authModulePath);
console.log('🔗 Module URL:', moduleUrl);

try {
  console.log('📥 Importing module...');
  const authModule = await import(moduleUrl);
  console.log('✅ Successfully imported auth module');
  console.log('📦 Available exports:', Object.keys(authModule));
  
  if (authModule.createModule) {
    console.log('🏗️ Creating module instance...');
    const moduleInstance = authModule.createModule();
    console.log('✅ Successfully created module instance');
    console.log('📋 Module name:', moduleInstance.name);
    console.log('📋 Module version:', moduleInstance.version);
    console.log('📋 Module dependencies:', moduleInstance.dependencies);
  } else {
    console.log('❌ No createModule function found');
  }
} catch (error) {
  console.log('❌ Failed to load auth module');
  console.log('🔥 Error type:', error.constructor.name);
  console.log('🔥 Error message:', error.message);
  console.log('🔥 Error stack:', error.stack);
  
  // Show the detailed error object
  console.log('🔥 Full error object:', error);
  
  // Try to extract more details
  if (error.cause) {
    console.log('🔥 Error cause:', error.cause);
  }
  
  // Show how the error would be serialized
  console.log('🔥 String(error):', String(error));
  console.log('🔥 JSON.stringify attempt:');
  try {
    console.log(JSON.stringify(error, null, 2));
  } catch (jsonError) {
    console.log('❌ Cannot JSON.stringify error:', jsonError.message);
  }
}