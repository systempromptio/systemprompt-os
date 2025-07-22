/**
 * @fileoverview Resource service for business logic and MCP SDK integration
 * @module resources/services/resource
 */

import type { Resource, ResourceContents } from '@modelcontextprotocol/sdk/types.js';
import type { ModuleDatabaseAdapter } from '../../database/adapters/module-adapter.js';
import type { 
  DBResource, 
  ResourceWithContents, 
  CreateResourceData, 
  UpdateResourceData,
  TemplateVariables 
} from '../types/index.js';
import { ResourceRepository } from '../repositories/resource.repository.js';

/**
 * Service layer for resource operations
 * Handles business logic and data transformation between database and MCP SDK types
 */
export class ResourceService {
  private readonly repository: ResourceRepository;

  constructor(db: ModuleDatabaseAdapter) {
    this.repository = new ResourceRepository(db);
  }

  /**
   * Lists all available resources
   * @returns Array of MCP SDK Resource objects
   */
  async listResources(): Promise<Resource[]> {
    const dbResources = this.repository.findAll();
    return dbResources.map(dbResource => this.toMCPResource(dbResource));
  }

  /**
   * Retrieves a resource with its contents by URI
   * @param uri - The unique URI of the resource
   * @returns The resource with contents if found, null otherwise
   */
  async getResource(uri: string): Promise<ResourceWithContents | null> {
    const dbResource = this.repository.findByUri(uri);
    if (!dbResource) {
      return null;
    }
    
    return this.toResourceWithContents(dbResource);
  }

  /**
   * Retrieves resources matching a pattern
   * @param pattern - The URI pattern to match (supports * wildcard)
   * @returns Array of matching resources
   */
  async getResourcesByPattern(pattern: string): Promise<Resource[]> {
    const dbResources = this.repository.findByPattern(pattern);
    return dbResources.map(dbResource => this.toMCPResource(dbResource));
  }

  /**
   * Creates a new resource
   * @param data - The resource creation data
   * @returns The created resource with contents
   * @throws Error if resource creation fails
   */
  async createResource(data: CreateResourceData): Promise<ResourceWithContents> {
    const dbResource = this.repository.create(data);
    return this.toResourceWithContents(dbResource);
  }

  /**
   * Updates an existing resource
   * @param uri - The URI of the resource to update
   * @param data - The update data
   * @returns The updated resource with contents if found, null otherwise
   */
  async updateResource(uri: string, data: UpdateResourceData): Promise<ResourceWithContents | null> {
    const dbResource = this.repository.update(uri, data);
    if (!dbResource) {
      return null;
    }
    
    return this.toResourceWithContents(dbResource);
  }

  /**
   * Deletes a resource
   * @param uri - The URI of the resource to delete
   * @returns True if the resource was deleted, false otherwise
   */
  async deleteResource(uri: string): Promise<boolean> {
    return this.repository.delete(uri);
  }

  /**
   * Processes a template resource with variable substitution
   * @param uri - The URI of the template resource
   * @param variables - Variables to substitute in the template
   * @returns The processed resource with substituted content, null if not found or not a template
   */
  async processTemplateResource(
    uri: string, 
    variables: TemplateVariables
  ): Promise<ResourceWithContents | null> {
    const dbResource = this.repository.findByUri(uri);
    if (!dbResource || dbResource.content_type !== 'template') {
      return null;
    }

    let processedContent = dbResource.content;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processedContent = processedContent.replace(
        new RegExp(placeholder, 'g'), 
        String(value)
      );
    }

    const resource = this.toMCPResource(dbResource);
    const contents: ResourceContents[] = [{
      uri: dbResource.uri,
      mimeType: dbResource.mime_type,
      text: processedContent
    }];

    return { resource, contents };
  }

  /**
   * Converts a database resource to MCP SDK Resource format
   * @param dbResource - The database resource record
   * @returns MCP SDK Resource object
   */
  private toMCPResource(dbResource: DBResource): Resource {
    const resource: Resource = {
      uri: dbResource.uri,
      name: dbResource.name,
      mimeType: dbResource.mime_type,
    };

    if (dbResource.description) {
      resource.description = dbResource.description;
    }

    return resource;
  }

  /**
   * Converts a database resource to ResourceWithContents format
   * @param dbResource - The database resource record
   * @returns Resource with contents
   */
  private toResourceWithContents(dbResource: DBResource): ResourceWithContents {
    const resource = this.toMCPResource(dbResource);
    
    let contents: ResourceContents[];
    
    if (dbResource.content_type === 'blob') {
      contents = [{
        uri: dbResource.uri,
        mimeType: dbResource.mime_type,
        blob: dbResource.content
      }];
    } else {
      contents = [{
        uri: dbResource.uri,
        mimeType: dbResource.mime_type,
        text: dbResource.content
      }];
    }

    return { resource, contents };
  }
}