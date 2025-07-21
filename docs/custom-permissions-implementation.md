# Custom Permissions Implementation Guide

## Overview

This guide shows how to implement custom permission levels (e.g., 'level 1', 'level 2', 'admin', 'viewer') that users can assign when granting access to their containers.

## Permission System Design

### 1. Permission Levels Structure

```typescript
// src/types/permissions.ts

export interface PermissionLevel {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  customConfig?: Record<string, any>;
}

export interface UserPermissionTemplate {
  userId: string;
  templates: PermissionLevel[];
  createdAt: Date;
  updatedAt: Date;
}

// Default permission templates
export const DEFAULT_PERMISSION_LEVELS: PermissionLevel[] = [
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to container',
    capabilities: ['container:view', 'logs:read', 'stats:read']
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Can execute commands and modify files',
    capabilities: ['container:view', 'logs:read', 'stats:read', 'exec:run', 'files:write']
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full control over container',
    capabilities: ['container:*', 'logs:*', 'stats:*', 'exec:*', 'files:*', 'settings:*']
  }
];

// User custom levels example
export interface CustomPermissionLevel extends PermissionLevel {
  userId: string;
  isCustom: boolean;
}
```

### 2. Database Schema Updates

```sql
-- Permission templates table
CREATE TABLE permission_templates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  capabilities JSON NOT NULL,
  custom_config JSON,
  is_custom BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Update access_grants table to reference permission templates
ALTER TABLE access_grants 
ADD COLUMN permission_template_id UUID REFERENCES permission_templates(id),
ADD COLUMN custom_capabilities JSON;

-- Indexes for performance
CREATE INDEX idx_permission_templates_user ON permission_templates(user_id);
CREATE INDEX idx_access_grants_template ON access_grants(permission_template_id);
```

## Server Integration

### 1. API Routes for Permission Management

```typescript
// src/server/external/rest/permissions/index.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { PermissionService } from '../../../services/permissions/permission-service.js';

export function setupPermissionRoutes(router: Router) {
  const permissionService = new PermissionService();

  // Get user's permission templates
  router.get('/api/permissions/templates', authenticate, async (req, res) => {
    try {
      const templates = await permissionService.getUserTemplates(req.user.id);
      res.json({
        defaults: DEFAULT_PERMISSION_LEVELS,
        custom: templates
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create custom permission template
  router.post('/api/permissions/templates', authenticate, async (req, res) => {
    try {
      const { name, description, capabilities, customConfig } = req.body;
      
      // Validate capabilities
      const validatedCapabilities = await permissionService.validateCapabilities(capabilities);
      
      const template = await permissionService.createTemplate({
        userId: req.user.id,
        name,
        description,
        capabilities: validatedCapabilities,
        customConfig
      });
      
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update permission template
  router.put('/api/permissions/templates/:templateId', authenticate, async (req, res) => {
    try {
      const { templateId } = req.params;
      const updates = req.body;
      
      // Verify ownership
      const template = await permissionService.getTemplate(templateId);
      if (template.userId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updated = await permissionService.updateTemplate(templateId, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete custom template
  router.delete('/api/permissions/templates/:templateId', authenticate, async (req, res) => {
    try {
      const { templateId } = req.params;
      
      // Verify ownership and not in use
      const canDelete = await permissionService.canDeleteTemplate(templateId, req.user.id);
      if (!canDelete) {
        return res.status(400).json({ error: 'Template is in use or not owned by user' });
      }
      
      await permissionService.deleteTemplate(templateId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
}
```

### 2. Permission Service Implementation

