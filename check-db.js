import { DatabaseService } from './build/modules/core/database/services/database.service.js';
import { LoggerService } from './build/modules/core/logger/services/logger.service.js';

async function checkDatabase() {
  try {
    const logger = LoggerService.getInstance();
    logger.initialize({
      stateDir: './state',
      logLevel: 'info',
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

    // Check if cli_commands table exists
    const tables = await dbService.query("SELECT name FROM sqlite_master WHERE type='table' AND name='cli_commands'");
    console.log('CLI Commands table exists:', tables.length > 0);

    if (tables.length > 0) {
      // Check if any commands are in the table
      const commands = await dbService.query("SELECT * FROM cli_commands");
      console.log('Number of commands in database:', commands.length);
      
      if (commands.length > 0) {
        console.log('Commands:');
        commands.forEach(cmd => {
          console.log(`  - ${cmd.command_path}: ${cmd.description}`);
        });
      }
    }

    // Check all tables
    const allTables = await dbService.query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('All tables in database:', allTables.map(t => t.name));

  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabase();