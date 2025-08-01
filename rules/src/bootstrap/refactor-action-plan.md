# Bootstrap Refactor Action Plan

## Phase 1: Immediate Fixes (Week 1)

### 1.1 Remove Hardcoded Constants
- **DELETE**: `/src/constants/bootstrap.ts`
- **Impact**: Removes hardcoded CORE_MODULES array
- **Dependencies**: Update all imports in bootstrap files

### 1.2 Rename MCP Phase
- **RENAME**: `mcp-servers-phase.ts` → `http-server-phase.ts`
- **UPDATE**: All references in bootstrap.ts
- **UPDATE**: Comments and documentation

### 1.3 Update IModule Interface
```typescript
// In /src/modules/core/modules/types/index.ts
interface IModule<TExports = unknown> {
  // ... existing properties ...
  
  // Add lifecycle methods
  start?(): Promise<void>;
  stop?(): Promise<void>;
  health?(): Promise<HealthStatus>;
}
```

### 1.4 Fix Warning Messages
In `module-manager.service.ts`:
```typescript
// Check existence before warning
if (this.shouldWarnAboutPath(injectablePath)) {
  this.logger.warn(...);
}
```

## Phase 2: Module Discovery System (Week 2)

### 2.1 Create Module Scanner
```typescript
// New file: /src/bootstrap/helpers/module-scanner.ts
export class CoreModuleScanner {
  async scan(basePath: string): Promise<ModuleDefinition[]> {
    // 1. Read /src/modules/core directory
    // 2. Find subdirectories with index.ts
    // 3. Read module.yaml for metadata
    // 4. Build ModuleDefinition array
  }
}
```

### 2.2 Create Dependency Resolver
```typescript
// New file: /src/bootstrap/helpers/dependency-resolver.ts
export class DependencyResolver {
  resolve(modules: ModuleDefinition[]): ModuleDefinition[] {
    // 1. Build dependency graph
    // 2. Check for circular dependencies
    // 3. Topological sort
    // 4. Return ordered modules
  }
}
```

### 2.3 Update Core Modules Phase
```typescript
// In core-modules-phase.ts
export const executeCoreModulesPhase = async (context) => {
  // 1. Use CoreModuleScanner to discover modules
  // 2. Use DependencyResolver to order them
  // 3. Load modules in dependency order
  // 4. Validate lifecycle methods for critical modules
}
```

## Phase 3: Lifecycle Management (Week 3)

### 3.1 Create Lifecycle Manager
```typescript
// New file: /src/bootstrap/helpers/lifecycle-manager.ts
export class ModuleLifecycleManager {
  async initialize(module: IModule): Promise<void>;
  async start(module: IModule): Promise<void>;
  async stop(module: IModule): Promise<void>;
  async checkHealth(module: IModule): Promise<HealthStatus>;
}
```

### 3.2 Update Shutdown Helper
```typescript
// Simplify shutdown-helper.ts
export const shutdownModule = async (
  module: IModule,
  timeout = 5000
): Promise<void> => {
  if (!module.stop) return;
  
  await Promise.race([
    module.stop(),
    timeoutPromise(timeout)
  ]);
};
```

### 3.3 Update BaseModule
```typescript
// Add default implementations
abstract class BaseModule<T> implements IModule<T> {
  async start(): Promise<void> {
    this.status = ModulesStatus.RUNNING;
  }
  
  async stop(): Promise<void> {
    this.status = ModulesStatus.STOPPED;
  }
  
  async health(): Promise<HealthStatus> {
    return {
      status: this.status === ModulesStatus.RUNNING ? 'healthy' : 'unhealthy'
    };
  }
}
```

## Phase 4: Event Integration (Week 4)

### 4.1 Add Bootstrap Event Emitter
```typescript
// New file: /src/bootstrap/helpers/bootstrap-events.ts
export class BootstrapEventEmitter extends EventEmitter {
  emitPhaseStart(phase: string): void;
  emitPhaseComplete(phase: string): void;
  emitModuleLoaded(module: string): void;
  emitModuleStarted(module: string): void;
  emitError(error: Error, context: any): void;
}
```

### 4.2 Integrate Events in Phases
- Emit events at each phase transition
- Emit events for each module lifecycle change
- Enable external monitoring of bootstrap progress

## Phase 5: Testing & Validation (Week 5)

### 5.1 Update Integration Tests
- Fix failing "shutdown and restart" test
- Add tests for dynamic module discovery
- Add tests for dependency resolution
- Add tests for lifecycle methods

### 5.2 Add Validation Tools
```typescript
// New file: /src/bootstrap/helpers/module-validator.ts
export class ModuleValidator {
  validateLifecycle(module: IModule): ValidationResult;
  validateDependencies(module: IModule): ValidationResult;
  validateExports(module: IModule): ValidationResult;
}
```

## Migration Checklist

### Before Starting
- [ ] Create feature branch
- [ ] Set up feature flags
- [ ] Document breaking changes

### Phase 1 Checklist
- [ ] Delete `/src/constants/bootstrap.ts`
- [ ] Rename MCP phase file
- [ ] Update IModule interface
- [ ] Fix warning messages
- [ ] Update all imports

### Phase 2 Checklist
- [ ] Implement CoreModuleScanner
- [ ] Implement DependencyResolver
- [ ] Update core-modules-phase
- [ ] Remove CORE_MODULES usage
- [ ] Test module discovery

### Phase 3 Checklist
- [ ] Implement ModuleLifecycleManager
- [ ] Update shutdown-helper
- [ ] Update BaseModule
- [ ] Add lifecycle to all modules
- [ ] Test lifecycle operations

### Phase 4 Checklist
- [ ] Implement BootstrapEventEmitter
- [ ] Add events to all phases
- [ ] Add events to lifecycle
- [ ] Create event documentation
- [ ] Test event emission

### Phase 5 Checklist
- [ ] Fix all integration tests
- [ ] Add new test coverage
- [ ] Implement validators
- [ ] Performance benchmarks
- [ ] Documentation updates

## Success Criteria

1. **No Hardcoded Lists**: CORE_MODULES removed completely
2. **Dynamic Discovery**: All modules discovered from filesystem
3. **Lifecycle Support**: All modules support start/stop/health
4. **Clean Shutdown**: Graceful shutdown with proper cleanup
5. **Event Visibility**: Full event stream for monitoring
6. **Test Coverage**: > 90% coverage for bootstrap code
7. **Performance**: < 2 second bootstrap time

## Rollback Plan

If issues arise:
1. Feature flags allow instant rollback
2. Old bootstrap code remains until Phase 5 complete
3. Parallel implementation allows A/B testing
4. Module-by-module migration reduces risk