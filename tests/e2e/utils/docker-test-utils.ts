import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import http from 'http';

const execAsync = promisify(exec);

export interface DockerTestConfig {
  serviceName: string;
  composeFile: string;
  healthEndpoint?: string;
  healthCheckInterval?: number;
  maxHealthCheckAttempts?: number;
  envVars?: Record<string, string>;
}

export class DockerTestEnvironment {
  private projectName: string;
  private config: DockerTestConfig;
  private isRunning = false;

  constructor(projectName: string, config: DockerTestConfig) {
    this.projectName = projectName;
    this.config = {
      healthCheckInterval: 2000,
      maxHealthCheckAttempts: 30,
      ...config
    };
  }

  async setup(): Promise<void> {
    console.log(`🐳 Setting up Docker environment for ${this.projectName}...`);
    
    // Clean up any existing containers
    await this.cleanup();
    
    // Check if image exists, if not build it
    console.log('📦 Checking Docker image...');
    try {
      const checkCmd = `docker images -q systemprompt-test:latest`;
      const { stdout: imageId } = await execAsync(checkCmd);
      
      if (!imageId.trim()) {
        console.log('📦 Building Docker image...');
        const buildCmd = `docker build -t systemprompt-test:latest .`;
        const { stderr: buildError } = await execAsync(buildCmd);
        
        if (buildError && !buildError.includes('WARNING') && !buildError.includes('warning')) {
          throw new Error(`Docker build failed: ${buildError}`);
        }
      } else {
        console.log('✅ Using existing Docker image');
      }
    } catch (error) {
      console.error('Failed to check/build image:', error);
      throw error;
    }
    
    // Build environment variables list
    const envVarsList = [
      'NODE_ENV=test',
      'STATE_PATH=/data/state',
      'PROJECTS_PATH=/data/projects',
      'FILE_ROOT=/workspace',
      'CLAUDE_PROXY_HOST=host.docker.internal',
      'CLAUDE_PROXY_PORT=9876',
      'CLAUDE_AVAILABLE=false',
      'GIT_AVAILABLE=false'
    ];
    
    // Add all provided environment variables
    if (this.config.envVars) {
      Object.entries(this.config.envVars).forEach(([key, value]) => {
        envVarsList.push(`${key}=${value}`);
      });
    }
    
    // Create a temporary docker-compose file that uses the pre-built image
    const tempComposeContent = `
version: '3.8'

services:
  mcp-server:
    image: systemprompt-test:latest
    ports:
      - "${this.config.envVars?.PORT || 3001}:${this.config.envVars?.PORT || 3001}"
    environment:
${envVarsList.map(env => `      - ${env}`).join('\n')}
    volumes:
      - ${this.projectName}-state:/data/state
      - ${this.config.envVars?.HOST_FILE_ROOT || '/var/www/html/systemprompt-os'}:/workspace:rw
    restart: "no"

volumes:
  ${this.projectName}-state:
    driver: local
`;
    
    // Write the temporary compose file
    const tempDir = join(process.cwd(), '.test-temp');
    await mkdir(tempDir, { recursive: true });
    const tempComposeFile = join(tempDir, `${this.projectName}-compose.yml`);
    await writeFile(tempComposeFile, tempComposeContent);
    
    // Start the containers with the temporary compose file
    console.log('🚀 Starting containers...');
    const upCmd = `docker-compose -p ${this.projectName} -f ${tempComposeFile} up -d`;
    const { stderr: upError } = await execAsync(upCmd, {
      env: { ...process.env, ...this.config.envVars }
    });
    
    if (upError && !upError.includes('WARNING') && !upError.includes('warning')) {
      throw new Error(`Failed to start containers: ${upError}`);
    }
    
    this.isRunning = true;
    
    // Wait for health check if endpoint provided
    if (this.config.healthEndpoint) {
      await this.waitForHealthCheck();
    }
    
    console.log('✅ Docker environment ready!');
  }

