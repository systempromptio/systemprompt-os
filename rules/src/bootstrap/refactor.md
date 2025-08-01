# Bootstrap Refactor Plan

## Current State Analysis

### Problems That Need Addressing

#### 1. Inconsistent Module Lifecycle
**Problem**: Modules have incomplete lifecycle management
- Only `initialize()` is defined in the `IModule` interface
- `stop()` method is checked but not part of the interface
- No standardized way to start operations or check health
- Shutdown logic uses duck-typing to find `stop()` methods

**Impact**: 
- Memory leaks from unreleased resources
- Inability to gracefully shutdown services
- No way to monitor module health
- Inconsistent cleanup behavior

#### 2. Hardcoded Module Registry
**Problem**: `CORE_MODULES` constant hardcodes all core modules
- Duplicates information already in filesystem
- Requires manual updates when adding/removing modules
- Violates DRY principle
- Makes module discovery rigid

**Impact**:
- Maintenance burden
- Easy to forget updating the list
- Can't dynamically add/remove core modules
- Testing requires mocking the constant

#### 3. Misleading MCP Server Phase
**Problem**: "MCP servers phase" actually sets up Express/HTTP
- Name suggests Model Context Protocol specific setup
- Actually loads general HTTP infrastructure
- MCP is just one module among many
- Creates confusion about phase purpose

**Impact**:
- Developer confusion
- Incorrect assumptions about phase responsibilities
- Harder to understand bootstrap flow

#### 4. Poor Separation of Concerns
**Problem**: Bootstrap mixes multiple responsibilities
- Module loading
- HTTP setup
- MCP configuration
- Extension discovery
- CLI registration

**Impact**:
- Difficult to test individual phases
- Can't reuse phases independently
- Tight coupling between unrelated systems

#### 5. Configuration Confusion
**Problem**: Multiple configuration sources with unclear precedence
- `/config/modules.json` for extensions
- Hardcoded `CORE_MODULES` for core
- Environment variables scattered
- No clear configuration schema

**Impact**:
- Warnings for missing optional files
- Unclear which config wins
- Hard to override settings
- No validation of configuration

#### 6. Inadequate Error Handling
**Problem**: Errors don't provide enough context
- Generic error messages
- No module-specific error types
- Timeouts are hardcoded
- Silent failures in non-critical modules

**Impact**:
- Hard to debug bootstrap failures
- Can't distinguish between error types
- No way to adjust timeouts
- Critical failures may go unnoticed

## Technical Debt

### 1. **Lifecycle Debt**
- Missing lifecycle methods in interface
- No health check standardization
- Inconsistent state management
- No lifecycle event system

### 2. **Architecture Debt**
- Monolithic Bootstrap class
- Tight coupling between phases
- No dependency injection
- Hardcoded phase order

### 3. **Discovery Debt**
- Manual module registration
- No plugin architecture
- Can't hot-reload modules
- No module versioning

### 4. **Testing Debt**
- Difficult to unit test phases
- No mock module system
- Can't test failure scenarios
- No performance benchmarks

### 5. **Operational Debt**
- No metrics collection
- Missing health endpoints
- No graceful degradation
- Poor observability

## Refactor Plan

### Phase 1: Fix Critical Issues (Week 1)

#### 1.1 Update Module Interface
```typescript
// Add lifecycle methods to IModule
interface IModule<TExports = unknown> {
  // ... existing properties ...
  
  // Lifecycle methods
  initialize(): Promise<void>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
  health?(): Promise<HealthStatus>;
}
```

#### 1.2 Rename MCP Phase
- Rename `mcp-servers-phase.ts` ’ `http-server-phase.ts`
- Update all references
- Clarify phase documentation

#### 1.3 Fix Warning Messages
- Make `/config/modules.json` truly optional
- Make `/injectable` path optional with no warnings
- Add existence checks before warning

### Phase 2: Implement Module Discovery (Week 2)

#### 2.1 Core Module Scanner
```typescript
class CoreModuleScanner {
  async scan(): Promise<ModuleDefinition[]> {
    const corePath = '/src/modules/core';
    const modules = await fs.readdir(corePath);
    return modules
      .filter(isValidModule)
      .map(buildModuleDefinition);
  }
}
```

