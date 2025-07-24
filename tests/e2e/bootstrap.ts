import { beforeAll, afterAll } from 'vitest';
import { DockerTestEnvironment } from './utils/docker-test-utils.js';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Global Docker environment instance
export let dockerEnv: DockerTestEnvironment;

// Configuration for the test environment
export const TEST_CONFIG = {
  baseUrl: 'http://localhost:3001',
  testTimeout: 180000, // 3 minutes for Docker operations
  projectName: 'systemprompt-e2e-test',
  envVars: {
    PORT: '3001',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-for-e2e-testing',
    GOOGLE_CLIENT_ID: 'test-google-client',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
    GITHUB_CLIENT_ID: 'test-github-client',
    GITHUB_CLIENT_SECRET: 'test-github-secret',
    LOG_LEVEL: 'debug',
    PROJECT_ROOT: '/workspace',
    HOST_FILE_ROOT: '/var/www/html/systemprompt-os',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'test-gemini-api-key'
  }
};

/**
 * Bootstrap function to initialize Docker environment for all e2e tests
 * This function is called once before all tests run
 */
export async function bootstrapTestEnvironment(): Promise<void> {
  console.log('🚀 Bootstrapping E2E test environment...');
  
  dockerEnv = new DockerTestEnvironment(TEST_CONFIG.projectName, {
    serviceName: 'mcp-server',
    composeFile: 'docker-compose.yml',
    healthEndpoint: `${TEST_CONFIG.baseUrl}/health`,
    envVars: TEST_CONFIG.envVars
  });

  await dockerEnv.setup();
  console.log('✅ E2E test environment ready!');
}

/**
 * Cleanup function to tear down Docker environment after all tests
 * This function is called once after all tests complete
 */
export async function cleanupTestEnvironment(): Promise<void> {
  console.log('🧹 Cleaning up E2E test environment...');
  
  if (dockerEnv) {
    await dockerEnv.cleanup();
  }
  
  console.log('✅ E2E test environment cleanup complete!');
}

// Export utility function for getting container logs
export async function getContainerLogs(): Promise<string> {
  if (!dockerEnv) {
    throw new Error('Docker environment not initialized');
  }
  return dockerEnv.getContainerLogs();
}

// Export utility function for executing commands in container
export async function execInContainer(command: string): Promise<{ stdout: string; stderr: string }> {
  if (!dockerEnv) {
    throw new Error('Docker environment not initialized');
  }
  return dockerEnv.exec(command);
}