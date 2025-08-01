# Server Event-Driven Architecture Refactoring Plan

## Executive Summary

This plan outlines the implementation of an event-driven architecture for the SystemPrompt OS server, transforming it from a tightly-coupled monolith to a lean, extensible platform. The refactoring will be done incrementally using Test-Driven Development (TDD).

## Current State Analysis

### Critical Issues Identified

1. **Direct Module Dependencies**
   - Server imports auth module directly: `import { getModuleRegistry } from '@/modules/core/modules/index'`
   - Auth module started manually in `index.ts`
   - Server knows about module internals

2. **Hardcoded Routes**
   - All routes defined statically in `routes.ts`
   - Modules cannot register endpoints dynamically
   - New features require server code changes

3. **Mixed Responsibilities**
   - Server handles authentication logic
   - Protocol-specific code mixed with core server
   - Session management duplicated

4. **No Event Bus**
   - No event-driven communication
   - Direct function calls between layers
   - Tight coupling prevents independent testing

5. **Auth Adapter Anti-pattern**
   - `ServerAuthAdapter` directly accesses auth services
   - Creates tight coupling with auth module
   - Duplicates auth module functionality

## Implementation Approach

### Phase 1: Core Server Foundation (Week 1)

**Integration Tests First**:
```typescript
// tests/integration/server/core/server-core.integration.test.ts
describe('Server Core Integration', () => {
  test('server starts without knowing about modules', async () => {
    const server = new ServerCore({ port: 0 });
    await server.start();
    expect(server.getStatus()).toBe('running');
    await server.stop();
  });

  test('protocol handlers register dynamically', async () => {
    const server = new ServerCore({ port: 0 });
    const httpHandler = new HttpProtocolHandler();
    
    await server.registerProtocol('http', httpHandler);
    expect(server.getProtocols()).toContain('http');
  });

  test('event bus enables module communication', async () => {
    const server = new ServerCore({ port: 0 });
    const received = [];
    
    server.eventBus.on('test.event', (data) => {
      received.push(data);
    });
    
    server.eventBus.emit('test.event', { message: 'hello' });
    expect(received).toEqual([{ message: 'hello' }]);
  });
});
```

**Implementation Tasks**:
1. Create `src/server/core/server.ts` with lifecycle management
2. Implement `src/server/core/services/event-bus.service.ts`
3. Create `src/server/core/services/registry.service.ts`
4. Define interfaces in `src/server/core/types/`

### Phase 2: Protocol Abstraction (Week 2)

