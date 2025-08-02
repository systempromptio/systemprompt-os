/**
 * Test MCP Protocol directly
 */

import { ServerCore } from '@/server/core/server';
import { McpProtocolHandlerV2 } from '@/server/protocols/mcp/mcp-protocol';
import { MCPEventBridge } from '@/server/mcp/handlers/mcp-event-bridge';
import { v4 as uuidv4 } from 'uuid';

async function testMcpProtocol() {
  console.log('🧪 Testing MCP Protocol Handler\n');
  
  // Create server core
  const serverCore = new ServerCore({ port: 0 });
  
  // Initialize MCP event bridge with debug
  const mcpEventBridge = MCPEventBridge.getInstance();
  mcpEventBridge.initialize(serverCore.eventBus, { debug: true });
  console.log('✅ Event bridge initialized\n');
  
  // Register MCP protocol handler
  const mcpHandler = new McpProtocolHandlerV2();
  await serverCore.registerProtocol('mcp', mcpHandler);
  console.log('✅ MCP protocol registered\n');
  
  // Test tool execution through protocol
  console.log('📋 Testing tool execution through MCP protocol');
  
  const requestId = uuidv4();
  const responsePromise = new Promise((resolve) => {
    serverCore.eventBus.once(`response.${requestId}`, (response) => {
      resolve(response);
    });
  });
  
  // Simulate MCP request event
  const mcpRequest = {
    requestId,
    headers: {
      'x-mcp-context': 'cli',
      'x-session-id': 'test-session'
    },
    body: {
      method: 'call_tool',
      params: {
        name: 'execute-cli',
        arguments: {
          module: 'logger',
          command: 'status'
        }
      }
    }
  };
  
  // Emit the request to the handler
  serverCore.eventBus.emit('mcp.request', mcpRequest);
  
  // Wait for response
  const response = await Promise.race([
    responsePromise,
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 5000))
  ]);
  
  if ((response as any).timeout) {
    console.log('❌ Failed: Tool execution timed out');
  } else if ((response as any).data) {
    console.log('✅ Success: Tool executed');
    const content = (response as any).data.content?.[0]?.text || JSON.stringify((response as any).data);
    console.log('   Response:', content.substring(0, 200));
  } else if ((response as any).error) {
    console.log('❌ Failed: Tool execution error');
    console.log('   Error:', (response as any).error);
  } else {
    console.log('❌ Failed: Unknown response');
    console.log('   Response:', response);
  }
  
  console.log('\n✨ Protocol test complete');
  process.exit(0);
}

// Run test
testMcpProtocol().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});