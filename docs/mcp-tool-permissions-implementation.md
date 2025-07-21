# MCP Tool Permissions Implementation

## Overview

This document describes the implementation of a role-based permission system for MCP (Model Context Protocol) tools in SystemPrompt. The system restricts tool access based on user roles and granular permissions.

## Implementation Summary

### 1. Permission System (`src/server/mcp/core/types/permissions.ts`)

- **Roles**: `admin` and `basic`
- **Permissions**: Granular permissions like `admin:*`, `system:read`, `tools:*`
- **Wildcard Support**: Permissions support wildcards (e.g., `admin:*` grants all admin permissions)

### 2. Tool Definition (`src/server/mcp/core/constants/tool/check-status.ts`)

The `checkstatus` tool is defined with permission metadata:

```typescript
export const checkStatus: PermissionTool = {
  name: "checkstatus",
  description: "Get comprehensive system status (admin only)",
  inputSchema: {
    type: "object",
    properties: {
      includeContainers: { type: "boolean" },
      includeUsers: { type: "boolean" },
      includeResources: { type: "boolean" },
      includeTunnels: { type: "boolean" },
      includeAuditLog: { type: "boolean" }
    }
  },
  _meta: {
    requiredRole: 'admin',
    requiredPermissions: ['system:read', 'admin:status']
  }
};
```

### 3. Tool Handlers (`src/server/mcp/core/handlers/tool-handlers.ts`)

- **Modern TypeScript**: Uses Zod for runtime validation, no `any` types
- **Permission Checking**: Validates user role and permissions before tool execution
- **Comprehensive Logging**: Logs all access attempts for security auditing
- **Error Handling**: Graceful error handling with detailed error messages

Key features:
- `handleListTools`: Filters tools based on user permissions
- `handleToolCall`: Enforces permissions before executing tools
- Strips internal `_meta` from public API responses

### 4. Check Status Handler (`src/server/mcp/core/handlers/tools/check-status.ts`)

Implements the actual system status check functionality:
- CPU, memory, and disk usage monitoring
- Service status checks (MCP, OAuth, Docker)
- Optional detailed information (containers, users, tunnels, audit logs)

### 5. Testing

#### Unit Tests (`tests/unit/server/mcp/core/handlers/tool-handlers.spec.ts`)
- Tests permission filtering in tool listing
- Tests access control for tool execution
- Tests error handling and logging
- 15 test cases covering all scenarios

#### E2E Tests (`tests/e2e/mcp-tool-api.spec.ts`)
- Tests complete user flows (admin vs basic users)
- Tests audit trail creation
- Tests concurrent request handling
- Tests error recovery
- 7 comprehensive test suites

## Usage Example

```typescript
// Admin user can see and use the check-status tool
const adminContext = { sessionId: 'admin-session-123' };
const tools = await handleListTools({}, adminContext);
// Returns: [{ name: 'checkstatus', description: '...' }]

const result = await handleToolCall({
  params: {
    name: 'checkstatus',
    arguments: { includeContainers: true }
  }
}, adminContext);
// Returns: System status information

// Basic user cannot see or use admin tools
const basicContext = { sessionId: 'basic-user-456' };
const tools = await handleListTools({}, basicContext);
// Returns: []

await handleToolCall({
  params: { name: 'checkstatus', arguments: {} }
}, basicContext);
// Throws: Permission denied error
```

## Security Features

1. **Role-Based Access Control**: Tools are restricted by user role
2. **Granular Permissions**: Fine-grained permission checks
3. **Audit Logging**: All access attempts are logged
4. **Session Validation**: Requires valid session ID
5. **Input Validation**: Zod validation for all inputs
6. **Error Sanitization**: Internal errors are not exposed to users

## Future Enhancements

1. **Custom Permissions**: Users can define custom permission levels
2. **Dynamic Tool Registration**: Add/remove tools at runtime
3. **Permission Inheritance**: Hierarchical permission structures
4. **Rate Limiting**: Per-user rate limits for tool usage
5. **Database Integration**: Store user sessions and permissions in database

## Testing

Run all tests:
```bash
npm test -- tests/unit/server/mcp/core/handlers/tool-handlers.spec.ts tests/unit/server/mcp/core/permissions.spec.ts tests/e2e/mcp-tool-api.spec.ts
```

All 29 tests pass successfully, demonstrating:
- Admin users can access admin-only tools
- Basic users are denied access to admin tools
- Proper error handling and logging
- Performance under concurrent requests