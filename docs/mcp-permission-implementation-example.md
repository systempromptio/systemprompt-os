# MCP Permission System Implementation Example

## Step-by-Step Implementation Guide

This guide shows how to implement the MCP tool permission system in your existing codebase.

### Step 1: Create Permission Types

```typescript
// src/server/mcp/core/types/permission-tool.ts
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolPermissionMeta {
  permissions: {
    required: string[];
    oneOf?: string[][];
    contextual?: {
      [key: string]: {
        condition: string;
        requires: string[];
      };
    };
    dynamic?: (args: any, context: any) => Promise<string[]>;
  };
  security: {
    level: 'public' | 'restricted' | 'sensitive' | 'critical';
    auditLog: boolean;
    rateLimit?: {
      calls: number;
      window: number;
    };
  };
  container?: {
    requiresAccess: boolean;
    minimumPermission?: string;
  };
}

export type PermissionTool = Tool & {
  _meta: ToolPermissionMeta;
};

export function definePermissionTool(
  tool: Tool,
  meta: ToolPermissionMeta
): PermissionTool {
  return { ...tool, _meta: meta };
}
```

### Step 2: Update Existing Tool Definitions

```typescript
// src/server/mcp/core/constants/tool/check-status.ts
import { definePermissionTool } from "../../types/permission-tool.js";

export const checkStatus = definePermissionTool({
  name: "checkstatus",
  description: "Check system status",
  inputSchema: {
    type: "object",
    properties: {
      testsessions: { type: "boolean" },
      verbose: { type: "boolean" },
      containerId: { type: "string" }
    }
  }
}, {
  permissions: {
    required: ["system:read"],
    contextual: {
      "verboseMode": {
        condition: "args.verbose === true",
        requires: ["system:read:detailed"]
      },
      "containerSpecific": {
        condition: "args.containerId != null",
        requires: ["container:view"]
      }
    }
  },
  security: {
    level: "public",
    auditLog: false
  },
  container: {
    requiresAccess: false
  }
});

export default checkStatus;
```

```typescript
// src/server/mcp/core/constants/tool/create-task.ts
import { definePermissionTool } from "../../types/permission-tool.js";

export const createTask = definePermissionTool({
  name: "createtask",
  description: "Create a new task",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      tool: { type: "string" },
      instructions: { type: "string" },
      containerId: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"] }
    },
    required: ["title"]
  }
}, {
  permissions: {
    required: ["tasks:create"],
    contextual: {
      "highPriority": {
        condition: "args.priority === 'critical'",
        requires: ["tasks:create:critical"]
      },
      "containerTask": {
        condition: "args.containerId != null",
        requires: ["container:write"]
      }
    }
  },
  security: {
    level: "restricted",
    auditLog: true,
    rateLimit: {
      calls: 100,
      window: 3600
    }
  },
  container: {
    requiresAccess: false,
    minimumPermission: "developer"
  }
});

export default createTask;
```

```typescript
// src/server/mcp/core/constants/tool/clean-state.ts
import { definePermissionTool } from "../../types/permission-tool.js";

export const cleanState = definePermissionTool({
  name: "cleanstate",
  description: "Clean system state - DANGEROUS operation",
  inputSchema: {
    type: "object",
    properties: {
      target: { 
        type: "string", 
        enum: ["cache", "logs", "temp", "all"] 
      },
      force: { type: "boolean" },
      dryRun: { type: "boolean" }
    },
    required: ["target"]
  }
}, {
  permissions: {
    required: ["system:admin", "maintenance:write"],
    contextual: {
      "forceClean": {
        condition: "args.force === true && args.target === 'all'",
        requires: ["system:admin:dangerous"]
      }
    },
    dynamic: async (args, context) => {
      // Require special permission during business hours
      const hour = new Date().getHours();
      if (hour >= 9 && hour <= 17 && !args.dryRun) {
        return ["maintenance:business-hours"];
      }
      return [];
    }
  },
  security: {
    level: "critical",
    auditLog: true,
    rateLimit: {
      calls: 5,
      window: 3600
    }
  }
});

export default cleanState;
```

