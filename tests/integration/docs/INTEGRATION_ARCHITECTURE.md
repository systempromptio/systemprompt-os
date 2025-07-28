# Agent-Task Integration Architecture

## Current Issues
1. Agent module contains task management logic (createTask, updateTaskStatus)
2. No clear separation of concerns between modules
3. Missing bidirectional communication interface

## Proposed Architecture

### Task Module Responsibilities
- Create, update, delete tasks
- Manage task lifecycle (pending → running → completed/failed)
- Task queue management
- Task assignment logic
- Emit task events

### Agent Module Responsibilities  
- Create, update, delete agents
- Manage agent lifecycle (stopped → active → busy)
- Monitor agent health
- Subscribe to task events
- Report agent availability

### Integration Points

#### 1. Task Assignment Flow
```
TaskModule.assignTask(taskId, agentId) 
  → Validates agent exists (via AgentModule API)
  → Updates task with agentId
  → Emits 'task.assigned' event
  
AgentModule (subscriber)
  → Receives 'task.assigned' event
  → Updates agent statistics
```

#### 2. Task Execution Flow
```
AgentModule.executeTask(agentId, taskId)
  → Retrieves task details (via TaskModule API)
  → Executes task logic
  → Reports progress/completion (via TaskModule API)
  
TaskModule.updateTaskStatus(taskId, status, result)
  → Updates task state
  → Emits 'task.completed' event
```

### Required Changes

1. **Remove task methods from AgentRepository**
   - Remove createTask()
   - Remove updateTaskStatus()
   - Remove getAgentTasks()

2. **Add to TaskService**
   - assignTaskToAgent(taskId, agentId)
   - getTasksByAgent(agentId) 
   - updateTaskProgress(taskId, progress)

3. **Add Event System**
   - TaskModule emits: task.created, task.assigned, task.started, task.completed, task.failed
   - AgentModule subscribes to relevant events

4. **Add Module APIs**
   - TaskModule exposes ITaskAPI for other modules
   - AgentModule exposes IAgentAPI for other modules

5. **Add Coordination Service** (optional)
   - Orchestrates agent-task matching
   - Implements assignment algorithms
   - Handles retries and failures