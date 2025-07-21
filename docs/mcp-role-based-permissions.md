# MCP Role-Based Permission System

## Overview

The MCP tool system now uses a simplified role-based permission model with two initial roles:
- **admin**: Full system access
- **basic**: Limited read-only access

## Current Implementation

### 1. Single Tool: check-status

The system now has only one MCP tool:

```typescript
// Tool definition with permissions
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

### 2. Role Definitions

```typescript
// Admin role permissions
admin: [
  'system:read',
  'system:write',
  'admin:*',
  'container:*',
  'user:*',
  'audit:read'
]

// Basic role permissions  
basic: [
  'system:read:basic',
  'container:read:own',
  'user:read:self'
]
```

### 3. Permission Format

Permissions follow the format: `resource:action` or `resource:action:scope`

Examples:
- `system:read` - Read system information
- `admin:*` - All admin actions
- `container:read:own` - Read own containers only

### 4. Permission Checking

The system checks permissions at two levels:

1. **Role-based**: Does the user have the required role?
2. **Granular**: Does the user have specific permissions?

```typescript
// Permission check logic
function hasToolPermission(userContext, tool) {
  // Check role requirement
  if (tool._meta.requiredRole && userContext.role !== tool._meta.requiredRole) {
    return false;
  }
  
  // Check specific permissions
  if (tool._meta.requiredPermissions) {
    return tool._meta.requiredPermissions.every(perm => 
      userContext.permissions.includes(perm) ||
      userContext.permissions.some(p => p.endsWith(':*'))
    );
  }
  
  return true;
}
```

## Admin System Status

The `check-status` tool provides comprehensive system information for admins:

### Basic Information (Always Included)
- System timestamp and uptime
- Platform information
- Resource usage (CPU, memory, disk)
- Service status (MCP, OAuth, Docker)

### Optional Information (Via Parameters)
- **includeContainers**: List of all containers with status
- **includeUsers**: Active users and their roles
- **includeResources**: Detailed resource utilization
- **includeTunnels**: Cloudflare tunnel status
- **includeAuditLog**: Recent system audit entries

## Usage Examples

### Admin User Experience

```javascript
// Admin lists tools - sees check-status
GET /mcp/tools
Response: {
  tools: [{
    name: "checkstatus",
    description: "Get comprehensive system status (admin only)",
    inputSchema: { ... }
  }]
}

// Admin calls check-status
POST /mcp/tools/call
{
  name: "checkstatus",
  arguments: {
    includeContainers: true,
    includeUsers: true
  }
}

Response: {
  timestamp: "2024-01-20T10:00:00Z",
  uptime: 86400,
  platform: "Linux 5.15",
  resources: { ... },
  services: { ... },
  containers: [ ... ],
  users: [ ... ]
}
```

### Basic User Experience

```javascript
// Basic user lists tools - sees no tools
GET /mcp/tools
Response: {
  tools: []
}

// Basic user tries to call check-status - denied
POST /mcp/tools/call
{
  name: "checkstatus"
}

Response: Error: Permission denied: basic role cannot access checkstatus tool
```

## Database Schema

```sql
-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role permissions
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id),
  permission VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission)
);

-- User roles
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

-- User custom permissions (beyond role)
CREATE TABLE user_permissions (
  user_id UUID REFERENCES users(id),
  permission VARCHAR(100) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by UUID REFERENCES users(id),
  expires_at TIMESTAMP,
  reason TEXT,
  PRIMARY KEY (user_id, permission)
);

-- Initial data
INSERT INTO roles (id, name, description) VALUES 
  ('role-admin', 'admin', 'Full system access'),
  ('role-basic', 'basic', 'Limited read-only access');

INSERT INTO role_permissions (role_id, permission) VALUES
  ('role-admin', 'system:read'),
  ('role-admin', 'system:write'),
  ('role-admin', 'admin:*'),
  ('role-admin', 'container:*'),
  ('role-admin', 'user:*'),
  ('role-admin', 'audit:read'),
  ('role-basic', 'system:read:basic'),
  ('role-basic', 'container:read:own'),
  ('role-basic', 'user:read:self');
```

## Integration with getUserPermissionContext

Replace the mock implementation with real database queries:

```typescript
async function getUserPermissionContext(context: MCPToolContext): Promise<UserPermissionContext> {
  // Get session
  const session = await db.query(
    'SELECT user_id FROM mcp_sessions WHERE session_id = $1 AND expires_at > NOW()',
    [context.sessionId]
  );
  
  if (!session.rows[0]) {
    throw new Error('Invalid session');
  }
  
  const userId = session.rows[0].user_id;
  
  // Get user and role
  const userResult = await db.query(`
    SELECT u.id, u.email, r.name as role
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE u.id = $1
  `, [userId]);
  
  const user = userResult.rows[0];
  
  // Get role permissions
  const rolePerms = await db.query(`
    SELECT permission
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    WHERE r.name = $1
  `, [user.role]);
  
  // Get custom permissions
  const customPerms = await db.query(`
    SELECT permission
    FROM user_permissions
    WHERE user_id = $1 
      AND (expires_at IS NULL OR expires_at > NOW())
  `, [userId]);
  
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: rolePerms.rows.map(r => r.permission),
    customPermissions: customPerms.rows.map(r => r.permission)
  };
}
```

## Future Enhancements

1. **More Roles**: Add intermediate roles like 'developer', 'operator'
2. **Dynamic Permissions**: Time-based or context-based permissions
3. **Permission Inheritance**: Role hierarchies
4. **Audit Trail**: Log all permission checks and tool usage
5. **Tool Expansion**: Add more tools with appropriate permission requirements

## Security Best Practices

1. **Default Deny**: Users have no tool access without explicit permissions
2. **Least Privilege**: Basic users get minimal permissions
3. **Audit Everything**: Log all admin tool usage
4. **Session Security**: Validate sessions on every request
5. **Permission Caching**: Cache permissions with short TTL for performance