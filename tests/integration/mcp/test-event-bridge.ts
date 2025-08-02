/**
 * Test MCP Event Bridge directly
 */

import { EventBus } from '@/server/core/services/event-bus.service';
import { MCPEventBridge } from '@/server/mcp/handlers/mcp-event-bridge';
import { v4 as uuidv4 } from 'uuid';

async function testEventBridge() {
  console.log('🧪 Testing MCP Event Bridge\n');
  
  // Create event bus
  const eventBus = new EventBus();
  
  // Initialize event bridge with debug mode
  const bridge = MCPEventBridge.getInstance();
  bridge.initialize(eventBus, { debug: true });
  
  console.log('✅ Event bridge initialized\n');
  
  // Test 1: System status tool
  console.log('📋 Test 1: System status tool');
  const statusRequestId = uuidv4();
  
  const statusPromise = new Promise((resolve) => {
    eventBus.once(`response.${statusRequestId}`, (response) => {
      resolve(response);
    });
  });
  
  // Emit tool event
  eventBus.emit('mcp.mcp.tool.system-status', {
    requestId: statusRequestId,
    sessionId: 'test-session',
    arguments: {}
  });
  
  const statusResult = await Promise.race([
    statusPromise,
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 5000))
  ]);
  
  if ((statusResult as any).timeout) {
    console.log('❌ Failed: System status timed out');
  } else if ((statusResult as any).data) {
    console.log('✅ Success: System status returned');
    const content = (statusResult as any).data.content[0].text;
    console.log('   Content preview:', content.substring(0, 100) + '...');
  } else {
    console.log('❌ Failed: System status error');
    console.log('   Result:', statusResult);
  }
  
  console.log();
  
  // Test 2: Execute CLI tool
  console.log('📋 Test 2: Execute CLI tool');
  const cliRequestId = uuidv4();
  
  const cliPromise = new Promise((resolve) => {
    eventBus.once(`response.${cliRequestId}`, (response) => {
      resolve(response);
    });
  });
  
  // Emit tool event
  eventBus.emit('mcp.mcp.tool.execute-cli', {
    requestId: cliRequestId,
    sessionId: 'test-session',
    arguments: {
      module: 'logger',
      command: 'status'
    }
  });
  
  const cliResult = await Promise.race([
    cliPromise,
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 5000))
  ]);
  
  if ((cliResult as any).timeout) {
    console.log('❌ Failed: Execute CLI timed out');
  } else if ((cliResult as any).data) {
    console.log('✅ Success: Execute CLI returned');
    const content = (cliResult as any).data.content?.[0]?.text || (cliResult as any).data;
    console.log('   Content:', typeof content === 'string' ? content.substring(0, 200) : content);
  } else if ((cliResult as any).error) {
    console.log('❌ Failed: Execute CLI error');
    console.log('   Error:', (cliResult as any).error);
  } else {
    console.log('❌ Failed: Execute CLI unknown response');
    console.log('   Result:', cliResult);
  }
  
  console.log();
  
  // Test 3: Generic tool handler
  console.log('📋 Test 3: Generic tool handler');
  const genericRequestId = uuidv4();
  
  const genericPromise = new Promise((resolve) => {
    eventBus.once(`response.${genericRequestId}`, (response) => {
      resolve(response);
    });
  });
  
  // Emit generic tool event
  eventBus.emit('mcp.tool.custom-tool', {
    requestId: genericRequestId,
    sessionId: 'test-session',
    arguments: { test: 'data' }
  });
  
  const genericResult = await Promise.race([
    genericPromise,
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 1000))
  ]);
  
  if ((genericResult as any).timeout) {
    console.log('❌ Failed: Generic tool timed out');
  } else if ((genericResult as any).data) {
    console.log('✅ Success: Generic tool returned');
    console.log('   Content:', (genericResult as any).data.content[0].text);
  } else {
    console.log('❌ Failed: Generic tool error');
    console.log('   Result:', genericResult);
  }
  
  console.log('\n✨ Event bridge test complete');
  process.exit(0);
}

// Run test
testEventBridge().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});