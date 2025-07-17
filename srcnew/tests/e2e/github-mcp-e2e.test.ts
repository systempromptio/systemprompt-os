/**
 * End-to-end tests for GitHub MCP server integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub MCP Server E2E', () => {
  let serverProcess: ChildProcess;
  const serverUrl = 'http://localhost:3000';
  const customDir = path.join(__dirname, '../../server/mcp/custom');

  beforeAll(async () => {
    // Ensure custom directory exists
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }

    // Clone GitHub MCP server (mock for testing)
    const githubMCPDir = path.join(customDir, 'github-mcp-server');
    if (!fs.existsSync(githubMCPDir)) {
      fs.mkdirSync(githubMCPDir, { recursive: true });
      
      // Create a mock GitHub MCP server for testing
      const mockServerContent = `
export default class GitHubMCPServer {
  name = 'GitHub MCP Server';
  version = '1.0.0';
  
  async handleRequest(req, res) {
    const { method, params, id } = req.body;
    
    switch (method) {
      case 'initialize':
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '0.1.0',
            capabilities: {
              tools: true,
              resources: true,
            },
            serverInfo: {
              name: this.name,
              version: this.version,
            },
          },
        });
        break;
        
      case 'tools/list':
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'github_search_repos',
                description: 'Search GitHub repositories',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Search query' },
                    limit: { type: 'number', description: 'Max results', default: 10 },
                  },
                  required: ['query'],
                },
              },
              {
                name: 'github_create_issue',
                description: 'Create a GitHub issue',
                inputSchema: {
                  type: 'object',
                  properties: {
                    owner: { type: 'string' },
                    repo: { type: 'string' },
                    title: { type: 'string' },
                    body: { type: 'string' },
                  },
                  required: ['owner', 'repo', 'title'],
                },
              },
            ],
          },
        });
        break;
        
      case 'tools/call':
        if (params.name === 'github_search_repos') {
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  repositories: [
                    { name: 'test-repo', stars: 100 },
                    { name: 'another-repo', stars: 50 },
                  ],
                }, null, 2),
              }],
            },
          });
        } else if (params.name === 'github_create_issue') {
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: \`Created issue #123: \${params.arguments.title} in \${params.arguments.owner}/\${params.arguments.repo}\`,
              }],
            },
          });
        }
        break;
        
      default:
        res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        });
    }
  }
  
  getActiveSessionCount() {
    return 0;
  }
  
  shutdown() {
    console.log('GitHub MCP Server shutting down');
  }
}
`;
      
      fs.writeFileSync(
        path.join(githubMCPDir, 'index.js'),
        mockServerContent
      );
    }

    // Start the server
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe',
      env: { ...process.env, PORT: '3000' },
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 30000);
      
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Server output:', output);
        
        if (output.includes('Server running') || output.includes('listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      serverProcess.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
    });

    // Give it a bit more time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 60000);

  afterAll(async () => {
    // Kill the server process
    if (serverProcess) {
      serverProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clean up test files
    const githubMCPDir = path.join(customDir, 'github-mcp-server');
    if (fs.existsSync(githubMCPDir)) {
      fs.rmSync(githubMCPDir, { recursive: true, force: true });
    }
  });

  it('should discover and load GitHub MCP server on startup', async () => {
    // Check server status
    const statusResponse = await axios.get(`${serverUrl}/mcp/status`);
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.data.servers).toBeDefined();
    expect(statusResponse.data.servers['github-mcp-server']).toBeDefined();
    expect(statusResponse.data.servers['github-mcp-server'].name).toBe('GitHub MCP Server');
    expect(statusResponse.data.servers['github-mcp-server'].status).toBe('running');
  });

  it('should initialize GitHub MCP server session', async () => {
    const response = await axios.post(`${serverUrl}/mcp/github-mcp-server`, {
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

    expect(response.status).toBe(200);
    expect(response.data.result.serverInfo.name).toBe('GitHub MCP Server');
    expect(response.data.result.capabilities.tools).toBe(true);
    expect(response.data.result.capabilities.resources).toBe(true);
  });

  it('should list GitHub MCP server tools', async () => {
    const response = await axios.post(`${serverUrl}/mcp/github-mcp-server`, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    expect(response.status).toBe(200);
    expect(response.data.result.tools).toHaveLength(2);
    
    const toolNames = response.data.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('github_search_repos');
    expect(toolNames).toContain('github_create_issue');
  });

  it('should execute GitHub search tool', async () => {
    const response = await axios.post(`${serverUrl}/mcp/github-mcp-server`, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'github_search_repos',
        arguments: {
          query: 'typescript mcp server',
          limit: 5,
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.data.result.content).toHaveLength(1);
    expect(response.data.result.content[0].type).toBe('text');
    
    const result = JSON.parse(response.data.result.content[0].text);
    expect(result.repositories).toBeDefined();
    expect(result.repositories).toHaveLength(2);
  });

  it('should execute GitHub create issue tool', async () => {
    const response = await axios.post(`${serverUrl}/mcp/github-mcp-server`, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'github_create_issue',
        arguments: {
          owner: 'test-owner',
          repo: 'test-repo',
          title: 'Test Issue from E2E',
          body: 'This is a test issue created by E2E tests',
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.data.result.content).toHaveLength(1);
    expect(response.data.result.content[0].text).toContain('Created issue #123');
    expect(response.data.result.content[0].text).toContain('Test Issue from E2E');
    expect(response.data.result.content[0].text).toContain('test-owner/test-repo');
  });

  it('should handle concurrent requests to different MCP servers', async () => {
    // Make concurrent requests to core and GitHub servers
    const [coreResponse, githubResponse] = await Promise.all([
      axios.post(`${serverUrl}/mcp/core`, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/list',
        params: {},
      }),
      axios.post(`${serverUrl}/mcp/github-mcp-server`, {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/list',
        params: {},
      }),
    ]);

    expect(coreResponse.status).toBe(200);
    expect(githubResponse.status).toBe(200);
    
    // Core server should have different tools than GitHub server
    const coreTools = coreResponse.data.result.tools.map((t: any) => t.name);
    const githubTools = githubResponse.data.result.tools.map((t: any) => t.name);
    
    expect(coreTools).toContain('echo');
    expect(coreTools).toContain('add');
    expect(githubTools).toContain('github_search_repos');
    expect(githubTools).toContain('github_create_issue');
    
    // No overlap between tool sets
    const overlap = coreTools.filter((t: string) => githubTools.includes(t));
    expect(overlap).toHaveLength(0);
  });
});