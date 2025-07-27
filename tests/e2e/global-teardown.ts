import { cleanupTestEnvironment } from './bootstrap.js';

export default async function globalTeardown() {
  console.log('🧹 Global E2E test teardown starting...');
  await cleanupTestEnvironment();
  console.log('✅ Global E2E test teardown complete!');
}