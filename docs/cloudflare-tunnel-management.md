# Cloudflare Tunnel Management Implementation

## Overview

This document details how to programmatically manage Cloudflare Tunnels for multi-tenant Docker container access.

## Cloudflare API Integration

### 1. Authentication

```typescript
// src/services/cloudflare/client.ts

export class CloudflareClient {
  private apiToken: string;
  private accountId: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';
  
  constructor() {
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN!;
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  }
  
  private async request(method: string, path: string, data?: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Cloudflare API error: ${error.errors[0]?.message}`);
    }
    
    return response.json();
  }
}
```

### 2. Tunnel Creation

```typescript
// src/services/cloudflare/tunnel-manager.ts

export class TunnelManager {
  constructor(private client: CloudflareClient) {}
  
  async createTunnel(userId: string, containerName: string) {
    // 1. Create tunnel
    const tunnel = await this.client.request('POST', 
      `/accounts/${this.accountId}/tunnels`, {
      name: `user-${userId}-${containerName}`,
      config_src: 'cloudflare'
    });
    
    // 2. Get tunnel token
    const token = await this.client.request('GET',
      `/accounts/${this.accountId}/tunnels/${tunnel.result.id}/token`
    );
    
    // 3. Create DNS record
    const dnsRecord = await this.createDNSRecord(tunnel.result.id, containerName);
    
    // 4. Create Access application
    const accessApp = await this.createAccessApplication(
      tunnel.result.id,
      containerName,
      userId
    );
    
    return {
      tunnelId: tunnel.result.id,
      tunnelToken: token.result,
      hostname: `${containerName}.containers.systemprompt.com`,
      accessAppId: accessApp.result.id
    };
  }
  
  private async createDNSRecord(tunnelId: string, containerName: string) {
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    
    return this.client.request('POST', `/zones/${zoneId}/dns_records`, {
      type: 'CNAME',
      name: `${containerName}.containers`,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true
    });
  }
  
  private async createAccessApplication(
    tunnelId: string, 
    containerName: string,
    ownerId: string
  ) {
    return this.client.request('POST',
      `/accounts/${this.accountId}/access/apps`, {
      name: `Container: ${containerName}`,
      domain: `${containerName}.containers.systemprompt.com`,
      type: 'self_hosted',
      session_duration: '24h',
      policies: [{
        name: `${containerName}-policy`,
        decision: 'allow',
        include: [{
          email: { '$in': [] } // Will be populated dynamically
        }],
        require: [{
          idp: {
            id: process.env.SYSTEMPROMPT_IDP_ID
          }
        }]
      }]
    });
  }
}
```

### 3. Container Orchestration

```typescript
// src/services/docker/container-manager.ts

import Docker from 'dockerode';
import { TunnelManager } from '../cloudflare/tunnel-manager';

export class ContainerManager {
  private docker: Docker;
  
  constructor(private tunnelManager: TunnelManager) {
    this.docker = new Docker();
  }
  
  async createUserContainer(userId: string, template: string = 'ubuntu:latest') {
    // 1. Create tunnel first
    const containerName = `user-${userId}-${Date.now()}`;
    const tunnel = await this.tunnelManager.createTunnel(userId, containerName);
    
    // 2. Create container with cloudflared
    const container = await this.docker.createContainer({
      Image: 'systemprompt/container-base',
      name: containerName,
      Env: [
        `TUNNEL_TOKEN=${tunnel.tunnelToken}`,
        `USER_ID=${userId}`
      ],
      HostConfig: {
        AutoRemove: false,
        RestartPolicy: { Name: 'unless-stopped' },
        Memory: 2 * 1024 * 1024 * 1024, // 2GB
        CpuShares: 512,
        // Isolated network
        NetworkMode: `user-network-${userId}`
      },
      Labels: {
        'systemprompt.user': userId,
        'systemprompt.tunnel': tunnel.tunnelId,
        'systemprompt.hostname': tunnel.hostname
      }
    });
    
    // 3. Create isolated network if not exists
    try {
      await this.docker.createNetwork({
        Name: `user-network-${userId}`,
        Driver: 'bridge',
        Internal: true,
        Labels: { 'systemprompt.user': userId }
      });
    } catch (e) {
      // Network might already exist
    }
    
    // 4. Start container
    await container.start();
    
    // 5. Store in database
    await this.saveContainerInfo({
      userId,
      containerId: container.id,
      containerName,
      tunnelId: tunnel.tunnelId,
      hostname: tunnel.hostname,
      accessAppId: tunnel.accessAppId,
      status: 'running'
    });
    
    return {
      containerId: container.id,
      hostname: tunnel.hostname
    };
  }
}
```

### 4. Base Container Image

```dockerfile
# Dockerfile for systemprompt/container-base

