/**
 * MCP Resource Templates handlers for dynamic resource discovery.
 * @file MCP Resource Templates handlers for dynamic resource discovery.
 * @module handlers/resource-templates-handler
 * This module implements resource templates functionality from the MCP specification.
 * Resource templates allow dynamic resource discovery with parameterized URIs.
 * Templates define patterns like `task://{taskId}` that clients can use to
 * construct URIs for specific resources.
 * @example
 * ```typescript
 * import {
 * handleListResourceTemplates,
 * matchResourceTemplate
 * } from './handlers/resource-templates-handler.js';
 * // List available templates
 * const { resourceTemplates } = await handleListResourceTemplates({});
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
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';
/**
 * Simple logger implementation to avoid circular dependencies.
 */
const logger = {
  debug: (source: string, message: string, data?: unknown): void => {
    console.debug(`[${source}] ${message}`, data ? JSON.stringify(data) : '');
  }
};

/**
 * Log source constants.
 */
const LogSource = {
  MCP: 'MCP'
} as const;

/**
 * Available resource templates for dynamic resource discovery.
 * @constant
 */
const RESOURCETEMPLATES: ResourceTemplate[] = [
  {
    uriTemplate: 'task://{taskId}',
    name: 'Task Details',
    description: 'Access detailed information about a specific task by its ID',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'task://{taskId}/logs',
    name: 'Task Logs',
    description: 'Access logs for a specific task',
    mimeType: 'text/plain',
  },
  {
    uriTemplate: 'task://{taskId}/result',
    name: 'Task Result',
    description: 'Access the result/output of a completed task',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'session://{sessionType}/{sessionId}',
    name: 'Session Details',
    description: 'Access information about active Claude or Gemini sessions',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'project://{projectPath}/status',
    name: 'Project Status',
    description: 'Get status information for a specific project',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'log://{logType}/{date}',
    name: 'System Logs',
    description: 'Access system logs by type and date ( format: YYYY-MM-DD)',
    mimeType: 'text/plain',
  },
];

/**
 * Handles MCP resources/templates/list requests.
 * @param request - The list resource templates request.
 * @returns List of available resource templates.
 * Returns the list of available resource templates that clients can use
 * to construct dynamic resource URIs.
 * @example
 * ```typescript
 * const result = await handleListResourceTemplates({});
 * console.log(`Available templates: ${result.resourceTemplates.length}`);
 * ```
 */
export const handleListResourceTemplates = function handleListResourceTemplates(
  request: ListResourceTemplatesRequest,
): ListResourceTemplatesResult {
  logger.debug(LogSource.MCP, '📋 Listing resource templates', {
    templateCount: RESOURCETEMPLATES.length,
    requestReceived: Boolean(request)
  });

  return {
    resourceTemplates: RESOURCETEMPLATES,
  };
}

/**
 * Gets the current resource templates.
 * @returns Array of resource templates.
 */
export const getResourceTemplates = function getResourceTemplates(): ResourceTemplate[] {
  return RESOURCETEMPLATES;
}

/**
 * Converts URI template to regex for matching.
 * @param template - The URI template string.
 * @returns Regular expression for matching URIs.
 */
const createTemplateRegex = function createTemplateRegex(template: string): RegExp {
  const pattern = template
    .replace(/[.*+?^$()|[\]\\]/gu, '\\$&')
    .replace(/\{(\w+)\}/gu, '(?<$1>[^/]+)');

  return new RegExp(`^${pattern}$`, 'u');
}

/**
 * Validates if a URI matches any template and extracts parameters.
 * @param uri - The URI to validate.
 * @returns Object with matched template and extracted parameters, or null if no match.
 * @example
 * ```typescript
 * const match = matchResourceTemplate('task://abc123/logs');
 * if ( match) {
 *   console.log(match.params.taskId); // 'abc123'
 * }
 * ```
 */
export const matchResourceTemplate = function matchResourceTemplate(
  uri: string,
): { template: ResourceTemplate; params: Record<string, string> } | null {
  for (const template of RESOURCETEMPLATES) {
    const regex = createTemplateRegex(template.uriTemplate);
    const match = uri.match(regex);

    if (match?.groups !== undefined) {
      return {
        template,
        params: match.groups,
      };
    }
  }

  return null;
}

/**
 * Expands a URI template with provided parameters.
 * @param template - The URI template string.
 * @param params - Parameters to substitute.
 * @returns Expanded URI with parameters replaced.
 * @example
 * ```typescript
 * const uri = expandTemplate('task://{taskId}/logs', { taskId: '123' });
 * console.log( uri); // 'task://123/logs'
 * ```
 */
export const expandTemplate = function expandTemplate(
  template: string,
  params: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/gu, (match, key: string): string => {
    return params[key] ?? match;
  });
}
