/**
 * @fileoverview MCP Resource Templates handlers for dynamic resource discovery
 * @module handlers/resource-templates-handler
 * 
 * @remarks
 * This module implements resource templates functionality from the MCP specification.
 * Resource templates allow dynamic resource discovery with parameterized URIs.
 * Templates define patterns like `task://{taskId}` that clients can use to
 * construct URIs for specific resources.
 * 
 * @example
 * ```typescript
 * import { handleListResourceTemplates, matchResourceTemplate } from './handlers/resource-templates-handler';
 * 
 * // List available templates
 * const { resourceTemplates } = await handleListResourceTemplates({});
 * 
 * // Match a URI against templates
 * const match = matchResourceTemplate('task://123/logs');
 * if ( match) {
 *   console.log('Matched template:', match.template.name);
 *   console.log('Parameters:', match.params); // { taskId: '123' }
 * }
 * ```
 */

import type { 
  ListResourceTemplatesRequest,
  ListResourceTemplatesResult,
  ResourceTemplate
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";

/**
 * Available resource templates for dynamic resource discovery
 * @constant
 */
const RESOURCETEMPLATES: ResourceTemplate[] = [
  {
    uriTemplate: "task://{taskId}",
    name: "Task Details",
    description: "Access detailed information about a specific task by its ID",
    mimeType: "application/json"
  },
  {
    uriTemplate: "task://{taskId}/logs",
    name: "Task Logs",
    description: "Access logs for a specific task",
    mimeType: "text/plain"
  },
  {
    uriTemplate: "task://{taskId}/result",
    name: "Task Result",
    description: "Access the result/output of a completed task",
    mimeType: "application/json"
  },
  {
    uriTemplate: "session://{sessionType}/{sessionId}",
    name: "Session Details",
    description: "Access information about active Claude or Gemini sessions",
    mimeType: "application/json"
  },
  {
    uriTemplate: "project://{projectPath}/status",
    name: "Project Status",
    description: "Get status information for a specific project",
    mimeType: "application/json"
  },
  {
    uriTemplate: "log://{logType}/{date}",
    name: "System Logs",
    description: "Access system logs by type and date ( format: YYYY-MM-DD)",
    mimeType: "text/plain"
  }
];

/**
 * Handles MCP resources/templates/list requests
 * 
 * @param request - The list resource templates request ( unused)
 * @returns List of available resource templates
 * 
 * @remarks
 * Returns the list of available resource templates that clients can use
 * to construct dynamic resource URIs.
 * 
 * @example
 * ```typescript
 * const result = await handleListResourceTemplates({});
 * console.log(`Available templates: ${result.resourceTemplates.length}`);
 * ```
 */
export async function handleListResourceTemplates(
  _request: ListResourceTemplatesRequest
): Promise<ListResourceTemplatesResult> {
  logger.debug("📋 Listing resource templates", { 
    templateCount: RESOURCETEMPLATES.length 
  });

  return {
    resourceTemplates: RESOURCETEMPLATES
  };
}

/**
 * Gets the current resource templates
 * 
 * @returns Array of resource templates
 */
export function getResourceTemplates(): ResourceTemplate[] {
  return RESOURCETEMPLATES;
}

/**
 * Validates if a URI matches any template and extracts parameters
 * 
 * @param uri - The URI to validate
 * @returns Object with matched template and extracted parameters, or null if no match
 * 
 * @example
 * ```typescript
 * const match = matchResourceTemplate('task://abc123/logs');
 * if ( match) {
 *   console.log(match.params.taskId); // 'abc123'
 * }
 * ```
 */
export function matchResourceTemplate( uri: string): { template: ResourceTemplate; params: Record<string, string> } | null {
  for (const template of RESOURCETEMPLATES) {
    const regex = createTemplateRegex(template.uriTemplate);
    const match = uri.match( regex);
    
    if (match && match.groups) {
      return {
        template,
        params: match.groups
      };
    }
  }
  
  return null;
}

/**
 * Converts URI template to regex for matching
 * 
 * @param template - The URI template string
 * @returns Regular expression for matching URIs
 */
function createTemplateRegex( template: string): RegExp {
  const pattern = template
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\{(\w+)\\}/g, '(?<$1>[^/]+)')
  
  return new RegExp(`^${pattern}$`);
}

/**
 * Expands a URI template with provided parameters
 * 
 * @param template - The URI template string
 * @param params - Parameters to substitute
 * @returns Expanded URI with parameters replaced
 * 
 * @example
 * ```typescript
 * const uri = expandTemplate('task://{taskId}/logs', { taskId: '123' });
 * console.log( uri); // 'task://123/logs'
 * ```
 */
export function expandTemplate( template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] || match;
  });
}