**Integration Tests**:
```typescript
// tests/integration/server/protocols/http-protocol.integration.test.ts
describe('HTTP Protocol Integration', () => {
  test('HTTP handler processes requests via events', async () => {
    const server = new ServerCore({ port: 0 });
    const httpHandler = new HttpProtocolHandler();
    
    await server.registerProtocol('http', httpHandler);
    await server.start();
    
    // Register test endpoint via event
    server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
      moduleId: 'test',
      endpoints: [{
        method: 'GET',
        path: '/api/test',
        handler: 'test.handle'
      }]
    });
    
    // Handle the event
    server.eventBus.on('test.handle', async (event) => {
      server.eventBus.emit(`response.${event.requestId}`, {
        data: { message: 'success' }
      });
    });
    
    // Make HTTP request
    const response = await fetch(`http://localhost:${server.port}/api/test`);
    const data = await response.json();
    
    expect(data).toEqual({ message: 'success' });
  });
});
```

**Implementation Tasks**:
1. Create `IProtocolHandler` interface
2. Implement `HttpProtocolHandler` with Express
3. Implement `McpProtocolHandler` with multi-context support
4. Remove protocol logic from main server

### Phase 3: Module Integration Bridge (Week 3)

**Integration Tests**:
```typescript
// tests/integration/server/integration/module-bridge.integration.test.ts
describe('Module Integration Bridge', () => {
  test('modules register endpoints dynamically', async () => {
    const server = new ServerCore({ port: 0 });
    const bridge = new ModuleBridge(server.eventBus);
    
    // Simulate module registration
    server.eventBus.emit(ServerEvents.REGISTER_ENDPOINTS, {
      moduleId: 'users',
      endpoints: [{
        protocol: 'http',
        method: 'GET',
        path: '/api/users/:id',
        handler: 'users.get',
        auth: { required: true }
      }]
    });
    
    const endpoints = bridge.getRegisteredEndpoints();
    expect(endpoints).toContainEqual(
      expect.objectContaining({
        path: '/api/users/:id',
        moduleId: 'users'
      })
    );
  });

  test('bridge forwards requests to modules via events', async () => {
    const server = new ServerCore({ port: 0 });
    const bridge = new ModuleBridge(server.eventBus);
    
    let receivedEvent;
    server.eventBus.on('users.get', (event) => {
      receivedEvent = event;
      server.eventBus.emit(`response.${event.requestId}`, {
        data: { id: event.params.id, name: 'Test User' }
      });
    });
    
    const response = await bridge.handleRequest({
      moduleId: 'users',
      handler: 'users.get',
      params: { id: '123' },
      requestId: 'req-1'
    });
    
    expect(response.data).toEqual({ id: '123', name: 'Test User' });
  });
});
```

**Implementation Tasks**:
1. Create `ModuleBridge` class
2. Implement `EndpointRegistry`
3. Add request routing logic
4. Implement timeout handling

### Phase 4: Authentication Integration (Week 4)

**Integration Tests**:
```typescript
// tests/integration/server/auth/auth-integration.test.ts
describe('Auth Module Integration', () => {
  test('auth validation via events', async () => {
    const server = new ServerCore({ port: 0 });
    
    // Simulate auth module response
    server.eventBus.on('auth.validate', async (event) => {
      if (event.token === 'valid-token') {
        server.eventBus.emit(`response.${event.requestId}`, {
          data: { valid: true, userId: 'user-123' }
        });
      } else {
        server.eventBus.emit(`response.${event.requestId}`, {
          error: { code: 'INVALID_TOKEN' }
        });
      }
    });
    
    // Test valid token
    const validResult = await server.eventBus.emitAndWait(
      'auth.validate',
      { token: 'valid-token', requestId: 'req-1' }
    );
    
    expect(validResult.data.valid).toBe(true);
    
    // Test invalid token
    const invalidResult = await server.eventBus.emitAndWait(
      'auth.validate',
      { token: 'invalid-token', requestId: 'req-2' }
    );
    
    expect(invalidResult.error.code).toBe('INVALID_TOKEN');
  });
});
```

**Implementation Tasks**:
1. Remove `ServerAuthAdapter`
2. Update middleware to use events
3. Implement auth event handlers
4. Test OAuth flow via events

### Phase 5: End-to-End Testing (Week 5)

**E2E Tests with Docker**:
```typescript
// tests/e2e/docker/01-server-external.e2e.test.ts
describe('Server External Access E2E', () => {
  let container: Docker.Container;
  let tunnelUrl: string;
  
  beforeAll(async () => {
    // Build and start container
    container = await buildAndStartContainer();
    
    // Wait for server to be ready
    await waitForHealthCheck(container);
    
    // Establish cloudflared tunnel
    tunnelUrl = await establishCloudflaredTunnel(container);
  });
  
  test('server accessible via cloudflared tunnel', async () => {
    const response = await fetch(`${tunnelUrl}/health`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });
  
  test('OAuth flow works through tunnel', async () => {
    // Test complete OAuth flow
    const authUrl = `${tunnelUrl}/oauth/authorize?client_id=test`;
    const response = await fetch(authUrl);
    
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('github.com');
  });
  
  test('MCP contexts accessible', async () => {
    const contexts = ['git-tools', 'terminal', 'system'];
    
    for (const context of contexts) {
      const response = await fetch(`${tunnelUrl}/mcp`, {
        method: 'POST',
        headers: { 'X-MCP-Context': context },
        body: JSON.stringify({ method: 'list_tools' })
      });
      
      expect(response.status).toBe(200);
    }
  });
});
```

## Testing Strategy

### 1. Unit Tests (Per Component)
- Test each service in isolation
- Mock dependencies
- Focus on business logic

### 2. Integration Tests (Per Phase)
- Test component interactions
- Use real event bus
- Verify end-to-end flows

### 3. E2E Tests (Final Phase)
- Test through external access
- Verify all protocols work
- Test deployment scenarios

### 4. Performance Tests
```typescript
describe('Server Performance', () => {
  test('handles 1000 concurrent requests', async () => {
    const server = new ServerCore({ port: 0 });
    await server.start();
    
    const requests = Array(1000).fill(0).map(() => 
      fetch(`http://localhost:${server.port}/health`)
    );
    
    const start = Date.now();
    await Promise.all(requests);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(5000); // Under 5 seconds
  });
});
```

## Migration Checklist

### Pre-Migration
- [ ] Set up feature flags
- [ ] Create rollback plan
- [ ] Document breaking changes
- [ ] Notify team

### Phase 1
- [ ] Implement core server
- [ ] Create event bus
- [ ] Add service registry
- [ ] Write unit tests
- [ ] Write integration tests

### Phase 2
- [ ] Create protocol handlers
- [ ] Migrate HTTP handling
- [ ] Migrate MCP handling
- [ ] Update configuration
- [ ] Test all endpoints

### Phase 3
- [ ] Build module bridge
- [ ] Create endpoint registry
- [ ] Implement request routing
- [ ] Add timeout handling
- [ ] Test module communication

### Phase 4
- [ ] Remove auth adapter
- [ ] Update auth middleware
- [ ] Test OAuth flows
- [ ] Verify session handling
- [ ] Update documentation

### Phase 5
- [ ] Create Docker setup
- [ ] Configure cloudflared
- [ ] Write E2E tests
- [ ] Performance testing
- [ ] Load testing

### Post-Migration
- [ ] Remove old code
- [ ] Update all documentation
- [ ] Monitor performance
- [ ] Gather feedback

## Success Metrics

1. **Architecture**
   - Zero direct module imports
   - 100% dynamic endpoint registration
   - All communication via events

2. **Performance**
   - 50% faster startup time
   - 2x request throughput
   - <100ms 95th percentile latency

3. **Quality**
   - 90%+ test coverage
   - Zero TypeScript errors
   - All linting rules pass

4. **Maintainability**
   - New modules added without server changes
   - New protocols added without core changes
   - Clear separation of concerns

## Risk Mitigation

1. **Breaking Changes**
   - Use feature flags for gradual rollout
   - Maintain backwards compatibility
   - Provide migration guides

2. **Performance Regression**
   - Benchmark each phase
   - Monitor production metrics
   - Have rollback plan ready

3. **Module Compatibility**
   - Test each module thoroughly
   - Provide module migration guide
   - Support legacy patterns temporarily

## Next Steps

1. Review and approve this plan
2. Set up integration test infrastructure
3. Begin Phase 1 implementation
4. Create first failing integration test
5. Implement to make test pass

## Timeline

- **Week 1**: Core Server Foundation
- **Week 2**: Protocol Abstraction
- **Week 3**: Module Integration Bridge
- **Week 4**: Authentication Integration
- **Week 5**: E2E Testing & Cleanup

Total Duration: **5 weeks** (vs 10 weeks in original plan)

This accelerated timeline focuses on critical path items and assumes:
- Full-time development resources
- No major blockers
- Parallel work where possible
- Reuse of existing code where appropriate