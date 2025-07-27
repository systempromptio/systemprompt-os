import { bootstrapTestEnvironment } from './bootstrap.js';

export default async function globalSetup() {
  console.log('🚀 Global E2E test setup starting...');
  await bootstrapTestEnvironment();
  console.log('✅ Global E2E test setup complete!');
}