  async cleanup(): Promise<void> {
    console.log(`🧹 Cleaning up Docker environment for ${this.projectName}...`);
    
    try {
      // Try to use the temporary compose file if it exists
      const tempComposeFile = join(process.cwd(), '.test-temp', `${this.projectName}-compose.yml`);
      let composeFile = this.config.composeFile;
      
      if (existsSync(tempComposeFile)) {
        composeFile = tempComposeFile;
      }
      
      // Stop and remove containers
      const downCmd = `docker-compose -p ${this.projectName} -f ${composeFile} down -v`;
      await execAsync(downCmd, {
        env: { ...process.env, ...this.config.envVars }
      });
      
      // Clean up temp files
      const tempDir = join(process.cwd(), '.test-temp');
      if (existsSync(tempDir)) {
        await rm(tempDir, { recursive: true, force: true });
      }
      
      this.isRunning = false;
      console.log('✅ Cleanup complete!');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
    }
  }

  async getContainerLogs(): Promise<string> {
    if (!this.isRunning) {
      return 'Container not running';
    }
    
    // Use the temporary compose file if it exists
    const tempComposeFile = join(process.cwd(), '.test-temp', `${this.projectName}-compose.yml`);
    const composeFile = existsSync(tempComposeFile) ? tempComposeFile : this.config.composeFile;
    
    const logsCmd = `docker-compose -p ${this.projectName} -f ${composeFile} logs ${this.config.serviceName}`;
    const { stdout } = await execAsync(logsCmd, {
      env: { ...process.env, ...this.config.envVars }
    });
    
    return stdout;
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.isRunning) {
      throw new Error('Container not running');
    }
    
    // Use the temporary compose file if it exists
    const tempComposeFile = join(process.cwd(), '.test-temp', `${this.projectName}-compose.yml`);
    const composeFile = existsSync(tempComposeFile) ? tempComposeFile : this.config.composeFile;
    
    const execCmd = `docker-compose -p ${this.projectName} -f ${composeFile} exec -T ${this.config.serviceName} ${command}`;
    return execAsync(execCmd, {
      env: { ...process.env, ...this.config.envVars }
    });
  }

  private async waitForHealthCheck(): Promise<void> {
    console.log(`⏳ Waiting for service health check at ${this.config.healthEndpoint}...`);
    
    let attempts = 0;
    const maxAttempts = this.config.maxHealthCheckAttempts!;
    const interval = this.config.healthCheckInterval!;
    
    const checkHealth = (): Promise<boolean> => {
      return new Promise((resolve) => {
        const url = new URL(this.config.healthEndpoint!);
        const options = {
          hostname: url.hostname,
          port: url.port || 80,
          path: url.pathname,
          method: 'GET',
          timeout: 5000
        };
        
        const req = http.request(options, (res) => {
          resolve(res.statusCode === 200);
        });
        
        req.on('error', () => {
          resolve(false);
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        
        req.end();
      });
    };
    
    while (attempts < maxAttempts) {
      const isHealthy = await checkHealth();
      if (isHealthy) {
        console.log('✅ Health check passed!');
        return;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    // Get container logs for debugging
    const logs = await this.getContainerLogs();
    throw new Error(`Health check failed after ${maxAttempts} attempts. Container logs:\n${logs}`);
  }
}

export async function createTempDockerCompose(
  content: string,
  projectName: string
): Promise<string> {
  const tempDir = join(process.cwd(), '.test-temp', projectName);
  await mkdir(tempDir, { recursive: true });
  
  const composePath = join(tempDir, 'docker-compose.yml');
  await writeFile(composePath, content);
  
  return composePath;
}

export async function cleanupTempFiles(projectName: string): Promise<void> {
  const tempDir = join(process.cwd(), '.test-temp', projectName);
  if (existsSync(tempDir)) {
    await rm(tempDir, { recursive: true, force: true });
  }
}