import { CommandDiscovery } from './src/cli/src/discovery.js';

const discovery = new CommandDiscovery();

discovery.discoverCommands().then(commands => {
  console.log('Total commands found:', commands.size);
  console.log('\nCommands by module:');
  
  const moduleMap = new Map();
  commands.forEach((cmd, name) => {
    const module = name.split(':')[0];
    if (!moduleMap.has(module)) {
      moduleMap.set(module, []);
    }
    moduleMap.get(module).push(name);
  });
  
  moduleMap.forEach((cmds, module) => {
    console.log(`\n${module}: ${cmds.length} commands`);
    cmds.forEach(cmd => console.log(`  - ${cmd}`));
  });
}).catch(err => {
  console.error('Error:', err);
});