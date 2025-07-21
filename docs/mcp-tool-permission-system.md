# MCP Tool Permission System

## Overview

This document describes a sophisticated permission system for MCP (Model Context Protocol) tools that allows fine-grained control over which tools users can access based on their permission levels and contexts.

## Core Concepts

### 1. Permission Metadata in Tool Definitions

Using the MCP SDK's `_meta` field, we can embed permission requirements directly in tool definitions:

```typescript
// src/server/mcp/core/constants/tool/create-task.ts
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolPermissionMeta {
  permissions: {
    required: string[];              // Required capabilities
    oneOf?: string[][];             // At least one set of capabilities
    contextual?: {                  // Context-based permissions
      [key: string]: {
        condition: string;           // Condition expression
        requires: string[];          // Required capabilities if condition met
      };
    };
  };
  security: {
    level: 'public' | 'restricted' | 'sensitive' | 'critical';
    auditLog: boolean;              // Should tool calls be logged?
    rateLimit?: {                   // Rate limiting config
      calls: number;
      window: number;               // in seconds
    };
  };
  container?: {
    requiresAccess: boolean;        // Does this tool need container access?
    minimumPermission?: string;     // Minimum container permission level
  };
}

export const createTask: Tool & { _meta: ToolPermissionMeta } = {
  name: "createtask",
  description: "Create a new task",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      tool: { type: "string" },
      instructions: { type: "string" },
      containerId: { type: "string" }  // Optional container context
    },
    required: ["title"]
  },
  _meta: {
    permissions: {
      required: ["tasks:create"],
      contextual: {
        "container": {
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
  }
};
```

### 2. Enhanced Tool Definitions

Create a base type for permission-aware tools:

```typescript
// src/server/mcp/core/types/permission-tool.ts
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export type PermissionTool = Tool & {
  _meta: ToolPermissionMeta;
};

// Helper to create permission-aware tools
export function definePermissionTool(
  tool: Tool,
  meta: ToolPermissionMeta
): PermissionTool {
  return {
    ...tool,
    _meta: meta
  };
}
```

### 3. Update All Tool Definitions

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
      "verbose": {
        condition: "args.verbose === true",
        requires: ["system:read:detailed"]
      }
    }
  },
  security: {
    level: "public",
    auditLog: false
  }
});

// src/server/mcp/core/constants/tool/clean-state.ts
export const cleanState = definePermissionTool({
  name: "cleanstate",
  description: "Clean system state",
  inputSchema: {
    type: "object",
    properties: {
      target: { type: "string" },
      force: { type: "boolean" }
    }
  }
}, {
  permissions: {
    required: ["system:admin"],
    contextual: {
      "force": {
        condition: "args.force === true",
        requires: ["system:admin:dangerous"]
      }
    }
  },
  security: {
    level: "critical",
    auditLog: true,
    rateLimit: {
      calls: 10,
      window: 3600
    }
  }
});

// src/server/mcp/core/constants/tool/report-task.ts
export const reportTask = definePermissionTool({
  name: "reporttask",
  description: "Generate task report",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "string" },
      format: { type: "string" },
      includeSecrets: { type: "boolean" }
    }
  }
}, {
  permissions: {
    required: ["tasks:read", "reports:generate"],
    contextual: {
      "secrets": {
        condition: "args.includeSecrets === true",
        requires: ["secrets:read"]
      }
    }
  },
  security: {
    level: "restricted",
    auditLog: true
  }
});
```

### 4. Permission-Aware Tool Registry

```typescript
// src/server/mcp/core/services/tool-registry.ts
import { PermissionTool } from "../types/permission-tool.js";
import { checkStatus } from "../constants/tool/check-status.js";
import { createTask } from "../constants/tool/create-task.js";
import { cleanState } from "../constants/tool/clean-state.js";
import { reportTask } from "../constants/tool/report-task.js";
import { getPrompt } from "../constants/tool/get-prompt.js";
import { updateTask } from "../constants/tool/update-task.js";
import { endTask } from "../constants/tool/end-task.js";

export class ToolRegistry {
  private static tools: Map<string, PermissionTool> = new Map();
  
  static {
    // Register all tools
    this.register(checkStatus);
    this.register(createTask);
    this.register(cleanState);
    this.register(reportTask);
    this.register(getPrompt);
    this.register(updateTask);
    this.register(endTask);
  }
  
