/**
 * CLI command: systemprompt system:update:status
 * Shows update status for core and custom code
 */

export default {
  name: 'update:status',
  description: 'Show update status for core and custom code',
  
  async handler(module: any, args: string[]): Promise<void> {
    console.log('📊 SystemPrompt Update Status\n');
    
    try {
      const status = await module.getUpdateStatus();
      
      // Core status
      console.log('🏢 Core SystemPrompt:');
      if (status.core.isRepo) {
        console.log(`   Branch: ${status.core.branch}`);
        console.log(`   Local changes: ${status.core.hasChanges ? 'Yes ⚠️' : 'No ✅'}`);
        
        if (status.core.behind > 0) {
          console.log(`   Updates available: ${status.core.behind} commits 📥`);
        } else {
          console.log(`   Status: Up to date ✅`);
        }
        
        if (status.core.ahead > 0) {
          console.log(`   Unpushed commits: ${status.core.ahead} 📤`);
        }
      } else {
        console.log(`   Status: Not a git repository ❌`);
      }
      
      // Custom modules status
      console.log('\n📦 Custom Modules:');
      if (!status.modules) {
        console.log('   Status: Not configured');
      } else if (status.modules.isRepo) {
        console.log(`   Branch: ${status.modules.branch}`);
        console.log(`   Local changes: ${status.modules.hasChanges ? 'Yes ⚠️' : 'No ✅'}`);
        
        if (status.modules.behind > 0) {
          console.log(`   Updates available: ${status.modules.behind} commits 📥`);
        } else {
          console.log(`   Status: Up to date ✅`);
        }
      } else {
        console.log(`   Status: Not a git repository`);
      }
      
      // MCP servers status
      console.log('\n🔌 Custom MCP Servers:');
      if (!status.mcp) {
        console.log('   Status: Not configured');
      } else if (status.mcp.isRepo) {
        console.log(`   Branch: ${status.mcp.branch}`);
        console.log(`   Local changes: ${status.mcp.hasChanges ? 'Yes ⚠️' : 'No ✅'}`);
        
        if (status.mcp.behind > 0) {
          console.log(`   Updates available: ${status.mcp.behind} commits 📥`);
        } else {
          console.log(`   Status: Up to date ✅`);
        }
      } else {
        console.log(`   Status: Not a git repository`);
      }
      
      // Summary
      const hasUpdates = (status.core.behind > 0) || 
                        (status.modules?.behind > 0) || 
                        (status.mcp?.behind > 0);
      
      if (hasUpdates) {
        console.log('\n💡 Updates are available! Run:');
        if (status.core.behind > 0) {
          console.log('   systemprompt system:update:core     # Update core');
        }
        if ((status.modules?.behind > 0) || (status.mcp?.behind > 0)) {
          console.log('   systemprompt system:update:custom   # Update custom code');
        }
      } else {
        console.log('\n✅ Everything is up to date!');
      }
      
    } catch (error) {
      console.error('❌ Failed to check status:', error.message);
      process.exit(1);
    }
  }
};