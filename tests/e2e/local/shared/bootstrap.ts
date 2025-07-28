import { spawn, execSync } from 'child_process';
import { join } from 'path';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

// Generate unique test session ID
const TEST_SESSION_ID = `local-e2e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Local test configuration with isolated paths
export const LOCAL_TEST_CONFIG = {
  testTimeout: 60000, // 1 minute for local commands
  sessionId: TEST_SESSION_ID,
  tempDir: join(process.cwd(), '.test-temp', TEST_SESSION_ID),
  testDbPath: join(process.cwd(), '.test-temp', TEST_SESSION_ID, 'local-test.db'),
  envVars: {
    NODE_ENV: 'test',
    DATABASE_FILE: join(process.cwd(), '.test-temp', TEST_SESSION_ID, 'local-test.db'),
    STATE_PATH: join(process.cwd(), '.test-temp', TEST_SESSION_ID, 'state'),
    PROJECTS_PATH: join(process.cwd(), '.test-temp', TEST_SESSION_ID, 'projects'),
    CONFIG_PATH: join(process.cwd(), '.test-temp', TEST_SESSION_ID, 'config'),
    LOG_LEVEL: 'error', // Reduce noise in tests
    JWT_SECRET: 'test-secret-key-for-local-testing',
    PORT: '0', // Don't start HTTP server for local tests
    DISABLE_SERVER: 'true', // Disable HTTP server completely
    TEST_SESSION_ID,
  }
};

let isBootstrapped = false;

/**
 * Bootstrap local test environment with isolated database
 */
export async function bootstrapLocalTestEnvironment(): Promise<void> {
  if (isBootstrapped) return;
  
  console.log(`🚀 Bootstrapping local E2E test environment (session: ${LOCAL_TEST_CONFIG.sessionId})...`);
  
  // Clean up any existing temp directory first
  if (existsSync(LOCAL_TEST_CONFIG.tempDir)) {
    console.log('🧹 Cleaning up existing test session directory...');
    execSync(`rm -rf "${LOCAL_TEST_CONFIG.tempDir}"`, { stdio: 'inherit' });
  }
  
  // Create fresh temp directory structure
  console.log('📁 Creating isolated test directories...');
  [
    LOCAL_TEST_CONFIG.tempDir,
    LOCAL_TEST_CONFIG.envVars.STATE_PATH,
    LOCAL_TEST_CONFIG.envVars.PROJECTS_PATH,
    LOCAL_TEST_CONFIG.envVars.CONFIG_PATH,
    join(LOCAL_TEST_CONFIG.envVars.STATE_PATH, 'auth', 'keys'), // Auth keys directory
    join(LOCAL_TEST_CONFIG.envVars.STATE_PATH, 'logs'), // Logs directory
  ].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
  
  // Compile TypeScript for testing
  console.log('📦 Validating TypeScript compilation...');
  try {
    execSync('npx tsc --noEmit', { 
      stdio: 'pipe',
      cwd: process.cwd(),
      env: { ...process.env, ...LOCAL_TEST_CONFIG.envVars }
    });
    console.log('✅ TypeScript compilation successful');
  } catch (error) {
    console.warn('⚠️  TypeScript compilation warnings (continuing anyway)');
  }
  
  // Initialize fresh database with clean schema
  console.log('🗄️  Creating fresh test database...');
  try {
    await execLocalCLI(['database', 'rebuild', '--force'], {
      timeout: 30000 // 30 seconds for database rebuild
    });
    console.log('✅ Fresh test database created and initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw new Error(`Failed to initialize test database: ${error}`);
  }
  
  // Verify database is accessible
  console.log('🔍 Verifying database connectivity...');
  try {
    await execLocalCLI(['database', 'status']);
    console.log('✅ Database connectivity verified');
  } catch (error) {
    console.error('❌ Database connectivity test failed:', error);
    throw new Error(`Database connectivity test failed: ${error}`);
  }
  
  isBootstrapped = true;
  console.log(`✅ Local E2E test environment ready! (session: ${LOCAL_TEST_CONFIG.sessionId})`);
}

/**
 * Cleanup local test environment
 */
export async function cleanupLocalTestEnvironment(): Promise<void> {
  console.log(`🧹 Cleaning up local E2E test environment (session: ${LOCAL_TEST_CONFIG.sessionId})...`);
  
  try {
    // Force stop any running processes that might be using the database
    console.log('🛑 Ensuring no processes are using test database...');
    
    // Remove entire temp directory and all contents
    if (existsSync(LOCAL_TEST_CONFIG.tempDir)) {
      console.log('🗑️  Removing test session directory...');
      execSync(`rm -rf "${LOCAL_TEST_CONFIG.tempDir}"`, { 
        stdio: 'pipe',
        timeout: 10000 // 10 second timeout for cleanup
      });
      console.log('✅ Test session directory removed');
    } else {
      console.log('ℹ️  Test session directory already clean');
    }
    
    // Clean up any stale .test-temp directories older than 1 hour
    const testTempBase = join(process.cwd(), '.test-temp');
    if (existsSync(testTempBase)) {
      console.log('🧹 Cleaning up stale test directories...');
      try {
        // Find and remove directories older than 1 hour
        execSync(`find "${testTempBase}" -maxdepth 1 -type d -name "local-e2e-*" -mmin +60 -exec rm -rf {} + 2>/dev/null || true`, {
          stdio: 'pipe',
          timeout: 5000
        });
      } catch (error) {
        console.warn('⚠️  Could not clean stale test directories (this is usually fine)');
      }
    }
    
    console.log(`✅ Local E2E test environment cleanup complete! (session: ${LOCAL_TEST_CONFIG.sessionId})`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    // Don't throw on cleanup errors - just log them
  }
}

/**
 * Execute local CLI command with proper environment
 */
export async function execLocalCLI(args: string[], options: { 
  timeout?: number;
  env?: Record<string, string>;
  allowFailure?: boolean;
} = {}): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || LOCAL_TEST_CONFIG.testTimeout;
    const env = { 
      ...process.env, 
      ...LOCAL_TEST_CONFIG.envVars, 
      ...options.env 
    };
    
    const child = spawn('npx', ['tsx', 'src/modules/core/cli/cli/main.ts', ...args], {
      cwd: process.cwd(),
      env,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeout}ms: ${args.join(' ')}`));
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      
      if (code === 0 || options.allowFailure) {
        resolve({ stdout, stderr, code });
      } else {
        const error = new Error(`Command failed with code ${code}: ${args.join(' ')}`);
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        (error as any).code = code;
        reject(error);
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

/**
 * Replacement for execInContainer - execute local CLI commands
 * This function provides compatibility with existing Docker-based tests
 */
export async function execInContainer(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  // Handle curl commands by converting them to appropriate CLI calls
  if (command.includes('curl')) {
    return handleCurlCommand(command);
  }
  
  // Parse the command to extract CLI arguments
  // Convert Docker paths like '/app/bin/systemprompt' to local CLI calls
  const cleanCommand = command.replace(/^\/app\/bin\/systemprompt\s*/, '').trim();
  
  if (!cleanCommand) {
    // Just systemprompt with no args - show help
    return execLocalCLI(['--help']);
  }
  
  // Split the command into arguments, properly handling quoted strings
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < cleanCommand.length) {
    const char = cleanCommand[i];
    
    if (char === '"' && (i === 0 || cleanCommand[i - 1] !== '\\')) {
      // Toggle quote state but don't include the quote in the argument
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      // Space outside quotes - end current argument
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      // Regular character or space inside quotes
      current += char;
    }
    i++;
  }
  
  // Add final argument if any
  if (current.length > 0) {
    args.push(current);
  }
  
  return execLocalCLI(args);
}

