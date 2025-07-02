#!/usr/bin/env tsx

/**
 * Project Setup Script
 * Handles all initial setup required to run the systemprompt-coding-agent
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

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Required environment variables
const REQUIRED_ENV_VARS = [
  { name: 'PROJECT_ROOT', description: 'Project root directory for task execution' }
];

// Optional environment variables
const OPTIONAL_ENV_VARS = [
  { name: 'PORT', default: '3000', description: 'Server port' },
  { name: 'JWT_SECRET', description: 'JWT secret for authentication' },
  { name: 'STATE_PATH', description: 'State persistence path' },
  { name: 'PROJECTS_PATH', description: 'Projects directory for code execution' },
  { name: 'CLOUDFLARE_TOKEN', description: 'Cloudflare tunnel token for HTTPS' },
  { name: 'PUSH_TOKEN', description: 'Device push token for notifications' },
  { name: 'UID', default: '1000', description: 'User ID for Docker' },
  { name: 'GID', default: '1000', description: 'Group ID for Docker' }
];

class ProjectSetup {
  private errors: string[] = [];
  private rl: readline.Interface;
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  private log(message: string, color: string = colors.reset): void {
    console.log(`${color}${message}${colors.reset}`);
  }
  
  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
  
  private header(title: string): void {
    this.log(`\n==== ${title} ====\n`, colors.green);
  }
  
  private success(message: string): void {
    this.log(`✓ ${message}`, colors.green);
  }
  
  private error(message: string): void {
    this.log(`ERROR: ${message}`, colors.red);
    this.errors.push(message);
  }
  
  private warning(message: string): void {
    this.log(`WARNING: ${message}`, colors.yellow);
  }
  
  private info(message: string): void {
    this.log(`ℹ ${message}`, colors.blue);
  }
  
  private checkCommand(command: string): string | null {
    try {
      const result = execSync(`which ${command}`, { encoding: 'utf8' }).trim();
      return result || null;
    } catch {
      return null;
    }
  }
  
  private execCommand(command: string, cwd?: string): boolean {
    try {
      execSync(command, { 
        cwd: cwd || projectRoot,
        stdio: 'inherit'
      });
      return true;
    } catch {
      return false;
    }
  }
  
  async checkNodeVersion(): Promise<boolean> {
    this.header('Checking Node.js version');
    
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (majorVersion < 18) {
      this.error(`Node.js 18+ is required. Current version: ${nodeVersion}`);
      return false;
    }
    
    this.success(`Node.js ${nodeVersion} found`);
    return true;
  }
  
  async checkDocker(): Promise<boolean> {
    this.header('Checking Docker');
    
    const dockerPath = this.checkCommand('docker');
    
    if (!dockerPath) {
      this.error('Docker is not installed or not in PATH');
      this.info('Please install Docker from: https://docs.docker.com/get-docker/');
      return false;
    }
    
    // Check if docker compose (v2) is available
    try {
      execSync('docker compose version', { stdio: 'pipe' });
      this.success('Docker and Docker Compose are available');
      return true;
    } catch {
      // Fallback to docker-compose (v1)
      const dockerComposePath = this.checkCommand('docker-compose');
      if (!dockerComposePath) {
        this.error('Docker Compose is not available');
        this.info('Please ensure you have Docker Desktop or Docker Compose installed');
        return false;
      }
      this.success('Docker and docker-compose found');
      return true;
    }
  }
  
  async checkClaude(): Promise<{ path: string | null; available: boolean }> {
    this.header('Checking Claude CLI');
    
    const claudePath = this.checkCommand('claude');
    
    if (!claudePath) {
      this.warning('Claude CLI not found. Install from: https://github.com/anthropics/claude-cli');
      return { path: null, available: false };
    }
    
    // Test if Claude actually works
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
  
  async checkCloudflared(): Promise<boolean> {
    // Load environment variables to check if cloudflare is configured
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const hasCloudflareToken = envContent.includes('CLOUDFLARE_TOKEN=') && 
                                 !envContent.includes('CLOUDFLARE_TOKEN=your_cloudflare_tunnel_token_here');
      
      if (!hasCloudflareToken) {
        // Cloudflare not configured, skip check
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
  
  async createDirectories(): Promise<void> {
    this.header('Creating project directories');
    
    const dirs = ['logs', '.tmp', 'e2e-test/results', 'daemon/logs'];
    
    for (const dir of dirs) {
      const fullPath = path.join(projectRoot, dir);
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    this.success('Directories created');
  }
  
  async installHooks(): Promise<boolean> {
    // Hooks are no longer used - removed
    return true;
  }
  
  async installDependencies(): Promise<boolean> {
    this.header('Installing project dependencies');
    
    // Main dependencies
    if (!this.execCommand('npm install --no-audit --no-fund')) {
      this.error('Failed to install main dependencies');
      return false;
    }
    this.success('Main dependencies installed');
    
    // Daemon dependencies
    this.header('Installing daemon dependencies');
    if (!this.execCommand('npm install --no-audit --no-fund', path.join(projectRoot, 'daemon'))) {
      this.error('Failed to install daemon dependencies');
      return false;
    }
    this.success('Daemon dependencies installed');
    
    // E2E test dependencies
    this.header('Installing E2E test dependencies');
    if (!this.execCommand('npm install --no-audit --no-fund', path.join(projectRoot, 'e2e-test'))) {
      this.error('Failed to install E2E test dependencies');
      return false;
    }
    this.success('E2E test dependencies installed');
    
    return true;
  }
  
  async buildProject(): Promise<boolean> {
    this.header('Building TypeScript projects');
    
    // Build main project
    if (!this.execCommand('npm run build')) {
      this.error('Failed to build main project');
      return false;
    }
    
    // Build daemon
    if (!this.execCommand('npm run build', path.join(projectRoot, 'daemon'))) {
      this.error('Failed to build daemon');
      return false;
    }
    
    // Build scripts
    if (!this.execCommand('npm run build:scripts')) {
      this.error('Failed to build scripts');
      return false;
    }
    
    this.success('All TypeScript projects built');
    return true;
  }
  
  async checkEnvironmentFile(): Promise<boolean> {
    this.header('Checking environment configuration');
    
    const envPath = path.join(projectRoot, '.env');
    const envExamplePath = path.join(projectRoot, '.env.example');
    
    // Check if .env exists
    if (!fs.existsSync(envPath)) {
      this.warning('.env file not found');
      
      // Copy from .env.example
      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        this.success('Created .env file from .env.example');
      } else {
        this.error('.env.example not found');
        return false;
      }
    }
    
    // Load and validate environment variables
    dotenv.config({ path: envPath });
    
    let isValid = true;
    const envVars = dotenv.parse(fs.readFileSync(envPath));
    
    this.info('\nValidating environment variables:');
    
    // Check PROJECT_ROOT specifically
    let projectRootValue = envVars['PROJECT_ROOT'] || process.env['PROJECT_ROOT'];
    
    if (!projectRootValue || projectRootValue.includes('/path/to/') || projectRootValue.includes('your_')) {
      this.warning('PROJECT_ROOT is not set or contains placeholder value');
      this.info('PROJECT_ROOT is the directory where Claude Code will execute tasks');
      
      // Prompt for PROJECT_ROOT
      const suggestedPath = process.cwd();
      const answer = await this.prompt(`\nEnter PROJECT_ROOT path (default: ${suggestedPath}): `);
      projectRootValue = answer || suggestedPath;
      
      // Validate the path exists
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
      
      // Update .env file with PROJECT_ROOT
      let envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('PROJECT_ROOT=')) {
        envContent = envContent.replace(/PROJECT_ROOT=.*/g, `PROJECT_ROOT=${projectRootValue}`);
      } else {
        envContent += `\n# Project root directory for task execution\nPROJECT_ROOT=${projectRootValue}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      this.success(`Updated PROJECT_ROOT in .env file: ${projectRootValue}`);
      
      // Reload env vars
      dotenv.config({ path: envPath });
      envVars['PROJECT_ROOT'] = projectRootValue;
    } else {
      this.success(`  PROJECT_ROOT is set: ${projectRootValue}`);
    }
    
    // Check optional variables
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
  
  async run(): Promise<void> {
    this.log('🚀 SystemPrompt Coding Agent Setup', colors.cyan);
    this.log('==================================', colors.cyan);
    
    // Check Node.js
    if (!await this.checkNodeVersion()) {
      process.exit(1);
    }
    
    // Check Docker - required
    const dockerAvailable = await this.checkDocker();
    if (!dockerAvailable) {
      this.error('\nSetup cannot continue without Docker');
      process.exit(1);
    }
    
    // Check environment file first
    const envValid = await this.checkEnvironmentFile();
    if (!envValid) {
      this.error('\nSetup incomplete: Failed to configure environment');
      process.exit(1);
    }
    
    // Check Claude
    const claude = await this.checkClaude();
    
    // Check Cloudflared
    const cloudflaredAvailable = await this.checkCloudflared();
    
    // Create directories
    await this.createDirectories();
    
    // Install dependencies
    if (!await this.installDependencies()) {
      this.error('Failed to install dependencies');
      process.exit(1);
    }
    
    // Build projects
    if (!await this.buildProject()) {
      this.error('Failed to build projects');
      process.exit(1);
    }
    
    // Hooks are no longer used - removed
    
    // Final summary
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
    
    // Close readline interface
    this.rl.close();
  }
}

// Main entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const setup = new ProjectSetup();
  setup.run().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}