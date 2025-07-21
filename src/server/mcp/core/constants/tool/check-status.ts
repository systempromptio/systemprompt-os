/**
 * Check Status Tool Definition
 * Provides admin-level system status information
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolPermissionMeta {
  requiredRole?: 'admin' | 'basic';
  requiredPermissions?: string[];
}

export type PermissionTool = Tool & {
  _meta?: ToolPermissionMeta;
};

export const checkStatus: PermissionTool = {
  name: "checkstatus",
  description: "Get comprehensive system status (admin only)",
  inputSchema: {
    type: "object",
    properties: {
      includeContainers: { 
        type: "boolean",
        description: "Include container status information"
      },
      includeUsers: { 
        type: "boolean",
        description: "Include active user information"
      },
      includeResources: { 
        type: "boolean",
        description: "Include resource usage statistics"
      },
      includeTunnels: { 
        type: "boolean",
        description: "Include Cloudflare tunnel status"
      },
      includeAuditLog: { 
        type: "boolean",
        description: "Include recent audit log entries"
      },
    },
  },
  _meta: {
    requiredRole: 'admin',
    requiredPermissions: ['system:read', 'admin:status']
  }
};

export default checkStatus;
