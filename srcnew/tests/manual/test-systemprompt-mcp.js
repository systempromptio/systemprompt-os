/**
 * Manual test for SystemPrompt MCP Template
 * 
 * This script tests:
 * 1. Server discovery and loading
 * 2. Tool listing and execution
 * 3. Resource access
 * 4. Prompt functionality
 * 
 * Run after starting the server:
 * npm run dev
 * node tests/manual/test-systemprompt-mcp.js
 */

import axios from 'axios';

const SERVER_URL = 'http://localhost:3000';
const MCP_TEMPLATE_ENDPOINT = '/mcp/systemprompt-mcp-template';

/**
 * Test the SystemPrompt MCP template server
 */
async function testSystemPromptMCPTemplate() {
  console.log('🧪 Testing SystemPrompt MCP Template Integration\n');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`MCP Endpoint: ${MCP_TEMPLATE_ENDPOINT}\n`);

  try {
    // 1. Check server status
    console.log('1️⃣ Checking MCP server status...');
    const statusResponse = await axios.get(`${SERVER_URL}/mcp/status`);
    
    console.log('📊 Available MCP servers:');
    Object.entries(statusResponse.data.servers).forEach(([id, info]) => {
      console.log(`   - ${id}: ${info.name} v${info.version} (${info.status})`);
    });

    // Check if our template is loaded
    const templateServer = statusResponse.data.servers['systemprompt-mcp-template'];
    if (!templateServer) {
      console.error('❌ SystemPrompt MCP template not found!');
      console.log('\nMake sure:');
      console.log('1. The template is built: cd server/mcp/custom/systemprompt-mcp-template && npm run build');
      console.log('2. The server is restarted after building');
      return;
    }

    console.log(`\n✅ Template server found: ${templateServer.name}`);

    // 2. Initialize session
    console.log('\n2️⃣ Initializing MCP session...');
    const initResponse = await axios.post(MCP_TEMPLATE_ENDPOINT, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '0.1.0',
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          sampling: true
        },
        clientInfo: {
          name: 'Test Client',
          version: '1.0.0'
        }
      }
    });

    const sessionId = initResponse.headers['mcp-session-id'] || initResponse.headers['x-session-id'];
    console.log(`✅ Session initialized: ${sessionId}`);
    console.log(`   Server: ${initResponse.data.result.serverInfo.name} v${initResponse.data.result.serverInfo.version}`);
    console.log(`   Capabilities:`, initResponse.data.result.capabilities);

    // Create axios instance with session header
    const client = axios.create({
      baseURL: SERVER_URL,
      headers: {
        'mcp-session-id': sessionId,
        'Content-Type': 'application/json'
      }
    });

    // 3. List available tools
    console.log('\n3️⃣ Listing available tools...');
    const toolsResponse = await client.post(MCP_TEMPLATE_ENDPOINT, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    console.log(`✅ Found ${toolsResponse.data.result.tools.length} tools:`);
    toolsResponse.data.result.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // 4. Execute a tool
    console.log('\n4️⃣ Executing example tool...');
    const toolResponse = await client.post(MCP_TEMPLATE_ENDPOINT, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'example_tool',
        arguments: {
          message: 'Hello from test script!'
        }
      }
    });

    console.log('✅ Tool execution result:');
    console.log(`   ${toolResponse.data.result.content[0].text}`);

    // 5. List resources
    console.log('\n5️⃣ Listing available resources...');
    const resourcesResponse = await client.post(MCP_TEMPLATE_ENDPOINT, {
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/list',
      params: {}
    });

    console.log(`✅ Found ${resourcesResponse.data.result.resources.length} resources:`);
    resourcesResponse.data.result.resources.forEach(resource => {
      console.log(`   - ${resource.uri}: ${resource.name}`);
    });

    // 6. Read a resource
    if (resourcesResponse.data.result.resources.length > 0) {
      const firstResource = resourcesResponse.data.result.resources[0];
      console.log(`\n6️⃣ Reading resource: ${firstResource.uri}...`);
      
      const readResponse = await client.post(MCP_TEMPLATE_ENDPOINT, {
        jsonrpc: '2.0',
        id: 5,
        method: 'resources/read',
        params: {
          uri: firstResource.uri
        }
      });

      console.log('✅ Resource content:');
      const content = readResponse.data.result.contents[0];
      console.log(`   Type: ${content.mimeType}`);
      console.log(`   Preview: ${content.text.substring(0, 100)}...`);
    }

    // 7. List prompts
    console.log('\n7️⃣ Listing available prompts...');
    const promptsResponse = await client.post(MCP_TEMPLATE_ENDPOINT, {
      jsonrpc: '2.0',
      id: 6,
      method: 'prompts/list',
      params: {}
    });

    console.log(`✅ Found ${promptsResponse.data.result.prompts.length} prompts:`);
    promptsResponse.data.result.prompts.forEach(prompt => {
      console.log(`   - ${prompt.name}: ${prompt.description}`);
    });

    // 8. Get a prompt
    if (promptsResponse.data.result.prompts.length > 0) {
      const firstPrompt = promptsResponse.data.result.prompts[0];
      console.log(`\n8️⃣ Getting prompt: ${firstPrompt.name}...`);
      
      const promptResponse = await client.post(MCP_TEMPLATE_ENDPOINT, {
        jsonrpc: '2.0',
        id: 7,
        method: 'prompts/get',
        params: {
          name: firstPrompt.name,
          arguments: firstPrompt.arguments?.reduce((acc, arg) => {
            acc[arg.name] = `Test ${arg.name}`;
            return acc;
          }, {}) || {}
        }
      });

      console.log('✅ Prompt content:');
      promptResponse.data.result.messages.forEach((msg, idx) => {
        console.log(`   Message ${idx + 1} (${msg.role}): ${msg.content.text.substring(0, 100)}...`);
      });
    }

    console.log('\n✨ All tests completed successfully!');
    console.log('\n📌 Summary:');
    console.log(`   - Server endpoint: ${MCP_TEMPLATE_ENDPOINT}`);
    console.log(`   - Tools available: ${toolsResponse.data.result.tools.length}`);
    console.log(`   - Resources available: ${resourcesResponse.data.result.resources.length}`);
    console.log(`   - Prompts available: ${promptsResponse.data.result.prompts.length}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running:');
      console.log('   npm run dev');
    } else if (error.response?.status === 404) {
      console.log('\n💡 The MCP template server might not be loaded.');
      console.log('   1. Check that the template is built:');
      console.log('      cd server/mcp/custom/systemprompt-mcp-template');
      console.log('      npm install && npm run build');
      console.log('   2. Restart the server');
    }
  }
}

// Run the test
console.log('SystemPrompt MCP Template Test');
console.log('===============================\n');
testSystemPromptMCPTemplate();