FROM ubuntu:22.04

# Install cloudflared
RUN apt-get update && \
    apt-get install -y wget && \
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && \
    dpkg -i cloudflared-linux-amd64.deb && \
    rm cloudflared-linux-amd64.deb

# Install basic tools
RUN apt-get install -y \
    curl \
    vim \
    git \
    nodejs \
    npm \
    python3 \
    python3-pip

# Create user workspace
RUN useradd -m -s /bin/bash user
WORKDIR /home/user

# Entry point script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

```bash
#!/bin/bash
# entrypoint.sh

# Start cloudflared tunnel
cloudflared tunnel --no-autoupdate run --token $TUNNEL_TOKEN &

# Keep container running
exec /bin/bash
```

### 5. Access Policy Management

```typescript
// src/services/cloudflare/access-manager.ts

export class AccessManager {
  constructor(private client: CloudflareClient) {}
  
  async grantAccess(
    accessAppId: string, 
    granteeEmail: string, 
    permissions: string[]
  ) {
    // Get current policy
    const app = await this.client.request('GET',
      `/accounts/${this.accountId}/access/apps/${accessAppId}`
    );
    
    const policy = app.result.policies[0];
    
    // Add email to allowed list
    if (!policy.include[0].email['$in'].includes(granteeEmail)) {
      policy.include[0].email['$in'].push(granteeEmail);
    }
    
    // Update policy with custom claims check
    policy.require.push({
      idp: {
        id: process.env.SYSTEMPROMPT_IDP_ID,
        claims: {
          'accessible_containers[*].container_id': {
            '$contains': app.result.id
          },
          'accessible_containers[*].permissions': {
            '$contains': permissions
          }
        }
      }
    });
    
    // Update the policy
    await this.client.request('PUT',
      `/accounts/${this.accountId}/access/apps/${accessAppId}`,
      { policies: [policy] }
    );
  }
  
  async revokeAccess(accessAppId: string, userEmail: string) {
    const app = await this.client.request('GET',
      `/accounts/${this.accountId}/access/apps/${accessAppId}`
    );
    
    const policy = app.result.policies[0];
    
    // Remove email from allowed list
    policy.include[0].email['$in'] = 
      policy.include[0].email['$in'].filter(email => email !== userEmail);
    
    // Update the policy
    await this.client.request('PUT',
      `/accounts/${this.accountId}/access/apps/${accessAppId}`,
      { policies: [policy] }
    );
    
    // Revoke active sessions
    await this.revokeActiveSessions(accessAppId, userEmail);
  }
  
  private async revokeActiveSessions(accessAppId: string, userEmail: string) {
    // Get active sessions
    const sessions = await this.client.request('GET',
      `/accounts/${this.accountId}/access/apps/${accessAppId}/active-sessions`
    );
    
    // Revoke sessions for the user
    for (const session of sessions.result) {
      if (session.user.email === userEmail) {
        await this.client.request('POST',
          `/accounts/${this.accountId}/access/apps/${accessAppId}/revoke-session`,
          { session_id: session.id }
        );
      }
    }
  }
}
```

### 6. Dashboard API Endpoints

```typescript
// src/api/containers.ts

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ContainerManager } from '../services/docker/container-manager';
import { AccessManager } from '../services/cloudflare/access-manager';

const router = Router();

// Create new container
router.post('/containers', authenticate, async (req, res) => {
  try {
    const { template } = req.body;
    const userId = req.user.id;
    
    const container = await containerManager.createUserContainer(userId, template);
    
    res.json({
      success: true,
      container
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Grant access
router.post('/containers/:containerId/access', authenticate, async (req, res) => {
  try {
    const { containerId } = req.params;
    const { email, permissions, expiresIn } = req.body;
    
    // Verify ownership
    const container = await getContainer(containerId);
    if (container.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Create access grant
    const grant = await createAccessGrant({
      grantorId: req.user.id,
      granteeEmail: email,
      containerId,
      permissions,
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    });
    
    // Update Cloudflare policy
    await accessManager.grantAccess(
      container.accessAppId,
      email,
      permissions
    );
    
    // Send notification email
    await sendAccessGrantEmail(email, container, grant);
    
    res.json({ success: true, grant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revoke access
router.delete('/containers/:containerId/access/:grantId', 
  authenticate, async (req, res) => {
  try {
    const { containerId, grantId } = req.params;
    
    // Verify ownership
    const container = await getContainer(containerId);
    if (container.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get grant details
    const grant = await getAccessGrant(grantId);
    
    // Revoke in Cloudflare
    await accessManager.revokeAccess(
      container.accessAppId,
      grant.granteeEmail
    );
    
    // Mark as revoked in database
    await revokeAccessGrant(grantId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container status
router.get('/containers/:containerId/status', authenticate, async (req, res) => {
  try {
    const { containerId } = req.params;
    
    // Check if user has access
    const hasAccess = await checkUserAccess(req.user.id, containerId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const container = await docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });
    const info = await container.inspect();
    
    res.json({
      status: info.State.Status,
      uptime: new Date(info.State.StartedAt).getTime(),
      cpu: calculateCPUPercent(stats),
      memory: {
        used: stats.memory_stats.usage,
        limit: stats.memory_stats.limit,
        percent: (stats.memory_stats.usage / stats.memory_stats.limit) * 100
      },
      network: {
        rx: stats.networks?.eth0?.rx_bytes || 0,
        tx: stats.networks?.eth0?.tx_bytes || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 7. Real-time Updates

```typescript
// src/services/websocket/container-updates.ts

