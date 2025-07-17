/**
 * CLI command: systemprompt system:update:core
 * Updates core SystemPrompt code from upstream
 */

export default {
  name: 'update:core',
  description: 'Update core SystemPrompt code from upstream',
  
  async handler(module: any, args: string[]): Promise<void> {
    console.log('🔄 Updating SystemPrompt core...\n');
    
    try {
      // Show current status first
      const status = await module.getUpdateStatus();
      
      if (!status.core.isRepo) {
        console.error('❌ Error: Not a git repository');
        process.exit(1);
      }
      
      console.log(`📍 Current branch: ${status.core.branch}`);
      
      if (status.core.hasChanges) {
        console.log('⚠️  Warning: Local changes detected (will be stashed)');
      }
      
      if (status.core.behind === 0) {
        console.log('✅ Already up to date!');
        return;
      }
      
      console.log(`📥 ${status.core.behind} updates available\n`);
      
      // Perform update
      const result = await module.updateCore();
      
      if (result.success) {
        console.log('✅ Core updated successfully!');
        if (result.output) {
          console.log('\nChanges:');
          console.log(result.output);
        }
        console.log('\n💡 Restart the container to apply updates:');
        console.log('   docker-compose restart');
      }
    } catch (error) {
      console.error('❌ Update failed:', error.message);
      process.exit(1);
    }
  }
};