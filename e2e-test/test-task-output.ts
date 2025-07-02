#!/usr/bin/env tsx
/**
 * Test script to verify task output and logs are properly saved
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTaskOutput() {
  console.log('🧪 Testing task output capture and logging...\n');

  // Setup connection
  const url = `http://127.0.0.1:${process.env.PORT || 3000}`;
  console.log(`📡 Connecting to ${url}`);
  
  const transport = new StreamableHTTPClientTransport(
    new URL('/mcp', url),
    {
      requestInit: {
        headers: {
          'Accept': 'application/json, text/event-stream',
          'Content-Type': 'application/json'
        }
      }
    }
  );
  const client = new Client({
    name: 'task-output-test',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log('✅ Connected to MCP server\n');

  // Create a test task that uses tools
  console.log('📝 Creating task with tool usage...');
  const createResult = await client.callTool('create_task', {
    tool: 'CLAUDECODE',
    instructions: 'Create a file called test-output.txt with the content "Hello from test" and then tell me what you did'
  });

  const taskId = createResult.content[0].text.match(/Created task with ID: (\S+)/)?.[1];
  if (!taskId) {
    throw new Error('Failed to extract task ID from response');
  }
  console.log(`✅ Created task: ${taskId}\n`);

  // Wait for task to complete
  console.log('⏳ Waiting for task to complete...');
  await wait(15000); // Give Claude time to execute

  // Read the task resource
  console.log(`📖 Reading task resource: task://${taskId}`);
  const taskResource = await client.readResource(`task://${taskId}`);
  const taskData = JSON.parse(taskResource.contents[0].text);

  console.log('\n📊 Task Summary:');
  console.log(`  ID: ${taskData.id}`);
  console.log(`  Status: ${taskData.status}`);
  console.log(`  Log count: ${taskData.log_count}`);
  console.log(`  Has result: ${taskData.result ? 'Yes' : 'No'}`);

  // Check if result is properly parsed (not stringified JSON)
  if (taskData.result && typeof taskData.result === 'string' && taskData.result.includes('"type":"result"')) {
    console.error('\n❌ ERROR: Result is still stringified JSON!');
    console.error('Result:', taskData.result.substring(0, 100) + '...');
    process.exit(1);
  }

  // Check for logs
  if (!taskData.logs || taskData.logs.length === 0) {
    console.log('\n⚠️  WARNING: No logs included in task resource');
    console.log('Reading logs separately...');
    
    // Try to read logs via separate endpoint
    try {
      const logsResource = await client.readResource(`task://${taskId}/logs`);
      console.log('✅ Logs available via task://[id]/logs endpoint');
    } catch (e) {
      console.error('❌ Failed to read logs separately');
    }
  } else {
    console.log(`\n✅ Found ${taskData.logs.length} log entries`);
    
    // Check for tool usage
    const toolLogs = taskData.logs.filter((log: any) => log.type === 'tool');
    console.log(`  Tool logs: ${toolLogs.length}`);
    
    if (taskData.tool_invocations) {
      console.log(`  Tool invocations: ${taskData.tool_invocations.length}`);
      taskData.tool_invocations.forEach((inv: any) => {
        console.log(`    - ${inv.toolName}: ${inv.success ? '✅' : '❌'} (${inv.duration}ms)`);
      });
    }
    
    if (taskData.tool_usage_summary) {
      console.log('\n📈 Tool Usage Summary:');
      console.log(`  Total invocations: ${taskData.tool_usage_summary.totalInvocations}`);
      console.log(`  Successful: ${taskData.tool_usage_summary.successfulInvocations}`);
      console.log(`  Failed: ${taskData.tool_usage_summary.failedInvocations}`);
      console.log(`  Total duration: ${taskData.tool_usage_summary.totalDuration}ms`);
    }
  }

  // Check if result is properly structured
  if (taskData.result) {
    console.log('\n📋 Result Structure:');
    if (typeof taskData.result === 'object') {
      console.log('✅ Result is properly parsed object');
      if (taskData.result.output) {
        console.log(`  Output: "${taskData.result.output.substring(0, 50)}..."`);
      }
      if (taskData.result.success !== undefined) {
        console.log(`  Success: ${taskData.result.success}`);
      }
    } else {
      console.log(`❌ Result is ${typeof taskData.result}: ${taskData.result.substring(0, 100)}...`);
    }
  }

  // Check metadata
  if (taskData.metadata) {
    console.log('\n💰 Cost & Performance:');
    console.log(`  Duration: ${taskData.metadata.duration_ms}ms`);
    console.log(`  Cost: $${taskData.metadata.cost_usd}`);
    if (taskData.metadata.tokens) {
      console.log(`  Tokens: ${taskData.metadata.tokens.input} in, ${taskData.metadata.tokens.output} out`);
    }
  }

  console.log('\n✅ Task output test completed!');
  await client.close();
}

// Run the test
testTaskOutput().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});