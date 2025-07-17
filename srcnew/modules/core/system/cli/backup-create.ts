/**
 * CLI command: systemprompt system:backup:create
 * Creates a backup of current state
 */

export default {
  name: 'backup:create',
  description: 'Create a backup of current state',
  
  async handler(module: any, args: string[]): Promise<void> {
    const backupName = args[0]; // Optional custom name
    
    console.log('💾 Creating backup...\n');
    
    try {
      const result = await module.createBackup(backupName);
      
      if (result.success) {
        console.log('✅ Backup created successfully!');
        console.log(`📁 Name: ${result.name}`);
        console.log(`📍 Location: ${result.path}`);
        console.log('\n💡 To restore this backup later:');
        console.log(`   systemprompt system:backup:restore ${result.name}`);
      }
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      process.exit(1);
    }
  }
};