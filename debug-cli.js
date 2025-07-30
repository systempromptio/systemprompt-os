import { spawn } from 'child_process';
import { join } from 'path';
import process from 'process';

const TEST_SESSION_ID = `debug-${Date.now()}`;
const TEST_CONFIG = {
  tempDir: join(process.cwd(), '.test-integration', TEST_SESSION_ID),
  dbPath: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'test.db'),
  envVars: {
    NODE_ENV: 'test',
    DATABASE_FILE: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'test.db'),
    STATE_PATH: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'state'),
    PROJECTS_PATH: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'projects'),
    CONFIG_PATH: join(process.cwd(), '.test-integration', TEST_SESSION_ID, 'config'),
    LOG_LEVEL: 'error',
    JWT_SECRET: 'test-secret-key',
    PORT: '0',
    DISABLE_SERVER: 'true',
    TEST_SESSION_ID,
  }
};

async function execCLI(args) {
  return new Promise((resolve, reject) => {
    const env = { 
      ...process.env, 
      ...TEST_CONFIG.envVars 
    };
    
    console.log('Spawning CLI with args:', args);
    console.log('Environment vars:', TEST_CONFIG.envVars);
    
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
      reject(new Error(`Command timed out: ${args.join(' ')}`));
    }, 30000);
    
    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      resolve({ stdout, stderr, code: code || 0 });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

// Test the exact command that's failing
execCLI([
  'agents', 'create',
  '--name', `test-worker-${TEST_SESSION_ID}`,
  '--description', 'Test worker agent for integration testing', 
  '--instructions', 'Process tasks and report results',
  '--type', 'worker',
  '--format', 'json'
]).then(result => {
  console.log('Result:', result);
}).catch(err => {
  console.error('Error:', err);
});