import { Server } from 'socket.io';
import Docker from 'dockerode';

export function setupContainerUpdates(io: Server) {
  const docker = new Docker();
  
  io.use(async (socket, next) => {
    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    const user = await validateToken(token);
    if (!user) {
      return next(new Error('Authentication failed'));
    }
    socket.data.user = user;
    next();
  });
  
  io.on('connection', (socket) => {
    console.log(`User ${socket.data.user.email} connected`);
    
    // Subscribe to container updates
    socket.on('subscribe:container', async (containerId) => {
      // Verify access
      const hasAccess = await checkUserAccess(
        socket.data.user.id, 
        containerId
      );
      
      if (!hasAccess) {
        socket.emit('error', 'Access denied');
        return;
      }
      
      // Join room for this container
      socket.join(`container:${containerId}`);
      
      // Start monitoring
      const container = docker.getContainer(containerId);
      const stream = await container.stats({ stream: true });
      
      stream.on('data', (data) => {
        const stats = JSON.parse(data.toString());
        socket.emit('container:stats', {
          containerId,
          stats: {
            cpu: calculateCPUPercent(stats),
            memory: stats.memory_stats.usage,
            network: stats.networks
          }
        });
      });
      
      socket.on('disconnect', () => {
        stream.destroy();
      });
    });
  });
}
```

## Monitoring & Maintenance

### 1. Health Checks

```typescript
// src/services/monitoring/health-check.ts

export async function performHealthChecks() {
  const containers = await getAllActiveContainers();
  
  for (const container of containers) {
    try {
      // Check container status
      const dockerContainer = docker.getContainer(container.containerId);
      const info = await dockerContainer.inspect();
      
      if (info.State.Status !== 'running') {
        await handleContainerDown(container);
      }
      
      // Check tunnel status
      const tunnelHealthy = await checkTunnelHealth(container.tunnelId);
      if (!tunnelHealthy) {
        await handleTunnelDown(container);
      }
      
      // Update status
      await updateContainerStatus(container.id, {
        lastHealthCheck: new Date(),
        healthy: info.State.Status === 'running' && tunnelHealthy
      });
      
    } catch (error) {
      console.error(`Health check failed for ${container.id}:`, error);
      await handleContainerError(container, error);
    }
  }
}

// Run health checks every minute
setInterval(performHealthChecks, 60000);
```

### 2. Resource Limits

```typescript
// src/config/resource-limits.ts

export const RESOURCE_LIMITS = {
  free: {
    containers: 1,
    memory: '512m',
    cpu: 0.5,
    storage: '5g',
    bandwidth: '10g/month'
  },
  pro: {
    containers: 5,
    memory: '2g',
    cpu: 1,
    storage: '20g',
    bandwidth: '100g/month'
  },
  enterprise: {
    containers: -1, // unlimited
    memory: '8g',
    cpu: 4,
    storage: '100g',
    bandwidth: -1 // unlimited
  }
};
```

## Security Considerations

1. **Container Isolation**: Each user's containers run in isolated networks
2. **Resource Limits**: Enforce CPU, memory, and bandwidth limits
3. **Access Logging**: Log all access attempts and operations
4. **Automatic Cleanup**: Remove unused containers after inactivity
5. **Tunnel Security**: Rotate tunnel tokens periodically
6. **Rate Limiting**: Limit API calls per user