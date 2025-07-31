/**
 * Rules Sync Service - Manages synchronization of generic rules to specific modules.
 * @file Rules sync service implementation.
 * @module dev/services
 * Handles copying and updating module rules with placeholder replacement.
 */

import {
 existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync
} from 'fs';
import { dirname, join } from 'path';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';

interface ModuleConfig {
  name: string;
  pascalCase: string;
  constantCase: string;
  entity: string;
  entityPascal: string;
  serviceName: string;
  tableName: string;
}

interface RuleSyncResult {
  success: boolean;
  message: string;
  filesProcessed: number;
  errors: string[];
}

/**
 * Service for synchronizing rules across modules.
 */
export class RulesSyncService {
  private static instance: RulesSyncService;
  private logger?: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns The rules sync service instance.
   */
  static getInstance(): RulesSyncService {
    RulesSyncService.instance ||= new RulesSyncService();
    return RulesSyncService.instance;
  }

  /**
   * Set logger instance.
   * @param logger - The logger instance to use.
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * Initialize service.
   * @returns Promise that resolves when initialized.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.logger?.info(LogSource.DEV, 'RulesSyncService initialized');
  }

  /**
   * Sync rules for a specific module.
   * @param moduleName - The name of the module to sync rules for.
   * @returns Promise that resolves to sync result.
   */
  async syncModuleRules(moduleName: string): Promise<RuleSyncResult> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.DEV, `Syncing rules for module: ${moduleName}`);

    const config = this.getModuleConfig(moduleName);
    const rulesBasePath = join(process.cwd(), 'rules', 'src', 'modules', 'core', '{module}');
    const moduleBasePath = join(process.cwd(), 'src', 'modules', 'core', moduleName);

    if (!existsSync(moduleBasePath)) {
      const message = `Module directory does not exist: ${moduleBasePath}`;
      this.logger?.error(LogSource.DEV, message);
      return {
        success: false,
        message,
        filesProcessed: 0,
        errors: [message]
      };
    }

    const ruleFiles = [
      'rules.md',
      'cli/rules.md',
      'database/rules.md',
      'repositories/rules.md',
      'services/rules.md',
      'types/rules.md',
      'utils/rules.md'
    ];

    const errors: string[] = [];
    let filesProcessed = 0;

    for (const ruleFile of ruleFiles) {
      const sourcePath = join(rulesBasePath, ruleFile);
      const targetPath = join(moduleBasePath, ruleFile);

      try {
        if (!existsSync(sourcePath)) {
          const error = `Source rule file not found: ${sourcePath}`;
          this.logger?.warn(LogSource.DEV, error);
          errors.push(error);
          continue;
        }

        const targetDir = dirname(targetPath);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }

        const sourceContent = readFileSync(sourcePath, 'utf-8');

        const targetContent = this.replacePlaceholders(sourceContent, config);

        writeFileSync(targetPath, targetContent, 'utf-8');

        this.logger?.debug(LogSource.DEV, `Synced rule file: ${ruleFile}`);
        filesProcessed++;
      } catch (error) {
        const errorMessage = `Failed to sync ${ruleFile}: ${error instanceof Error ? error.message : String(error)}`;
        this.logger?.error(LogSource.DEV, errorMessage);
        errors.push(errorMessage);
      }
    }

    const success = errors.length === 0;
    const message = success
      ? `Successfully synced ${filesProcessed} rule files for ${moduleName}`
      : `Synced ${filesProcessed} files with ${errors.length} errors for ${moduleName}`;

    this.logger?.info(LogSource.DEV, message);

    return {
      success,
      message,
      filesProcessed,
      errors
    };
  }

  /**
   * Sync rules for all modules.
   * @returns Promise that resolves to array of sync results.
   */
  async syncAllModules(): Promise<RuleSyncResult[]> {
    await this.ensureInitialized();

    this.logger?.info(LogSource.DEV, 'Syncing rules for all modules');

    const modules = this.getAllModules();
    const results: RuleSyncResult[] = [];

    this.logger?.info(LogSource.DEV, `Found ${modules.length} modules: ${modules.join(', ')}`);

    for (const moduleName of modules) {
      const result = await this.syncModuleRules(moduleName);
      results.push(result);
    }

    const totalSuccess = results.filter(r => { return r.success }).length;
    const totalErrors = results.reduce((sum, r) => { return sum + r.errors.length }, 0);

    this.logger?.info(
LogSource.DEV,
      `Completed syncing rules: ${totalSuccess}/${modules.length} modules successful, ${totalErrors} total errors`
    );

    return results;
  }

  /**
   * Get all available modules.
   * @returns Array of module names.
   */
  getAllModules(): string[] {
    const modulesPath = join(process.cwd(), 'src', 'modules', 'core');

    if (!existsSync(modulesPath)) {
      this.logger?.error(LogSource.DEV, `Modules directory not found: ${modulesPath}`);
      return [];
    }

    return readdirSync(modulesPath, { withFileTypes: true })
      .filter(dirent => { return dirent.isDirectory() })
      .map(dirent => { return dirent.name })
      .filter(name => { return !name.startsWith('.') });
  }

  /**
   * Get module configuration for placeholder replacement.
   * @param moduleName - The module name.
   * @returns Module configuration object.
   */
  private getModuleConfig(moduleName: string): ModuleConfig {
    const entity = this.toSingular(moduleName);
    return {
      name: moduleName,
      pascalCase: this.toPascalCase(moduleName),
      constantCase: this.toConstantCase(moduleName),
      entity,
      entityPascal: this.toPascalCase(entity),
      serviceName: moduleName,
      tableName: entity.toLowerCase()
    };
  }

  /**
   * Replace placeholders in content with module-specific values.
   * @param content - The content with placeholders.
   * @param config - The module configuration.
   * @returns Content with placeholders replaced.
   */
  private replacePlaceholders(content: string, config: ModuleConfig): string {
    return content
      .replace(/\{module\}/g, config.name)
      .replace(/\{Module\}/g, config.pascalCase)
      .replace(/\{MODULE_CONSTANT\}/g, config.constantCase)
      .replace(/\{entity\}/g, config.entity)
      .replace(/\{Entity\}/g, config.entityPascal)
      .replace(/\{service-name\}/g, config.serviceName)
      .replace(/\{module-name\}/g, config.name)
      .replace(/\{table_name\}/g, config.tableName);
  }

  /**
   * Convert string to PascalCase.
   * @param str - String to convert.
   * @returns PascalCase string.
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Convert string to CONSTANT_CASE.
   * @param str - String to convert.
   * @returns CONSTANT_CASE string.
   */
  private toConstantCase(str: string): string {
    return str.toUpperCase().replace(/-/g, '_');
  }

  /**
   * Convert plural to singular (simple implementation).
   * @param str - String to convert.
   * @returns Singular form.
   */
  private toSingular(str: string): string {
    if (str.endsWith('s') && str.length > 1) {
      return str.slice(0, -1);
    }
    return str;
  }

  /**
   * Ensure service is initialized.
   * @returns Promise that resolves when initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
