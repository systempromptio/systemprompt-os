import { DatabaseService } from './build/modules/core/database/services/database.service.js';
import { LoggerService } from './build/modules/core/logger/services/logger.service.js';

async function checkSchema() {
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

    // Check the actual schema of cli_commands table
    const schema = await dbService.query("PRAGMA table_info(cli_commands)");
    console.log('CLI Commands table schema:');
    schema.forEach(col => {
      console.log(`  ${col.name}: ${col.type} (nullable: ${!col.notnull}, default: ${col.dflt_value})`);
    });

  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema();