/**
 * Global setup for local E2E tests
 */
import { bootstrapLocalTestEnvironment } from './bootstrap.js';

export default async function globalSetup() {
  console.log('🚀 Global Local E2E test setup starting...');
  await bootstrapLocalTestEnvironment();
  console.log('✅ Global Local E2E test setup complete!');
}