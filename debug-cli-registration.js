import { DatabaseService } from './build/modules/core/database/services/database.service.js';
import { LoggerService } from './build/modules/core/logger/services/logger.service.js';
import { CliService } from './build/modules/core/cli/services/cli.service.js';
import { existsSync } from 'fs';

async function debugRegistration() {
  try {
    const logger = LoggerService.getInstance();
    logger.initialize({
      stateDir: './state',
      logLevel: 'debug',
      outputs: ['console'],
      files: { system: 'system.log', error: 'error.log', access: 'access.log' },
      maxSize: '10m',
      maxFiles: 5
    });

    const dbService = DatabaseService.initialize({
      type: 'sqlite',
      sqlite: { filename: './state/database.db' },
      pool: { min: 1, max: 10, idleTimeout: 30000 }
    }, logger);

    const cliService = CliService.getInstance();
    await cliService.initialize(logger, dbService);

    // Test the exact same module map that bootstrap uses
    const moduleMap = new Map();
    const baseModulePath = `${process.cwd()}/src/modules/core/`;
    
    // Add CLI module specifically
    const cliPath = `${baseModulePath}cli`;
    moduleMap.set('cli', { path: cliPath });
    
    console.log('Testing CLI module path:', cliPath);
    console.log('module.yaml exists:', existsSync(`${cliPath}/module.yaml`));
    
    if (existsSync(`${cliPath}/module.yaml`)) {
      const fs = await import('fs');
      const yamlContent = fs.readFileSync(`${cliPath}/module.yaml`, 'utf-8');
      console.log('YAML content length:', yamlContent.length);
      console.log('First 200 chars of YAML:', yamlContent.substring(0, 200));
    }

    console.log('Calling scanAndRegisterModuleCommands...');
    await cliService.scanAndRegisterModuleCommands(moduleMap);
    
    // Check database after registration
    const commands = await dbService.query("SELECT * FROM cli_commands");
    console.log('Commands after registration:', commands.length);

  } catch (error) {
    console.error('Error during debug:', error);
  }
}

debugRegistration();