/**
 * Global setup for Docker E2E tests
 */
import { bootstrapDockerTestEnvironment } from './bootstrap.js';

export default async function globalSetup() {
  console.log('🚀 Global Docker E2E test setup starting...');
  await bootstrapDockerTestEnvironment();
  console.log('✅ Global Docker E2E test setup complete!');
}