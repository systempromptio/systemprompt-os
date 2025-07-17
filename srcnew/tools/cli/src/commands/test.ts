/**
 * @fileoverview Test command implementation
 * @module cli/commands/test
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

export class TestCommand {
  async execute(options: { e2e?: boolean; integration?: boolean; unit?: boolean; all?: boolean; watch?: boolean }): Promise<void> {
    try {
      console.log('Running tests...\n');
      
      const srcnewPath = resolve(process.cwd(), 'srcnew');
      const cwd = srcnewPath;
      const args = ['run'];
      
      if (options.all) {
        args.push('test:all');
      } else if (options.e2e) {
        args.push('test:e2e');
      } else if (options.integration) {
        args.push('test:integration');
      } else if (options.unit) {
        args.push('test:unit');
      } else if (options.watch) {
        args.push('test');
      } else {
        // Default to unit tests
        args.push('test:unit');
      }
      
      const child = spawn('npm', args, {
        cwd,
        stdio: 'inherit',
        shell: true
      });
      
      child.on('exit', (code) => {
        if (code === 0) {
          console.log('\nAll tests passed!');
        } else {
          console.log('\nTests failed with exit code:', code);
        }
        process.exit(code || 0);
      });
      
      child.on('error', (error) => {
        console.error('Failed to run tests:', error);
        process.exit(1);
      });
      
    } catch (error) {
      console.error('Error running tests:', error);
      process.exit(1);
    }
  }
}