  static register(tool: PermissionTool) {
    this.tools.set(tool.name, tool);
  }
  
  static get(name: string): PermissionTool | undefined {
    return this.tools.get(name);
  }
  
  static getAll(): PermissionTool[] {
    return Array.from(this.tools.values());
  }
  
  static getFiltered(filter: (tool: PermissionTool) => boolean): PermissionTool[] {
    return this.getAll().filter(filter);
  }
}
```

### 5. Permission Evaluation Engine

```typescript
// src/server/mcp/core/services/permission-evaluator.ts
import { PermissionTool } from "../types/permission-tool.js";
import { checkPermission } from "../../../services/permissions/capability-validator.js";

export interface PermissionContext {
  userId: string;
  capabilities: string[];
  containerAccess?: {
    containerId: string;
    permissions: string[];
  }[];
  rateLimits: Map<string, { count: number; resetAt: Date }>;
}

export class PermissionEvaluator {
  constructor(private context: PermissionContext) {}
  
  async canUseTool(
    tool: PermissionTool, 
    args?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    const meta = tool._meta;
    
    // Check basic required permissions
    for (const required of meta.permissions.required) {
      if (!checkPermission(this.context.capabilities, required)) {
        return { 
          allowed: false, 
          reason: `Missing required permission: ${required}` 
        };
      }
    }
    
    // Check one-of permissions
    if (meta.permissions.oneOf) {
      const hasOneOf = meta.permissions.oneOf.some(set =>
        set.every(perm => checkPermission(this.context.capabilities, perm))
      );
      if (!hasOneOf) {
        return { 
          allowed: false, 
          reason: `Missing one of required permission sets` 
        };
      }
    }
    
    // Check contextual permissions
    if (meta.permissions.contextual && args) {
      for (const [name, rule] of Object.entries(meta.permissions.contextual)) {
        if (this.evaluateCondition(rule.condition, args)) {
          for (const required of rule.requires) {
            if (!checkPermission(this.context.capabilities, required)) {
              return { 
                allowed: false, 
                reason: `Missing contextual permission: ${required} (for ${name})` 
              };
            }
          }
        }
      }
    }
    
    // Check container access if required
    if (meta.container?.requiresAccess && args?.containerId) {
      const hasAccess = this.context.containerAccess?.some(
        access => access.containerId === args.containerId
      );
      if (!hasAccess) {
        return { 
          allowed: false, 
          reason: `No access to container: ${args.containerId}` 
        };
      }
    }
    
    // Check rate limits
    if (meta.security.rateLimit) {
      const limit = this.context.rateLimits.get(tool.name);
      if (limit && limit.count >= meta.security.rateLimit.calls) {
        if (limit.resetAt > new Date()) {
          return { 
            allowed: false, 
            reason: `Rate limit exceeded. Resets at ${limit.resetAt.toISOString()}` 
          };
        }
      }
    }
    
    return { allowed: true };
  }
  
  private evaluateCondition(condition: string, args: Record<string, any>): boolean {
    // Simple condition evaluator - in production, use a proper expression parser
    // This is a simplified version that handles basic comparisons
    try {
      // Create a safe evaluation context
      const safeArgs = Object.freeze({ args });
      const func = new Function('args', `return ${condition}`);
      return func(args);
    } catch {
      return false;
    }
  }
  
