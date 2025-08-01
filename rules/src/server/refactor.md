# Server Refactoring Plan

## Executive Summary

The current server implementation violates core architectural principles by tightly coupling with modules, mixing protocol concerns, and lacking proper abstraction layers. This refactoring plan outlines a phased approach to transform the server into a world-class, extensible platform that follows the architecture defined in `rules.md`.

## Current State Analysis

### Critical Issues

1. **Direct Module Dependencies**
   - Server directly imports auth module: `import { getModuleRegistry } from '@/modules/core/modules/index'`
   - Hardcoded module startup logic in `index.ts`
   - Server knows about module internals

2. **Mixed Protocol Concerns**
   - HTTP and MCP handling in same codebase without abstraction
   - No clear protocol handler interface
   - Protocol-specific logic scattered throughout

3. **Poor Authentication Architecture**
   - Multiple auth adapters (`ServerAuthAdapter`, auth middleware)
   - Unclear responsibility boundaries
   - Direct auth module manipulation

4. **No Plugin Architecture**
   - Routes hardcoded in `routes.ts`
   - No dynamic endpoint registration
   - Modules can't expose endpoints without server changes

5. **Session Management Issues**
   - MCP sessions separate from HTTP sessions
   - No unified session management
   - Session logic duplicated

6. **Lack of Observability**
   - No structured health checks
   - Missing metrics collection
   - Limited monitoring capabilities

7. **Testing and Debug Code**
   - Debug routes in production code
   - Test endpoints mixed with real endpoints
   - Console.log statements throughout

## Refactoring Phases

### Phase 1: Core Server Foundation (2 weeks)

**Goal**: Create the new server core with proper abstractions

**Tasks**:
1. Create `src/server/core/` directory structure
2. Implement `ServerCore` class with lifecycle management
3. Create `IProtocolHandler` interface
4. Implement server event bus service
5. Create service registry for protocols
6. Add graceful shutdown handling

**Deliverables**:
- `/src/server/core/server.ts`
- `/src/server/core/types/server.types.ts`
- `/src/server/core/services/registry.service.ts`
- `/src/server/core/services/events.service.ts`
- Unit tests for all core components

**Success Criteria**:
- Server can start/stop without knowing about protocols
- Event bus operational with request/response pattern
- Service registry can register/unregister protocols

### Phase 2: Protocol Abstraction Layer (2 weeks)

**Goal**: Separate protocol handling from server core

**Tasks**:
1. Create protocol handler structure
2. Implement HTTP protocol handler
3. Implement MCP protocol handler
4. Create protocol configuration system
5. Migrate existing HTTP endpoints
6. Migrate existing MCP handling

**Deliverables**:
- `/src/server/protocols/http/http-protocol.ts`
- `/src/server/protocols/mcp/mcp-protocol.ts`
- `/src/server/protocols/types/protocol.types.ts`
- Protocol handler tests

**Success Criteria**:
- Protocols register themselves with server core
- All existing endpoints work through new handlers
- Protocol handlers are independently testable

### Phase 3: Module Integration Bridge (3 weeks)

**Goal**: Enable modules to register endpoints dynamically

**Tasks**:
1. Create module bridge service
2. Implement endpoint registry
3. Add module registration events
4. Create endpoint definition schema
5. Implement request forwarding via events
6. Add response handling

**Deliverables**:
- `/src/server/integration/module-bridge.ts`
- `/src/server/integration/endpoint-registry.ts`
- `/src/server/integration/types/integration.types.ts`
- Integration tests

**Success Criteria**:
- Modules can register endpoints via events
- Server forwards requests to modules via events
- No direct module imports in server

### Phase 4: Security Layer (2 weeks)

**Goal**: Unified security across all protocols

**Tasks**:
1. Create unified authentication service
2. Implement authorization service
3. Add rate limiting service
4. Create unified session manager
5. Integrate with all protocols
6. Remove old auth adapters

**Deliverables**:
- `/src/server/security/authentication.ts`
- `/src/server/security/authorization.ts`
- `/src/server/security/rate-limiting.ts`
- `/src/server/security/session-manager.ts`
- Security layer tests

**Success Criteria**:
- Single authentication flow for all protocols
- Sessions work across HTTP and MCP
- Rate limiting enforced per endpoint

### Phase 5: Module Migration (4 weeks)

**Goal**: Migrate all modules to use new registration pattern

**Tasks**:
1. Update auth module to register endpoints
2. Update other core modules
3. Remove hardcoded routes
4. Update module lifecycle for registration
5. Test all module endpoints
6. Update documentation

**Module Migration Order**:
1. Auth module (most complex, sets pattern)
2. Config module
3. System module
4. Users module
5. Remaining modules

**Success Criteria**:
- All routes dynamically registered
- No hardcoded endpoints in server
- All tests passing

### Phase 6: Monitoring and Health (1 week)

**Goal**: Add comprehensive monitoring

**Tasks**:
1. Implement health check aggregator
2. Add metrics collection
3. Create structured logging
4. Add performance monitoring
5. Implement health endpoints
6. Add monitoring dashboard

**Deliverables**:
- `/src/server/monitoring/health-check.ts`
- `/src/server/monitoring/metrics.ts`
- `/src/server/monitoring/logging.ts`
- Monitoring tests

