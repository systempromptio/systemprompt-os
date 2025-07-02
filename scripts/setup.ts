#!/usr/bin/env tsx

/**
 * @fileoverview SystemPrompt Coding Agent setup script
 * @module setup
 * @description Handles initial setup and configuration for the SystemPrompt Coding Agent,
 * including environment validation, dependency installation, and project building.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * ANSI color codes for terminal output
 * @const {Object}
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
} as const;

/**
 * @interface EnvVariable
 * @description Represents an environment variable configuration
 */
interface EnvVariable {
  name: string;
  description: string;
  default?: string;
}

/**
 * Required environment variables that must be configured
 * @const {EnvVariable[]}
 */
const REQUIRED_ENV_VARS: EnvVariable[] = [
  { name: 'PROJECT_ROOT', description: 'Project root directory for task execution' }
];

/**
 * Optional environment variables with defaults
 * @const {EnvVariable[]}
 */
const OPTIONAL_ENV_VARS: EnvVariable[] = [
  { name: 'PORT', default: '3000', description: 'MCP server port (Docker container external port)' },
  { name: 'CLAUDE_PROXY_PORT', default: '9876', description: 'Host Bridge Daemon port for Claude proxy' },
  { name: 'JWT_SECRET', description: 'JWT secret for authentication (optional)' },
  { name: 'PUSH_TOKEN', description: 'Device push token for notifications (for mobile app)' },
  { name: 'COMPOSE_PROJECT_NAME', default: 'systemprompt-coding-agent', description: 'Docker Compose project name' }
];

/**
 * @class ProjectSetup
 * @description Manages the complete setup process for the SystemPrompt Coding Agent
 */
class ProjectSetup {
  private errors: string[] = [];
  private rl: readline.Interface;
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  /**
   * Logs a message with optional color
   * @param {string} message - The message to log
   * @param {string} [color] - ANSI color code
   */
  private log(message: string, color: string = colors.reset): void {
    console.log(`${color}${message}${colors.reset}`);
  }
  
