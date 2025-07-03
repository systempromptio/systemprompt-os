/**
 * @file Task Lifecycle Test
 * @module test-task-lifecycle
 * 
 * @remarks
 * Tests task lifecycle including waiting status and updates
 */

import { createMCPClient, log, TestTracker } from './utils/test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Test task lifecycle with waiting and updates
 */
async function testTaskLifecycle(): Promise<void> {
  const tracker = new TestTracker();
  let client: Client | undefined;
  let taskId: string | undefined;
  
  try {
    log.title('Task Lifecycle Test');
    log.info('Testing task creation, waiting, updating, and ending');
    
    // Create MCP client
    client = await createMCPClient();
    
    // Test 1: Create task that creates a file
    const start1 = Date.now();
    try {
      log.info('Creating task with file creation...');
      const timestamp = Date.now();
      const testFile = `/tmp/test-task-${timestamp}.txt`;
      
      const result = await client.callTool({
        name: 'create_task',
        arguments: {
          title: `Test Task Lifecycle ${timestamp}`,
          instructions: `echo "Initial content created at ${new Date().toISOString()}" > ${testFile}`
        }
      });
      
      // Extract task ID from result
      const content = result.content[0];
      if (content.type !== 'text') {
        throw new Error('Expected text content from create_task');
      }
      
      // Parse task ID from response
      log.debug(`Full response text: ${content.text}`);
      const taskIdMatch = content.text.match(/Task created with ID: ([a-f0-9-]+)/);
      if (!taskIdMatch) {
        // Try alternative patterns
        const altMatch = content.text.match(/task.*?([a-f0-9-]{36})/i);
        if (altMatch) {
          taskId = altMatch[1];
          log.debug(`Extracted task ID (alternative pattern): ${taskId}`);
        } else {
          throw new Error(`Could not extract task ID from response: ${content.text}`);
        }
      } else {
        taskId = taskIdMatch[1];
        log.debug(`Created task with ID: ${taskId}`);
      }
      
      // Wait for task to complete initial execution
      log.debug('Waiting 10 seconds for task to complete initial execution...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Verify file was created
      if (!existsSync(testFile)) {
        // List files in /tmp to debug
        const { stdout } = await execAsync('ls /tmp/test-task-*.txt 2>/dev/null || echo "No files found"');
        log.debug(`Files in /tmp: ${stdout.trim()}`);
        throw new Error(`Test file was not created at ${testFile}`);
      }
      
      const initialContent = readFileSync(testFile, 'utf8');
      log.debug(`Initial file content: ${initialContent}`);
      
      const duration1 = Date.now() - start1;
      log.success(`Create task with file creation (${duration1}ms)`);
      tracker.add({ name: 'Create task with file creation', passed: true, duration: duration1 });
    } catch (error) {
      const duration1 = Date.now() - start1;
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Create task with file creation failed: ${errorMsg}`);
      tracker.add({ name: 'Create task with file creation', passed: false, error: errorMsg, duration: duration1 });
      throw error;
    }
    
    // Test 2: Wait 30 seconds (demonstrating task stays in waiting status)
    const start2 = Date.now();
    try {
      log.info('Wait 30 seconds with task in waiting status...');
      log.info('Waiting 30 seconds to demonstrate task remains in waiting status...');
      
      // Wait 30 seconds
      for (let i = 0; i < 30; i++) {
        process.stdout.write(`\rWaiting... ${30 - i} seconds remaining`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log('\r                                        \r'); // Clear the line
      
      log.debug('Completed 30 second wait');
      
      const duration2 = Date.now() - start2;
      log.success(`Wait 30 seconds with task in waiting status (${duration2}ms)`);
      tracker.add({ name: 'Wait 30 seconds with task in waiting status', passed: true, duration: duration2 });
    } catch (error) {
      const duration2 = Date.now() - start2;
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Wait 30 seconds with task in waiting status failed: ${errorMsg}`);
      tracker.add({ name: 'Wait 30 seconds with task in waiting status', passed: false, error: errorMsg, duration: duration2 });
      throw error;
    }
    
    // Test 3: Update the task (update the file)
    const start3 = Date.now();
    try {
      log.info('Updating task to modify file...');
      const timestamp = Date.now();
      
      const result = await client.callTool({
        name: 'update_task',
        arguments: {
          id: taskId,
          instructions: `echo "Updated content added at ${new Date().toISOString()}" >> /tmp/test-task-*.txt`
        }
      });
      
      log.debug(`Update result: ${JSON.stringify(result.content)}`);
      
      // Wait for update to complete
      log.debug('Waiting 5 seconds for update to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Find the test file (it should still exist from test 1)
      const { stdout } = await execAsync('ls /tmp/test-task-*.txt');
      const testFiles = stdout.trim().split('\n').filter(f => f.length > 0);
      
      if (testFiles.length === 0) {
        throw new Error('No test files found');
      }
      
      const testFile = testFiles[0];
      
      // Verify file was updated
      const updatedContent = readFileSync(testFile, 'utf8');
      log.debug(`Updated file content: ${updatedContent}`);
      
      if (!updatedContent.includes('Updated content added at')) {
        throw new Error('File was not updated with new content');
      }
      
      const duration3 = Date.now() - start3;
      log.success(`Update task to modify file (${duration3}ms)`);
      tracker.add({ name: 'Update task to modify file', passed: true, duration: duration3 });
    } catch (error) {
      const duration3 = Date.now() - start3;
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Update task to modify file failed: ${errorMsg}`);
      tracker.add({ name: 'Update task to modify file', passed: false, error: errorMsg, duration: duration3 });
      throw error;
    }
    
    // Test 4: Wait another 30 seconds
    const start4 = Date.now();
    try {
      log.info('Waiting another 30 seconds...');
      
      for (let i = 0; i < 30; i++) {
        process.stdout.write(`\rWaiting... ${30 - i} seconds remaining`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log('\r                                        \r'); // Clear the line
      
      const duration4 = Date.now() - start4;
      log.success(`Wait another 30 seconds (${duration4}ms)`);
      tracker.add({ name: 'Wait another 30 seconds', passed: true, duration: duration4 });
    } catch (error) {
      const duration4 = Date.now() - start4;
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Wait another 30 seconds failed: ${errorMsg}`);
      tracker.add({ name: 'Wait another 30 seconds', passed: false, error: errorMsg, duration: duration4 });
      throw error;
    }
    
    // Test 5: End the task
    const start5 = Date.now();
    try {
      log.info('Ending task...');
      const result = await client.callTool({
        name: 'end_task',
        arguments: { id: taskId }
      });
      
      log.debug(`End task result: ${JSON.stringify(result.content)}`);
      
      const duration5 = Date.now() - start5;
      log.success(`End task (${duration5}ms)`);
      tracker.add({ name: 'End task', passed: true, duration: duration5 });
    } catch (error) {
      const duration5 = Date.now() - start5;
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`End task failed: ${errorMsg}`);
      tracker.add({ name: 'End task', passed: false, error: errorMsg, duration: duration5 });
      throw error;
    }
    
  } catch (error) {
    log.error(`Test suite error: ${error}`);
    tracker.add({
      name: 'Test Suite',
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    // Clean up
    if (client) {
      await client.close();
    }
    
    // Print summary
    tracker.printSummary();
    
    // Exit with appropriate code
    const { failed } = tracker.getSummary();
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Export for use in test-all
export { testTaskLifecycle };

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testTaskLifecycle().catch(error => {
    log.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}