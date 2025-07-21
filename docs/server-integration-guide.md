# Server Integration Guide for Cloudflare Zero Trust

## Overview

This guide shows how the Cloudflare Zero Trust integration fits into the existing SystemPrompt server architecture at `/var/www/html/systemprompt-os/src/server`.

## Current Server Structure

```
src/server/
├── index.ts                 # Main server entry point
├── config.ts               # Server configuration
├── external/               # External REST API
│   ├── index.ts           # API setup
│   ├── auth/              # Authentication logic
│   ├── middleware/        # Express middleware
│   └── rest/              # REST endpoints
│       ├── oauth2/        # OAuth2 endpoints
│       ├── health.ts      # Health check
│       └── status.ts      # Status endpoint
└── mcp/                    # MCP server integration
```

## Integration Points

### 1. Main Server Entry (src/server/index.ts)

The server already has OAuth2 support. We need to extend it:

```typescript
// Add to existing endpoints in index.ts
endpoints: {
  health: `${baseUrl}/health`,
  status: `${baseUrl}/status`,
  oauth2: {
    discovery: `${baseUrl}/.well-known/openid-configuration`,
    authorize: `${baseUrl}/oauth2/authorize`,
    token: `${baseUrl}/oauth2/token`,
    userinfo: `${baseUrl}/oauth2/userinfo`,
  },
  // NEW: Container management endpoints
  containers: {
    list: `${baseUrl}/api/containers`,
    create: `${baseUrl}/api/containers`,
    access: `${baseUrl}/api/containers/{id}/access`,
    status: `${baseUrl}/api/containers/{id}/status`
  },
  // NEW: Permission management
  permissions: {
    templates: `${baseUrl}/api/permissions/templates`,
    capabilities: `${baseUrl}/api/permissions/capabilities`
  }
},
```

### 2. External API Setup (src/server/external/index.ts)

Add new route modules to the existing setup:

```typescript
// src/server/external/index.ts
import { setupContainerRoutes } from './rest/containers/index.js';
import { setupPermissionRoutes } from './rest/permissions/index.js';
import { setupCloudflareRoutes } from './rest/cloudflare/index.js';

export async function setupExternalAPI(app: Express, logger?: any): Promise<void> {
  const router = Router();
  
  // ... existing OAuth2 and auth setup ...
  
  // NEW: Container management routes
  await setupContainerRoutes(router);
  
  // NEW: Permission system routes
  await setupPermissionRoutes(router);
  
  // NEW: Cloudflare integration routes
  await setupCloudflareRoutes(router);
  
  // Mount all external API routes
  app.use(router);
}
```

### 3. New Directory Structure

```
src/server/external/rest/
├── oauth2/                    # Existing OAuth2
├── containers/                # NEW
│   ├── index.ts              # Container routes
│   ├── access.ts             # Access management
│   └── operations.ts         # Container operations
├── permissions/               # NEW
│   ├── index.ts              # Permission routes
│   └── templates.ts          # Template management
└── cloudflare/                # NEW
    ├── index.ts              # Cloudflare routes
    └── tunnels.ts            # Tunnel management

src/services/                  # NEW service layer
├── cloudflare/
│   ├── client.ts             # Cloudflare API client
│   ├── tunnel-manager.ts     # Tunnel operations
│   └── access-manager.ts     # Access policy management
├── docker/
│   ├── container-manager.ts  # Docker operations
│   └── resource-monitor.ts   # Resource monitoring
└── permissions/
    ├── permission-service.ts # Permission logic
    └── capability-validator.ts # Validation
```

### 4. Extending OAuth2 Implementation

The existing OAuth2 setup needs to support OIDC features:

```typescript
// src/server/external/rest/oauth2/well-known.ts
import { Router } from 'express';
import { getJWKS } from '../../auth/jwks.js';

export function setupWellKnownRoutes(router: Router, baseUrl: string) {
  // OIDC Discovery
  router.get('/.well-known/openid-configuration', (req, res) => {
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth2/authorize`,
      token_endpoint: `${baseUrl}/oauth2/token`,
      userinfo_endpoint: `${baseUrl}/oauth2/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code', 'token', 'id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'email', 'profile', 'containers'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      claims_supported: [
        'sub', 'email', 'name', 'picture', 
        'accessible_containers', 'permissions'
      ]
    });
  });
  
  // JWKS endpoint
  router.get('/.well-known/jwks.json', (req, res) => {
    res.json(getJWKS());
  });
}
```

