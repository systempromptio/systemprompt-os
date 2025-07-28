# Missing Functionality for Proper Module Separation

## Current State Analysis

### ❌ What's Wrong
1. **Agent module manages task state** - AgentRepository has `createTask()`, `updateTaskStatus()`, `getAgentTasks()`
2. **No task assignment in Task module** - Tasks can't be assigned to agents through TaskService
3. **No event system** - Modules communicate through direct method calls
4. **Missing orchestration** - No coordinator between modules

### ✅ What We Have
- Task module can create and update tasks
- Agent module can create and manage agents
- Both modules have repositories and services

## Required Functionality

### 1. Task Module Enhancements
```typescript
// Add to TaskService
assignTaskToAgent(taskId: number, agentId: string): Promise<void>
unassignTask(taskId: number): Promise<void>
getTasksByAgent(agentId: string): Promise<ITask[]>
getTasksByStatus(status: TaskStatusEnum): Promise<ITask[]>
updateTaskProgress(taskId: number, progress: number): Promise<void>
```

### 2. Remove from Agent Module
```typescript
// Remove from AgentRepository
- createTask()
- updateTaskStatus()
- getAgentTasks()

// Remove from AgentService  
- assignTask() // Move logic to TaskService
```

### 3. Add Event System
```typescript
// Core event bus
interface IEventBus {
  emit(event: string, data: any): void
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
}

// Task events
- task.created
- task.assigned  
- task.started
- task.completed
- task.failed

// Agent events
- agent.created
- agent.available
- agent.busy
- agent.stopped
```

### 4. Add Module APIs
```typescript
// Task Module API
interface ITaskModuleAPI {
  createTask(task: Partial<ITask>): Promise<ITask>
  getTask(taskId: number): Promise<ITask | null>
  updateTask(taskId: number, updates: Partial<ITask>): Promise<void>
  assignToAgent(taskId: number, agentId: string): Promise<void>
}

// Agent Module API  
interface IAgentModuleAPI {
  createAgent(agent: Partial<IAgent>): Promise<IAgent>
  getAgent(agentId: string): Promise<IAgent | null>
  updateAgent(agentId: string, updates: Partial<IAgent>): Promise<void>
  isAgentAvailable(agentId: string): Promise<boolean>
}
```

### 5. Add Orchestration Layer
```typescript
class TaskOrchestrator {
  // Coordinates between modules
  // Implements assignment algorithms
  // Handles retries and failures
  // No direct state management
}
```

## Implementation Steps

1. **Phase 1: Add Missing Methods**
   - Add task assignment methods to TaskService
   - Add agent query methods to TaskService

2. **Phase 2: Implement Event System**
   - Create EventBus service
   - Add event emissions to both modules
   - Subscribe to relevant events

3. **Phase 3: Remove Coupling**
   - Remove task methods from AgentRepository
   - Update AgentService to use TaskModule API

4. **Phase 4: Add Orchestration**
   - Create TaskOrchestrator service
   - Implement assignment algorithms
   - Handle edge cases

## Benefits

1. **Clear Separation** - Each module manages only its own state
2. **Loose Coupling** - Modules communicate through events/APIs
3. **Testability** - Each module can be tested independently  
4. **Flexibility** - Easy to add new assignment strategies
5. **Scalability** - Can distribute modules to different services