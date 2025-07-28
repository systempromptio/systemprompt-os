/**
 * Global teardown for Docker E2E tests
 */
import { cleanupDockerTestEnvironment } from './bootstrap.js';

export default async function globalTeardown() {
  console.log('🧹 Global Docker E2E test teardown starting...');
  await cleanupDockerTestEnvironment();
  console.log('✅ Global Docker E2E test teardown complete!');
}