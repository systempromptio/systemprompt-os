/**
 * @fileoverview Type definitions for the resources module
 * @module resources/types
 */

import type { Resource, ResourceContents } from '@modelcontextprotocol/sdk/types.js';

/**
 * Content type for resources
 */
export type ResourceContentType = 'text' | 'blob' | 'template';

/**
 * Database representation of a resource
 */
export interface DBResource {
  id: number;
  uri: string;
  name: string;
  description?: string;
  mime_type: string;
  content_type: ResourceContentType;
  content: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Data required to create a new resource
 */
export interface CreateResourceData {
  uri: string;
  name: string;
  description?: string;
  mime_type?: string;
  content_type?: ResourceContentType;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Data for updating an existing resource
 */
export interface UpdateResourceData {
  name?: string;
  description?: string;
  mime_type?: string;
  content_type?: ResourceContentType;
  content?: string;
  metadata?: Record<string, any>;
}

/**
 * Resource with its contents
 */
export interface ResourceWithContents {
  resource: Resource;
  contents: ResourceContents[];
}

/**
 * Template variables for template resources
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean;
}