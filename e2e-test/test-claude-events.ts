#!/usr/bin/env node
/**
 * Quick test to verify Claude events are being captured
 */

import { createMCPClient } from './typescript/utils/test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function testClaudeEvents() {
  console.log('🔍 Testing Claude Event Capture...\n');
  
  const client = await createMCPClient();
  
  try {
    // Create a task
    console.log('Creating test task...');
    const createResult = await client.callTool({
      name: 'create_task',
      arguments: {
        tool: 'CLAUDECODE',
        instructions: 'echo "Testing Claude events" && ls -la'
      }
    });
    
    if (createResult.isError) {
      throw new Error('Failed to create task');
    }
    
    const content = createResult.content[0];
    console.log('Response content:', content);
    
    let task_id: string;
    if ('text' in content) {
      // Try to extract task ID from the text
      const text = content.text;
      // Check if it's JSON
      if (text.trim().startsWith('{')) {
        const parsed = JSON.parse(text);
        task_id = parsed.task_id;
      } else {
        // Extract task ID from text response
        const match = text.match(/ID\s+([a-f0-9-]+)/);
        if (match) {
          task_id = match[1];
        } else {
          throw new Error('Could not extract task ID from response');
        }
      }
    } else {
      throw new Error('Unexpected response format');
    }
    console.log(`✓ Task created: ${task_id}\n`);
    
    // Wait for task to complete
    console.log('Waiting for task to complete...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Read task logs
    const logsResource = await client.readResource({ uri: `task://${task_id}/logs` });
    const logsContent = logsResource.contents[0];
    if (!('text' in logsContent)) {
      throw new Error('Unexpected logs format');
    }
    
    const logs = JSON.parse(logsContent.text);
    console.log(`\n✓ Total logs: ${logs.length}\n`);
    
    // Check for Claude events
    const eventTypes = {
      PROCESS_START: logs.filter((log: any) => log.prefix === 'PROCESS_START'),
      PROCESS_END: logs.filter((log: any) => log.prefix === 'PROCESS_END'),
      TOOL_START: logs.filter((log: any) => log.prefix === 'TOOL_START'),
      TOOL_END: logs.filter((log: any) => log.prefix === 'TOOL_END'),
    };
    
    console.log('Claude Event Counts:');
    console.log('==================');
    for (const [type, events] of Object.entries(eventTypes)) {
      console.log(`${type}: ${events.length}`);
    }
    
    // Show sample events
    if (eventTypes.PROCESS_START.length > 0) {
      console.log('\nSample PROCESS_START event:');
      console.log(JSON.stringify(eventTypes.PROCESS_START[0], null, 2));
    }
    
    if (eventTypes.PROCESS_END.length > 0) {
      console.log('\nSample PROCESS_END event:');
      console.log(JSON.stringify(eventTypes.PROCESS_END[0], null, 2));
      
      // Check if output is included
      const processEnd = eventTypes.PROCESS_END[0];
      if (processEnd.metadata?.output) {
        console.log('\n✓ Process end includes output');
      } else {
        console.log('\n❌ Process end missing output!');
      }
    }
    
    // Check task resource
    const taskResource = await client.readResource({ uri: `task://${task_id}` });
    const taskContent = taskResource.contents[0];
    if ('text' in taskContent) {
      const task = JSON.parse(taskContent.text);
      console.log('\nTask Resource Summary:');
      console.log('====================');
      console.log(`Status: ${task.status}`);
      console.log(`Log count: ${task.log_count}`);
      if (task.metadata) {
        console.log(`Duration: ${task.metadata.duration_ms}ms`);
        console.log(`Cost: $${task.metadata.cost_usd || 'N/A'}`);
        if (task.metadata.tokens) {
          console.log(`Tokens: ${JSON.stringify(task.metadata.tokens)}`);
        }
      }
    }
    
    // Final verdict
    console.log('\n' + '='.repeat(50));
    if (eventTypes.PROCESS_START.length > 0 && eventTypes.PROCESS_END.length > 0) {
      console.log('✅ Claude events are being captured successfully!');
    } else {
      console.log('❌ Claude events are NOT being captured properly!');
      process.exit(1);
    }
    
  } finally {
    await client.close();
  }
}

testClaudeEvents().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});