### Step 3: Create Tool Registry

```typescript
// src/server/mcp/core/services/tool-registry.ts
import { PermissionTool } from "../types/permission-tool.js";
import { checkStatus } from "../constants/tool/check-status.js";
import { createTask } from "../constants/tool/create-task.js";
import { cleanState } from "../constants/tool/clean-state.js";
import { getPrompt } from "../constants/tool/get-prompt.js";
import { updateTask } from "../constants/tool/update-task.js";
import { endTask } from "../constants/tool/end-task.js";
import { reportTask } from "../constants/tool/report-task.js";
import { logger } from "'@/modules/core/logger/index.js'";

export class ToolRegistry {
  private static tools: Map<string, PermissionTool> = new Map();
  private static initialized = false;
  
  static initialize() {
    if (this.initialized) return;
    
    // Register all tools
    const toolsToRegister = [
      checkStatus,
      createTask,
      cleanState,
      getPrompt,
      updateTask,
      endTask,
      reportTask
    ];
    
    for (const tool of toolsToRegister) {
      this.register(tool);
    }
    
    this.initialized = true;
    logger.info(`Registered ${this.tools.size} MCP tools`);
  }
  
  static register(tool: PermissionTool) {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name} (${tool._meta.security.level})`);
  }
  
  static get(name: string): PermissionTool | undefined {
    return this.tools.get(name);
  }
  
  static getAll(): PermissionTool[] {
    return Array.from(this.tools.values());
  }
  
  static getBySecurityLevel(level: string): PermissionTool[] {
    return this.getAll().filter(tool => tool._meta.security.level === level);
  }
  
  static getPublicTools(): Tool[] {
    // Return tools without _meta for public consumption
    return this.getAll()
      .filter(tool => tool._meta.security.level === 'public')
      .map(({ _meta, ...tool }) => tool);
  }
}

// Initialize on module load
ToolRegistry.initialize();
```

### Step 4: Update Tool Handlers

```typescript
// src/server/mcp/core/handlers/tool-handlers.ts
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { ToolRegistry } from "../services/tool-registry.js";
import { PermissionEvaluator } from "../services/permission-evaluator.js";
import { getUserPermissionContext } from "../services/user-context.js";
import { AuditLogger } from "../services/audit-logger.js";
import { RateLimiter } from "../services/rate-limiter.js";
import { logger } from "'@/modules/core/logger/index.js'";
import type { MCPToolContext } from "../types/request-context.js";

// Tool handlers
import { handleCheckStatus } from "./tools/check-status.js";
import { handleGetPrompt } from "./tools/get-prompt.js";
import { handleCreateTask } from "./tools/create-task.js";
import { handleUpdateTask } from "./tools/update-task.js";
import { handleEndTask } from "./tools/end-task.js";
import { handleReportTask } from "./tools/report-task.js";
import { handleCleanState } from "./tools/clean-state.js";

// Handler registry
const TOOL_HANDLERS: Record<string, (args: any, context: MCPToolContext) => Promise<CallToolResult>> = {
  checkstatus: handleCheckStatus,
  getprompt: handleGetPrompt,
  createtask: handleCreateTask,
  updatetask: handleUpdateTask,
  endtask: handleEndTask,
  reporttask: handleReportTask,
  cleanstate: handleCleanState,
};

/**
 * List tools with permission filtering
 */