#### 2.2 Remove CORE_MODULES Constant
- Replace with dynamic discovery
- Build dependency graph at runtime
- Cache discovery results

#### 2.3 Dependency Resolver
```typescript
class DependencyResolver {
  resolve(modules: ModuleDefinition[]): ModuleDefinition[] {
    // Topological sort
    // Detect circular dependencies
    // Return ordered list
  }
}
```

### Phase 3: Lifecycle Manager (Week 3)

#### 3.1 Standardized Lifecycle
```typescript
class ModuleLifecycleManager {
  async initializeModule(module: IModule): Promise<void> {
    // Pre-init hooks
    await module.initialize();
    // Post-init hooks
  }
  
  async startModule(module: IModule): Promise<void> {
    if (module.start) {
      await module.start();
    }
  }
  
  async stopModule(module: IModule, timeout = 5000): Promise<void> {
    if (module.stop) {
      await Promise.race([
        module.stop(),
        this.timeout(timeout)
      ]);
    }
  }
}
```

#### 3.2 Health Check System
```typescript
class HealthCheckService {
  async checkModule(module: IModule): Promise<HealthStatus> {
    if (module.health) {
      return module.health();
    }
    return { status: 'unknown' };
  }
  
  async checkAll(): Promise<SystemHealth> {
    // Aggregate all module health
  }
}
```

### Phase 4: Refactor Bootstrap Architecture (Week 4)

#### 4.1 Phase Extraction
- Extract each phase to separate class
- Implement phase interface
- Enable phase composition

#### 4.2 Configuration System
```typescript
class BootstrapConfiguration {
  static load(): BootstrapConfig {
    // 1. Defaults
    // 2. Config files
    // 3. Environment variables
    // 4. Runtime overrides
  }
  
  validate(config: unknown): BootstrapConfig {
    // Zod validation
  }
}
```

#### 4.3 Event System
```typescript
class BootstrapEventEmitter {
  // Emit lifecycle events
  emit('phase:start', { phase: 'core_modules' });
  emit('module:initialized', { module: 'auth' });
  emit('bootstrap:complete', { duration: 1234 });
}
```

### Phase 5: Testing & Monitoring (Week 5)

#### 5.1 Test Infrastructure
- Mock module factory
- Phase test harnesses
- Failure injection
- Performance tests

#### 5.2 Observability
- Metrics collection
- Distributed tracing
- Health endpoints
- Bootstrap dashboard

## Migration Strategy

### Step 1: Parallel Implementation
- Build new system alongside old
- Feature flag to switch between them
- Gradual rollout

### Step 2: Module Migration
- Update modules one by one
- Add new lifecycle methods
- Maintain backward compatibility

### Step 3: Deprecation
- Mark old methods deprecated
- Provide migration guide
- Set removal timeline

### Step 4: Cleanup
- Remove old bootstrap code
- Remove CORE_MODULES constant
- Clean up configuration

## Success Metrics

1. **Bootstrap Time**: < 2 seconds for core modules
2. **Memory Usage**: No leaks after 24 hours
3. **Error Rate**: < 0.1% bootstrap failures
4. **Test Coverage**: > 90% for bootstrap code
5. **Module Discovery**: 100% automatic for core

## Risk Mitigation

1. **Compatibility**: Maintain backward compatibility during migration
2. **Rollback**: Feature flags enable quick rollback
3. **Testing**: Comprehensive test suite before deployment
4. **Monitoring**: Real-time metrics during rollout
5. **Documentation**: Clear migration guides for module authors

## Timeline

- **Week 1**: Critical fixes (lifecycle, naming, warnings)
- **Week 2**: Module discovery system
- **Week 3**: Lifecycle management
- **Week 4**: Architecture refactor
- **Week 5**: Testing and monitoring
- **Week 6**: Migration and cleanup

## Next Steps

1. Review and approve refactor plan
2. Create feature branch
3. Set up feature flags
4. Begin Phase 1 implementation
5. Daily progress updates