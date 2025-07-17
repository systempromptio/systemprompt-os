/**
 * CLI command: systemprompt system:deploy:init
 * Initializes deployment structure for custom code
 */

export default {
  name: 'deploy:init',
  description: 'Initialize deployment structure for custom code',
  
  async handler(module: any, args: string[]): Promise<void> {
    console.log('🚀 Initializing deployment structure...\n');
    
    try {
      const result = await module.initDeployment();
      
      if (result.success) {
        console.log('✅ Deployment structure initialized successfully!\n');
        console.log(`📁 Custom code root: ${result.customRoot}`);
        console.log('\n📦 Created git repositories:');
        console.log('   - modules/       → Custom SystemPrompt modules');
        console.log('   - mcp-servers/   → Custom MCP servers');
        console.log('\n🔗 Symlinks created:');
        console.log('   - ./modules/custom      → Your custom modules');
        console.log('   - ./server/mcp/custom   → Your custom MCP servers');
        console.log('\n💡 Next steps:');
        console.log('   1. Add your custom modules to:');
        console.log(`      ${result.customRoot}/modules/`);
        console.log('   2. Add your custom MCP servers to:');
        console.log(`      ${result.customRoot}/mcp-servers/`);
        console.log('   3. Commit and push to your git remotes');
        console.log('   4. Use system:update:custom to pull updates');
      }
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      process.exit(1);
    }
  }
};