export async function handleListTools(
  request: ListToolsRequest,
  context: MCPToolContext
): Promise<ListToolsResult> {
  try {
    logger.info(`Listing tools for session: ${context.sessionId}`);
    
    // Get user permission context
    const permContext = await getUserPermissionContext(context);
    const evaluator = new PermissionEvaluator(permContext);
    
    // Get all registered tools
    const allTools = ToolRegistry.getAll();
    const availableTools: Tool[] = [];
    
    // Filter tools based on permissions
    for (const tool of allTools) {
      try {
        const canUse = await evaluator.canUseTool(tool);
        if (canUse.allowed) {
          // Remove _meta from public response
          const { _meta, ...publicTool } = tool;
          availableTools.push(publicTool);
        } else {
          logger.debug(`Tool ${tool.name} filtered out: ${canUse.reason}`);
        }
      } catch (error) {
        logger.error(`Error checking permissions for tool ${tool.name}:`, error);
      }
    }
    
    // Sort by name
    availableTools.sort((a, b) => a.name.localeCompare(b.name));
    
    logger.info(`User ${permContext.userId} can access ${availableTools.length}/${allTools.length} tools`);
    
    return { tools: availableTools };
  } catch (error) {
    logger.error("Failed to list tools:", error);
    throw new Error("Failed to list available tools");
  }
}

/**
 * Execute tool with permission checking
 */
export async function handleToolCall(
  request: CallToolRequest,
  context: MCPToolContext,
): Promise<CallToolResult> {
  const startTime = Date.now();
  const { name, arguments: args } = request.params;
  
  try {
    logger.info(`Tool call: ${name}`, { 
      sessionId: context.sessionId,
      hasArgs: !!args 
    });
    
    // Validate tool exists
    const tool = ToolRegistry.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    // Get permission context
    const permContext = await getUserPermissionContext(context);
    const evaluator = new PermissionEvaluator(permContext);
    
    // Check permissions with arguments
    const canUse = await evaluator.canUseTool(tool, args);
    if (!canUse.allowed) {
      // Audit denied attempt
      await AuditLogger.logDeniedAccess({
        userId: permContext.userId,
        toolName: name,
        reason: canUse.reason,
        arguments: args,
        securityLevel: tool._meta.security.level
      });
      
      throw new Error(`Permission denied: ${canUse.reason}`);
    }
    
    // Check and update rate limits
    if (tool._meta.security.rateLimit) {
      const withinLimit = await RateLimiter.checkAndIncrement(
        permContext.userId,
        name,
        tool._meta.security.rateLimit
      );
      
      if (!withinLimit) {
        throw new Error(`Rate limit exceeded for tool ${name}`);
      }
    }
    
    // Start audit log entry
    const auditId = tool._meta.security.auditLog
      ? await AuditLogger.startToolCall({
          userId: permContext.userId,
          toolName: name,
          arguments: args,
          securityLevel: tool._meta.security.level,
          containerId: args?.containerId
        })
      : null;
    
    // Get handler
    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      throw new Error(`No handler implemented for tool: ${name}`);
    }
    
    // Execute tool
    logger.debug(`Executing ${name} with args:`, args);
    const result = await handler(args || {}, context);
    
    // Complete audit log
    if (auditId) {
      await AuditLogger.completeToolCall(auditId, {
        success: true,
        duration: Date.now() - startTime,
        resultSize: JSON.stringify(result).length
      });
    }
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`Tool ${name} failed:`, {
      error: errorMessage,
      duration: Date.now() - startTime,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Audit failed execution
    const tool = ToolRegistry.get(name);
    if (tool?._meta.security.auditLog) {
      const permContext = await getUserPermissionContext(context);
      await AuditLogger.logFailedToolCall({
        userId: permContext.userId,
        toolName: name,
        error: errorMessage,
        duration: Date.now() - startTime
      });
    }
    
    throw error;
  }
}
```

### Step 5: Permission Evaluator Implementation

```typescript
// src/server/mcp/core/services/permission-evaluator.ts
import { PermissionTool } from "../types/permission-tool.js";
import { checkPermission } from "../../../services/permissions/capability-validator.js";
import { logger } from "'@/modules/core/logger/index.js'";

