/**
 * Whoami Tool Definition
 * Returns information about the current authenticated user - accessible to all users
 */

import type { PermissionTool } from "./check-status.js";

export const whoami: PermissionTool = {
  name: "whoami",
  description: "Get information about the current authenticated user",
  inputSchema: {
    type: "object",
    properties: {
      includePermissions: { 
        type: "boolean",
        description: "Include user permissions in the response"
      },
      includeSession: { 
        type: "boolean",
        description: "Include current session information"
      }
    }
  },
  _meta: {
    requiredRole: 'basic',
    requiredPermissions: ['tools:basic']
  }
};

export default whoami;