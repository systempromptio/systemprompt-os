/**
 * Global teardown for local E2E tests
 */
import { cleanupLocalTestEnvironment } from './bootstrap.js';

export default async function globalTeardown() {
  console.log('🧹 Global Local E2E test teardown starting...');
  await cleanupLocalTestEnvironment();
  console.log('✅ Global Local E2E test teardown complete!');
}