  getToolsForUser(): PermissionTool[] {
    return ToolRegistry.getFiltered(tool => {
      const result = this.canUseTool(tool);
      return result.then(r => r.allowed).catch(() => false);
    });
  }
}
```

### 6. Enhanced Tool Handlers

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
import { PermissionEvaluator, PermissionContext } from "../services/permission-evaluator.js";
import { AuditLogger } from "../services/audit-logger.js";
import { RateLimiter } from "../services/rate-limiter.js";
import { logger } from "@/utils/logger.js";
import type { MCPToolContext } from "../types/request-context.js";

// Import all tool handlers
import { handleCheckStatus } from "./tools/check-status.js";
import { handleGetPrompt } from "./tools/get-prompt.js";
import { handleCreateTask } from "./tools/create-task.js";
import { handleUpdateTask } from "./tools/update-task.js";
import { handleEndTask } from "./tools/end-task.js";
import { handleReportTask } from "./tools/report-task.js";
import { handleCleanState } from "./tools/clean-state.js";

/**
 * Get permission context for the current session
 */
async function getPermissionContext(context: MCPToolContext): Promise<PermissionContext> {
  // Get user from session
  const user = await getUserFromSession(context.sessionId);
  
  // Get user's capabilities
  const capabilities = await getUserCapabilities(user.id);
  
  // Get container access if applicable
  const containerAccess = await getUserContainerAccess(user.id);
  
  // Get rate limit state
  const rateLimits = await RateLimiter.getUserLimits(user.id);
  
  return {
    userId: user.id,
    capabilities,
    containerAccess,
    rateLimits
  };
}

/**
 * Handles MCP tool listing requests with permission filtering
 */
export async function handleListTools(
  request: ListToolsRequest,
  context: MCPToolContext
): Promise<ListToolsResult> {
  try {
    // Get permission context
    const permContext = await getPermissionContext(context);
    const evaluator = new PermissionEvaluator(permContext);
    
    // Get all tools user has access to
    const allTools = ToolRegistry.getAll();
    const allowedTools: Tool[] = [];
    
    for (const tool of allTools) {
      const canUse = await evaluator.canUseTool(tool);
      if (canUse.allowed) {
        // Strip _meta from response (it's internal)
        const { _meta, ...toolWithoutMeta } = tool;
        allowedTools.push(toolWithoutMeta);
      }
    }
    
    // Sort alphabetically
    allowedTools.sort((a, b) => a.name.localeCompare(b.name));
    
    logger.info(`Listed ${allowedTools.length} tools for user ${permContext.userId}`);
    
    return { tools: allowedTools };
  } catch (error) {
    logger.error("Failed to list tools", error);
    throw error;
  }
}

/**
 * Handles MCP tool invocation with permission checking
 */
export async function handleToolCall(
  request: CallToolRequest,
  context: MCPToolContext,
): Promise<CallToolResult> {
  try {
    const { name, arguments: args } = request.params;
    
    logger.info(`Tool call requested: ${name}`, { sessionId: context.sessionId });
    
    // Get tool definition
    const tool = ToolRegistry.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    // Get permission context
    const permContext = await getPermissionContext(context);
    const evaluator = new PermissionEvaluator(permContext);
    
    // Check permissions
    const canUse = await evaluator.canUseTool(tool, args);
    if (!canUse.allowed) {
      logger.warn(`Permission denied for tool ${name}`, {
        userId: permContext.userId,
        reason: canUse.reason
      });
      throw new Error(`Permission denied: ${canUse.reason}`);
    }
    
    // Update rate limits
    if (tool._meta.security.rateLimit) {
      await RateLimiter.increment(permContext.userId, name);
    }
    
    // Audit log if required
    if (tool._meta.security.auditLog) {
      await AuditLogger.logToolCall({
        userId: permContext.userId,
        toolName: name,
        arguments: args,
        securityLevel: tool._meta.security.level,
        timestamp: new Date()
      });
    }
    
    // Execute tool based on name
    let result: CallToolResult;
    
    switch (name) {
      case "checkstatus":
        result = await handleCheckStatus(args, context);
        break;
      case "getprompt":
        result = await handleGetPrompt(args, context);
        break;
      case "createtask":
        result = await handleCreateTask(args, context);
        break;
      case "updatetask":
        result = await handleUpdateTask(args, context);
        break;
      case "endtask":
        result = await handleEndTask(args, context);
        break;
      case "reporttask":
        result = await handleReportTask(args, context);
        break;
      case "cleanstate":
        result = await handleCleanState(args, context);
        break;
      default:
        throw new Error(`Tool handler not implemented: ${name}`);
    }
    
    // Audit successful execution
    if (tool._meta.security.auditLog) {
      await AuditLogger.logToolResult({
        userId: permContext.userId,
        toolName: name,
        success: true,
        timestamp: new Date()
      });
    }
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error("Tool call failed", {
      toolName: request.params?.name,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Audit failed execution
    const tool = ToolRegistry.get(request.params.name);
    if (tool?._meta.security.auditLog) {
      const permContext = await getPermissionContext(context);
      await AuditLogger.logToolResult({
        userId: permContext.userId,
        toolName: request.params.name,
        success: false,
        error: errorMessage,
        timestamp: new Date()
      });
    }
    
    throw error;
  }
}
```

