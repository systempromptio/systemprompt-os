/**
 * CLI command: systemprompt system:update:custom
 * Updates custom modules and MCP servers from their git repositories
 */

export default {
  name: 'update:custom',
  description: 'Update custom modules and MCP servers from their git repos',
  
  async handler(module: any, args: string[]): Promise<void> {
    console.log('🔄 Updating custom code...\n');
    
    try {
      const result = await module.updateCustom();
      
      // Display modules update result
      console.log('📦 Custom Modules:');
      if (result.modules.skipped) {
        console.log(`   ${result.modules.message}`);
      } else if (result.modules.success) {
        console.log(`   ✅ ${result.modules.message}`);
        if (result.modules.output) {
          console.log(`   ${result.modules.output}`);
        }
      } else if (result.modules.error) {
        console.log(`   ❌ Error: ${result.modules.error}`);
      }
      
      // Display MCP servers update result
      console.log('\n🔌 Custom MCP Servers:');
      if (result.mcp.skipped) {
        console.log(`   ${result.mcp.message}`);
      } else if (result.mcp.success) {
        console.log(`   ✅ ${result.mcp.message}`);
        if (result.mcp.output) {
          console.log(`   ${result.mcp.output}`);
        }
      } else if (result.mcp.error) {
        console.log(`   ❌ Error: ${result.mcp.error}`);
      }
      
      if (result.success) {
        console.log('\n💡 Restart the container to load updated custom code:');
        console.log('   docker-compose restart');
      }
    } catch (error) {
      console.error('❌ Update failed:', error.message);
      process.exit(1);
    }
  }
};