**Success Criteria**:
- Health endpoint shows all component status
- Metrics available for all endpoints
- Performance data collected

### Phase 7: Cleanup and Optimization (1 week)

**Goal**: Remove old code and optimize

**Tasks**:
1. Remove old server code
2. Delete deprecated auth adapters
3. Remove debug/test routes
4. Optimize event bus performance
5. Add caching where appropriate
6. Performance testing

**Success Criteria**:
- All old code removed
- Performance benchmarks met
- Clean codebase

## Migration Strategy

### Incremental Approach

1. **Parallel Development**: Build new server alongside old
2. **Feature Flags**: Toggle between old/new implementations
3. **Gradual Cutover**: Migrate endpoints incrementally
4. **Rollback Plan**: Keep old code until fully migrated

### Testing Strategy

1. **Unit Tests**: Each new component fully tested
2. **Integration Tests**: End-to-end testing for each phase
3. **Regression Tests**: Ensure existing functionality preserved
4. **Performance Tests**: Benchmark against current server
5. **Load Tests**: Ensure scalability improvements

### Risk Mitigation

1. **Breaking Changes**: Use feature flags for gradual rollout
2. **Performance Regression**: Benchmark each phase
3. **Module Compatibility**: Test each module thoroughly
4. **Data Migration**: Sessions/auth state preserved
5. **Rollback Plan**: Keep ability to revert each phase

## Technical Debt Items

### Immediate Fixes (Do First)
1. Remove console.log statements
2. Remove debug routes from production
3. Fix TypeScript strict errors
4. Remove unused imports

### Architecture Fixes (During Refactor)
1. Remove direct module imports
2. Eliminate auth adapter duplication
3. Unify session management
4. Standardize error handling

### Future Improvements (Post-Refactor)
1. Add WebSocket support
2. Implement GraphQL handler
3. Add request/response caching
4. Enable horizontal scaling
5. Add multi-region support

## Implementation Guidelines

### Code Standards
1. **TypeScript**: Strict mode, no any types
2. **Testing**: 100% coverage for new code
3. **Documentation**: JSDoc for all public APIs
4. **Linting**: Follow project ESLint rules
5. **Commits**: Conventional commits format

### Review Process
1. **Design Review**: Before each phase
2. **Code Review**: All PRs require approval
3. **Security Review**: For auth/security changes
4. **Performance Review**: Benchmark results
5. **Architecture Review**: Monthly progress check

### Communication
1. **Weekly Updates**: Progress on current phase
2. **Blockers**: Immediate escalation
3. **Design Decisions**: Document in ADRs
4. **Breaking Changes**: Advance notice to team

## Success Metrics

### Performance
- [ ] 50% reduction in server startup time
- [ ] 2x throughput for concurrent requests
- [ ] Sub-100ms latency for 95th percentile
- [ ] Memory usage stable under load

### Architecture
- [ ] Zero direct module imports
- [ ] 100% dynamic route registration
- [ ] All protocols use same auth flow
- [ ] Event-driven module communication

### Quality
- [ ] 90%+ test coverage
- [ ] Zero TypeScript errors
- [ ] All linting rules pass
- [ ] Documentation complete

### Maintainability
- [ ] New protocols added without core changes
- [ ] Modules registered without server changes
- [ ] Security updates in single location
- [ ] Monitoring for all components

## Timeline Summary

Total Duration: **13 weeks**

1. **Weeks 1-2**: Core Server Foundation
2. **Weeks 3-4**: Protocol Abstraction Layer
3. **Weeks 5-7**: Module Integration Bridge
4. **Weeks 8-9**: Security Layer
5. **Weeks 10-13**: Module Migration
6. **Week 14**: Monitoring and Health
7. **Week 15**: Cleanup and Optimization

## Next Steps

1. **Approval**: Get plan approved by team
2. **Team Assignment**: Assign developers to phases
3. **Environment Setup**: Create feature flag system
4. **Phase 1 Kickoff**: Begin core server development
5. **Communication**: Announce to broader team

## Appendix: File Mapping

### Files to Create
```
src/server/
   core/
      server.ts
      types/
         server.types.ts
         registry.types.ts
      services/
          registry.service.ts
          events.service.ts
   protocols/
      http/
         http-protocol.ts
         middleware/
         types/
      mcp/
         mcp-protocol.ts
         session-manager.ts
         types/
      types/
          protocol.types.ts
   integration/
      module-bridge.ts
      endpoint-registry.ts
      types/
          integration.types.ts
   security/
      authentication.ts
      authorization.ts
      rate-limiting.ts
      session-manager.ts
      types/
          security.types.ts
   monitoring/
       health-check.ts
       metrics.ts
       logging.ts
       types/
           monitoring.types.ts
```

### Files to Modify
- `/src/modules/core/*/index.ts` - Add endpoint registration
- `/src/bootstrap/phases/http-server-phase.ts` - Use new server

### Files to Delete (Phase 7)
- `/src/server/external/` - Entire directory
- `/src/server/mcp.ts` - Replaced by protocol handler
- `/src/server/services/auth-adapter.service.ts` - Replaced
- All debug/test routes