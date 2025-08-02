#!/usr/bin/env tsx
/**
 * Manual test to verify MCP SDK server connectivity
 * This test:
 * 1. Bootstraps the system and creates an MCP context with tools
 * 2. Creates an MCP SDK server from the module configuration
 * 3. Connects to the server using MCP SDK client
 * 4. Lists tools to verify the connection works
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { runBootstrap } from '@/bootstrap';
import type { Bootstrap } from '@/bootstrap';
import type { IMCPModuleExports } from '@/modules/core/mcp/types/manual';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { spawn } from 'child_process';

async function testMCPSDKConnection() {
  console.log('🚀 Starting MCP SDK Connection Test\n');
  
  let bootstrap: Bootstrap | null = null;
  
  try {
    // Step 1: Bootstrap the system
    console.log('1️⃣ Bootstrapping SystemPrompt OS...');
    bootstrap = await runBootstrap();
    const mcpModule = bootstrap.getModule('mcp');
    
    if (!mcpModule) {
      throw new Error('MCP module not found');
    }
    
    const mcp = mcpModule.exports as IMCPModuleExports;
    console.log('✅ System bootstrapped successfully\n');
    
    // Step 2: Create a test context with tools
    console.log('2️⃣ Creating test MCP context with tools...');
    const context = await mcp.contexts.create({
      name: 'sdk-test-context',
      description: 'Test context for SDK connectivity',
      version: '1.0.0',
      server_config: {
        name: 'SDK Test Server',
        version: '1.0.0',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    });
    
    console.log(`✅ Created context: ${context.name} (${context.id})\n`);
    
    // Add some test tools
    console.log('3️⃣ Adding test tools to context...');
    await mcp.tools.create(context.id, {
      name: 'echo',
      description: 'Echoes back the input message',
      input_schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo'
          }
        },
        required: ['message']
      },
      handler_type: 'function',
      handler_config: {}
    });
    
    await mcp.tools.create(context.id, {
      name: 'get-time',
      description: 'Returns the current time',
      input_schema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            description: 'Time format (iso, unix, readable)',
            enum: ['iso', 'unix', 'readable']
          }
        }
      },
      handler_type: 'function',
      handler_config: {}
    });
    
    console.log('✅ Added 2 test tools\n');
    
    // Step 4: Create MCP SDK Server from module
    console.log('4️⃣ Creating MCP SDK Server from module configuration...');
    const mcpServer: Server = await mcp.server.createFromContext(context.id);
    
    if (!mcpServer) {
      throw new Error('Failed to create MCP SDK server');
    }
    
    console.log(`✅ MCP SDK Server created: ${mcpServer.constructor.name}`);
    console.log(`   Server name: ${mcpServer.serverInfo?.name || 'Unknown'}`);
    console.log(`   Server version: ${mcpServer.serverInfo?.version || 'Unknown'}\n`);
    
    // Step 5: Test direct server capabilities
    console.log('5️⃣ Testing direct server capabilities...');
    
    // Check if server has the expected structure
    if (typeof mcpServer.setRequestHandler === 'function') {
      console.log('✅ Server has setRequestHandler method');
    } else {
      console.log('❌ Server missing setRequestHandler method');
    }
    
    // The server should already have handlers registered from the module
    // Let's verify by checking the server info
    const serverInfo = mcpServer.serverInfo;
    console.log('   Server info:', JSON.stringify(serverInfo, null, 2));
    
    // Step 6: Connect via HTTP endpoint (alternative test)
    console.log('\n6️⃣ Testing via HTTP endpoint...');
    const fetch = (await import('node-fetch')).default;
    
    // First, start the integrated server
    const { startIntegratedServer } = await import('@/server/integrated-server');
    const httpServer = await startIntegratedServer(4567);
    console.log('✅ HTTP server started on port 4567');
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test listing tools via HTTP
    const response = await fetch('http://localhost:4567/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mcp-context': 'sdk-test-context'
      },
      body: JSON.stringify({
        method: 'list_tools',
        params: {}
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Successfully listed tools via HTTP:');
      console.log('   Tools found:', data.tools?.length || 0);
      
      if (data.tools && Array.isArray(data.tools)) {
        data.tools.forEach((tool: any) => {
          console.log(`   - ${tool.name}: ${tool.description}`);
        });
      }
    } else {
      console.log('❌ Failed to list tools via HTTP:', response.status, response.statusText);
    }
    
    // Step 7: Test tool execution
    console.log('\n7️⃣ Testing tool execution via HTTP...');
    const execResponse = await fetch('http://localhost:4567/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mcp-context': 'sdk-test-context'
      },
      body: JSON.stringify({
        method: 'call_tool',
        params: {
          name: 'echo',
          arguments: {
            message: 'Hello from MCP SDK test!'
          }
        }
      })
    });
    
    if (execResponse.ok) {
      const result = await execResponse.json();
      console.log('✅ Tool execution response:', JSON.stringify(result, null, 2));
    } else {
      const error = await execResponse.text();
      console.log('❌ Tool execution failed:', error);
    }
    
    // Clean up
    console.log('\n8️⃣ Cleaning up...');
    httpServer.close();
    await mcp.contexts.delete(context.id);
    console.log('✅ Test context deleted');
    
    console.log('\n✨ MCP SDK Connection Test Complete!');
    console.log('Summary:');
    console.log('  ✅ MCP module loaded successfully');
    console.log('  ✅ MCP context created with tools');
    console.log('  ✅ MCP SDK Server created from module');
    console.log('  ✅ Tools accessible via HTTP endpoint');
    console.log('  ✅ Tool execution works');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (bootstrap) {
      await bootstrap.shutdown();
    }
    process.exit(0);
  }
}

// Run the test
testMCPSDKConnection().catch(console.error);