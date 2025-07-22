/**
 * System backup and restore service
 */

import { existsSync, mkdirSync } from 'fs';
import { readdir, stat, copyFile, rm } from 'fs/promises';
import { join, basename } from 'path';
import { randomBytes } from 'crypto';
import type { BackupInfo, BackupOptions } from '../types/index.js';

export class BackupService {
  private backupPath: string;
  
  constructor(private config: any, private logger: any) {
    this.backupPath = config.path || './backups';
    this.ensureBackupDirectory();
  }
  
  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!existsSync(this.backupPath)) {
      mkdirSync(this.backupPath, { recursive: true });
    }
  }
  
  /**
   * Create a system backup
   */
  async createBackup(options: BackupOptions): Promise<BackupInfo> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    const backupDir = join(this.backupPath, backupId);
    
    try {
      // Create backup directory
      mkdirSync(backupDir, { recursive: true });
      
      const components: string[] = [];
      let totalSize = 0;
      
      // Backup config
      if (options.includeConfig !== false) {
        await this.backupConfig(backupDir);
        components.push('config');
      }
      
      // Backup data
      if (options.includeData !== false) {
        await this.backupData(backupDir);
        components.push('data');
      }
      
      // Backup modules
      if (options.includeModules !== false) {
        await this.backupModules(backupDir);
        components.push('modules');
      }
      
      // Create manifest
      const manifest = {
        id: backupId,
        timestamp: timestamp.toISOString(),
        version: this.getSystemVersion(),
        components,
        compressed: options.compress || false
      };
      
      await this.writeJSON(join(backupDir, 'manifest.json'), manifest);
      
      // Compress if requested
      let finalPath = backupDir;
      if (options.compress) {
        finalPath = await this.compressBackup(backupDir);
        // Remove uncompressed directory
        await rm(backupDir, { recursive: true, force: true });
      }
      
      // Calculate size
      totalSize = await this.calculateSize(finalPath);
      
      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp,
        version: manifest.version,
        components,
        size: totalSize,
        path: finalPath,
        compressed: options.compress || false
      };
      
      this.logger?.info('Backup created', { backupId, components, size: totalSize });
      
      // Clean old backups if retention is set
      if (this.config.retention) {
        await this.cleanOldBackups(this.config.retention);
      }
      
      return backupInfo;
    } catch (error) {
      // Clean up on failure
      try {
        await rm(backupDir, { recursive: true, force: true });
      } catch {}
      
      throw new Error(`Backup failed: ${error}`);
    }
  }
  
  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string, options: any): Promise<void> {
    const backupPath = join(this.backupPath, backupId);
    const compressedPath = `${backupPath}.tar.gz`;
    
    let extractPath = backupPath;
    let isCompressed = false;
    
    // Check if backup exists
    if (existsSync(compressedPath)) {
      isCompressed = true;
      extractPath = await this.decompressBackup(compressedPath);
    } else if (!existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    try {
      // Read manifest
      const manifest = await this.readJSON(join(extractPath, 'manifest.json'));
      
      // Restore components
      const components = options.components?.split(',') || manifest.components;
      
      if (components.includes('config')) {
        await this.restoreConfig(extractPath);
      }
      
      if (components.includes('data')) {
        await this.restoreData(extractPath);
      }
      
      if (components.includes('modules')) {
        await this.restoreModules(extractPath);
      }
      
      this.logger?.info('Backup restored', { backupId, components });
      
      // Clean up extracted files if compressed
      if (isCompressed && extractPath !== backupPath) {
        await rm(extractPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Clean up on failure
      if (isCompressed && extractPath !== backupPath) {
        try {
          await rm(extractPath, { recursive: true, force: true });
        } catch {}
      }
      
      throw new Error(`Restore failed: ${error}`);
    }
  }
  
  /**
   * Backup configuration files
   */
  private async backupConfig(backupDir: string): Promise<void> {
    const configDir = join(backupDir, 'config');
    mkdirSync(configDir, { recursive: true });
    
    // Backup main config files
    const configFiles = [
      'modules.json',
      '.env',
      'config.json'
    ];
    
    for (const file of configFiles) {
      if (existsSync(file)) {
        await copyFile(file, join(configDir, file));
      }
    }
    
    // Backup state config directory
    const stateConfigDir = './state/config';
    if (existsSync(stateConfigDir)) {
      await this.copyDirectory(stateConfigDir, join(configDir, 'state-config'));
    }
  }
  
  /**
   * Backup data
   */
  private async backupData(backupDir: string): Promise<void> {
    const dataDir = join(backupDir, 'data');
    mkdirSync(dataDir, { recursive: true });
    
    // Backup database
    const dbFile = './state/systemprompt.db';
    if (existsSync(dbFile)) {
      await copyFile(dbFile, join(dataDir, 'systemprompt.db'));
    }
    
    // Backup other state files
    const stateFiles = await readdir('./state');
    for (const file of stateFiles) {
      if (file.endsWith('.json') || file.endsWith('.db')) {
        await copyFile(join('./state', file), join(dataDir, file));
      }
    }
  }
  
  /**
   * Backup modules
   */
  private async backupModules(backupDir: string): Promise<void> {
    const modulesDir = join(backupDir, 'modules');
    mkdirSync(modulesDir, { recursive: true });
    
    // Backup custom modules only (not core)
    const customModulesPath = './src/modules/custom';
    if (existsSync(customModulesPath)) {
      await this.copyDirectory(customModulesPath, join(modulesDir, 'custom'));
    }
    
    // Backup extensions
    const extensionsPath = './extensions';
    if (existsSync(extensionsPath)) {
      await this.copyDirectory(extensionsPath, join(modulesDir, 'extensions'));
    }
  }
  
  /**
   * Restore configuration
   */
  private async restoreConfig(backupDir: string): Promise<void> {
    const configDir = join(backupDir, 'config');
    
    // Restore main config files
    const configFiles = await readdir(configDir);
    for (const file of configFiles) {
      if (file !== 'state-config') {
        await copyFile(join(configDir, file), file);
      }
    }
    
    // Restore state config
    const stateConfigBackup = join(configDir, 'state-config');
    if (existsSync(stateConfigBackup)) {
      await this.copyDirectory(stateConfigBackup, './state/config');
    }
  }
  
  /**
   * Restore data
   */
  private async restoreData(backupDir: string): Promise<void> {
    const dataDir = join(backupDir, 'data');
    
    // Ensure state directory exists
    if (!existsSync('./state')) {
      mkdirSync('./state', { recursive: true });
    }
    
    // Restore all data files
    const dataFiles = await readdir(dataDir);
    for (const file of dataFiles) {
      await copyFile(join(dataDir, file), join('./state', file));
    }
  }
  
  /**
   * Restore modules
   */
  private async restoreModules(backupDir: string): Promise<void> {
    const modulesDir = join(backupDir, 'modules');
    
    // Restore custom modules
    const customBackup = join(modulesDir, 'custom');
    if (existsSync(customBackup)) {
      await this.copyDirectory(customBackup, './src/modules/custom');
    }
    
    // Restore extensions
    const extensionsBackup = join(modulesDir, 'extensions');
    if (existsSync(extensionsBackup)) {
      await this.copyDirectory(extensionsBackup, './extensions');
    }
  }
  
  /**
   * Compress backup directory
   */
  private async compressBackup(backupDir: string): Promise<string> {
    const archivePath = `${backupDir}.tar.gz`;
    
    // Use tar command for compression
    const { execSync } = require('child_process');
    const dirName = basename(backupDir);
    const parentDir = join(backupDir, '..');
    
    execSync(`tar -czf ${archivePath} -C ${parentDir} ${dirName}`, {
      stdio: 'inherit'
    });
    
    return archivePath;
  }
  
  /**
   * Decompress backup
   */
  private async decompressBackup(archivePath: string): Promise<string> {
    const extractPath = archivePath.replace('.tar.gz', '');
    
    // Use tar command for decompression
    const { execSync } = require('child_process');
    
    execSync(`tar -xzf ${archivePath} -C ${this.backupPath}`, {
      stdio: 'inherit'
    });
    
    return extractPath;
  }
  
  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    mkdirSync(dest, { recursive: true });
    
    const entries = await readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }
  
  /**
   * Calculate directory/file size
   */
  private async calculateSize(path: string): Promise<number> {
    const stats = await stat(path);
    
    if (stats.isDirectory()) {
      let total = 0;
      const entries = await readdir(path, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = join(path, entry.name);
        total += await this.calculateSize(entryPath);
      }
      
      return total;
    } else {
      return stats.size;
    }
  }
  
  /**
   * Clean old backups based on retention policy
   */
  private async cleanOldBackups(retentionDays: number): Promise<void> {
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const backups = await readdir(this.backupPath);
    
    for (const backup of backups) {
      const backupPath = join(this.backupPath, backup);
      const stats = await stat(backupPath);
      
      if (stats.mtime.getTime() < cutoff) {
        await rm(backupPath, { recursive: true, force: true });
        this.logger?.info('Removed old backup', { backup });
      }
    }
  }
  
  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }
  
  /**
   * Get system version
   */
  private getSystemVersion(): string {
    try {
      const packageJson = require('../../../../package.json');
      return packageJson.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
  
  /**
   * Write JSON file
   */
  private async writeJSON(path: string, data: any): Promise<void> {
    const { writeFile } = require('fs/promises');
    await writeFile(path, JSON.stringify(data, null, 2));
  }
  
  /**
   * Read JSON file
   */
  private async readJSON(path: string): Promise<any> {
    const { readFile } = require('fs/promises');
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  }
}