```typescript
// src/services/permissions/permission-service.ts

import { db } from '../../database/index.js';
import { validateCapabilityPattern } from './capability-validator.js';

export class PermissionService {
  
  async getUserTemplates(userId: string): Promise<CustomPermissionLevel[]> {
    const templates = await db.query(
      'SELECT * FROM permission_templates WHERE user_id = $1 ORDER BY name',
      [userId]
    );
    
    return templates.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      capabilities: row.capabilities,
      customConfig: row.custom_config,
      isCustom: row.is_custom
    }));
  }
  
  async createTemplate(data: {
    userId: string;
    name: string;
    description?: string;
    capabilities: string[];
    customConfig?: Record<string, any>;
  }): Promise<CustomPermissionLevel> {
    // Validate name uniqueness
    const existing = await db.query(
      'SELECT id FROM permission_templates WHERE user_id = $1 AND name = $2',
      [data.userId, data.name]
    );
    
    if (existing.rows.length > 0) {
      throw new Error('Permission template with this name already exists');
    }
    
    const result = await db.query(
      `INSERT INTO permission_templates 
       (user_id, name, description, capabilities, custom_config, is_custom)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [data.userId, data.name, data.description, JSON.stringify(data.capabilities), 
       JSON.stringify(data.customConfig || {})]
    );
    
    return this.mapToPermissionLevel(result.rows[0]);
  }
  
  async validateCapabilities(capabilities: string[]): Promise<string[]> {
    const validated: string[] = [];
    
    for (const capability of capabilities) {
      if (validateCapabilityPattern(capability)) {
        validated.push(capability);
      } else {
        throw new Error(`Invalid capability pattern: ${capability}`);
      }
    }
    
    return validated;
  }
  
  private mapToPermissionLevel(row: any): CustomPermissionLevel {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      capabilities: row.capabilities,
      customConfig: row.custom_config,
      isCustom: row.is_custom
    };
  }
}
```

### 3. Capability Validator

```typescript
// src/services/permissions/capability-validator.ts

const VALID_RESOURCES = [
  'container', 'logs', 'stats', 'exec', 'files', 
  'settings', 'network', 'volumes', 'env'
];

const VALID_ACTIONS = [
  'view', 'read', 'write', 'create', 'delete', 
  'run', 'stop', 'restart', 'update', '*'
];

export function validateCapabilityPattern(capability: string): boolean {
  // Format: resource:action or resource:*
  const parts = capability.split(':');
  if (parts.length !== 2) return false;
  
  const [resource, action] = parts;
  
  return VALID_RESOURCES.includes(resource) && 
         VALID_ACTIONS.includes(action);
}

export function checkPermission(
  userCapabilities: string[], 
  requiredCapability: string
): boolean {
  // Check for exact match
  if (userCapabilities.includes(requiredCapability)) {
    return true;
  }
  
  // Check for wildcard permissions
  const [resource, action] = requiredCapability.split(':');
  
  // Check resource:* permission
  if (userCapabilities.includes(`${resource}:*`)) {
    return true;
  }
  
  // Check *:* (super admin)
  if (userCapabilities.includes('*:*')) {
    return true;
  }
  
  return false;
}
```

### 4. Integration with Container Access

```typescript
// src/server/external/rest/containers/access.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { ContainerAccessService } from '../../../services/containers/access-service.js';

