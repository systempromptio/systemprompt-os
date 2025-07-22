/**
 * System update command
 */

import type { CLIContext } from '../../../../cli/src/types.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      const branch = context.args.branch || 'main';
      const restart = context.args.restart || false;
      
      console.log('SystemPrompt OS Update');
      console.log('=====================\n');
      
      // Check if this is a git repository
      if (!existsSync('.git')) {
        console.error('Error: Not a git repository');
        console.error('SystemPrompt OS must be installed from git to use update feature');
        process.exit(1);
      }
      
      // Get current branch and status
      console.log('Checking current status...');
      const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      
      if (status.trim()) {
        console.error('Error: Working directory has uncommitted changes');
        console.error('Please commit or stash your changes before updating');
        console.log('\nModified files:');
        console.log(status);
        process.exit(1);
      }
      
      console.log(`Current branch: ${currentBranch}`);
      
      // Fetch latest changes
      console.log('\nFetching latest changes...');
      execSync('git fetch origin', { stdio: 'inherit' });
      
      // Check if there are updates
      const behind = execSync(`git rev-list HEAD..origin/${branch} --count`, { encoding: 'utf8' }).trim();
      
      if (behind === '0') {
        console.log('\n✓ SystemPrompt OS is already up to date!');
        return;
      }
      
      console.log(`\nFound ${behind} new commits`);
      
      // Show what will be updated
      console.log('\nChanges to be applied:');
      const changes = execSync(`git log HEAD..origin/${branch} --oneline`, { encoding: 'utf8' });
      console.log(changes);
      
      // Switch branch if needed
      if (currentBranch !== branch) {
        console.log(`\nSwitching to ${branch} branch...`);
        execSync(`git checkout ${branch}`, { stdio: 'inherit' });
      }
      
      // Pull latest changes
      console.log('\nApplying updates...');
      execSync(`git pull origin ${branch}`, { stdio: 'inherit' });
      
      // Check if package.json was updated
      const filesChanged = execSync('git diff HEAD@{1} HEAD --name-only', { encoding: 'utf8' });
      
      if (filesChanged.includes('package.json')) {
        console.log('\nPackage dependencies have changed. Installing updates...');
        execSync('npm install', { stdio: 'inherit' });
      }
      
      // Rebuild if TypeScript files changed
      if (filesChanged.match(/\.ts$/m)) {
        console.log('\nRebuilding application...');
        execSync('npm run build', { stdio: 'inherit' });
      }
      
      console.log('\n✓ Update completed successfully!');
      
      // Show current version
      try {
        const packageJson = require('../../../../package.json');
        console.log(`\nCurrent version: ${packageJson.version}`);
      } catch {}
      
      if (restart) {
        console.log('\nRestarting system...');
        execSync(`${process.argv[0]} ${process.argv[1]} system:restart --confirm`, { 
          stdio: 'inherit' 
        });
      } else {
        console.log('\nPlease restart the system for changes to take effect:');
        console.log('  systemprompt system:restart');
      }
    } catch (error) {
      console.error('Error during update:', error);
      process.exit(1);
    }
  }
};