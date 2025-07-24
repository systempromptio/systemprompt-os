/**
 * @fileoverview MCP test commands
 * @module modules/core/mcp/cli
 */

import { Command } from 'commander';
import type { MCPModule } from '../index.js';
import { LoggerService } from '@/modules/core/logger/services/logger.service.js';

export function createTestCommand(module: MCPModule): Command {
  const cmd = new Command('test').description('Test MCP components');

  // Test tool
  cmd
    .command('tool')
    .description('Test a tool execution')
    .requiredOption('-n, --name <name>', 'Tool name')
    .requiredOption('-a, --args <args>', 'Tool arguments (JSON string)')
    .action(async (options) => {
      try {
        // Parse arguments
        let args: any;
        try {
          args = JSON.parse(options.args);
        } catch {
          console.error('Error: Invalid JSON for arguments');
          process.exit(1);
        }

        console.log(`\nTesting tool: ${options.name}`);
        console.log('Arguments:', JSON.stringify(args, null, 2));
        console.log('\n--- Test Execution ---\n');

        const startTime = Date.now();

        // Execute tool
        const result = await module.executeTool(options.name, args, {
          userId: 'test-user',
          sessionId: 'test-session',
          logger: LoggerService.getInstance(),
        });

        const duration = Date.now() - startTime;

        console.log('\n--- Test Results ---\n');
        console.log(`Status: ${result.success ? '✓ Success' : '✗ Failed'}`);
        console.log(`Duration: ${duration}ms`);

        if (result.success) {
          console.log('\nOutput:');
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          console.log('\nError:');
          console.log(`Code: ${result.error?.code}`);
          console.log(`Message: ${result.error?.message}`);
          if (result.error?.details) {
            console.log('Details:', JSON.stringify(result.error.details, null, 2));
          }
        }

        if (result.metadata) {
          console.log('\nMetadata:');
          console.log(JSON.stringify(result.metadata, null, 2));
        }

        process.exit(result.success ? 0 : 1);
      } catch (error: any) {
        console.error('\n--- Test Failed ---\n');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
      }
    });

  // Integration tests
  cmd
    .command('integration')
    .description('Run MCP integration tests')
    .action(async () => {
      try {
        console.log('Running MCP integration tests...\n');

        let passed = 0;
        let failed = 0;

        // Test 1: Server info
        console.log('Test 1: Get server info');
        try {
          const info = await module.getServerInfo();
          if (info.name && info.version && info.capabilities) {
            console.log('  ✓ Passed');
            passed++;
          } else {
            console.log('  ✗ Failed: Invalid server info');
            failed++;
          }
        } catch (error: any) {
          console.log(`  ✗ Failed: ${error.message}`);
          failed++;
        }

        // Test 2: List tools
        console.log('\nTest 2: List tools');
        try {
          const tools = await module.listTools();
          if (Array.isArray(tools)) {
            console.log(`  ✓ Passed (${tools.length} tools found)`);
            passed++;
          } else {
            console.log('  ✗ Failed: Invalid tools response');
            failed++;
          }
        } catch (error: any) {
          console.log(`  ✗ Failed: ${error.message}`);
          failed++;
        }

        // Test 3: List prompts
        console.log('\nTest 3: List prompts');
        try {
          const prompts = await module.listPrompts();
          if (Array.isArray(prompts)) {
            console.log(`  ✓ Passed (${prompts.length} prompts found)`);
            passed++;
          } else {
            console.log('  ✗ Failed: Invalid prompts response');
            failed++;
          }
        } catch (error: any) {
          console.log(`  ✗ Failed: ${error.message}`);
          failed++;
        }

        // Test 4: List resources
        console.log('\nTest 4: List resources');
        try {
          const resources = await module.listResources();
          if (Array.isArray(resources)) {
            console.log(`  ✓ Passed (${resources.length} resources found)`);
            passed++;
          } else {
            console.log('  ✗ Failed: Invalid resources response');
            failed++;
          }
        } catch (error: any) {
          console.log(`  ✗ Failed: ${error.message}`);
          failed++;
        }

        // Test 5: Get statistics
        console.log('\nTest 5: Get statistics');
        try {
          const stats = await module.getStats();
          if (stats.tools && stats.prompts && stats.resources) {
            console.log('  ✓ Passed');
            passed++;
          } else {
            console.log('  ✗ Failed: Invalid statistics');
            failed++;
          }
        } catch (error: any) {
          console.log(`  ✗ Failed: ${error.message}`);
          failed++;
        }

        // Test 6: Cache operations
        console.log('\nTest 6: Cache operations');
        try {
          await module.clearCache();
          const stats = module.getCacheStats();
          if (stats.entries === 0) {
            console.log('  ✓ Passed');
            passed++;
          } else {
            console.log('  ✗ Failed: Cache not cleared');
            failed++;
          }
        } catch (error: any) {
          console.log(`  ✗ Failed: ${error.message}`);
          failed++;
        }

        // Summary
        console.log('\n=== Test Summary ===');
        console.log(`Total: ${passed + failed}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

        process.exit(failed > 0 ? 1 : 0);
      } catch (error: any) {
        console.error('Integration test error:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}