export interface PermissionContext {
  userId: string;
  email: string;
  capabilities: string[];
  containerAccess?: {
    containerId: string;
    permissions: string[];
    level: string;
  }[];
  groups?: string[];
  metadata?: Record<string, any>;
}

export class PermissionEvaluator {
  constructor(private context: PermissionContext) {}
  
  async canUseTool(
    tool: PermissionTool, 
    args?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const meta = tool._meta;
      
      // Level 1: Check required permissions
      if (meta.permissions.required.length > 0) {
        for (const required of meta.permissions.required) {
          if (!this.hasPermission(required)) {
            return { 
              allowed: false, 
              reason: `Missing required permission: ${required}` 
            };
          }
        }
      }
      
      // Level 2: Check one-of permissions
      if (meta.permissions.oneOf && meta.permissions.oneOf.length > 0) {
        const hasOneOf = meta.permissions.oneOf.some(permSet =>
          permSet.every(perm => this.hasPermission(perm))
        );
        
        if (!hasOneOf) {
          return { 
            allowed: false, 
            reason: `Missing one of required permission sets` 
          };
        }
      }
      
      // Level 3: Check contextual permissions
      if (meta.permissions.contextual && args) {
        for (const [context, rule] of Object.entries(meta.permissions.contextual)) {
          try {
            if (this.evaluateCondition(rule.condition, args)) {
              for (const required of rule.requires) {
                if (!this.hasPermission(required)) {
                  return { 
                    allowed: false, 
                    reason: `Missing contextual permission: ${required} (context: ${context})` 
                  };
                }
              }
            }
          } catch (error) {
            logger.warn(`Failed to evaluate condition for ${context}:`, error);
          }
        }
      }
      
      // Level 4: Check dynamic permissions
      if (meta.permissions.dynamic && args) {
        try {
          const dynamicPerms = await meta.permissions.dynamic(args, this.context);
          for (const required of dynamicPerms) {
            if (!this.hasPermission(required)) {
              return { 
                allowed: false, 
                reason: `Missing dynamic permission: ${required}` 
              };
            }
          }
        } catch (error) {
          logger.error(`Dynamic permission check failed:`, error);
          return { 
            allowed: false, 
            reason: `Dynamic permission evaluation failed` 
          };
        }
      }
      
      // Level 5: Check container requirements
      if (meta.container?.requiresAccess && args?.containerId) {
        const containerCheck = this.checkContainerAccess(
          args.containerId, 
          meta.container.minimumPermission
        );
        if (!containerCheck.allowed) {
          return containerCheck;
        }
      }
      
      return { allowed: true };
      
    } catch (error) {
      logger.error(`Permission evaluation error:`, error);
      return { 
        allowed: false, 
        reason: `Permission check failed: ${error.message}` 
      };
    }
  }
  
  private hasPermission(required: string): boolean {
    return checkPermission(this.context.capabilities, required);
  }
  
  private checkContainerAccess(
    containerId: string, 
    minimumLevel?: string
  ): { allowed: boolean; reason?: string } {
    const access = this.context.containerAccess?.find(
      a => a.containerId === containerId
    );
    
    if (!access) {
      return { 
        allowed: false, 
        reason: `No access to container: ${containerId}` 
      };
    }
    
    if (minimumLevel && access.level !== minimumLevel) {
      // Check if user's level meets minimum
      const levels = ['viewer', 'developer', 'admin'];
      const userLevel = levels.indexOf(access.level);
      const requiredLevel = levels.indexOf(minimumLevel);
      
      if (userLevel < requiredLevel) {
        return { 
          allowed: false, 
          reason: `Requires ${minimumLevel} access, but user has ${access.level}` 
        };
      }
    }
    
    return { allowed: true };
  }
  
  private evaluateCondition(condition: string, args: Record<string, any>): boolean {
    // Safe condition evaluation using Function constructor
    try {
      // Only allow simple property access and comparisons
      const sanitized = condition
        .replace(/[^a-zA-Z0-9_.=!<>& |()]/g, '')
        .trim();
      
      const func = new Function('args', `
        try {
          return ${sanitized};
        } catch {
          return false;
        }
      `);
      
      return func(args) === true;
    } catch (error) {
      logger.warn(`Condition evaluation failed: ${condition}`, error);
      return false;
    }
  }
}
```

### Step 6: User Context Service

```typescript
// src/server/mcp/core/services/user-context.ts
import { MCPToolContext } from "../types/request-context.js";
import { PermissionContext } from "./permission-evaluator.js";
import { db } from "../../../database/index.js";
import { logger } from "'@/modules/core/logger/index.js'";

