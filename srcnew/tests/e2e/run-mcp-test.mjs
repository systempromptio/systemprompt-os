#!/usr/bin/env node
/**
 * E2E test runner for MCP server in Docker container
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const execAsync = promisify(exec);

async function waitForHealthy(containerId, maxAttempts = 30) {
  console.log('Waiting for container to be healthy...');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { stdout: health } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' ${containerId}`);
      if (health.trim() === 'healthy') {
        return true;
      }
    } catch (error) {
      // Container might not be ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

async function runTests() {
  let client;
  let transport;
  let containerId;
  
  try {
    console.log('🐳 Starting Docker container...');
    
    // Build and start container
    await execAsync('docker-compose -f docker-compose.mcp.yml build');
    await execAsync('docker-compose -f docker-compose.mcp.yml up -d');
    
    // Get container ID
    const { stdout: containerInfo } = await execAsync('docker-compose -f docker-compose.mcp.yml ps -q mcp-server');
    containerId = containerInfo.trim();
    console.log('Container ID:', containerId);
    
    // Wait for healthy status
    const healthy = await waitForHealthy(containerId);
    if (!healthy) {
      throw new Error('Container failed to become healthy');
    }
    
    console.log('✅ Container is healthy!');
    
    // Test 1: Server Status
    console.log('\n📊 Test 1: Server Status');
    const statusResponse = await fetch('http://localhost:3000/mcp/status');
    if (!statusResponse.ok) {
      throw new Error(`Status endpoint failed: ${statusResponse.status}`);
    }
    const status = await statusResponse.json();
    console.log('Server status:', JSON.stringify(status, null, 2));
    
    // Initialize MCP client
    console.log('\n🔌 Test 2: MCP Client Connection');
    transport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
    
    client = new Client({
      name: 'mcp-test-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });
    
    await client.connect(transport);
    console.log('✅ Connected and initialized');
    
    // Test 3: List tools
    console.log('\n🔧 Test 3: List Tools');
    const toolsResult = await client.listTools();
    console.log(`Found ${toolsResult.tools.length} tools:`, toolsResult.tools.map(t => t.name));
    
    // Test 4: Call echo tool
    console.log('\n📢 Test 4: Echo Tool');
    const echoResult = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello MCP!' },
    });
    console.log('Echo result:', echoResult.content[0].text);
    
    // Test 5: Call add tool
    console.log('\n➕ Test 5: Add Tool');
    const addResult = await client.callTool({
      name: 'add',
      arguments: { a: 5, b: 3 },
    });
    console.log('Add result:', addResult.content[0].text);
    
    // Test 6: List resources
    console.log('\n📁 Test 6: List Resources');
    const resourcesResult = await client.listResources();
    console.log(`Found ${resourcesResult.resources.length} resources:`, resourcesResult.resources.map(r => r.uri));
    
    // Test 7: Read resource
    console.log('\n📖 Test 7: Read System Info');
    const infoResult = await client.readResource({
      uri: 'system://info',
    });
    const info = JSON.parse(infoResult.contents[0].text);
    console.log('System info:', JSON.stringify(info, null, 2));
    
    // Test 8: List prompts
    console.log('\n💬 Test 8: List Prompts');
    const promptsResult = await client.listPrompts();
    console.log(`Found ${promptsResult.prompts.length} prompts:`, promptsResult.prompts.map(p => p.name));
    
    // Test 9: Get prompt
    console.log('\n👋 Test 9: Get Greeting Prompt');
    const greetingResult = await client.getPrompt({
      name: 'greeting',
      arguments: { name: 'Alice' },
    });
    console.log('Greeting prompt:', greetingResult.messages[0].content.text);
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (client) {
      await client.close();
    }
    if (transport) {
      await transport.close();
    }
    
    console.log('\n🧹 Cleaning up...');
    await execAsync('docker-compose -f docker-compose.mcp.yml down');
  }
}

// Run the tests
runTests();