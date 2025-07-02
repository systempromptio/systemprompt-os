/**
 * Simple test to verify tool tracking is working
 */

import { createMCPClient, log } from './utils/test-utils.js';

async function main() {
  const client = await createMCPClient(true);
  
  try {
    // Create a simple task that uses tools
    log.info('Creating task with tool usage...');
    const result = await client.callTool({
      name: 'create_task',
      arguments: {
        title: 'Simple Tool Test',
        instructions: 'Create a file called hello.txt with the content "Hello World" and then run ls -la hello.txt'
      }
    });
    
    const taskId = (result.content as any)[0].text.match(/ID ([a-f0-9-]+)/)?.[1];
    log.info(`Task ID: ${taskId}`);
    
    // Wait for completion
    log.info('Waiting 20 seconds for task to complete...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Read the task
    log.info('Reading task resource...');
    const taskResource = await client.readResource({ uri: `task://${taskId}` });
    const task = JSON.parse(taskResource.contents[0].text as string);
    
    // Check what we got
    log.info(`Task status: ${task.status}`);
    log.info(`Log count: ${task.log_count}`);
    log.info(`Has logs array: ${task.logs ? 'Yes' : 'No'}`);
    log.info(`Has tool_invocations: ${task.tool_invocations ? 'Yes' : 'No'}`);
    
    if (task.logs) {
      log.info(`Number of logs: ${task.logs.length}`);
      const toolLogs = task.logs.filter((l: any) => l.type === 'tool');
      log.info(`Tool logs: ${toolLogs.length}`);
      
      // Show tool logs
      toolLogs.forEach((tl: any) => {
        log.info(`  ${tl.prefix} - ${tl.message} - ${tl.metadata?.toolName || 'N/A'}`);
      });
    }
    
    if (task.tool_invocations) {
      log.info(`\nTool invocations: ${task.tool_invocations.length}`);
      task.tool_invocations.forEach((inv: any) => {
        log.info(`  ${inv.toolName}: ${inv.success ? '✅' : '❌'}`);
      });
    } else {
      log.error('❌ No tool invocations found!');
    }
    
    // Show result
    if (task.result) {
      log.info(`\nResult: ${JSON.stringify(task.result)}`);
    }
    
    // Clean up
    try {
      await client.callTool({
        name: 'create_task',
        arguments: {
          title: 'Cleanup',
          instructions: 'Delete hello.txt if it exists'
        }
      });
    } catch (e) {
      // Ignore cleanup errors
    }
    
  } finally {
    await client.close();
  }
}

main().catch(error => {
  log.error(`Test failed: ${error}`);
  process.exit(1);
});