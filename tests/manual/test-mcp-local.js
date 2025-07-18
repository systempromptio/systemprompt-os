#!/usr/bin/env node
/**
 * Manual test script for MCP server using MCP SDK
 * Run with: node tests/manual/test-mcp-local.js
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testMCPServer() {
  const baseUrl = 'http://localhost:3000';
  let client;
  let transport;
  
  console.log('Testing MCP Server at', baseUrl + '/mcp');
  
  try {
    // 1. Create client and connect
    console.log('\n1. Creating MCP client and connecting...');
    transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    
    client = new Client({
      name: 'mcp-test-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
    
    await client.connect(transport);
    console.log('✓ Connected and initialized');
    
    // 2. List tools
    console.log('\n2. Listing tools...');
    const toolsResult = await client.listTools();
    console.log('Tools:', JSON.stringify(toolsResult.tools, null, 2));
    console.log(`✓ Found ${toolsResult.tools.length} tools`);
    
    // 3. Call echo tool
    console.log('\n3. Calling echo tool...');
    const echoResult = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello MCP!' },
    });
    console.log('Echo result:', JSON.stringify(echoResult.content, null, 2));
    console.log('✓ Echo tool worked');
    
    // 4. Call add tool
    console.log('\n4. Calling add tool...');
    const addResult = await client.callTool({
      name: 'add',
      arguments: { a: 5, b: 3 },
    });
    console.log('Add result:', JSON.stringify(addResult.content, null, 2));
    console.log('✓ Add tool worked');
    
    // 5. List resources
    console.log('\n5. Listing resources...');
    const resourcesResult = await client.listResources();
    console.log('Resources:', JSON.stringify(resourcesResult.resources, null, 2));
    console.log(`✓ Found ${resourcesResult.resources.length} resources`);
    
    // 6. Read system info
    console.log('\n6. Reading system info resource...');
    const infoResult = await client.readResource({
      uri: 'system://info',
    });
    const info = JSON.parse(infoResult.contents[0].text);
    console.log('System info:', JSON.stringify(info, null, 2));
    console.log('✓ Resource read successfully');
    
    // 7. List prompts
    console.log('\n7. Listing prompts...');
    const promptsResult = await client.listPrompts();
    console.log('Prompts:', JSON.stringify(promptsResult.prompts, null, 2));
    console.log(`✓ Found ${promptsResult.prompts.length} prompts`);
    
    // 8. Get greeting prompt
    console.log('\n8. Getting greeting prompt...');
    const greetingResult = await client.getPrompt({
      name: 'greeting',
      arguments: { name: 'Alice' },
    });
    console.log('Greeting prompt:', JSON.stringify(greetingResult.messages, null, 2));
    console.log('✓ Prompt retrieved successfully');
    
    // 9. Check server status
    console.log('\n9. Checking server status...');
    const statusResponse = await fetch(`${baseUrl}/mcp/status`);
    const statusResult = await statusResponse.json();
    console.log('Server status:', JSON.stringify(statusResult, null, 2));
    console.log('✓ Server status checked');
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    if (client) {
      await client.close();
    }
    if (transport) {
      await transport.close();
    }
  }
}

// Check if server is running
fetch('http://localhost:3000/health')
  .then(() => {
    console.log('Server is running, starting tests...');
    return testMCPServer();
  })
  .catch(() => {
    console.error('Server is not running. Please start it with: npm run dev');
    process.exit(1);
  });