### 7. Supporting Services

```typescript
// src/server/mcp/core/services/audit-logger.ts
export interface ToolAuditEntry {
  userId: string;
  toolName: string;
  arguments?: any;
  securityLevel: string;
  timestamp: Date;
  success?: boolean;
  error?: string;
}

export class AuditLogger {
  static async logToolCall(entry: ToolAuditEntry) {
    await db.query(
      `INSERT INTO tool_audit_log 
       (user_id, tool_name, arguments, security_level, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.userId, entry.toolName, JSON.stringify(entry.arguments), 
       entry.securityLevel, entry.timestamp]
    );
  }
  
  static async logToolResult(entry: ToolAuditEntry) {
    await db.query(
      `UPDATE tool_audit_log 
       SET success = $1, error = $2
       WHERE user_id = $3 AND tool_name = $4 
       AND timestamp = $5`,
      [entry.success, entry.error, entry.userId, 
       entry.toolName, entry.timestamp]
    );
  }
}

// src/server/mcp/core/services/rate-limiter.ts
export class RateLimiter {
  private static limits = new Map<string, Map<string, RateLimit>>();
  
  static async getUserLimits(userId: string): Promise<Map<string, RateLimit>> {
    if (!this.limits.has(userId)) {
      this.limits.set(userId, new Map());
    }
    return this.limits.get(userId)!;
  }
  
  static async increment(userId: string, toolName: string) {
    const userLimits = await this.getUserLimits(userId);
    const current = userLimits.get(toolName) || { count: 0, resetAt: new Date() };
    
    if (current.resetAt < new Date()) {
      // Reset the counter
      current.count = 1;
      current.resetAt = new Date(Date.now() + 3600000); // 1 hour
    } else {
      current.count++;
    }
    
    userLimits.set(toolName, current);
  }
}
```

### 8. Database Schema

```sql
-- Tool audit log
CREATE TABLE tool_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  arguments JSONB,
  security_level VARCHAR(20),
  timestamp TIMESTAMP NOT NULL,
  success BOOLEAN,
  error TEXT,
  container_id UUID,
  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  INDEX idx_user_tool (user_id, tool_name),
  INDEX idx_timestamp (timestamp),
  INDEX idx_security_level (security_level)
);

-- Tool rate limits
CREATE TABLE tool_rate_limits (
  user_id UUID NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  count INT DEFAULT 0,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  PRIMARY KEY (user_id, tool_name)
);

-- Tool permission overrides (for special cases)
CREATE TABLE tool_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  group_id UUID,
  tool_name VARCHAR(100) NOT NULL,
  grant_type VARCHAR(20) NOT NULL, -- 'allow' or 'deny'
  capabilities JSONB,
  reason TEXT,
  expires_at TIMESTAMP,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (user_id IS NOT NULL OR group_id IS NOT NULL)
);
```

## Advanced Permission Scenarios

### 1. Container-Specific Tools

Some tools should only be available when working with specific containers:

```typescript
export const execCommand = definePermissionTool({
  name: "exec",
  description: "Execute command in container",
  inputSchema: {
    type: "object",
    properties: {
      containerId: { type: "string" },
      command: { type: "string" },
      workdir: { type: "string" }
    },
    required: ["containerId", "command"]
  }
}, {
  permissions: {
    required: ["exec:run"],
    contextual: {
      "sudo": {
        condition: "args.command.startsWith('sudo')",
        requires: ["exec:sudo"]
      }
    }
  },
  security: {
    level: "sensitive",
    auditLog: true,
    rateLimit: {
      calls: 100,
      window: 300 // 5 minutes
    }
  },
  container: {
    requiresAccess: true,
    minimumPermission: "developer"
  }
});
```

### 2. Time-Based Permissions

```typescript
export interface TimeBasedPermission {
  schedule?: {
    daysOfWeek?: number[];  // 0-6
    hoursOfDay?: number[];  // 0-23
    timezone?: string;
  };
  temporary?: {
    validFrom: Date;
    validUntil: Date;
  };
}

