/**
 * @file Test Output Capture in Task Result
 * @module test-output-capture
 * 
 * @remarks
 * Tests that the output from Claude is properly captured and stored in the task result field
 */

import { createMCPClient, log, TestTracker, runTest } from './utils/test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ResourceUpdatedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOutputCapture(client: Client): Promise<void> {
  let taskId: string | null = null;
  let taskComplete = false;
  
  // Set up notification handler to monitor task updates
  client.setNotificationHandler(ResourceUpdatedNotificationSchema, async (notification) => {
    if (taskId && notification.params.uri === `task://${taskId}`) {
      try {
        const taskResource = await client.readResource({ uri: notification.params.uri });
        const contents = taskResource.contents as any[];
        if (contents?.[0]?.text) {
          const taskInfo = JSON.parse(contents[0].text);
          
          log.info(`📊 Task Status: ${taskInfo.status}`);
          log.info(`📊 Has Result: ${!!taskInfo.result}`);
          
          if (taskInfo.result) {
            log.success(`✅ Task result captured: ${JSON.stringify(taskInfo.result).substring(0, 100)}...`);
          }
          
          // Check if task is complete (handle both old and new status names)
          if (taskInfo.status === 'waiting' || taskInfo.status === 'completed_active' || taskInfo.status === 'completed' || taskInfo.status === 'failed') {
            taskComplete = true;
            log.info(`✅ Task ${taskInfo.status}!`);
            
            // Debug the entire task object
            log.debug(`Full task object: ${JSON.stringify(taskInfo, null, 2)}`);
          }
        }
      } catch (error) {
        log.error(`Failed to read task resource: ${error}`);
      }
    }
  });
  
  // Create a simple task that should produce output
  log.info('Creating task to test output capture...');
  const createResult = await client.callTool({
    name: 'create_task',
    arguments: {
      instructions: 'Say "Hello from the pirate test!" and nothing else'
    }
  });
  
  const content = createResult.content as any[];
  if (!content?.[0]?.text) {
    throw new Error('No response from create_task');
  }
  
  // Debug the response
  log.debug(`Response text: ${content[0].text}`);
  log.debug(`Response type: ${typeof content[0].text}`);
  
  // Check if response is already parsed or needs parsing
  let response;
  if (typeof content[0].text === 'string' && content[0].text.startsWith('{')) {
    response = JSON.parse(content[0].text);
    taskId = response.result?.task_id;
  } else {
    // Try to extract task ID from the plain text response
    const match = content[0].text.match(/ID ([a-f0-9-]+)/);
    if (!match) {
      throw new Error(`Could not extract task ID from response: ${content[0].text}`);
    }
    taskId = match[1];
  }
  
  if (!taskId) {
    throw new Error('No task ID in response');
  }
  
  log.info(`Created task ${taskId}`);
  log.info('Waiting for task to complete...');
  
  // Wait for task to complete (max 30 seconds)
  const maxWaitTime = 30000;
  const startTime = Date.now();
  
  while (!taskComplete && (Date.now() - startTime) < maxWaitTime) {
    await sleep(1000);
  }
  
  if (!taskComplete) {
    throw new Error('Task did not complete within timeout');
  }
  
  // Read the final task state
  const finalTaskResource = await client.readResource({ uri: `task://${taskId}` });
  const finalContents = finalTaskResource.contents as any[];
  if (!finalContents?.[0]?.text) {
    throw new Error('Could not read final task state');
  }
  
  const finalTask = JSON.parse(finalContents[0].text);
  
  // Verify the output was captured
  if (!finalTask.result) {
    log.error('❌ Task result field is missing!');
    log.error(`Final task state: ${JSON.stringify(finalTask, null, 2)}`);
    throw new Error('Task result was not captured');
  }
  
  log.success('✅ Task result successfully captured!');
  log.info(`Result: ${JSON.stringify(finalTask.result)}`);
}

export async function testOutputCaptureE2E(): Promise<void> {
  const tracker = new TestTracker();
  let client: Client | null = null;
  
  try {
    // Create client
    client = await createMCPClient(true);
    
    // Run test
    await runTest(
      'Output Capture E2E Test',
      async () => {
        await testOutputCapture(client!);
      },
      tracker
    );
    
    tracker.printSummary();
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testOutputCaptureE2E()
    .then(() => {
      log.success('✅ Output capture test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      log.error(`❌ Output capture test failed: ${error}`);
      process.exit(1);
    });
}