### 5. Update UserInfo Endpoint

Extend the existing userinfo endpoint to include container access:

```typescript
// src/server/external/rest/oauth2/userinfo.ts
import { getUserContainerAccess } from '../../../services/access/index.js';

router.get('/oauth2/userinfo', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Get container access information
    const containerAccess = await getUserContainerAccess(user.id);
    
    res.json({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      
      // NEW: Container access claims
      accessible_containers: containerAccess.map(access => ({
        container_id: access.containerId,
        container_name: access.containerName,
        permission_level: access.permissionLevel,
        capabilities: access.capabilities,
        granted_by: access.grantedBy,
        expires_at: access.expiresAt
      })),
      
      // NEW: User's own containers
      owned_containers: user.containers?.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        created_at: c.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});
```

### 6. Authentication Middleware Updates

Extend the existing auth middleware to handle container permissions:

```typescript
// src/server/external/middleware/auth.ts
import { checkPermission } from '../../services/permissions/capability-validator.js';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // ... existing JWT validation ...
  
  // NEW: Add container access to request
  req.user.getContainerAccess = async (containerId: string) => {
    return await getUserContainerAccess(req.user.id, containerId);
  };
  
  req.user.hasPermission = async (containerId: string, capability: string) => {
    const access = await req.user.getContainerAccess(containerId);
    return checkPermission(access.capabilities, capability);
  };
  
  next();
}

// NEW: Container permission middleware
export function requireContainerPermission(capability: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { containerId } = req.params;
    
    if (!await req.user.hasPermission(containerId, capability)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: capability
      });
    }
    
    next();
  };
}
```

### 7. Environment Configuration

Add new environment variables to `.env`:

```bash
# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_TUNNEL_SECRET=your-tunnel-secret

# Container Configuration
DOCKER_HOST=/var/run/docker.sock
CONTAINER_BASE_IMAGE=systemprompt/container-base
CONTAINER_NETWORK_PREFIX=user-network-
CONTAINER_MEMORY_LIMIT=2G
CONTAINER_CPU_SHARES=512

# Permission System
DEFAULT_PERMISSION_LEVELS=viewer,developer,admin
MAX_CUSTOM_TEMPLATES_PER_USER=10
DEFAULT_ACCESS_DURATION=604800  # 7 days in seconds

# Resource Limits
FREE_TIER_CONTAINERS=1
PRO_TIER_CONTAINERS=5
ENTERPRISE_TIER_CONTAINERS=-1  # unlimited
```

### 8. Database Migrations

Create migration files for the new tables:

```typescript
// src/database/migrations/001_container_tables.ts
export async function up(db: Database) {
  // Users table extension
  await db.query(`
    ALTER TABLE users 
    ADD COLUMN tier VARCHAR(50) DEFAULT 'free',
    ADD COLUMN container_quota INT DEFAULT 1
  `);
  
  // Containers table
  await db.query(`
    CREATE TABLE containers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      container_id VARCHAR(255) UNIQUE,
      tunnel_id VARCHAR(255),
      tunnel_token TEXT,
      hostname VARCHAR(255),
      access_app_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'creating',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_accessed TIMESTAMP,
      UNIQUE(user_id, name)
    )
  `);
  
  // Permission templates table
  await db.query(`
    CREATE TABLE permission_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      capabilities JSON NOT NULL,
      custom_config JSON,
      is_custom BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
    )
  `);
  
  // Access grants table
  await db.query(`
    CREATE TABLE access_grants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      grantor_id UUID REFERENCES users(id),
      grantee_email VARCHAR(255) NOT NULL,
      container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
      permission_template_id UUID REFERENCES permission_templates(id),
      capabilities JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      revoked_at TIMESTAMP,
      last_accessed TIMESTAMP,
      INDEX idx_grantee_email (grantee_email),
      INDEX idx_container_id (container_id)
    )
  `);
}
```