// In tool definition
_meta: {
  permissions: {
    required: ["maintenance:execute"],
    timeBased: {
      schedule: {
        daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
        hoursOfDay: [9, 10, 11, 12, 13, 14, 15, 16, 17], // 9am-5pm
        timezone: "America/New_York"
      }
    }
  }
}
```

### 3. Dynamic Permission Requirements

```typescript
// Tool that requires different permissions based on target
export const manageService = definePermissionTool({
  name: "manageservice",
  description: "Manage system services",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string" },
      action: { type: "string", enum: ["start", "stop", "restart", "status"] }
    }
  }
}, {
  permissions: {
    required: ["services:read"],
    dynamic: async (args, context) => {
      // Critical services require admin permission
      const criticalServices = ["database", "auth", "tunnel"];
      if (criticalServices.includes(args.service)) {
        return ["services:admin"];
      }
      
      // Write actions require write permission
      if (["start", "stop", "restart"].includes(args.action)) {
        return ["services:write"];
      }
      
      return [];
    }
  },
  security: {
    level: "restricted",
    auditLog: true
  }
});
```

## Integration with Container Permissions

### 1. Container Context in Tools

```typescript
// In permission evaluator
async canUseToolInContainer(
  tool: PermissionTool,
  containerId: string,
  args: Record<string, any>
): Promise<{ allowed: boolean; reason?: string }> {
  // First check general tool permissions
  const generalCheck = await this.canUseTool(tool, args);
  if (!generalCheck.allowed) {
    return generalCheck;
  }
  
  // Then check container-specific permissions
  const containerAccess = this.context.containerAccess?.find(
    a => a.containerId === containerId
  );
  
  if (!containerAccess) {
    return { allowed: false, reason: "No access to container" };
  }
  
  // Check if user has minimum permission level for this tool
  if (tool._meta.container?.minimumPermission) {
    const hasMinimum = containerAccess.permissions.includes(
      tool._meta.container.minimumPermission
    );
    if (!hasMinimum) {
      return { 
        allowed: false, 
        reason: `Requires ${tool._meta.container.minimumPermission} permission in container` 
      };
    }
  }
  
  return { allowed: true };
}
```

### 2. Tool Filtering by Container

```typescript
// Get tools available for a specific container
export async function getToolsForContainer(
  userId: string,
  containerId: string
): Promise<Tool[]> {
  const context = await getPermissionContext({ userId });
  const evaluator = new PermissionEvaluator(context);
  
  const allTools = ToolRegistry.getAll();
  const allowedTools: Tool[] = [];
  
  for (const tool of allTools) {
    // Skip tools that require container access if not in container context
    if (tool._meta.container?.requiresAccess && !containerId) {
      continue;
    }
    
    const canUse = await evaluator.canUseToolInContainer(tool, containerId, {});
    if (canUse.allowed) {
      allowedTools.push(tool);
    }
  }
  
  return allowedTools;
}
```

## Usage Examples

### 1. User with Limited Permissions

```typescript
// User capabilities: ["tasks:read", "container:view"]
// Available tools: checkstatus (limited), getprompt
// Unavailable tools: createtask, cleanstate, etc.
```

### 2. Developer with Container Access

```typescript
// User capabilities: ["tasks:*", "container:write", "exec:run"]
// Container permissions: ["developer"]
// Available tools: All task tools, exec (no sudo), file operations
// Unavailable tools: cleanstate, admin tools
```

### 3. Admin with Full Access

```typescript
// User capabilities: ["*:*"]
// Available tools: All tools with no restrictions
// Rate limits still apply for dangerous operations
```

## Security Best Practices

1. **Principle of Least Privilege**: Users start with minimal permissions
2. **Audit Everything**: Critical tools log all operations
3. **Rate Limiting**: Prevent abuse of expensive operations
4. **Context Awareness**: Tools adapt based on container/user context
5. **Time-Based Access**: Support temporary elevated permissions
6. **Fail Secure**: Deny by default if permission check fails

## Future Enhancements

1. **Permission Templates**: Pre-defined sets of tool permissions
2. **Delegation**: Allow users to delegate tool permissions
3. **Workflow Permissions**: Permissions for tool combinations
4. **Machine Learning**: Detect unusual tool usage patterns
5. **Integration with External Systems**: LDAP/AD permission sync