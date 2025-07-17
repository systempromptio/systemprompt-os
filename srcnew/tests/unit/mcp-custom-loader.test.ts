/**
 * Unit tests for custom MCP server loading
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomMCPLoader } from '../../src/server/mcp/custom-loader.js';
import { MCPServerRegistry } from '../../src/server/mcp/registry.js';

describe('Custom MCP Server Loader', () => {
  let loader: CustomMCPLoader;
  let registry: MCPServerRegistry;

  beforeEach(() => {
    registry = new MCPServerRegistry();
    loader = new CustomMCPLoader(registry);
  });

  it('should create loader instance', () => {
    expect(loader).toBeDefined();
    expect(loader).toBeInstanceOf(CustomMCPLoader);
  });

  it('should discover servers in directory', async () => {
    // This test will use the actual file system
    const servers = await loader.discoverServers('./server/mcp/custom');
    
    // We should find at least our example-github-mcp
    expect(servers).toContain('example-github-mcp');
  });
});