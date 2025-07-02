#!/usr/bin/env npx tsx
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = `http://127.0.0.1:${process.env.PORT || '3010'}`;

async function testTaskOutput() {
  console.log('Testing task output capture...\n');
  console.log(`Connecting to MCP server at ${MCP_URL}`);
  
  const transport = new StreamableHTTPClientTransport(
    new URL(`${MCP_URL}/mcp`)
  );
  
  const client = new Client({ 
    name: 'test-task-output',
    version: '1.0.0'
  }, { capabilities: {} });
  
  await client.connect(transport);
  console.log('✓ Connected to MCP server\n');
  
  // Create a simple task
  console.log('Creating task...');
  const createResult = await client.callTool({
    name: 'create_task',
    arguments: {
      title: 'Test Output Capture',
      instructions: 'Say "Hello from Claude! The output capture is working." and nothing else.'
    }
  });
  
  console.log('Create result:', JSON.stringify(createResult, null, 2));
  
  // Extract task ID from structuredContent
  const taskId = (createResult as any).structuredContent?.result?.task_id;
  
  console.log(`✓ Task created with ID: ${taskId}\n`);
  
  if (!taskId) {
    console.error('Failed to extract task ID from result');
    process.exit(1);
  }
  
  // Wait for task to complete
  console.log('Waiting for task to complete...');
  await new Promise(resolve => setTimeout(resolve, 20000)); // Wait 20 seconds
  
  // Get task details
  console.log('Reading task resource...');
  const taskResource = await client.readResource({
    uri: `task://${taskId}`
  });
  
  console.log('\nRaw resource content length:', taskResource.contents[0].text.length);
  const taskData = JSON.parse(taskResource.contents[0].text);
  console.log('Parsed task data keys:', Object.keys(taskData));
  
  console.log('\n=== Task Status ===');
  console.log('Status:', taskData.status);
  console.log('Total logs:', taskData.logs?.length || 0);
  console.log('Has result:', !!taskData.result);
  console.log('Result:', taskData.result);
  
  console.log('\n=== Task Logs ===');
  if (taskData.logs && taskData.logs.length > 0) {
    console.log(`Found ${taskData.logs.length} total logs`);
    
    // Count log types
    const logTypes: Record<string, number> = {};
    taskData.logs.forEach((log: any) => {
      const key = `${log.type}${log.prefix ? ':' + log.prefix : ''}`;
      logTypes[key] = (logTypes[key] || 0) + 1;
    });
    console.log('Log types:', logTypes);
    
    // Show output-related logs
    console.log('\n=== Output/Result Logs ===');
    let foundOutput = false;
    taskData.logs.forEach((log: any, index: number) => {
      if (log.type === 'output' || log.prefix === 'CLAUDE_RESULT' || log.prefix === 'RESULT' || 
          log.prefix === 'CLAUDECODE_OUTPUT' || log.message?.includes('Hello from Claude')) {
        foundOutput = true;
        console.log(`\nLog ${index + 1} (${log.timestamp}):`);
        console.log('  Type:', log.type);
        console.log('  Prefix:', log.prefix);
        console.log('  Message:', log.message);
        if (log.metadata) {
          console.log('  Metadata:', JSON.stringify(log.metadata, null, 2));
        }
      }
    });
    
    if (!foundOutput) {
      console.log('No output/result logs found!');
      
      // Show last few logs to debug
      console.log('\n=== Last 5 logs ===');
      taskData.logs.slice(-5).forEach((log: any, index: number) => {
        console.log(`\nLog ${taskData.logs.length - 5 + index + 1}:`);
        console.log('  Type:', log.type);
        console.log('  Prefix:', log.prefix);
        console.log('  Message:', log.message?.substring(0, 100) + (log.message?.length > 100 ? '...' : ''));
      });
    }
  } else {
    console.log('No logs found!');
  }
  
  await client.close();
  console.log('\n✓ Test complete');
}

testTaskOutput().catch(console.error);