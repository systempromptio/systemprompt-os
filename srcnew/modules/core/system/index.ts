/**
 * System Management Module
 * Handles updates, backups, and deployment management
 */

import { ServiceModule } from '../../../interfaces/service';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class SystemModule implements ServiceModule {
  private config: any;
  private logger: any;
  
  constructor(config: any, dependencies: any) {
    this.config = config;
    this.logger = dependencies.logger;
  }
  
  async init(): Promise<void> {
    this.logger.info('System module initialized');
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }
  
  /**
   * Check if a directory is a git repository
   */
  private isGitRepo(dir: string): boolean {
    try {
      execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get git status for a directory
   */
  private getGitStatus(dir: string): any {
    try {
      const branch = execSync('git branch --show-current', { cwd: dir }).toString().trim();
      const status = execSync('git status --porcelain', { cwd: dir }).toString().trim();
      const ahead = execSync('git rev-list HEAD...@{u} --count', { cwd: dir }).toString().trim();
      
      // Fetch to check for updates
      execSync('git fetch --quiet', { cwd: dir });
      const behind = execSync('git rev-list HEAD..@{u} --count', { cwd: dir }).toString().trim();
      
      return {
        branch,
        hasChanges: status.length > 0,
        ahead: parseInt(ahead) || 0,
        behind: parseInt(behind) || 0,
        isRepo: true
      };
    } catch (error) {
      return {
        isRepo: false,
        error: error.message
      };
    }
  }
  
  /**
   * Update core SystemPrompt code
   */
  async updateCore(): Promise<any> {
    this.logger.info('Starting core update...');
    
    try {
      // Check git status
      const status = this.getGitStatus('.');
      
      if (!status.isRepo) {
        throw new Error('Not a git repository');
      }
      
      if (status.hasChanges) {
        this.logger.warn('Local changes detected, stashing...');
        execSync('git stash push -m "Auto-stash before core update"');
      }
      
      // Pull updates
      this.logger.info('Pulling core updates...');
      const output = execSync('git pull origin main', { encoding: 'utf8' });
      
      // Restore stashed changes if any
      if (status.hasChanges) {
        try {
          execSync('git stash pop');
          this.logger.info('Restored local changes');
        } catch (error) {
          this.logger.warn('Failed to restore local changes, manual intervention may be needed');
        }
      }
      
      return {
        success: true,
        message: 'Core updated successfully',
        output: output.trim()
      };
    } catch (error) {
      this.logger.error('Core update failed:', error);
      throw error;
    }
  }
  
  /**
   * Update custom modules and MCP servers
   */
  async updateCustom(): Promise<any> {
    this.logger.info('Starting custom code update...');
    
    const results = {
      modules: null,
      mcp: null
    };
    
    // Update custom modules
    if (fs.existsSync(this.config.customRepoPath)) {
      this.logger.info('Updating custom modules...');
      results.modules = await this.updateGitRepo(this.config.customRepoPath, 'modules');
    } else {
      results.modules = { skipped: true, message: 'No custom modules directory' };
    }
    
    // Update custom MCP servers
    if (fs.existsSync(this.config.mcpCustomRepoPath)) {
      this.logger.info('Updating custom MCP servers...');
      results.mcp = await this.updateGitRepo(this.config.mcpCustomRepoPath, 'MCP servers');
    } else {
      results.mcp = { skipped: true, message: 'No custom MCP directory' };
    }
    
    return {
      success: true,
      modules: results.modules,
      mcp: results.mcp
    };
  }
  
  /**
   * Update a git repository
   */
  private async updateGitRepo(repoPath: string, name: string): Promise<any> {
    try {
      if (!this.isGitRepo(repoPath)) {
        return {
          skipped: true,
          message: `${name} is not a git repository`
        };
      }
      
      const status = this.getGitStatus(repoPath);
      
      if (status.behind === 0) {
        return {
          success: true,
          message: `${name} already up to date`
        };
      }
      
      const output = execSync('git pull', { cwd: repoPath, encoding: 'utf8' });
      
      return {
        success: true,
        message: `${name} updated successfully`,
        output: output.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get update status for all repositories
   */
  async getUpdateStatus(): Promise<any> {
    const status = {
      core: this.getGitStatus('.'),
      modules: null,
      mcp: null
    };
    
    if (fs.existsSync(this.config.customRepoPath)) {
      status.modules = this.getGitStatus(this.config.customRepoPath);
    }
    
    if (fs.existsSync(this.config.mcpCustomRepoPath)) {
      status.mcp = this.getGitStatus(this.config.mcpCustomRepoPath);
    }
    
    return status;
  }
  
  /**
   * Create a backup
   */
  async createBackup(name?: string): Promise<any> {
    const backupName = name || `backup-${new Date().toISOString().replace(/:/g, '-')}`;
    const backupPath = path.join(this.config.backupDir, backupName);
    
    this.logger.info(`Creating backup: ${backupName}`);
    
    try {
      fs.mkdirSync(backupPath, { recursive: true });
      
      // Backup configuration
      if (fs.existsSync('.env')) {
        fs.copyFileSync('.env', path.join(backupPath, '.env'));
      }
      
      // Backup docker-compose
      if (fs.existsSync('docker-compose.yml')) {
        fs.copyFileSync('docker-compose.yml', path.join(backupPath, 'docker-compose.yml'));
      }
      
      // Backup state
      if (fs.existsSync('./state')) {
        execSync(`cp -r ./state ${backupPath}/`);
      }
      
      // Create backup metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        name: backupName,
        systemVersion: this.getSystemVersion(),
        gitStatus: {
          core: this.getGitStatus('.'),
          modules: fs.existsSync(this.config.customRepoPath) ? 
            this.getGitStatus(this.config.customRepoPath) : null,
          mcp: fs.existsSync(this.config.mcpCustomRepoPath) ? 
            this.getGitStatus(this.config.mcpCustomRepoPath) : null
        }
      };
      
      fs.writeFileSync(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Clean old backups
      this.cleanOldBackups();
      
      return {
        success: true,
        name: backupName,
        path: backupPath
      };
    } catch (error) {
      this.logger.error('Backup failed:', error);
      throw error;
    }
  }
  
  /**
   * List available backups
   */
  async listBackups(): Promise<any[]> {
    try {
      const backups = fs.readdirSync(this.config.backupDir)
        .filter(f => fs.statSync(path.join(this.config.backupDir, f)).isDirectory())
        .map(name => {
          const metadataPath = path.join(this.config.backupDir, name, 'metadata.json');
          if (fs.existsSync(metadataPath)) {
            return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          }
          return { name, timestamp: null };
        })
        .sort((a, b) => b.timestamp?.localeCompare(a.timestamp) || 0);
      
      return backups;
    } catch (error) {
      this.logger.error('Failed to list backups:', error);
      return [];
    }
  }
  
  /**
   * Initialize deployment structure
   */
  async initDeployment(): Promise<any> {
    this.logger.info('Initializing deployment structure...');
    
    const customRoot = '/home/pi/systemprompt-custom';
    
    try {
      // Create directory structure
      const dirs = [
        customRoot,
        path.join(customRoot, 'modules'),
        path.join(customRoot, 'mcp-servers'),
        path.join(customRoot, 'config'),
        path.join(customRoot, 'docs')
      ];
      
      dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
      
      // Create README files
      this.createDeploymentReadme(customRoot);
      this.createModulesReadme(path.join(customRoot, 'modules'));
      this.createMCPReadme(path.join(customRoot, 'mcp-servers'));
      
      // Initialize as git repos
      this.initGitRepo(path.join(customRoot, 'modules'), 'Custom SystemPrompt Modules');
      this.initGitRepo(path.join(customRoot, 'mcp-servers'), 'Custom MCP Servers');
      
      // Create symlinks in main project
      this.createSymlink(
        path.join(customRoot, 'modules'),
        './modules/custom'
      );
      
      this.createSymlink(
        path.join(customRoot, 'mcp-servers'),
        './server/mcp/custom'
      );
      
      return {
        success: true,
        message: 'Deployment structure initialized',
        customRoot
      };
    } catch (error) {
      this.logger.error('Deployment initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Helper methods
   */
  
  private cleanOldBackups(): void {
    try {
      const backups = this.listBackups();
      if (backups.length > this.config.maxBackups) {
        const toDelete = backups.slice(this.config.maxBackups);
        toDelete.forEach(backup => {
          const backupPath = path.join(this.config.backupDir, backup.name);
          execSync(`rm -rf ${backupPath}`);
          this.logger.info(`Deleted old backup: ${backup.name}`);
        });
      }
    } catch (error) {
      this.logger.warn('Failed to clean old backups:', error);
    }
  }
  
  private getSystemVersion(): string {
    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      return packageJson.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  private initGitRepo(dir: string, description: string): void {
    if (!this.isGitRepo(dir)) {
      execSync('git init', { cwd: dir });
      fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n*.log\n.env\n');
      execSync('git add .', { cwd: dir });
      execSync(`git commit -m "Initialize ${description}"`, { cwd: dir });
      this.logger.info(`Initialized git repository: ${dir}`);
    }
  }
  
  private createSymlink(target: string, link: string): void {
    if (fs.existsSync(link)) {
      fs.unlinkSync(link);
    }
    fs.symlinkSync(target, link);
    this.logger.info(`Created symlink: ${link} -> ${target}`);
  }
  
  private createDeploymentReadme(dir: string): void {
    const content = `# SystemPrompt Custom Code

This directory contains your custom modules and MCP servers for SystemPrompt.

## Structure

\`\`\`
systemprompt-custom/
├── modules/         # Custom modules (git repository)
├── mcp-servers/     # Custom MCP servers (git repository)
├── config/          # Instance configuration
└── docs/            # Custom documentation
\`\`\`

## Usage

1. Custom modules are automatically loaded from \`modules/\`
2. Custom MCP servers are automatically registered from \`mcp-servers/\`
3. Configuration in \`config/\` overrides defaults

## Updates

- Core updates: \`systemprompt system:update:core\`
- Custom updates: \`systemprompt system:update:custom\`
- Status: \`systemprompt system:update:status\`
`;
    fs.writeFileSync(path.join(dir, 'README.md'), content);
  }
  
  private createModulesReadme(dir: string): void {
    const content = `# Custom SystemPrompt Modules

Place your custom modules here. Each module should have:

\`\`\`
my-module/
├── module.yaml    # Module configuration
├── index.ts       # Module implementation
├── cli/           # CLI commands (optional)
└── README.md      # Module documentation
\`\`\`

## Example module.yaml

\`\`\`yaml
name: my-module
type: daemon|service|plugin
version: 1.0.0
description: My custom module
config:
  # Module configuration
cli:
  commands:
    - name: status
      description: Show module status
\`\`\`

This is a git repository. Commit your changes and push to your remote.
`;
    fs.writeFileSync(path.join(dir, 'README.md'), content);
  }
  
  private createMCPReadme(dir: string): void {
    const content = `# Custom MCP Servers

Place your custom MCP servers here. Each server should:

1. Implement the MCP protocol
2. Export a server class or function
3. Be automatically discovered and registered

## Example Structure

\`\`\`
my-mcp-server/
├── server.ts      # MCP server implementation
├── package.json   # Dependencies
└── README.md      # Documentation
\`\`\`

This is a git repository. Commit your changes and push to your remote.
`;
    fs.writeFileSync(path.join(dir, 'README.md'), content);
  }
}