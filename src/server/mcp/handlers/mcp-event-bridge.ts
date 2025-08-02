/**
 * MCP Event Bridge
 * Bridges MCP protocol events to tool handlers.
 */

import type { IEventBus } from '@/modules/core/events/types/manual';

export class MCPEventBridge {
  private static instance: MCPEventBridge;
  private initialized = false;
  private debug = false;
  
  private constructor() {}
  
  public static getInstance(): MCPEventBridge {
    if (!MCPEventBridge.instance) {
      MCPEventBridge.instance = new MCPEventBridge();
    }
    return MCPEventBridge.instance;
  }
  
  /**
   * Initialize the event bridge with event bus.
   */
  public initialize(eventBus: IEventBus, options?: { debug?: boolean }): void {
    if (this.initialized) {
      return;
    }
    
    this.debug = options?.debug || false;
    
    if (this.debug) {
      console.log('[MCPEventBridge] Initializing MCP event bridge');
    }
    
    // Register handler for execute-cli tool
    eventBus.on('mcp.mcp.tool.execute-cli', async (event: any) => {
      if (this.debug) {
        console.log('[MCPEventBridge] Received execute-cli event', { 
          requestId: event.requestId,
          arguments: event.arguments 
        });
      }
      
      try {
        // Import and execute the simple handler (no logger dependency)
        const { executeSimpleCli } = await import('./simple-cli-handler');
        
        // Execute the tool
        const result = await executeSimpleCli(event.arguments);
        
        if (this.debug) {
          console.log('[MCPEventBridge] Tool execution completed', { 
            requestId: event.requestId,
            hasResult: !!result 
          });
        }
        
        // Send response back via the requestId
        eventBus.emit(`response.${event.requestId}`, {
          data: result
        });
      } catch (error) {
        if (this.debug) {
          console.error('[MCPEventBridge] Tool execution failed', error);
        }
        
        eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Tool execution failed',
            statusCode: 500
          }
        });
      }
    });
    
    // Register handler for system-status tool
    eventBus.on('mcp.mcp.tool.system-status', async (event: any) => {
      if (this.debug) {
        console.log('[MCPEventBridge] Received system-status event', { 
          requestId: event.requestId 
        });
      }
      
      try {
        // Use simple system status without dependencies
        const { getSimpleSystemStatus } = await import('./simple-cli-handler');
        const result = getSimpleSystemStatus();
        
        // Send response
        eventBus.emit(`response.${event.requestId}`, {
          data: result
        });
      } catch (error) {
        if (this.debug) {
          console.error('[MCPEventBridge] System status failed', error);
        }
        
        eventBus.emit(`response.${event.requestId}`, {
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'System status failed',
            statusCode: 500
          }
        });
      }
    });
    
    // Register generic MCP tool handler for database-managed tools
    eventBus.on('mcp.tool.*', async (event: any, eventName: string) => {
      // Extract tool name from event name
      const toolName = eventName.replace('mcp.tool.', '');
      
      if (this.debug) {
        console.log(`[MCPEventBridge] Received tool event for ${toolName}`, { 
          requestId: event.requestId,
          arguments: event.arguments 
        });
      }
      
      // For now, just return a placeholder response
      // This would be where we'd execute database-managed tool handlers
      eventBus.emit(`response.${event.requestId}`, {
        data: {
          content: [{
            type: 'text',
            text: `Tool ${toolName} executed with args: ${JSON.stringify(event.arguments)}`,
          }],
        }
      });
    });
    
    this.initialized = true;
    if (this.debug) {
      console.log('[MCPEventBridge] MCP event bridge initialized');
    }
  }
  
  /**
   * Check if bridge is initialized.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}