export function setupContainerAccessRoutes(router: Router) {
  const accessService = new ContainerAccessService();

  // Grant access with permission template
  router.post('/api/containers/:containerId/access', authenticate, async (req, res) => {
    try {
      const { containerId } = req.params;
      const { 
        email, 
        permissionTemplateId,  // Can be default or custom template ID
        customCapabilities,     // Optional: override template capabilities
        expiresIn,
        notificationMessage
      } = req.body;
      
      // Verify container ownership
      const container = await accessService.getContainer(containerId);
      if (container.userId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      // Get permission template
      const template = await accessService.getPermissionTemplate(
        permissionTemplateId, 
        req.user.id
      );
      
      // Create access grant
      const grant = await accessService.createGrant({
        grantorId: req.user.id,
        granteeEmail: email,
        containerId,
        permissionTemplateId,
        capabilities: customCapabilities || template.capabilities,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        notificationMessage
      });
      
      // Update Cloudflare Zero Trust policy
      await accessService.updateCloudflarePolicy(container, grant);
      
      // Send notification
      await accessService.sendAccessNotification(email, container, grant, notificationMessage);
      
      res.json({
        success: true,
        grant: {
          id: grant.id,
          email: grant.granteeEmail,
          permissions: grant.capabilities,
          templateName: template.name,
          expiresAt: grant.expiresAt
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // List access grants with permission details
  router.get('/api/containers/:containerId/access', authenticate, async (req, res) => {
    try {
      const { containerId } = req.params;
      
      // Check if user has access to view grants
      const hasAccess = await accessService.canViewGrants(req.user.id, containerId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const grants = await accessService.getContainerGrants(containerId);
      
      res.json({
        grants: grants.map(grant => ({
          id: grant.id,
          email: grant.granteeEmail,
          permissionLevel: grant.template?.name || 'Custom',
          capabilities: grant.capabilities,
          grantedBy: grant.grantor.email,
          grantedAt: grant.createdAt,
          expiresAt: grant.expiresAt,
          lastAccessed: grant.lastAccessed
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
```

### 5. Update Server Index to Include Permission Routes

```typescript
// src/server/external/index.ts - Add to setupExternalAPI function

import { setupPermissionRoutes } from './rest/permissions/index.js';
import { setupContainerAccessRoutes } from './rest/containers/access.js';

export async function setupExternalAPI(app: Express, logger?: any): Promise<void> {
  const router = Router();
  
  // ... existing code ...
  
  // Permission management endpoints
  setupPermissionRoutes(router);
  
  // Container access management endpoints
  setupContainerAccessRoutes(router);
  
  // Mount all external API routes
  app.use(router);
}
```

### 6. OIDC Token Claims with Custom Permissions

```typescript
// src/server/external/auth/token-generator.ts - Update token generation

export async function generateIdToken(user: User, grants: AccessGrant[]) {
  const enrichedGrants = await Promise.all(
    grants.map(async (grant) => {
      const template = grant.permissionTemplateId 
        ? await getPermissionTemplate(grant.permissionTemplateId)
        : null;
        
      return {
        container_id: grant.containerId,
        container_name: grant.containerName,
        permission_level: template?.name || 'Custom',
        capabilities: grant.capabilities,
        granted_by: grant.grantorEmail,
        expires_at: grant.expiresAt.toISOString()
      };
    })
  );
  
  const idToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    accessible_containers: enrichedGrants,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })
  .setProtectedHeader({ alg: 'RS256', kid: 'primary' })
  .sign(privateKey);
  
  return idToken;
}
```

## Dashboard UI Examples

### 1. Permission Template Manager

```typescript
// src/client/components/PermissionTemplateManager.tsx

import React, { useState, useEffect } from 'react';

export const PermissionTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState([]);
  const [creating, setCreating] = useState(false);
  
  return (
    <div className="permission-manager">
      <h2>Permission Templates</h2>
      
      <div className="templates-grid">
        {/* Default Templates */}
        <div className="template-section">
          <h3>Default Templates</h3>
          <div className="template-card">
            <h4>👁 Viewer</h4>
            <p>Read-only access</p>
            <ul>
              <li>View container status</li>
              <li>Read logs</li>
              <li>View statistics</li>
            </ul>
          </div>
          
          <div className="template-card">
            <h4>💻 Developer</h4>
            <p>Development access</p>
            <ul>
              <li>All viewer permissions</li>
              <li>Execute commands</li>
              <li>Modify files</li>
            </ul>
          </div>
          
          <div className="template-card">
            <h4>👑 Administrator</h4>
            <p>Full control</p>
            <ul>
              <li>All permissions</li>
              <li>Manage settings</li>
              <li>Control container</li>
            </ul>
          </div>
        </div>
        
        {/* Custom Templates */}
        <div className="template-section">
          <h3>Custom Templates</h3>
          {templates.map(template => (
            <div key={template.id} className="template-card custom">
              <h4>{template.name}</h4>
              <p>{template.description}</p>
              <div className="capabilities">
                {template.capabilities.map(cap => (
                  <span key={cap} className="capability-tag">{cap}</span>
                ))}
              </div>
              <button onClick={() => editTemplate(template.id)}>Edit</button>
            </div>
          ))}
          
          <button 
            className="add-template-btn"
            onClick={() => setCreating(true)}
          >
            + Create Custom Template
          </button>
        </div>
      </div>
      
      {creating && <CreateTemplateModal onClose={() => setCreating(false)} />}
    </div>
  );
};
```

### 2. Grant Access Modal

```typescript
// src/client/components/GrantAccessModal.tsx

export const GrantAccessModal: React.FC<{ containerId: string }> = ({ containerId }) => {
  const [email, setEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('viewer');
  const [customCapabilities, setCustomCapabilities] = useState([]);
  const [expiresIn, setExpiresIn] = useState('604800'); // 7 days
  const [message, setMessage] = useState('');
  
  const handleGrant = async () => {
    const response = await fetch(`/api/containers/${containerId}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        permissionTemplateId: selectedTemplate,
        customCapabilities: customCapabilities.length > 0 ? customCapabilities : undefined,
        expiresIn: parseInt(expiresIn),
        notificationMessage: message
      })
    });
    
    if (response.ok) {
      toast.success(`Access granted to ${email}`);
      onClose();
    }
  };
  
  return (
    <div className="modal">
      <h2>Grant Container Access</h2>
      
      <input
        type="email"
        placeholder="User email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      
      <div className="permission-selector">
        <h3>Permission Level</h3>
        <select 
          value={selectedTemplate} 
          onChange={(e) => setSelectedTemplate(e.target.value)}
        >
          <optgroup label="Default Templates">
            <option value="viewer">👁 Viewer - Read Only</option>
            <option value="developer">💻 Developer - Read/Write</option>
            <option value="admin">👑 Administrator - Full Access</option>
          </optgroup>
          <optgroup label="Custom Templates">
            {customTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
        </select>
      </div>
      
      <div className="expiration">
        <h3>Access Duration</h3>
        <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}>
          <option value="3600">1 hour</option>
          <option value="86400">24 hours</option>
          <option value="604800">7 days</option>
          <option value="2592000">30 days</option>
          <option value="7776000">90 days</option>
          <option value="0">Never expires</option>
        </select>
      </div>
      
      <textarea
        placeholder="Optional message to include in invitation email"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      
      <div className="actions">
        <button onClick={handleGrant}>Grant Access</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};
```

## Security Enforcement

### 1. Middleware for Permission Checking

```typescript
// src/server/middleware/permissions.ts

export function requirePermission(requiredCapability: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { containerId } = req.params;
      const userId = req.user.id;
      
      // Get user's capabilities for this container
      const capabilities = await getUserCapabilities(userId, containerId);
      
      // Check if user has required permission
      if (!checkPermission(capabilities, requiredCapability)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredCapability,
          userCapabilities: capabilities
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

// Usage example
router.post('/api/containers/:containerId/exec',
  authenticate,
  requirePermission('exec:run'),
  async (req, res) => {
    // User has exec:run permission
    const result = await executeCommand(req.params.containerId, req.body.command);
    res.json(result);
  }
);
```

## Benefits of This System

1. **Flexibility**: Users can create custom permission levels for their specific needs
2. **Granularity**: Fine-grained control over what each permission level can do
3. **User-Friendly**: Pre-defined templates for common use cases
4. **Scalable**: Easy to add new capabilities as features are added
5. **Auditable**: All permission grants and usage are logged
6. **Secure**: Permissions enforced at both API and Cloudflare levels