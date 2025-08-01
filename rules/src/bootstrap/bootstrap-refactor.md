# Bootstrap System Refactor Status

**Last Updated**: 2025-08-01

## Overview

This document tracks the ongoing refactor of the SystemPrompt OS bootstrap system. The refactor aims to transform the bootstrap from a hardcoded, monolithic system into a dynamic, modular, and observable initialization framework.

## Current Status: 60% Complete

### ✅ Completed (What's Done)

1. **Module Lifecycle Support**
   - IModule interface includes `start?()`, `stop?()`, and `health?()` methods
   - BaseModule provides default implementations for all lifecycle methods
   - Module registry properly checks for method existence before calling
   - Clean lifecycle sequence: initialize → start → running → stop → terminated

2. **HTTP Server Phase Clarity**
   - Renamed `mcp-servers-phase.ts` to `http-server-phase.ts`
   - Updated all references in bootstrap.ts and types
   - Clear separation of HTTP setup from protocol-specific code

3. **Optional Path Handling**
   - Warning messages for optional paths changed to debug messages
   - `/injectable` and `/config/modules.json` are truly optional
   - Messages include "(this is normal)" suffix for clarity

4. **Module Discovery Infrastructure**
   - `CoreModuleScanner` class implemented for filesystem discovery
   - `DependencyResolver` class with circular dependency detection
   - Topological sorting for correct module load order
   - Feature flag `useDynamicDiscovery` added (currently false)

5. **Module Start Method Fix**
   - Registry checks if `module.start` exists and is a function
   - No errors thrown for modules without start methods
   - Proper debug logging for modules without start

### ⏳ In Progress (What's Partially Done)

1. **Dynamic Module Discovery**
   - Infrastructure complete but not activated
   - Feature flag set to false for safety
   - Still using hardcoded CORE_MODULES constant
   - Need to enable and test thoroughly

2. **Separation of Concerns**
   - HTTP setup separated into its own phase
   - Module discovery infrastructure ready
   - Still need to separate CLI registration and other concerns

### ❌ Not Started (What's Left)

1. **Remove CORE_MODULES Constant**
   - File `/src/constants/bootstrap.ts` still exists
   - All imports need updating
   - Switch to fully dynamic discovery

2. **Lifecycle Manager**
   - No centralized `ModuleLifecycleManager` class
   - Lifecycle logic scattered across services
   - Need unified lifecycle orchestration

3. **Event System**
   - No `BootstrapEventEmitter` implemented
   - Cannot monitor bootstrap progress externally
   - No lifecycle events emitted

4. **Health Endpoints**
   - Health methods exist but not exposed via HTTP
   - No `/health` endpoint for module status
   - No aggregated system health check

5. **Integration Test Failures**
   - Multiple test failures in bootstrap integration tests
   - Need to fix before enabling dynamic discovery

## Action Plan

### Phase 1: Fix Tests and Enable Discovery (Priority: HIGH)
```bash
# 1. Fix integration test failures
npm test -- src/__tests__/bootstrap.integration.test.ts

# 2. Enable dynamic discovery
# In src/bootstrap.ts, change:
private readonly useDynamicDiscovery: boolean = true;

# 3. Test thoroughly
./bin/systemprompt dev test bootstrap
```

### Phase 2: Remove Hardcoded Constants (Priority: HIGH)
```bash
# 1. Delete constants file
rm src/constants/bootstrap.ts

# 2. Update all imports (search and replace)
# From: import { CORE_MODULES } from '@/constants/bootstrap'
# To: Remove the import

# 3. Ensure bootstrap uses dynamic discovery
```

### Phase 3: Implement Lifecycle Manager (Priority: MEDIUM)
```typescript
// Create src/bootstrap/helpers/lifecycle-manager.ts
export class ModuleLifecycleManager {
  async initializeModule(module: IModule): Promise<void>
  async startModule(module: IModule): Promise<void>
  async stopModule(module: IModule, timeout?: number): Promise<void>
  async checkModuleHealth(module: IModule): Promise<HealthStatus>
}
```

### Phase 4: Add Event System (Priority: MEDIUM)
```typescript
// Create src/bootstrap/helpers/bootstrap-events.ts
export class BootstrapEventEmitter extends EventEmitter {
  emitPhaseStart(phase: BootstrapPhaseEnum): void
  emitPhaseComplete(phase: BootstrapPhaseEnum): void
  emitModuleLifecycle(module: string, event: string): void
}
```

### Phase 5: Expose Health Endpoints (Priority: LOW)
```typescript
// In http-server-phase.ts, add:
app.get('/health', async (req, res) => {
  const health = await moduleRegistry.healthCheckAll();
  res.json(health);
});
```

## Success Criteria

| Criteria | Status | Description |
|----------|--------|-------------|
| No Hardcoded Lists | ❌ | CORE_MODULES constant must be removed |
| Dynamic Discovery | ❌ | All modules discovered from filesystem |
| Lifecycle Support | ✅ | All modules support start/stop/health |
| Clean Shutdown | ✅ | Graceful shutdown with proper cleanup |
| Event Visibility | ❌ | Full event stream for monitoring |
| Test Coverage | ❓ | > 90% coverage for bootstrap code |
| Performance | ❓ | < 2 second bootstrap time |

## Risks and Mitigations

1. **Risk**: Breaking existing functionality
   - **Mitigation**: Feature flag allows instant rollback
   - **Status**: Flag implemented and ready

2. **Risk**: Module load order issues
   - **Mitigation**: DependencyResolver handles ordering
   - **Status**: Implemented with circular dependency detection

3. **Risk**: Performance degradation
   - **Mitigation**: Parallel loading where possible
   - **Status**: Not yet implemented

## Next Developer Actions

1. **MUST DO FIRST**: Fix integration test failures
2. **THEN**: Set `useDynamicDiscovery = true` and test
3. **NEXT**: Remove CORE_MODULES constant
4. **FINALLY**: Implement remaining features

## Commands for Testing

```bash
# Run bootstrap tests
npm test -- src/__tests__/bootstrap.integration.test.ts

# Test bootstrap with debug logging
DEBUG=bootstrap:* ./bin/systemprompt dev test

# Check module discovery
./bin/systemprompt dev list-modules

# Verify no hardcoded references
grep -r "CORE_MODULES" src/
```

## Notes for Developers

- The refactor follows the rules in `/var/www/html/systemprompt-os/rules/src/bootstrap/rules.md`
- All changes must maintain backward compatibility until fully migrated
- Use the feature flag for safe testing
- Document any deviations from the plan

---

**Remember**: This is a living document. Update it as you make progress!