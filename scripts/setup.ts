#!/usr/bin/env tsx

/**
 * @fileoverview SystemPrompt Coding Agent setup script
 * @module setup
 * @description Handles initial setup and configuration for the SystemPrompt Coding Agent,
 * including environment validation, dependency installation, and project building.
 */

import { execSync, exec, ExecSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * ANSI color codes for terminal output
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
 * Supported platforms for the setup script
 */
type Platform = 'wsl' | 'macos' | 'windows' | 'linux';

/**
 * Represents an environment variable configuration
 */
interface EnvVariable {
  /** The name of the environment variable */
  name: string;
  /** Human-readable description of the variable */
  description: string;
  /** Default value if not set */
  default?: string;
}

/**
 * Result of checking a CLI tool
 */
interface ToolCheckResult {
  /** Path to the tool executable */
  path: string | null;
  /** Whether the tool is available and working */
  available: boolean;
  /** Tool version if available */
  version?: string;
}

/**
 * Required environment variables that must be configured
 */
const REQUIRED_ENV_VARS: readonly EnvVariable[] = [
  { name: 'PROJECT_ROOT', description: 'Project root directory for task execution' }
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS: readonly EnvVariable[] = [
  { name: 'PORT', default: '3000', description: 'MCP server port (Docker container external port)' },
  { name: 'CLAUDE_PROXY_PORT', default: '9876', description: 'Host Bridge Daemon port for Claude proxy' },
  { name: 'JWT_SECRET', description: 'JWT secret for authentication (optional)' },
  { name: 'PUSH_TOKEN', description: 'Device push token for notifications (for mobile app)' },
  { name: 'COMPOSE_PROJECT_NAME', default: 'systemprompt-coding-agent', description: 'Docker Compose project name' }
] as const;

/**
 * Tool-related environment variables that are auto-detected
 */
const TOOL_ENV_VARS: readonly EnvVariable[] = [
  { name: 'CLAUDE_PATH', description: 'Path to Claude CLI executable' },
  { name: 'GEMINI_PATH', description: 'Path to Gemini CLI executable' },
  { name: 'SHELL_PATH', default: '/bin/bash', description: 'Shell path for command execution' },
  { name: 'CLAUDE_AVAILABLE', default: 'false', description: 'Whether Claude CLI is available' },
  { name: 'GEMINI_AVAILABLE', default: 'false', description: 'Whether Gemini CLI is available' }
] as const;

/**
 * Manages the complete setup process for the SystemPrompt Coding Agent
 */
class ProjectSetup {
  private readonly errors: string[] = [];
  private readonly rl: readline.Interface;
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  /**
   * Logs a message with optional color
   * @param message - The message to log
   * @param color - ANSI color code
   */
  private log(message: string, color: string = colors.reset): void {
    console.log(`${color}${message}${colors.reset}`);
  }
  
  /**
   * Logs an error message and tracks it
   * @param message - The error message
   */
  private error(message: string): void {
    this.errors.push(message);
    console.error(`${colors.red}ERROR: ${message}${colors.reset}`);
  }
  
  /**
   * Logs a success message
   * @param message - The success message
   */
  private success(message: string): void {
    this.log(`✓ ${message}`, colors.green);
  }
  
  /**
   * Logs an info message
   * @param message - The info message
   */
  private info(message: string): void {
    this.log(`ℹ ${message}`, colors.blue);
  }
  
  /**
   * Logs a warning message
   * @param message - The warning message
   */
  private warning(message: string): void {
    this.log(`⚠ ${message}`, colors.yellow);
  }
  
  /**
   * Logs a section header
   * @param title - The header title
   */
  private header(title: string): void {
    this.log(`\n==== ${title} ====\n`, colors.green);
  }
  
  /**
   * Prompts the user for input
   * @param question - The question to ask
   * @returns The user's response
   */
  private prompt(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }
  
  /**
   * Detects the current platform
   * @returns The detected platform
   */
  private detectPlatform(): Platform {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      return 'macos';
    }
    
    if (platform === 'win32') {
      return 'windows';
    }
    
    // Check if running in WSL
    try {
      const osRelease = fs.readFileSync('/proc/version', 'utf-8');
      if (osRelease.toLowerCase().includes('microsoft')) {
        return 'wsl';
      }
    } catch {
      // Not WSL
    }
    
    return 'linux';
  }
  
  /**
   * Gets the appropriate host IP for Docker connectivity based on platform
   * @returns The host IP address
   */
  private async getDockerHostIP(): Promise<string> {
    const platform = this.detectPlatform();
    
    switch (platform) {
      case 'wsl':
        // In WSL2, we need the WSL2 VM's IP address
        try {
          const result = execSync('ip addr show eth0 | grep "inet " | awk \'{print $2}\' | cut -d/ -f1', {
            encoding: 'utf-8'
          }).trim();
          if (result) {
            this.info(`Detected WSL2 host IP: ${result}`);
            return result;
          }
        } catch {
          this.warning('Could not detect WSL2 host IP, using default');
        }
        return 'host.docker.internal';
        
      case 'macos':
      case 'windows':
        // Docker Desktop provides host.docker.internal
        return 'host.docker.internal';
        
      case 'linux':
        // Native Linux can use host network mode or bridge IP
        try {
          // Try to get the docker0 bridge IP
          const result = execSync('ip addr show docker0 | grep "inet " | awk \'{print $2}\' | cut -d/ -f1', {
            encoding: 'utf-8'
          }).trim();
          if (result) {
            this.info(`Detected Docker bridge IP: ${result}`);
            return result;
          }
        } catch {
          // docker0 might not exist yet
        }
        return '172.17.0.1'; // Default Docker bridge gateway
    }
  }
  
  /**
   * Executes a shell command safely
   * @param command - The command to execute
   * @param options - Execution options
   * @returns The command output or null on failure
   */
  private execCommandSafe(command: string, options: ExecSyncOptions = {}): string | null {
    try {
      const result = execSync(command, {
        encoding: 'utf-8',
        stdio: 'pipe',
        ...options
      });
      return result.toString().trim();
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status !== 0) {
        // Command failed with non-zero exit code
        return null;
      }
      throw error; // Re-throw actual errors
    }
  }
  
  /**
   * Executes a shell command with output
   * @param command - The command to execute
   * @param cwd - Working directory for the command
   * @returns Success status
   */
  private execCommand(command: string, cwd?: string): boolean {
    try {
      execSync(command, {
        cwd: cwd || projectRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
      });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Checks if a command exists in the system PATH
   * @param command - The command to check
   * @returns Path to the command or null if not found
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
   * @returns Whether Node.js version meets requirements
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
   * @returns Whether Docker is properly installed
   */
  async checkDocker(): Promise<boolean> {
    this.header('Checking Docker');
    
    const dockerPath = this.checkCommand('docker');
    
    if (!dockerPath) {
      this.error('Docker not found');
      this.info('Install Docker from: https://docs.docker.com/get-docker/');
      return false;
    }
    
    const composeVersion = this.execCommandSafe('docker compose version');
    if (!composeVersion) {
      this.error('Docker Compose not working');
      this.info('Ensure Docker Compose v2 is installed');
      return false;
    }
    
    this.log(composeVersion);
    
    // Check if Docker daemon is running
    const dockerInfo = this.execCommandSafe('docker info', { timeout: 5000 });
    if (!dockerInfo) {
      this.warning('Docker is installed but daemon is not running');
      this.info('Docker Desktop will be started automatically when you run: npm start');
    } else {
      this.success('Docker daemon is running');
    }
    
    this.success('Docker and Docker Compose are available');
    return true;
  }
  
  /**
   * Checks Claude CLI availability
   * @returns Claude CLI status
   */
  async checkClaude(): Promise<ToolCheckResult> {
    this.header('Checking Claude CLI');
    
    // First check for local claude in node_modules
    const isWindows = process.platform === 'win32';
    const localClaudePath = path.join(projectRoot, 'node_modules/.bin', isWindows ? 'claude.cmd' : 'claude');
    let claudePath: string | null = null;
    
    if (fs.existsSync(localClaudePath)) {
      claudePath = localClaudePath;
    } else {
      // Fall back to system PATH
      claudePath = this.checkCommand('claude');
    }
    
    if (!claudePath) {
      this.warning('Claude CLI not found. Install from: https://github.com/anthropics/claude-cli');
      this.updateToolEnvVar('CLAUDE_PATH', '');
      this.updateToolEnvVar('CLAUDE_AVAILABLE', 'false');
      return { path: null, available: false };
    }
    
    this.updateToolEnvVar('CLAUDE_PATH', claudePath);
    
    // Check version
    const needsQuotes = process.platform === 'win32' || claudePath.includes(' ');
    const quotedPath = needsQuotes ? `"${claudePath}"` : claudePath;
    
    const version = this.execCommandSafe(`${quotedPath} --version`, { timeout: 5000 });
    if (!version) {
      this.warning(`Claude found at ${claudePath} but not working properly`);
      this.updateToolEnvVar('CLAUDE_AVAILABLE', 'false');
      return { path: claudePath, available: false };
    }
    
    this.success(`Claude CLI found at: ${claudePath} (version: ${version})`);
    
    // Skip authentication check for now - it can be interactive
    // Just assume authenticated if version check worked
    this.info('Claude CLI is available (authentication check skipped)');
    this.updateToolEnvVar('CLAUDE_AVAILABLE', 'true');
    return { path: claudePath, available: true, version };
  }
  
  /**
   * Updates a tool environment variable in .env file
   * @param name - Variable name
   * @param value - Variable value
   */
  private updateToolEnvVar(name: string, value: string): void {
    const envPath = path.join(projectRoot, '.env');
    if (!fs.existsSync(envPath)) {
      return;
    }
    
    let envContent = fs.readFileSync(envPath, 'utf-8');
    const regex = new RegExp(`^${name}=.*$`, 'gm');
    
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${name}=${value}`);
    } else {
      // Add in the tool section if it exists, otherwise at the end
      const toolSectionRegex = /^# Tool paths and availability.*$/gm;
      if (envContent.match(toolSectionRegex)) {
        // Add after the tool section header
        envContent = envContent.replace(toolSectionRegex, (match) => `${match}\n${name}=${value}`);
      } else {
        // Add at the end with a tool section
        envContent += `\n# Tool paths and availability (detected by setup/start scripts)\n${name}=${value}`;
      }
    }
    
    fs.writeFileSync(envPath, envContent);
  }
  
  /**
   * Checks Gemini CLI availability
   */
  async checkGemini(): Promise<void> {
    this.header('Checking Gemini CLI');
    
    const geminiPath = this.checkCommand('gemini');
    
    if (!geminiPath) {
      this.info('Gemini CLI not found (optional)');
      this.updateToolEnvVar('GEMINI_PATH', '');
      this.updateToolEnvVar('GEMINI_AVAILABLE', 'false');
      return;
    }
    
    this.updateToolEnvVar('GEMINI_PATH', geminiPath);
    
    const needsQuotes = process.platform === 'win32' || geminiPath.includes(' ');
    const quotedPath = needsQuotes ? `"${geminiPath}"` : geminiPath;
    
    const version = this.execCommandSafe(`${quotedPath} --version`, { timeout: 5000 });
    if (!version) {
      this.warning(`Gemini found at ${geminiPath} but not working properly`);
      this.updateToolEnvVar('GEMINI_AVAILABLE', 'false');
      return;
    }
    
    this.success(`Gemini CLI found at: ${geminiPath}`);
    this.updateToolEnvVar('GEMINI_AVAILABLE', 'true');
  }
  
  /**
   * Checks Shell availability
   */
  async checkShell(): Promise<void> {
    const shellPaths = ['/bin/bash', '/usr/bin/bash', 'bash'];
    let foundShell = '';
    
    for (const shell of shellPaths) {
      const shellPath = this.checkCommand(shell);
      if (shellPath && fs.existsSync(shellPath)) {
        foundShell = shellPath;
        break;
      }
    }
    
    if (foundShell) {
      this.updateToolEnvVar('SHELL_PATH', foundShell);
    } else {
      this.warning('Bash shell not found, using default /bin/bash');
      this.updateToolEnvVar('SHELL_PATH', '/bin/bash');
    }
  }
  
  /**
   * Checks Cloudflare tunnel (cloudflared) availability
   * @returns Whether cloudflared is available
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
   * @returns Success status
   */
  async installDependencies(): Promise<boolean> {
    this.header('Installing project dependencies');
    
    const projects = [
      { name: 'Main', path: projectRoot },
      { name: 'Daemon', path: path.join(projectRoot, 'daemon') },
      { name: 'E2E test', path: path.join(projectRoot, 'e2e-test') }
    ];
    
    for (const project of projects) {
      this.info(`Installing ${project.name} dependencies...`);
      if (!this.execCommand('npm install --no-audit --no-fund', project.path)) {
        this.error(`Failed to install ${project.name} dependencies`);
        return false;
      }
      this.success(`${project.name} dependencies installed`);
    }
    
    return true;
  }
  
  /**
   * Builds the TypeScript projects
   * @returns Success status
   */
  async buildProject(): Promise<boolean> {
    this.header('Building TypeScript projects');
    
    const buildTasks = [
      { name: 'main project', command: 'npm run build', cwd: projectRoot },
      { name: 'daemon', command: 'npm run build', cwd: path.join(projectRoot, 'daemon') },
      { name: 'scripts', command: 'npm run build:scripts', cwd: projectRoot }
    ];
    
    for (const task of buildTasks) {
      if (!this.execCommand(task.command, task.cwd)) {
        this.error(`Failed to build ${task.name}`);
        return false;
      }
    }
    
    this.success('All TypeScript projects built');
    return true;
  }
  
  /**
   * Validates and configures environment variables
   * @returns Success status
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
    
    // Check PROJECT_ROOT
    let projectRootValue: string | undefined = envVars['PROJECT_ROOT'] || process.env['PROJECT_ROOT'];
    
    if (!projectRootValue || projectRootValue.includes('/path/to/') || projectRootValue.includes('your_')) {
      const newValue = await this.promptForProjectRoot(projectRootValue);
      
      if (!newValue) {
        return false;
      }
      projectRootValue = newValue;
      
      this.updateEnvVar(envPath, 'PROJECT_ROOT', projectRootValue);
      this.success(`Updated PROJECT_ROOT in .env file: ${projectRootValue}`);
      
      dotenv.config({ path: envPath });
      envVars['PROJECT_ROOT'] = projectRootValue;
    } else {
      this.success(`  PROJECT_ROOT is set: ${projectRootValue}`);
    }
    
    // Check optional variables
    this.info('\nOptional environment variables:');
    
    // Check for port conflicts
    await this.checkPortConflicts(envPath, envVars);
    
    // Check and set CLAUDE_PROXY_HOST based on platform
    await this.configureDockerHost(envPath, envVars);
    
    // Display status of optional variables
    for (const { name, default: defaultValue } of OPTIONAL_ENV_VARS) {
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
   * Prompts for PROJECT_ROOT configuration
   * @param currentValue - Current value if any
   * @returns The configured path or null
   */
  private async promptForProjectRoot(currentValue: string | undefined): Promise<string | null> {
    this.warning('PROJECT_ROOT is not set or contains placeholder value');
    this.info('PROJECT_ROOT is the directory where Claude Code will execute tasks');
    
    const suggestedPath = process.cwd();
    const answer = await this.prompt(`\nEnter PROJECT_ROOT path (default: ${suggestedPath}): `);
    const projectRootValue = answer || suggestedPath;
    
    if (!fs.existsSync(projectRootValue)) {
      this.error(`Path does not exist: ${projectRootValue}`);
      const create = await this.prompt('Would you like to create this directory? (y/N): ');
      if (create.toLowerCase() === 'y') {
        try {
          fs.mkdirSync(projectRootValue, { recursive: true });
          this.success(`Created directory: ${projectRootValue}`);
        } catch (err) {
          this.error(`Failed to create directory: ${err}`);
          return null;
        }
      } else {
        return null;
      }
    }
    
    return projectRootValue;
  }
  
  /**
   * Updates an environment variable in the .env file
   * @param envPath - Path to .env file
   * @param name - Variable name
   * @param value - Variable value
   */
  private updateEnvVar(envPath: string, name: string, value: string): void {
    let envContent = fs.readFileSync(envPath, 'utf-8');
    const regex = new RegExp(`^${name}=.*$`, 'gm');
    
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${name}=${value}`);
    } else {
      envContent += `\n# ${REQUIRED_ENV_VARS.find(v => v.name === name)?.description || name}\n${name}=${value}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
  }
  
  /**
   * Checks for port conflicts and suggests alternatives
   * @param envPath - Path to .env file
   * @param envVars - Current environment variables
   */
  private async checkPortConflicts(envPath: string, envVars: Record<string, string>): Promise<void> {
    const portsToCheck = [
      { name: 'PORT', default: '3000' },
      { name: 'CLAUDE_PROXY_PORT', default: '9876' }
    ];
    
    for (const { name, default: defaultValue } of portsToCheck) {
      const currentValue = envVars[name] || defaultValue;
      const portInUse = await this.isPortInUse(parseInt(currentValue));
      
      if (portInUse) {
        this.warning(`  ${name}=${currentValue} - Port is already in use!`);
        const suggestedPort = parseInt(currentValue) + 1;
        const useAlt = await this.prompt(`    Would you like to use port ${suggestedPort} instead? (y/N): `);
        if (useAlt.toLowerCase() === 'y') {
          this.updateEnvVar(envPath, name, suggestedPort.toString());
          this.success(`  Updated ${name} to ${suggestedPort}`);
        }
      }
    }
  }
  
  /**
   * Checks if a port is in use
   * @param port - Port number to check
   * @returns Whether the port is in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        process.platform === 'darwin' 
          ? `lsof -i :${port} -t 2>/dev/null || true`
          : `netstat -tlnp 2>/dev/null | grep :${port} 2>/dev/null || true`
      );
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
  
  /**
   * Configures Docker host IP based on platform
   * @param envPath - Path to .env file
   * @param envVars - Current environment variables
   */
  private async configureDockerHost(envPath: string, envVars: Record<string, string>): Promise<void> {
    const claudeProxyHost = envVars['CLAUDE_PROXY_HOST'];
    if (!claudeProxyHost || claudeProxyHost === 'host.docker.internal') {
      const platform = this.detectPlatform();
      const hostIP = await this.getDockerHostIP();
      
      if (platform === 'wsl' && hostIP !== 'host.docker.internal') {
        this.info(`\n  Detected WSL2 environment`);
        this.info(`  Setting CLAUDE_PROXY_HOST to WSL2 host IP: ${hostIP}`);
        
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = /^CLAUDE_PROXY_HOST=.*$/gm;
        
        if (envContent.match(regex)) {
          envContent = envContent.replace(regex, `CLAUDE_PROXY_HOST=${hostIP}`);
        } else {
          const portRegex = /^CLAUDE_PROXY_PORT=.*$/gm;
          if (envContent.match(portRegex)) {
            envContent = envContent.replace(portRegex, (match) => 
              `${match}\n\n# Claude proxy host for Docker (auto-detected for WSL2)\nCLAUDE_PROXY_HOST=${hostIP}`
            );
          } else {
            envContent += `\n# Claude proxy host for Docker (auto-detected for WSL2)\nCLAUDE_PROXY_HOST=${hostIP}\n`;
          }
        }
        
        fs.writeFileSync(envPath, envContent);
        this.success(`  Updated CLAUDE_PROXY_HOST for WSL2 compatibility`);
      } else {
        this.info(`  CLAUDE_PROXY_HOST will use default: ${hostIP}`);
      }
    }
  }
  
  /**
   * Runs the complete setup process
   */
  async run(): Promise<void> {
    this.log('🚀 SystemPrompt Coding Agent Setup', colors.cyan);
    this.log('==================================', colors.cyan);
    
    try {
      // Critical checks
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
      
      // Tool checks
      const claude = await this.checkClaude();
      await this.checkGemini();
      await this.checkShell();
      const cloudflaredAvailable = await this.checkCloudflared();
      
      // Project setup
      await this.createDirectories();
      
      if (!await this.installDependencies()) {
        this.error('Failed to install dependencies');
        process.exit(1);
      }
      
      if (!await this.buildProject()) {
        this.error('Failed to build projects');
        process.exit(1);
      }
      
      // Display completion message
      this.displayCompletionMessage(claude, cloudflaredAvailable);
      
    } finally {
      this.rl.close();
    }
  }
  
  /**
   * Displays the completion message with next steps
   * @param claude - Claude tool check result
   * @param cloudflaredAvailable - Whether cloudflared is available
   */
  private displayCompletionMessage(claude: ToolCheckResult, cloudflaredAvailable: boolean): void {
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
  }
}

// Execute setup when run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const setup = new ProjectSetup();
  setup.run().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}