import { DockerTestEnvironment } from '../utils/docker-test-utils.js';
import { config } from 'dotenv';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env file
config();

// Global Docker environment instance
export let dockerEnv: DockerTestEnvironment;

// Shared state file for test environment
const E2E_STATE_FILE = join(process.cwd(), '.test-temp', 'docker-e2e-state.json');

export function writeTestState(state: any): void {
  const tempDir = join(process.cwd(), '.test-temp');
  if (!existsSync(tempDir)) {
    require('fs').mkdirSync(tempDir, { recursive: true });
  }
  writeFileSync(E2E_STATE_FILE, JSON.stringify(state, null, 2));
}

export function readTestState(): any {
  if (!existsSync(E2E_STATE_FILE)) {
    throw new Error('Docker E2E test state not found. Make sure global setup has run.');
  }
  return JSON.parse(readFileSync(E2E_STATE_FILE, 'utf-8'));
}

export function getTestBaseUrl(): string {
  try {
    const testState = readTestState();
    return testState.baseUrl;
  } catch {
    // Fallback to localhost if state not available (for backwards compatibility)
    return 'http://localhost:3001';
  }
}

// Configuration for the Docker test environment
export const DOCKER_TEST_CONFIG = {
  baseUrl: process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'https://democontainer.systemprompt.io' : 'http://localhost:3001',
  testTimeout: 180000, // 3 minutes for Docker operations
  projectName: 'systemprompt-e2e-docker',
  envVars: {
    PORT: '3000', // Always use port 3000 inside the container
    BASE_URL: process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'https://democontainer.systemprompt.io' : 'http://localhost:3001',
    TUNNEL_URL: process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'https://democontainer.systemprompt.io' : '',
    OAUTH_DOMAIN: process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'https://democontainer.systemprompt.io' : 'http://localhost:3001',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-for-docker-e2e-testing',
    GOOGLE_CLIENT_ID: 'test-google-client',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
    GITHUB_CLIENT_ID: 'test-github-client',
    GITHUB_CLIENT_SECRET: 'test-github-secret',
    LOG_LEVEL: 'debug',
    PROJECT_ROOT: '/workspace',
    HOST_FILE_ROOT: '/var/www/html/systemprompt-os',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'test-gemini-api-key',
    ENABLE_OAUTH_TUNNEL: process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'true' : 'false',
    CLOUDFLARE_TUNNEL_TOKEN: process.env.CLOUDFLARE_TUNNEL_TOKEN || ''
  }
};

/**
 * Bootstrap function to initialize Docker environment for all e2e tests
 * This function is called once before all tests run
 */
export async function bootstrapDockerTestEnvironment(): Promise<void> {
  console.log('🚀 Bootstrapping Docker E2E test environment...');
  
  const baseUrl = process.env.CLOUDFLARE_TUNNEL_TOKEN 
    ? 'https://democontainer.systemprompt.io' 
    : 'http://localhost:3001';
  
  dockerEnv = new DockerTestEnvironment(DOCKER_TEST_CONFIG.projectName, {
    serviceName: 'mcp-server',
    composeFile: 'docker-compose.test.yml',
    healthEndpoint: `${baseUrl}/health`,
    envVars: DOCKER_TEST_CONFIG.envVars
  });

  await dockerEnv.setup();
  
  // Write state for test files to access
  writeTestState({
    projectName: DOCKER_TEST_CONFIG.projectName,
    baseUrl: baseUrl,
    isReady: true
  });
  
  console.log('✅ Docker E2E test environment ready!');
}

/**
 * Cleanup function to tear down Docker environment after all tests
 * This function is called once after all tests complete
 */
export async function cleanupDockerTestEnvironment(): Promise<void> {
  console.log('🧹 Cleaning up Docker E2E test environment...');
  
  if (dockerEnv) {
    await dockerEnv.cleanup();
  }
  
  console.log('✅ Docker E2E test environment cleanup complete!');
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
  // Create a temporary Docker environment instance for command execution
  const testState = readTestState();
  if (!testState.isReady) {
    throw new Error('Docker environment not ready');
  }
  
  const tempDockerEnv = new DockerTestEnvironment(testState.projectName, {
    serviceName: 'mcp-server',
    composeFile: 'docker-compose.test.yml',
    envVars: DOCKER_TEST_CONFIG.envVars
  });
  
  // Set it as running since global setup already started it
  (tempDockerEnv as any).isRunning = true;
  
  return tempDockerEnv.exec(command);
}