#!/usr/bin/env node

/**
 * @fileoverview Unified startup script for SystemPrompt Coding Agent
 * @module start-all
 * @description Validates environment, starts proxy daemon, and launches Docker services
 * with proper environment configuration and health checks.
 */

import { ChildProcess, spawn, exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import * as net from 'net';
import * as dotenv from 'dotenv';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from .env file
dotenv.config({ path: path.join(projectRoot, '.env') });

/**
 * @interface ValidatedEnvironment
 * @description Environment configuration after validation
 */
interface ValidatedEnvironment {
  CLAUDE_PATH: string;
  GEMINI_PATH: string;
  SHELL_PATH: string;
  CLAUDE_AVAILABLE: string;
  GEMINI_AVAILABLE: string;
  CLAUDE_PROXY_HOST: string;
  CLAUDE_PROXY_PORT: string;
  MCP_PORT: string;
  HOST_FILE_ROOT: string;
  GIT_AVAILABLE: string;
  TUNNEL_URL?: string;
  TUNNEL_ENABLED?: string;
  PUBLIC_URL?: string;
  errors: string[];
}

/**
 * ANSI color codes for terminal output
 * @const {Object}
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
} as const;

/**
 * @class StartupManager
 * @description Manages the complete startup process for all services
 */
class StartupManager {
  private proxyProcess: ChildProcess | null = null;
  private dockerProcess: ChildProcess | null = null;
  
  /**
   * Logs a message with optional color
   * @param {string} message - The message to log
   * @param {string} [color] - ANSI color code
   */
  private log(message: string, color: string = colors.reset): void {
    console.log(`${color}${message}${colors.reset}`);
  }
  
  /**
   * Logs an error message
   * @param {string} message - The error message
   */
  private error(message: string): void {
    console.error(`${colors.red}ERROR: ${message}${colors.reset}`);
  }
  
  /**
   * Logs a success message
   * @param {string} message - The success message
   */
  private success(message: string): void {
    this.log(`✓ ${message}`, colors.green);
  }
  
  /**
   * Logs an info message
   * @param {string} message - The info message
   */
  private info(message: string): void {
    this.log(`ℹ ${message}`, colors.blue);
  }
  
  /**
   * Logs a warning message
   * @param {string} message - The warning message
   */
  private warning(message: string): void {
    this.log(`⚠ ${message}`, colors.yellow);
  }
  
  /**
   * Determines the appropriate Docker host based on platform
   * @returns {string} Docker host address
   */
  private getDockerHost(): string {
    // Always use host.docker.internal for Docker containers
    // This works on Mac, Windows, and WSL2
    return 'host.docker.internal';
  }

  /**
   * Validates the runtime environment
   * @returns {Promise<ValidatedEnvironment>} Validated environment configuration
   */
  async validateEnvironment(): Promise<ValidatedEnvironment> {
    this.log('\n==== Validating Environment ====\n', colors.blue);
    
    const errors: string[] = [];
    const env: ValidatedEnvironment = {
      CLAUDE_PATH: '',
      GEMINI_PATH: '',
      SHELL_PATH: '/bin/bash',
      CLAUDE_AVAILABLE: 'false',
      GEMINI_AVAILABLE: 'false',
      CLAUDE_PROXY_HOST: process.env.CLAUDE_PROXY_HOST || this.getDockerHost(),
      CLAUDE_PROXY_PORT: process.env.CLAUDE_PROXY_PORT || '9876',
      MCP_PORT: process.env.PORT || '3000',
      HOST_FILE_ROOT: projectRoot,
      GIT_AVAILABLE: 'false',
      errors: []
    };
    
    const claudeCommand = await this.findCommand('claude');
    if (claudeCommand) {
      env.CLAUDE_PATH = claudeCommand;
      env.CLAUDE_AVAILABLE = 'true';
      this.success(`Claude found at: ${claudeCommand}`);
    } else {
      this.warning('Claude not found');
      errors.push('Claude CLI not found - install from: https://github.com/anthropics/claude-cli');
    }
    
    const geminiCommand = await this.findCommand('gemini');
    if (geminiCommand) {
      env.GEMINI_PATH = geminiCommand;
      env.GEMINI_AVAILABLE = 'true';
      this.success(`Gemini found at: ${geminiCommand}`);
    } else {
      this.info('Gemini not found (optional)');
    }
    
    const shellPath = await this.findCommand('bash');
    if (shellPath) {
      env.SHELL_PATH = shellPath;
      this.success(`Shell found at: ${shellPath}`);
    } else {
      errors.push('Bash shell not found');
    }
    
    const dockerPath = await this.findCommand('docker');
    if (!dockerPath) {
      errors.push('Docker not found - install from: https://docs.docker.com/get-docker/');
    } else {
      this.success('Docker found');
    }
    
    const dockerComposePath = await this.findCommand('docker-compose') || await this.findCommand('docker');
    if (!dockerComposePath) {
      errors.push('Docker Compose not found');
    } else {
      this.success('docker-compose found');
    }
    
    try {
      const { stdout } = await execAsync('git status --porcelain -b', { cwd: projectRoot });
      env.GIT_AVAILABLE = 'true';
      this.success('Git repository detected');
    } catch {
      this.warning('Not a git repository - git operations will be disabled');
    }
    
    if (fs.existsSync(path.join(projectRoot, '.tunnel-url'))) {
      try {
        const tunnelUrl = fs.readFileSync(path.join(projectRoot, '.tunnel-url'), 'utf-8').trim();
        if (tunnelUrl) {
          env.TUNNEL_URL = tunnelUrl;
          env.TUNNEL_ENABLED = 'true';
          env.PUBLIC_URL = tunnelUrl;
          this.success(`Tunnel URL detected: ${tunnelUrl}`);
        }
      } catch (e) {
        this.warning('Failed to read tunnel URL');
      }
    }
    
    env.errors = errors;
    
    if (errors.length === 0) {
      this.success('\nAll validations passed!');
    } else {
      this.error(`\n${errors.length} validation error(s) found`);
    }
    
    return env;
  }
  
  /**
   * Finds a command in the system PATH
   * @param {string} command - Command to find
   * @returns {Promise<string|null>} Path to command or null
   */
  private async findCommand(command: string): Promise<string | null> {
    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      const which = spawn(isWindows ? 'where' : 'which', [command], {
        stdio: ['ignore', 'pipe', 'ignore']
      });
      
      let output = '';
      
      which.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      which.on('close', (code: number | null) => {
        if (code === 0 && output.trim()) {
          const firstLine = output.trim().split('\n')[0].trim();
          resolve(firstLine);
        } else {
          resolve(null);
        }
      });
    });
  }
  
  /**
   * Builds the daemon if needed
   * @returns {Promise<boolean>} Success status
   */
  async buildDaemon(): Promise<boolean> {
    this.log('\n==== Building Daemon ====\n', colors.blue);
    
    try {
      await execAsync('npm run build', {
        cwd: path.join(projectRoot, 'daemon'),
        shell: '/bin/bash'
      });
      this.success('Daemon built successfully');
      return true;
    } catch (error) {
      this.error(`Failed to build daemon: ${error}`);
      return false;
    }
  }
  
  /**
   * Starts the proxy daemon
   * @param {ValidatedEnvironment} env - Validated environment
   * @returns {Promise<boolean>} Success status
   */
  async startProxy(env: ValidatedEnvironment): Promise<boolean> {
    this.log('\n==== Starting Proxy ====\n', colors.blue);
    
    await this.killExistingProxy();
    
    const proxyEnv = {
      ...process.env,
      CLAUDE_PATH: env.CLAUDE_PATH,
      GEMINI_PATH: env.GEMINI_PATH || '',
      SHELL_PATH: env.SHELL_PATH,
      CLAUDE_AVAILABLE: env.CLAUDE_AVAILABLE,
      GEMINI_AVAILABLE: env.GEMINI_AVAILABLE || 'false',
      CLAUDE_PROXY_PORT: env.CLAUDE_PROXY_PORT,
      PATH: process.env.PATH
    };
    
    this.proxyProcess = spawn('node', [
      path.join(projectRoot, 'daemon', 'dist', 'host-bridge-daemon.js')
    ], {
      env: proxyEnv,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    this.proxyProcess.on('error', (err) => {
      this.error(`Failed to start proxy: ${err.message}`);
    });
    
    this.proxyProcess.on('exit', (code, signal) => {
      if (code !== null) {
        this.error(`Proxy exited with code ${code}`);
      } else if (signal !== null) {
        this.info(`Proxy terminated by signal ${signal}`);
      }
    });
    
    this.proxyProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[DAEMON] ${message}`);
      }
    });
    
    this.proxyProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.error(`[DAEMON ERROR] ${message}`);
      }
    });
    
    const success = await this.waitForPort(parseInt(env.CLAUDE_PROXY_PORT), 10);
    
    if (success) {
      const pidFile = path.join(projectRoot, 'daemon', 'logs', 'daemon.pid');
      fs.mkdirSync(path.dirname(pidFile), { recursive: true });
      fs.writeFileSync(pidFile, this.proxyProcess.pid!.toString());
      this.success(`Daemon started (PID: ${this.proxyProcess.pid})`);
    }
    
    return success;
  }
  
  /**
   * Kills any existing proxy daemon
   * @returns {Promise<void>}
   */
  private async killExistingProxy(): Promise<void> {
    const pidFile = path.join(projectRoot, 'daemon', 'logs', 'daemon.pid');
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
      try {
        process.kill(pid, 'SIGTERM');
        this.info(`Killed existing daemon (PID: ${pid})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        // Process doesn't exist
      }
      fs.unlinkSync(pidFile);
    }
  }
  
  /**
   * Waits for a port to become available
   * @param {number} port - Port number
   * @param {number} maxAttempts - Maximum attempts
   * @returns {Promise<boolean>} Success status
   */
  private async waitForPort(port: number, maxAttempts: number): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isPortOpen(port)) {
        this.success(`Daemon is listening on port ${port}`);
        return true;
      }
      this.info(`Waiting for daemon to start... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.error(`Daemon failed to start on port ${port}`);
    return false;
  }
  
  /**
   * Checks if a port is open
   * @param {number} port - Port to check
   * @returns {Promise<boolean>} Whether port is open
   */
  private isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      
      client.setTimeout(1000);
      client.once('connect', () => {
        client.destroy();
        resolve(true);
      });
      
      client.once('error', () => {
        client.destroy();
        resolve(false);
      });
      
      client.once('timeout', () => {
        client.destroy();
        resolve(false);
      });
      
      client.connect(port, '127.0.0.1');
    });
  }
  
  /**
   * Verifies setup has been completed
   * @returns {Promise<boolean>} Whether setup is complete
   */
  private async verifySetupComplete(): Promise<boolean> {
    const envPath = path.join(projectRoot, '.env');
    if (!fs.existsSync(envPath)) {
      this.error('.env file not found');
      return false;
    }
    
    const buildPath = path.join(projectRoot, 'build');
    if (!fs.existsSync(buildPath)) {
      this.error('Build directory not found');
      return false;
    }
    
    const daemonPath = path.join(projectRoot, 'daemon', 'dist', 'host-bridge-daemon.js');
    if (!fs.existsSync(daemonPath)) {
      this.error('Daemon not built');
      return false;
    }
    
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      this.error('Dependencies not installed');
      return false;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf-8');
    if (!envContent.includes('PROJECT_ROOT=') || envContent.includes('PROJECT_ROOT=/path/to/')) {
      this.error('PROJECT_ROOT not configured in .env');
      return false;
    }
    
    return true;
  }
  
  /**
   * Performs pre-flight checks
   * @param {ValidatedEnvironment} env - Environment configuration
   * @returns {Promise<boolean>} Whether all checks pass
   */
  private async performPreChecks(env: ValidatedEnvironment): Promise<boolean> {
    this.log('\n==== Pre-flight Checks ====\n', colors.blue);
    let allChecksPass = true;
    
    if (await this.isPortOpen(parseInt(env.CLAUDE_PROXY_PORT))) {
      this.error(`Port ${env.CLAUDE_PROXY_PORT} is already in use`);
      
      // Check if it's our daemon or another process
      try {
        const { stdout } = await execAsync(
          `lsof -i :${env.CLAUDE_PROXY_PORT} -t 2>/dev/null || netstat -tlnp 2>/dev/null | grep :${env.CLAUDE_PROXY_PORT} | awk '{print $7}' | cut -d'/' -f1`
        );
        const pid = stdout.trim();
        
        if (pid) {
          const { stdout: cmdOutput } = await execAsync(`ps -p ${pid} -o command= 2>/dev/null || true`);
          const command = cmdOutput.trim();
          
          if (command && command.includes('host-bridge-daemon.js')) {
            this.info(`  Daemon is already running (PID: ${pid})`);
            
            // Check if it's from this installation
            if (command.includes(projectRoot)) {
              this.info(`  This is our daemon - run "npm run stop" first`);
            } else {
              this.info(`  This is from another installation`);
              this.info(`  Consider using different ports in .env file`);
            }
          } else {
            this.info(`  Another process is using this port`);
          }
        }
      } catch (e) {
        // Couldn't determine what's using the port
        this.info(`  Could not determine what process is using the port`);
      }
      
      const pidFile = path.join(projectRoot, 'daemon', 'logs', 'daemon.pid');
      if (fs.existsSync(pidFile)) {
        const pid = fs.readFileSync(pidFile, 'utf-8').trim();
        this.info(`  Found daemon PID file with PID: ${pid}`);
      }
      
      this.info(`  Run "npm run stop" to stop existing services`);
      allChecksPass = false;
    } else {
      this.success(`Port ${env.CLAUDE_PROXY_PORT} is available`);
    }
    
    if (await this.isPortOpen(parseInt(env.MCP_PORT))) {
      this.warning(`Port ${env.MCP_PORT} is in use (likely Docker services already running)`);
    } else {
      this.success(`Port ${env.MCP_PORT} is available`);
    }
    
    try {
      await execAsync('docker info', { timeout: 5000 });
      this.success('Docker daemon is running');
    } catch {
      this.error('Docker daemon is not running');
      this.info('  Start Docker Desktop or run: sudo systemctl start docker');
      allChecksPass = false;
    }
    
    if (env.CLAUDE_AVAILABLE === 'false') {
      this.warning('Claude CLI not configured');
      this.info('  Coding agent functionality will be limited');
    }
    
    const testDir = path.join(projectRoot, 'test-write-permissions');
    try {
      fs.mkdirSync(testDir);
      fs.rmdirSync(testDir);
      this.success('Write permissions verified');
    } catch (e) {
      this.error('No write permissions in project directory');
      allChecksPass = false;
    }
    
    return allChecksPass;
  }
  
  /**
   * Starts Docker services
   * @param {ValidatedEnvironment} env - Environment configuration
   * @returns {Promise<boolean>} Success status
   */
  async startDocker(env: ValidatedEnvironment): Promise<boolean> {
    this.log('\n==== Starting Docker Services ====\n', colors.blue);
    
    // Create a clean env object without the errors array
    const { errors, ...cleanEnv } = env;
    
    // Don't pass CLAUDE_PROXY_HOST to Docker - let docker-compose use its default (host.docker.internal)
    const { CLAUDE_PROXY_HOST, ...cleanEnvWithoutHost } = cleanEnv;
    
    const dockerEnv = {
      ...process.env,
      ...cleanEnvWithoutHost,
      HOST_FILE_ROOT: projectRoot,
      DAEMON_HOST: 'host.docker.internal', // Always use host.docker.internal for Docker
      DAEMON_PORT: env.CLAUDE_PROXY_PORT,
      CLAUDE_PROXY_PORT: env.CLAUDE_PROXY_PORT, // Pass the port
      CLAUDE_AVAILABLE: env.CLAUDE_AVAILABLE, // Pass Claude availability
      CLAUDE_PATH: env.CLAUDE_PATH, // Pass Claude path for reference
      PROJECT_ROOT: projectRoot,
      COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME || 'systemprompt-coding-agent'
    };
    
    try {
      const skipBuild = process.env.SKIP_DOCKER_BUILD === 'true';
      
      if (!skipBuild) {
        this.info('Building Docker image with latest code...');
        this.info('(Set SKIP_DOCKER_BUILD=true to skip this step)');
        await execAsync('docker compose build mcp-server', {
          cwd: projectRoot,
          env: dockerEnv,
          shell: '/bin/bash'
        });
        this.success('Docker image built with latest code');
      } else {
        this.warning('Skipping Docker build (SKIP_DOCKER_BUILD=true)');
      }
      
      this.info('Starting Docker services...');
      await execAsync('docker compose up -d', {
        cwd: projectRoot,
        env: dockerEnv,
        shell: '/bin/bash'
      });
      this.success('Docker services started');
      return true;
    } catch (error) {
      this.error(`Failed to start Docker services: ${error}`);
      return false;
    }
  }
  
  /**
   * Runs the complete startup process
   * @returns {Promise<void>}
   */
  async start(): Promise<void> {
    try {
      const env = await this.validateEnvironment();
      
      if (env.errors.length > 0) {
        this.error('\nCannot start due to validation errors');
        this.error('\nPlease fix the following issues:');
        env.errors.forEach(err => this.error(`  • ${err}`));
        this.info('\nRun "npm run setup" to configure your environment');
        process.exit(1);
      }
      
      if (!await this.performPreChecks(env)) {
        this.error('\nPre-flight checks failed. Cannot continue.');
        process.exit(1);
      }
      
      if (!await this.verifySetupComplete()) {
        this.error('\nSetup has not been completed!');
        this.error('Please run "npm run setup" first to configure the environment.');
        process.exit(1);
      }
      
      const daemonPath = path.join(projectRoot, 'daemon', 'dist', 'host-bridge-daemon.js');
      if (!fs.existsSync(daemonPath)) {
        this.error('Daemon not found. Please run "npm run setup" first.');
        process.exit(1);
      }
      
      if (!await this.startProxy(env)) {
        this.error('Failed to start proxy');
        process.exit(1);
      }
      
      if (!await this.startDocker(env)) {
        this.error('Failed to start Docker services');
        process.exit(1);
      }
      
      this.log('\n==== Services Started Successfully ====\n', colors.green);
      this.success(`MCP server running at: http://localhost:${env.MCP_PORT}`);
      this.success(`Daemon running on port: ${env.CLAUDE_PROXY_PORT}`);
      
      if (env.TUNNEL_URL) {
        this.success(`Tunnel URL: ${env.TUNNEL_URL}`);
      }
      
      this.info('\nTo check status: npm run status');
      this.info('To view logs: npm run logs');
      this.info('To stop: npm run stop');
      
      this.info('\nPress Ctrl+C to stop all services');
      
      process.on('SIGINT', () => {
        this.info('\nShutting down services...');
        if (this.proxyProcess) {
          this.proxyProcess.kill('SIGTERM');
        }
        process.exit(0);
      });
      
    } catch (error) {
      this.error(`Startup failed: ${error}`);
      process.exit(1);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manager = new StartupManager();
  manager.start();
}