import { DatabaseService } from '../build/modules/core/database/services/database.service.js';
import { LoggerService } from '../build/modules/core/logger/services/logger.service.js';

// Initialize logger first
const logger = LoggerService.getInstance();
logger.initialize({
  logLevel: 'info',
  outputs: ['console'],
  timestamp: true,
  pretty: true,
  stateDir: './state'
});

// Initialize database
await DatabaseService.initialize({
  type: 'sqlite', 
  sqlite: {filename: './state/database.db'}
}, logger);

const db = DatabaseService.getInstance();

console.log('\n=== Modules Table ===');
const modules = await db.query('SELECT name, path, enabled FROM modules');
console.log(modules);

console.log('\n=== CLI Commands Table ===');
const commands = await db.query('SELECT * FROM cli_commands LIMIT 10');
console.log(commands);

await db.disconnect();