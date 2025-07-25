import { DatabaseService } from './build/modules/core/database/services/database.service.js';
import { LoggerService } from './build/modules/core/logger/services/logger.service.js';
import { CliService } from './build/modules/core/cli/services/cli.service.js';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

async function debugDetailed() {
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

    // Manual step-by-step registration
    const moduleName = 'cli';
    const moduleInfo = { path: `${process.cwd()}/src/modules/core/cli` };
    const yamlPath = join(moduleInfo.path, 'module.yaml');
    
    console.log('Step 1: Check YAML file existence');
    console.log('YAML path:', yamlPath);
    console.log('Exists:', existsSync(yamlPath));
    
    if (!existsSync(yamlPath)) {
      console.log('YAML file does not exist, stopping');
      return;
    }
    
    console.log('\nStep 2: Read and parse YAML');
    const yamlContent = readFileSync(yamlPath, 'utf-8');
    console.log('YAML content preview:', yamlContent.substring(0, 500));
    
    const moduleConfig = parse(yamlContent);
    console.log('Parsed config keys:', Object.keys(moduleConfig));
    console.log('Has cli section:', !!moduleConfig.cli);
    console.log('CLI config:', JSON.stringify(moduleConfig.cli, null, 2));
    
    const commands = moduleConfig.cli?.commands ?? [];
    console.log('\nStep 3: Found commands');
    console.log('Number of commands:', commands.length);
    console.log('Commands:', JSON.stringify(commands, null, 2));
    
    if (commands.length === 0) {
      console.log('No commands found in YAML, this is the issue!');
      return;
    }
    
    console.log('\nStep 4: Process each command');
    for (const command of commands) {
      console.log(`\nProcessing command: ${command.name}`);
      const commandPath = `${moduleName}:${command.name}`;
      const executor = command.executor ?? `cli/${command.name.replace(':', '/')}.js`;
      const executorPath = join(moduleInfo.path, executor);
      
      console.log('  Command path:', commandPath);
      console.log('  Executor:', executor);
      console.log('  Executor path:', executorPath);
      console.log('  Executor exists:', existsSync(executorPath));
      
      const cliCommand = {
        name: command.name,
        description: command.description ?? '',
        options: command.options ?? [],
      };
      
      console.log('  CLI command object:', JSON.stringify(cliCommand, null, 2));
      
      try {
        console.log('  Attempting to register command...');
        await cliService.registerCommand(cliCommand, moduleName, executorPath);
        console.log('  ✓ Command registered successfully');
      } catch (error) {
        console.log('  ✗ Command registration failed:', error.message);
        console.log('  Full error:', error);
      }
    }
    
    // Check final database state
    console.log('\nStep 5: Check database after registration');
    const finalCommands = await dbService.query("SELECT * FROM cli_commands");
    console.log('Final commands in database:', finalCommands.length);
    finalCommands.forEach(cmd => {
      console.log(`  - ${cmd.command_path}: ${cmd.description}`);
    });

  } catch (error) {
    console.error('Error during detailed debug:', error);
  }
}

debugDetailed();