export async function getUserPermissionContext(
  context: MCPToolContext
): Promise<PermissionContext> {
  try {
    // Get user from session
    const sessionResult = await db.query(
      `SELECT u.id, u.email, s.metadata
       FROM mcp_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_id = $1 AND s.expires_at > NOW()`,
      [context.sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      throw new Error("Invalid or expired session");
    }
    
    const user = sessionResult.rows[0];
    
    // Get user capabilities
    const capResult = await db.query(
      `SELECT DISTINCT c.capability
       FROM user_capabilities uc
       JOIN capabilities c ON uc.capability_id = c.id
       WHERE uc.user_id = $1 AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
       UNION
       SELECT DISTINCT c.capability
       FROM user_groups ug
       JOIN group_capabilities gc ON ug.group_id = gc.group_id
       JOIN capabilities c ON gc.capability_id = c.id
       WHERE ug.user_id = $1`,
      [user.id]
    );
    
    const capabilities = capResult.rows.map(r => r.capability);
    
    // Get container access
    const containerResult = await db.query(
      `SELECT 
         c.id as container_id,
         ag.capabilities,
         pt.name as permission_level
       FROM access_grants ag
       JOIN containers c ON ag.container_id = c.id
       LEFT JOIN permission_templates pt ON ag.permission_template_id = pt.id
       WHERE ag.grantee_email = $1 
         AND (ag.expires_at IS NULL OR ag.expires_at > NOW())
         AND ag.revoked_at IS NULL`,
      [user.email]
    );
    
    const containerAccess = containerResult.rows.map(r => ({
      containerId: r.container_id,
      permissions: r.capabilities || [],
      level: r.permission_level || 'custom'
    }));
    
    // Get user groups
    const groupResult = await db.query(
      `SELECT g.name
       FROM user_groups ug
       JOIN groups g ON ug.group_id = g.id
       WHERE ug.user_id = $1`,
      [user.id]
    );
    
    const groups = groupResult.rows.map(r => r.name);
    
    return {
      userId: user.id,
      email: user.email,
      capabilities,
      containerAccess,
      groups,
      metadata: user.metadata || {}
    };
    
  } catch (error) {
    logger.error("Failed to get user permission context:", error);
    throw new Error("Failed to retrieve user permissions");
  }
}
```

## Testing the Implementation

### 1. Unit Tests

```typescript
// tests/unit/permission-evaluator.spec.ts
import { PermissionEvaluator } from "@/server/mcp/core/services/permission-evaluator";
import { definePermissionTool } from "@/server/mcp/core/types/permission-tool";

describe("PermissionEvaluator", () => {
  const mockContext = {
    userId: "user123",
    email: "test@example.com",
    capabilities: ["tasks:read", "tasks:create", "system:read"],
    containerAccess: [{
      containerId: "container123",
      permissions: ["read", "write"],
      level: "developer"
    }]
  };
  
  const evaluator = new PermissionEvaluator(mockContext);
  
  it("should allow tool with matching permissions", async () => {
    const tool = definePermissionTool({
      name: "test",
      description: "Test tool",
      inputSchema: { type: "object" }
    }, {
      permissions: { required: ["tasks:read"] },
      security: { level: "public", auditLog: false }
    });
    
    const result = await evaluator.canUseTool(tool);
    expect(result.allowed).toBe(true);
  });
  
  it("should deny tool with missing permissions", async () => {
    const tool = definePermissionTool({
      name: "test",
      description: "Test tool",
      inputSchema: { type: "object" }
    }, {
      permissions: { required: ["admin:write"] },
      security: { level: "restricted", auditLog: true }
    });
    
    const result = await evaluator.canUseTool(tool);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Missing required permission");
  });
  
  it("should check contextual permissions", async () => {
    const tool = definePermissionTool({
      name: "test",
      description: "Test tool",
      inputSchema: { type: "object" }
    }, {
      permissions: {
        required: ["tasks:create"],
        contextual: {
          "priority": {
            condition: "args.priority === 'high'",
            requires: ["tasks:create:priority"]
          }
        }
      },
      security: { level: "restricted", auditLog: true }
    });
    
    // Should allow without high priority
    const result1 = await evaluator.canUseTool(tool, { priority: "low" });
    expect(result1.allowed).toBe(true);
    
    // Should deny with high priority (missing permission)
    const result2 = await evaluator.canUseTool(tool, { priority: "high" });
    expect(result2.allowed).toBe(false);
  });
});
```

### 2. Integration Tests

```typescript
// tests/integration/mcp-tools.spec.ts
import request from "supertest";
import { app } from "@/server";

describe("MCP Tool Permissions", () => {
  let userToken: string;
  let adminToken: string;
  
  beforeAll(async () => {
    // Setup test users with different permissions
    userToken = await createTestUser(["tasks:read", "tasks:create"]);
    adminToken = await createTestUser(["*:*"]);
  });
  
  describe("GET /mcp/tools", () => {
    it("should return filtered tools for regular user", async () => {
      const response = await request(app)
        .get("/mcp/tools")
        .set("Authorization", `Bearer ${userToken}`);
        
      expect(response.status).toBe(200);
      expect(response.body.tools).toHaveLength(3); // Limited tools
      expect(response.body.tools.map(t => t.name))
        .not.toContain("cleanstate");
    });
    
    it("should return all tools for admin", async () => {
      const response = await request(app)
        .get("/mcp/tools")
        .set("Authorization", `Bearer ${adminToken}`);
        
      expect(response.status).toBe(200);
      expect(response.body.tools.length).toBeGreaterThan(5);
      expect(response.body.tools.map(t => t.name))
        .toContain("cleanstate");
    });
  });
  
  describe("POST /mcp/tools/call", () => {
    it("should allow permitted tool call", async () => {
      const response = await request(app)
        .post("/mcp/tools/call")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "createtask",
          arguments: {
            title: "Test task",
            description: "Test description"
          }
        });
        
      expect(response.status).toBe(200);
    });
    
    it("should deny unpermitted tool call", async () => {
      const response = await request(app)
        .post("/mcp/tools/call")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          name: "cleanstate",
          arguments: { target: "all" }
        });
        
      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Permission denied");
    });
  });
});
```

## Migration Guide

1. **Update all tool definitions** to use `definePermissionTool`
2. **Add permission metadata** to each tool based on security requirements
3. **Update tool handlers** to use the new permission-aware system
4. **Create database tables** for audit logs and rate limits
5. **Configure user capabilities** in your existing permission system
6. **Test thoroughly** with different user permission levels

## Best Practices

1. **Start Restrictive**: Begin with minimal permissions and expand as needed
2. **Use Contextual Permissions**: Add conditions for sensitive operations
3. **Audit Critical Tools**: Always log usage of sensitive tools
4. **Rate Limit Expensive Operations**: Prevent abuse and resource exhaustion
5. **Document Permission Requirements**: Make it clear what each tool needs
6. **Regular Security Reviews**: Periodically review tool permissions