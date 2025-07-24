import { beforeAll, afterAll } from 'vitest';
import { bootstrapTestEnvironment, cleanupTestEnvironment, TEST_CONFIG } from './bootstrap.js';

// Global setup for all E2E tests
beforeAll(async () => {
  await bootstrapTestEnvironment();
}, TEST_CONFIG.testTimeout);

afterAll(async () => {
  await cleanupTestEnvironment();
}, TEST_CONFIG.testTimeout);