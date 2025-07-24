import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index.js';

export const command: CLICommand = {
  description: 'Start interactive REPL',

  async execute(_context: CLIContext): Promise<void> {
    const { getModuleLoader } = await import('../../../loader.js');
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const devModule = moduleLoader.getModule('dev');
    const devService = devModule?.exports?.service;

    if (!devService) {
      console.error('Dev service not available');
      process.exit(1);
    }

    console.log('Starting SystemPrompt OS REPL...');
    console.log('Available objects: db, logger, modules');
    console.log('Type .help for more information');
    console.log('Type .exit to quit\n');

    const modules = moduleLoader.getLoadedModules();
    const replContext = {
      modules: Object.fromEntries(modules.map((m: any) => [m.name, m])),
      moduleLoader,
    };

    try {
      await devService.startRepl(replContext);
    } catch (error) {
      console.error('Failed to start REPL:', error);
      process.exit(1);
    }
  },
};