  /**
   * Logs an error message and tracks it
   * @param {string} message - The error message
   */
  private error(message: string): void {
    this.errors.push(message);
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
   * Logs a section header
   * @param {string} title - The header title
   */
  private header(title: string): void {
    this.log(`\n==== ${title} ====\n`, colors.green);
  }
  
  /**
   * Prompts the user for input
   * @param {string} question - The question to ask
   * @returns {Promise<string>} The user's response
   */
  private prompt(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }
  
  /**
   * Executes a shell command
   * @param {string} command - The command to execute
   * @param {string} [cwd] - Working directory for the command
   * @returns {boolean} Success status
   */
  private execCommand(command: string, cwd?: string): boolean {
    try {
      execSync(command, {
        cwd: cwd || projectRoot,
        stdio: 'inherit',
        shell: '/bin/bash'
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Checks if a command exists in the system PATH
   * @param {string} command - The command to check
   * @returns {string|null} Path to the command or null if not found
   */
  private checkCommand(command: string): string | null {
    try {
      const result = execSync(
        process.platform === 'win32' ? `where ${command}` : `which ${command}`,
        { encoding: 'utf-8', stdio: 'pipe' }
      ).trim();
      return result || null;
    } catch {
      return null;
    }
  }
  
  /**
   * Validates the Node.js version
   * @returns {Promise<boolean>} Whether Node.js version meets requirements
   */
  async checkNodeVersion(): Promise<boolean> {
    this.header('Checking Node.js version');
    
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (majorVersion < 18) {
      this.error(`Node.js v18+ required. Found: ${nodeVersion}`);
      this.info('Please upgrade Node.js: https://nodejs.org/');
      return false;
    }
    
    this.success(`Node.js ${nodeVersion} found`);
    return true;
  }
  
  /**
   * Checks Docker and Docker Compose availability
   * @returns {Promise<boolean>} Whether Docker is properly installed
   */
  async checkDocker(): Promise<boolean> {
    this.header('Checking Docker');
    
    const dockerPath = this.checkCommand('docker');
    const dockerComposePath = this.checkCommand('docker');
    
    if (!dockerPath) {
      this.error('Docker not found');
      this.info('Install Docker from: https://docs.docker.com/get-docker/');
      return false;
    }
    
    try {
      const composeWorks = this.execCommand('docker compose version', '/tmp');
      if (!composeWorks) {
        this.error('Docker Compose not working');
        this.info('Ensure Docker Compose v2 is installed');
        return false;
      }
    } catch {
      this.error('Docker Compose not available');
      return false;
    }
    
    this.success('Docker and Docker Compose are available');
    return true;
  }
  
  /**
   * Checks Claude CLI availability
   * @returns {Promise<{path: string | null; available: boolean}>} Claude CLI status
   */
  async checkClaude(): Promise<{ path: string | null; available: boolean }> {
    this.header('Checking Claude CLI');
    
    const claudePath = this.checkCommand('claude');
    
    if (!claudePath) {
      this.warning('Claude CLI not found. Install from: https://github.com/anthropics/claude-cli');
      return { path: null, available: false };
    }
    
    try {
      execSync(`${claudePath} --version`, { 
        timeout: 5000,
        stdio: 'pipe'
      });
      this.success(`Claude CLI found at: ${claudePath}`);
      return { path: claudePath, available: true };
    } catch {
      this.warning(`Claude found at ${claudePath} but not working properly`);
      return { path: claudePath, available: false };
    }
  }
  
  /**
   * Checks Cloudflare tunnel (cloudflared) availability
   * @returns {Promise<boolean>} Whether cloudflared is available
   */
  async checkCloudflared(): Promise<boolean> {
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const hasCloudflareToken = envContent.includes('CLOUDFLARE_TOKEN=') && 
                                 !envContent.includes('CLOUDFLARE_TOKEN=your_cloudflare_tunnel_token_here');
      
      if (!hasCloudflareToken) {
        return false;
      }
    }
    
    this.header('Checking Cloudflare Tunnel (cloudflared) - Optional');
    
    const cloudflaredPath = this.checkCommand('cloudflared');
    
    if (!cloudflaredPath) {
      this.info('Cloudflared not found (optional)');
      this.info('If you want to use Cloudflare tunnels, install cloudflared manually:');
      this.info('Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
      return false;
    } else {
      this.success(`Cloudflared found at: ${cloudflaredPath}`);
      return true;
    }
  }
  
  /**
   * Creates required project directories
   * @returns {Promise<void>}
   */
  async createDirectories(): Promise<void> {
    this.header('Creating project directories');
    
    const dirs = ['logs', '.tmp', 'e2e-test/results', 'daemon/logs'];
    
    for (const dir of dirs) {
      const fullPath = path.join(projectRoot, dir);
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    this.success('Directories created');
  }
  
  /**
   * Installs project dependencies
   * @returns {Promise<boolean>} Success status
   */
  async installDependencies(): Promise<boolean> {
    this.header('Installing project dependencies');
    
    if (!this.execCommand('npm install --no-audit --no-fund')) {
      this.error('Failed to install main dependencies');
      return false;
    }
    this.success('Main dependencies installed');
    
    this.header('Installing daemon dependencies');
    if (!this.execCommand('npm install --no-audit --no-fund', path.join(projectRoot, 'daemon'))) {
      this.error('Failed to install daemon dependencies');
      return false;
    }
    this.success('Daemon dependencies installed');
    
    this.header('Installing E2E test dependencies');
    if (!this.execCommand('npm install --no-audit --no-fund', path.join(projectRoot, 'e2e-test'))) {
      this.error('Failed to install E2E test dependencies');
      return false;
    }
    this.success('E2E test dependencies installed');
    
    return true;
  }
  
  /**
   * Builds the TypeScript projects
   * @returns {Promise<boolean>} Success status
   */
  async buildProject(): Promise<boolean> {
    this.header('Building TypeScript projects');
    
    if (!this.execCommand('npm run build')) {
      this.error('Failed to build main project');
      return false;
    }
    
    if (!this.execCommand('npm run build', path.join(projectRoot, 'daemon'))) {
      this.error('Failed to build daemon');
      return false;
    }
    
    if (!this.execCommand('npm run build:scripts')) {
      this.error('Failed to build scripts');
      return false;
    }
    
    this.success('All TypeScript projects built');
    return true;
  }
  
  /**
   * Validates and configures environment variables
   * @returns {Promise<boolean>} Success status
   */
  async checkEnvironmentFile(): Promise<boolean> {
    this.header('Checking environment configuration');
    
    const envPath = path.join(projectRoot, '.env');
    const envExamplePath = path.join(projectRoot, '.env.example');
    
    if (!fs.existsSync(envPath)) {
      this.warning('.env file not found');
      
      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        this.success('Created .env file from .env.example');
      } else {
        this.error('.env.example not found');
        return false;
      }
    }
    
    dotenv.config({ path: envPath });
    
    let isValid = true;
    const envVars = dotenv.parse(fs.readFileSync(envPath));
    
    this.info('\nValidating environment variables:');
    
    let projectRootValue = envVars['PROJECT_ROOT'] || process.env['PROJECT_ROOT'];
    
    if (!projectRootValue || projectRootValue.includes('/path/to/') || projectRootValue.includes('your_')) {
      this.warning('PROJECT_ROOT is not set or contains placeholder value');
      this.info('PROJECT_ROOT is the directory where Claude Code will execute tasks');
      
      const suggestedPath = process.cwd();
      const answer = await this.prompt(`\nEnter PROJECT_ROOT path (default: ${suggestedPath}): `);
      projectRootValue = answer || suggestedPath;
      
      if (!fs.existsSync(projectRootValue)) {
        this.error(`Path does not exist: ${projectRootValue}`);
        const create = await this.prompt('Would you like to create this directory? (y/N): ');
        if (create.toLowerCase() === 'y') {
          try {
            fs.mkdirSync(projectRootValue, { recursive: true });
            this.success(`Created directory: ${projectRootValue}`);
          } catch (err) {
            this.error(`Failed to create directory: ${err}`);
            return false;
          }
        } else {
          return false;
        }
      }
      
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('PROJECT_ROOT=')) {
        envContent = envContent.replace(/PROJECT_ROOT=.*/g, `PROJECT_ROOT=${projectRootValue}`);
      } else {
        envContent += `\n# Project root directory for task execution\nPROJECT_ROOT=${projectRootValue}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      this.success(`Updated PROJECT_ROOT in .env file: ${projectRootValue}`);
      
      dotenv.config({ path: envPath });
      envVars['PROJECT_ROOT'] = projectRootValue;
    } else {
      this.success(`  PROJECT_ROOT is set: ${projectRootValue}`);
    }
    
    this.info('\nOptional environment variables:');
    for (const { name, default: defaultValue, description } of OPTIONAL_ENV_VARS) {
      const value = envVars[name] || process.env[name];
      
      if (!value || value.includes('your_') || value.includes('_here')) {
        this.info(`  ${name} is not set (optional)`);
        if (defaultValue) {
          this.info(`    Will use default: ${defaultValue}`);
        }
      } else {
        this.success(`  ${name} is set`);
      }
    }
    
    return isValid;
  }
  
  /**
   * Runs the complete setup process
   * @returns {Promise<void>}
   */
  async run(): Promise<void> {
    this.log('🚀 SystemPrompt Coding Agent Setup', colors.cyan);
    this.log('==================================', colors.cyan);
    
    if (!await this.checkNodeVersion()) {
      process.exit(1);
    }
    
    const dockerAvailable = await this.checkDocker();
    if (!dockerAvailable) {
      this.error('\nSetup cannot continue without Docker');
      process.exit(1);
    }
    
    const envValid = await this.checkEnvironmentFile();
    if (!envValid) {
      this.error('\nSetup incomplete: Failed to configure environment');
      process.exit(1);
    }
    
    const claude = await this.checkClaude();
    const cloudflaredAvailable = await this.checkCloudflared();
    
    await this.createDirectories();
    
    if (!await this.installDependencies()) {
      this.error('Failed to install dependencies');
      process.exit(1);
    }
    
    if (!await this.buildProject()) {
      this.error('Failed to build projects');
      process.exit(1);
    }
    
    this.log('\n✨ Setup completed successfully!', colors.green);
    
    if (this.errors.length > 0) {
      this.warning('\nSome issues were encountered:');
      this.errors.forEach(err => this.error(`  - ${err}`));
    }
    
    this.log('\nNext steps:', colors.cyan);
    this.info('1. Review and update .env file if needed');
    this.info('2. Start the server: npm run start');
    this.info('3. Run tests: npm test');
    
    this.info('\nUseful commands:');
    this.success('  npm start          # Start all services');
    this.success('  npm run tunnel     # Start services with internet tunnel');
    this.success('  npm test           # Run all tests');
    this.success('  npm run logs       # View logs');
    this.success('  npm run status     # Check service status');
    
    if (!claude.available) {
      this.warning('\nNote: Claude CLI is not available.');
      this.info('Install Claude CLI for full functionality: npm install -g @anthropic-ai/claude-code');
    }
    
    if (cloudflaredAvailable) {
      this.info('\n✨ Cloudflare tunnel is available! Use "npm run tunnel" to expose your server.');
    } else {
      this.info('\nCloudflare tunnel not configured. To use tunnels:');
      this.info('1. Set CLOUDFLARE_TOKEN in .env');
      this.info('2. Install cloudflared from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
    }
    
    this.info('\nFor more information, see README.md');
    
    this.rl.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const setup = new ProjectSetup();
  setup.run().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}