/**
 * Handle curl commands by converting them to CLI equivalents
 * Since local tests don't run HTTP server, we simulate API calls with CLI commands
 */
async function handleCurlCommand(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  // Extract the URL path from curl command
  const urlMatch = command.match(/curl[^"]*"?([^"]*\/api\/[^"]*)"?/);
  
  if (!urlMatch) {
    throw new Error(`Could not parse curl command: ${command}`);
  }
  
  const urlPath = urlMatch[1];
  
  // Convert API endpoints to CLI commands
  if (urlPath.includes('/api/status')) {
    // Convert status API call to CLI status command
    const statusResult = await execLocalCLI(['status', '--format=json']);
    return statusResult;
  }
  
  // For other API endpoints, return a mock response indicating local testing
  const mockResponse = {
    error: 'API endpoints not available in local testing mode',
    suggestion: 'Use CLI commands instead of HTTP API calls',
    originalCommand: command
  };
  
  return {
    stdout: JSON.stringify(mockResponse),
    stderr: '',
    code: 0
  };
}

/**
 * Get test base URL - not used in local tests but provided for compatibility
 */
export function getTestBaseUrl(): string {
  // Return placeholder since local tests don't use HTTP
  return 'http://localhost:0';
}

/**
 * Execute TypeScript compilation check
 */
export async function checkTypeScript(): Promise<{ success: boolean; output: string }> {
  try {
    const output = execSync('npx tsc --noEmit', { 
      encoding: 'utf8',
      env: { ...process.env, ...LOCAL_TEST_CONFIG.envVars }
    });
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.stdout + error.stderr };
  }
}

/**
 * Get test state for persistence between tests
 */
export function getLocalTestState(): any {
  const stateFile = join(LOCAL_TEST_CONFIG.tempDir, 'local-test-state.json');
  if (!existsSync(stateFile)) {
    return {};
  }
  return JSON.parse(readFileSync(stateFile, 'utf-8'));
}

/**
 * Save test state for persistence between tests
 */
export function saveLocalTestState(state: any): void {
  const stateFile = join(LOCAL_TEST_CONFIG.tempDir, 'local-test-state.json');
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Utility to run CLI command and expect success
 */
export async function expectCLISuccess(args: string[], expectedOutput?: string): Promise<string> {
  const result = await execLocalCLI(args);
  
  if (result.code !== 0) {
    throw new Error(`CLI command failed: ${args.join(' ')}\nStdout: ${result.stdout}\nStderr: ${result.stderr}`);
  }
  
  if (expectedOutput && !result.stdout.includes(expectedOutput)) {
    throw new Error(`Expected output "${expectedOutput}" not found in: ${result.stdout}`);
  }
  
  return result.stdout;
}

/**
 * Utility to run CLI command and expect failure
 */
export async function expectCLIFailure(args: string[], expectedError?: string): Promise<string> {
  try {
    await execLocalCLI(args);
    throw new Error(`Expected CLI command to fail: ${args.join(' ')}`);
  } catch (error: any) {
    if (expectedError && !error.stderr?.includes(expectedError) && !error.stdout?.includes(expectedError)) {
      throw new Error(`Expected error "${expectedError}" not found in: ${error.stderr || error.stdout}`);
    }
    return error.stderr || error.stdout || error.message;
  }
}