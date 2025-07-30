import { Bootstrap } from './src/bootstrap.js';

const bootstrap = new Bootstrap({ 
  skipMcp: true, 
  environment: 'test', 
  cliMode: true 
});

try {
  const modules = await bootstrap.bootstrap();
  const cliModule = modules.get('cli');
  const cliService = cliModule.exports.service();
  const commands = await cliService.getCommandsFromDatabase();

  console.log('Total commands in database:', commands.length);
  
  console.log('\nAgent create command:');
  const agentCreate = commands.find(cmd => cmd.command_path === 'agents:create');
  if (agentCreate) {
    console.log('Command:', agentCreate.command_path);
    console.log('Options:', JSON.stringify(agentCreate.options, null, 2));
  } else {
    console.log('agents:create command not found');
  }

  console.log('\nAgent update command:');
  const agentUpdate = commands.find(cmd => cmd.command_path === 'agents:update');
  if (agentUpdate) {
    console.log('Command:', agentUpdate.command_path);
    console.log('Options:', JSON.stringify(agentUpdate.options, null, 2));
  } else {
    console.log('agents:update command not found');
  }

  await bootstrap.shutdown();
} catch (error) {
  console.error('Error:', error);
}