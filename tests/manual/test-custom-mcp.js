/**
 * Manual test for custom MCP server loading
 * Run this after starting the server to verify custom servers are loaded
 */

import axios from 'axios';

const serverUrl = 'http://localhost:3000';

async function testCustomMCPServers() {
  console.log('Testing Custom MCP Server Loading...\n');

  try {
    // 1. Check server status
    console.log('1. Checking MCP server status...');
    const statusResponse = await axios.get(`${serverUrl}/mcp/status`);
    console.log('Available MCP servers:');
    Object.entries(statusResponse.data.servers).forEach(([id, info]) => {
      console.log(`  - ${id}: ${info.name} v${info.version} (${info.status})`);
    });

    // 2. Test example GitHub MCP server
    if (statusResponse.data.servers['example-github-mcp']) {
      console.log('\n2. Testing example-github-mcp server...');
      
      // Initialize
      const initResponse = await axios.post(`${serverUrl}/mcp/example-github-mcp`, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '0.1.0',
          capabilities: {},
          clientInfo: {
            name: 'Test Client',
            version: '1.0.0',
          },
        },
      });
      console.log('  ✓ Initialized:', initResponse.data.result.serverInfo.name);

      // List tools
      const toolsResponse = await axios.post(`${serverUrl}/mcp/example-github-mcp`, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });
      console.log('  ✓ Available tools:');
      toolsResponse.data.result.tools.forEach(tool => {
        console.log(`    - ${tool.name}: ${tool.description}`);
      });

      // Call a tool
      const callResponse = await axios.post(`${serverUrl}/mcp/example-github-mcp`, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'github_search_repos',
          arguments: {
            query: 'mcp server',
            limit: 5,
          },
        },
      });
      console.log('  ✓ Tool execution result:');
      console.log('   ', callResponse.data.result.content[0].text.split('\\n')[0]);

      // List resources
      const resourcesResponse = await axios.post(`${serverUrl}/mcp/example-github-mcp`, {
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/list',
        params: {},
      });
      console.log('  ✓ Available resources:');
      resourcesResponse.data.result.resources.forEach(resource => {
        console.log(`    - ${resource.uri}: ${resource.name}`);
      });
    } else {
      console.log('\\n⚠️  example-github-mcp server not found!');
    }

    console.log('\\n✅ Custom MCP server loading is working correctly!');

  } catch (error) {
    console.error('\\n❌ Error testing custom MCP servers:');
    console.error(error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
console.log('Make sure the server is running with: npm run dev\\n');
testCustomMCPServers();