### 9. Startup Sequence

Update the server startup to initialize new services:

```typescript
// src/server/index.ts - in startServer function
export async function startServer(port?: number): Promise<Server> {
  const app = await createApp();
  const serverPort = port || parseInt(CONFIG.PORT, 10);
  
  // NEW: Initialize services before starting
  await initializeServices();
  
  const server = app.listen(serverPort, '0.0.0.0', async () => {
    logger.info(`🚀 systemprompt-os running on port ${serverPort}`);
    
    // ... existing logs ...
    
    // NEW: Container service status
    logger.info('🐳 Docker service: Connected');
    logger.info('☁️  Cloudflare API: Connected');
    logger.info('🔐 Permission system: Initialized');
  });
  
  return server;
}

async function initializeServices() {
  // Initialize Cloudflare client
  const cloudflareClient = new CloudflareClient();
  await cloudflareClient.validateConnection();
  
  // Initialize Docker connection
  const docker = new Docker();
  await docker.ping();
  
  // Load default permission templates
  await loadDefaultPermissionTemplates();
  
  // Start background jobs
  startHealthCheckJob();
  startResourceMonitoringJob();
  startAccessExpirationJob();
}
```

## Testing the Integration

### 1. Test Endpoints

```bash
# Test OIDC discovery
curl http://localhost:3000/.well-known/openid-configuration

# Test container creation
curl -X POST http://localhost:3000/api/containers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template": "ubuntu:latest"}'

# Test granting access
curl -X POST http://localhost:3000/api/containers/$CONTAINER_ID/access \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "permissionTemplateId": "developer",
    "expiresIn": 604800
  }'
```

### 2. Integration Tests

```typescript
// tests/integration/cloudflare-integration.spec.ts
describe('Cloudflare Zero Trust Integration', () => {
  it('should create container with tunnel', async () => {
    const response = await request(app)
      .post('/api/containers')
      .set('Authorization', `Bearer ${token}`)
      .send({ template: 'ubuntu:latest' });
      
    expect(response.status).toBe(201);
    expect(response.body.container).toHaveProperty('hostname');
    expect(response.body.container.hostname).toMatch(/\.containers\.systemprompt\.com$/);
  });
  
  it('should grant and revoke access', async () => {
    // Grant access
    const grantResponse = await request(app)
      .post(`/api/containers/${containerId}/access`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'test@example.com',
        permissionTemplateId: 'viewer',
        expiresIn: 3600
      });
      
    expect(grantResponse.status).toBe(200);
    
    // Verify access in userinfo
    const userInfoResponse = await request(app)
      .get('/oauth2/userinfo')
      .set('Authorization', `Bearer ${granteeToken}`);
      
    expect(userInfoResponse.body.accessible_containers).toHaveLength(1);
    expect(userInfoResponse.body.accessible_containers[0].container_id).toBe(containerId);
  });
});
```

## Monitoring and Observability

### 1. Metrics to Track

- Container creation/deletion rates
- Access grant/revoke events
- Tunnel health status
- Resource usage per container
- API response times
- Authentication success/failure rates

### 2. Logging

```typescript
// Structured logging for container events
logger.info('Container created', {
  userId: user.id,
  containerId: container.id,
  tunnelId: tunnel.id,
  hostname: tunnel.hostname
});

logger.info('Access granted', {
  grantorId: grantor.id,
  granteeEmail: email,
  containerId: container.id,
  permissionLevel: template.name,
  expiresAt: grant.expiresAt
});
```

## Security Checklist

- [ ] All container operations require authentication
- [ ] Permission checks on every container API endpoint
- [ ] Rate limiting on container creation
- [ ] Audit logging for all access changes
- [ ] Automatic cleanup of expired grants
- [ ] Resource limits enforced per user tier
- [ ] Isolated Docker networks per user
- [ ] Encrypted tunnel tokens
- [ ] Regular security scans of base images