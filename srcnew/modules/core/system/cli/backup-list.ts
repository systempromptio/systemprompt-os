/**
 * CLI command: systemprompt system:backup:list
 * Lists available backups
 */

export default {
  name: 'backup:list',
  description: 'List available backups',
  
  async handler(module: any, args: string[]): Promise<void> {
    console.log('📋 Available Backups\n');
    
    try {
      const backups = await module.listBackups();
      
      if (backups.length === 0) {
        console.log('No backups found.');
        console.log('\n💡 Create a backup with:');
        console.log('   systemprompt system:backup:create');
        return;
      }
      
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.name}`);
        if (backup.timestamp) {
          const date = new Date(backup.timestamp);
          console.log(`   Created: ${date.toLocaleString()}`);
        }
        if (backup.systemVersion) {
          console.log(`   Version: ${backup.systemVersion}`);
        }
        if (backup.gitStatus) {
          const statuses = [];
          if (backup.gitStatus.core?.branch) {
            statuses.push(`core: ${backup.gitStatus.core.branch}`);
          }
          if (backup.gitStatus.modules?.branch) {
            statuses.push(`modules: ${backup.gitStatus.modules.branch}`);
          }
          if (backup.gitStatus.mcp?.branch) {
            statuses.push(`mcp: ${backup.gitStatus.mcp.branch}`);
          }
          if (statuses.length > 0) {
            console.log(`   Branches: ${statuses.join(', ')}`);
          }
        }
        console.log('');
      });
      
      console.log(`💡 To restore a backup:`);
      console.log(`   systemprompt system:backup:restore <backup-name>`);
      
    } catch (error) {
      console.error('❌ Failed to list backups:', error.message);
      process.exit(1);
    }
  }
};