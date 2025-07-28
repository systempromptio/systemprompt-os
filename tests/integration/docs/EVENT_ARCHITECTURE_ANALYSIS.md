# Event Architecture Analysis: Auth, Users, and Permissions

## Current Module Analysis

### Auth Module
- **Services**: AuthService, TokenService, UserService, MFAService, AuditService
- **Key Operations**:
  - User login/logout
  - Token creation/validation/revocation
  - MFA verification
  - OAuth provider management
  - Audit logging

### Permissions Module  
- **Services**: PermissionsService
- **Key Operations**:
  - Create/manage permissions and roles
  - Grant/revoke permissions
  - Assign/remove roles from users
  - Check user permissions

### User Module (within Auth)
- **Services**: UserService
- **Key Operations**:
  - Create/update users
  - OAuth identity management
  - First-user admin assignment

## Event Integration Scenarios

### 1. Authentication Events
```typescript
// User login
eventBus.emit('auth.login.attempted', { email, ip, timestamp })
eventBus.emit('auth.login.succeeded', { userId, sessionId, provider })
eventBus.emit('auth.login.failed', { email, reason, ip })
eventBus.emit('auth.mfa.required', { userId, sessionId })
eventBus.emit('auth.mfa.verified', { userId, sessionId })

// Token lifecycle
eventBus.emit('auth.token.created', { userId, tokenId, type, expiresAt })
eventBus.emit('auth.token.revoked', { tokenId, revokedBy, reason })
eventBus.emit('auth.token.expired', { tokenId })

// Session management
eventBus.emit('auth.session.created', { userId, sessionId })
eventBus.emit('auth.session.terminated', { sessionId, reason })
```

### 2. User Management Events
```typescript
// User lifecycle
eventBus.emit('user.created', { userId, email, roles, isFirstUser })
eventBus.emit('user.updated', { userId, changes })
eventBus.emit('user.deleted', { userId, deletedBy })
eventBus.emit('user.activated', { userId })
eventBus.emit('user.deactivated', { userId, reason })

// OAuth events
eventBus.emit('user.oauth.linked', { userId, provider, providerId })
eventBus.emit('user.oauth.unlinked', { userId, provider })
```

### 3. Permission Events
```typescript
// Role management
eventBus.emit('permission.role.created', { roleId, name })
eventBus.emit('permission.role.assigned', { userId, roleId, assignedBy })
eventBus.emit('permission.role.removed', { userId, roleId, removedBy })
eventBus.emit('permission.role.expired', { userId, roleId })

// Permission changes
eventBus.emit('permission.granted', { roleId, permissionId })
eventBus.emit('permission.revoked', { roleId, permissionId })
eventBus.emit('permission.check.denied', { userId, resource, action })
```

## Cross-Module Event Flows

### Flow 1: User Registration with Task Assignment
```
1. UserService creates user
   → emit('user.created')
   
2. PermissionsService listens
   → Assigns default role
   → emit('permission.role.assigned')
   
3. TaskModule listens  
   → Creates onboarding tasks
   → emit('task.created')
   
4. AgentModule listens
   → Assigns welcome agent
   → emit('agent.assigned')
```

### Flow 2: Permission-Based Task Access
```
1. TaskService.assignTaskToAgent()
   → Check agent permissions
   → emit('permission.check.requested')
   
2. PermissionsService listens
   → Validates permissions
   → emit('permission.check.result')
   
3. TaskService continues
   → Assigns task or denies
   → emit('task.assigned' | 'task.assignment.denied')
```

### Flow 3: Security Audit Trail
```
1. Any sensitive action
   → emit('audit.log.required')
   
2. AuditService listens
   → Logs to secure storage
   → emit('audit.logged')
   
3. AlertModule listens (future)
   → Checks for anomalies
   → emit('security.alert')
```

## Architecture Decision: Hybrid Approach

### Recommendation: Three-Tier Architecture

#### Tier 1: Direct Module APIs (Commands)
- **When**: Synchronous operations requiring immediate response
- **Examples**:
  ```typescript
  // Direct API calls
  const user = await userService.createUser(data)
  const allowed = await permissionService.checkPermission(userId, resource, action)
  const task = await taskService.assignTaskToAgent(taskId, agentId)
  ```

#### Tier 2: Event Bus (Notifications)
- **When**: Broadcasting state changes, audit logs, cross-cutting concerns
- **Examples**:
  ```typescript
  // After successful operations
  eventBus.emit('user.created', { userId })
  eventBus.emit('task.completed', { taskId, result })
  ```

#### Tier 3: Module-Specific Hooks (Subscriptions)
- **When**: Module needs to react to specific events from another module
- **Examples**:
  ```typescript
  // Module subscribes to relevant events
  authModule.on('user.created', async (data) => {
    await auditService.log('user.created', data)
  })
  ```

## Implementation Patterns

### Pattern 1: Command-Event Separation
```typescript
class TaskService {
  // Command: Direct API call
  async assignTaskToAgent(taskId: number, agentId: string): Promise<void> {
    // 1. Check permissions via API
    const canAssign = await this.permissionService.checkPermission(
      agentId, 'task', 'assign'
    )
    
    // 2. Perform assignment
    if (canAssign.allowed) {
      await this.repository.update(taskId, { assignedAgentId: agentId })
      
      // 3. Emit event for notifications
      this.eventBus.emit('task.assigned', { taskId, agentId })
    }
  }
}
```

### Pattern 2: Event Aggregation
```typescript
class SecurityAggregator {
  constructor(eventBus: IEventBus) {
    // Subscribe to all security-relevant events
    eventBus.on('auth.login.failed', this.handleFailedLogin)
    eventBus.on('permission.check.denied', this.handleDeniedAccess)
    eventBus.on('user.deactivated', this.handleUserDeactivation)
  }
  
  private handleFailedLogin = async (data) => {
    await this.checkForBruteForce(data)
  }
}
```

### Pattern 3: Module Facades
```typescript
interface IAuthModuleAPI {
  // Commands (synchronous responses)
  validateToken(token: string): Promise<TokenValidationResult>
  checkPermission(userId: string, resource: string, action: string): Promise<boolean>
  
  // Event subscriptions
  onUserAuthenticated(handler: (data: AuthEvent) => void): void
  onPermissionChanged(handler: (data: PermissionEvent) => void): void
}
```

## Benefits of Hybrid Approach

1. **Clear Semantics**
   - Commands = "do this now, I need the result"
   - Events = "this happened, anyone interested?"

2. **Performance**
   - Direct calls for critical paths
   - Async events for notifications

3. **Debugging**
   - Stack traces for commands
   - Event logs for system behavior

4. **Flexibility**
   - Modules can expose both APIs and events
   - Consumers choose appropriate mechanism

## Migration Strategy

1. **Phase 1**: Add EventBus for notifications (keep existing APIs)
2. **Phase 2**: Identify cross-cutting concerns, move to events
3. **Phase 3**: Create module facade APIs for clean interfaces
4. **Phase 4**: Deprecate tight coupling, use events where appropriate

## Conclusion

The hybrid approach provides the best balance:
- **Use direct APIs** for command/query operations
- **Use events** for notifications and audit trails
- **Keep modules loosely coupled** but with clear contracts
- **Maintain performance** for critical operations