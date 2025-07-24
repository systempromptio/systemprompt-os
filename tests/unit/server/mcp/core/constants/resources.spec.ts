/**
 * @fileoverview Unit tests for resources constants
 * @module tests/unit/server/mcp/core/constants/resources
 */

import { describe, it, expect } from 'vitest';
import { RESOURCES } from '../../../../../../src/server/mcp/core/constants/resources.js';

describe('resources constants', () => {
  describe('RESOURCES array', () => {
    it('contains expected number of resources', () => {
      expect(RESOURCES).toHaveLength(3);
    });
    
    it('all resources have required properties', () => {
      RESOURCES.forEach(resource => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
        
        expect(typeof resource.uri).toBe('string');
        expect(typeof resource.name).toBe('string');
        expect(typeof resource.description).toBe('string');
        expect(typeof resource.mimeType).toBe('string');
      });
    });
    
    it('contains example resource', () => {
      const exampleResource = RESOURCES.find(r => r.uri === 'template://example');
      expect(exampleResource).toBeDefined();
      expect(exampleResource).toEqual({
        uri: 'template://example',
        name: 'Example Resource',
        description: 'An example resource demonstrating the resource pattern',
        mimeType: 'text/plain'
      });
    });
    
    it('contains config resource', () => {
      const configResource = RESOURCES.find(r => r.uri === 'template://config');
      expect(configResource).toBeDefined();
      expect(configResource).toEqual({
        uri: 'template://config',
        name: 'Template Configuration',
        description: 'Template server configuration and settings',
        mimeType: 'application/json'
      });
    });
    
    it('contains guidelines resource', () => {
      const guidelinesResource = RESOURCES.find(r => r.uri === 'template://guidelines');
      expect(guidelinesResource).toBeDefined();
      expect(guidelinesResource).toEqual({
        uri: 'template://guidelines',
        name: 'Template Guidelines',
        description: 'Guidelines for using this MCP server template',
        mimeType: 'text/markdown'
      });
    });
    
    it('all URIs follow template:// schema', () => {
      RESOURCES.forEach(resource => {
        expect(resource.uri).toMatch(/^template:\/\/.+$/);
      });
    });
    
    it('all URIs are unique', () => {
      const uris = RESOURCES.map(r => r.uri);
      const uniqueUris = new Set(uris);
      expect(uniqueUris.size).toBe(uris.length);
    });
    
    it('all names are unique', () => {
      const names = RESOURCES.map(r => r.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
    
    it('mime types are valid', () => {
      const validMimeTypes = ['text/plain', 'application/json', 'text/markdown'];
      RESOURCES.forEach(resource => {
        expect(validMimeTypes).toContain(resource.mimeType);
      });
    });
  });
});