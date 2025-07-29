import { Bootstrap } from './src/bootstrap';
import { DatabaseService } from './src/modules/core/database/services/database.service';
import { LoggerService } from './src/modules/core/logger/services/logger.service';
import { LoggerMode, LogOutput } from './src/modules/core/logger/types';

async function testCLIBootstrap() {
  console.log('🔧 Testing CLI Bootstrap...\n');

  try {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_FILE = './test-cli.db';
    process.env.STATE_PATH = './test-state';
    process.env.LOG_MODE = 'cli';
    
    // Bootstrap the system
    console.log('1️⃣ Bootstrapping system...');
    const bootstrap = new Bootstrap({
      skipMcp: true,
      environment: 'test',
      cliMode: true,
    });

    const modules = await bootstrap.bootstrap();
    console.log(`✅ Bootstrapped ${modules.size} modules`);
    
    // Get CLI module
    const cliModule = modules.get('cli');
    if (!cliModule) {
      throw new Error('CLI module not found');
    }
    
    // Check CLI service
    console.log('\n2️⃣ Checking CLI service...');
    const cliService = cliModule.exports.service();
    console.log(`✅ CLI service initialized: ${cliService.isInitialized()}`);
    
    // Get database service
    const database = DatabaseService.getInstance();
    
    // Check CLI tables
    console.log('\n3️⃣ Checking database tables...');
    const tables = await database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cli_%'"
    );
    console.log('CLI Tables found:', tables.map(t => t.name));
    
    // Check registered commands
    console.log('\n4️⃣ Checking registered commands...');
    const commands = await database.query(
      'SELECT COUNT(*) as count FROM cli_commands'
    );
    console.log(`Commands registered: ${commands[0].count}`);
    
    // List some commands
    const commandList = await database.query(
      'SELECT command_path, module_name FROM cli_commands LIMIT 10'
    );
    console.log('\nSample commands:');
    commandList.forEach((cmd: any) => {
      console.log(`  - ${cmd.command_path} (module: ${cmd.module_name})`);
    });
    
    // Get all commands through service
    console.log('\n5️⃣ Getting commands through CLI service...');
    const allCommands = await cliService.getAllCommands();
    console.log(`Total commands available: ${allCommands.size}`);
    
    // Sample some commands
    let count = 0;
    for (const [name, cmd] of allCommands) {
      if (count++ < 5) {
        console.log(`  - ${name}: ${cmd.description}`);
      }
    }

    // Shutdown
    console.log('\n✅ Test completed successfully!');
    await bootstrap.shutdown();
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCLIBootstrap().catch(console.error);