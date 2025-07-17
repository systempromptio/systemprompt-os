# Action Framework - Device-Based Autonomous Execution

## Overview

The systemprompt-os action system enables agents to execute long-running tasks directly on device hardware using native scheduling mechanisms like cron, systemd timers, and event-driven triggers. All actions run locally with full hardware access while maintaining security boundaries.

## Core Architecture

### 1. Scheduling Engine

#### Cron-Based Execution
```bash
# Agent task scheduling via crontab
/var/spool/cron/systemprompt-os/{agent-id}

# Example: Research agent checking for updates every hour
0 * * * * /usr/bin/systemprompt-os action execute \
  --agent research-001 \
  --task "check_arxiv_papers" \
  --timeout 3600
```

#### Systemd Timers for Complex Schedules
```ini
# /etc/systemd/system/systemprompt-agent-{agent-id}.timer
[Unit]
Description=Agent action scheduler for {agent-id}

[Timer]
OnBootSec=5min
OnUnitActiveSec=30min
RandomizedDelaySec=5min
Persistent=true

[Install]
WantedBy=timers.target
```

#### Event-Driven Triggers
```yaml
triggers:
  filesystem:
    - path: /data/incoming
      events: [create, modify]
      action: process_new_file
  network:
    - port: 8080
      protocol: webhook
      action: handle_webhook
  hardware:
    - device: /dev/ttyUSB0
      event: data_available
      action: read_sensor_data
```

### 2. Action Execution Pipeline

#### Task Queue Management
```python
class DeviceActionQueue:
    def __init__(self, agent_id: str):
        self.queue_path = f"/var/lib/systemprompt-os/agents/{agent_id}/actions/queue"
        self.active_path = f"/var/lib/systemprompt-os/agents/{agent_id}/actions/active"
        self.completed_path = f"/var/lib/systemprompt-os/agents/{agent_id}/actions/completed"
        
    def schedule(self, action: Action):
        # Write action to queue with priority
        action_file = f"{self.queue_path}/{action.priority}_{action.id}.json"
        atomic_write(action_file, action.serialize())
        
        # Signal dispatcher via named pipe
        os.write(self.dispatcher_pipe, b'1')
```

#### Long-Running Task Support
```yaml
long_tasks:
  execution:
    mode: detached
    supervisor: systemd
    restart_policy: on-failure
    max_retries: 3
  monitoring:
    heartbeat_interval: 60s
    progress_reporting: enabled
    resource_tracking: true
  interruption:
    save_state: true
    checkpoint_interval: 5m
    resume_capability: automatic
```

### 3. Resource Management

#### CPU & Memory Limits
```ini
# Systemd resource control for agent actions
[Service]
CPUQuota=50%
MemoryLimit=2G
IOWeight=50
TasksMax=100

# Nice level for background processing
Nice=10
```

#### Storage Quotas
```yaml
storage:
  quotas:
    temp_space: 10GB
    output_space: 50GB
    log_space: 1GB
  cleanup:
    temp_files: 24h
    completed_actions: 7d
    failed_actions: 30d
```

### 4. Action Types & Capabilities

#### System Actions
```python
@action_type("system")
class SystemAction:
    capabilities = [
        "file_operations",      # Read, write, delete files
        "process_management",   # Start, stop, monitor processes
        "network_requests",     # HTTP/HTTPS requests
        "shell_execution",      # Sandboxed shell commands
        "hardware_access"       # GPIO, serial, USB devices
    ]
```

#### Data Processing Actions
```python
@action_type("data_processing")
class DataAction:
    capabilities = [
        "batch_processing",     # Large dataset operations
        "stream_processing",    # Real-time data streams
        "ml_inference",         # On-device ML models
        "data_transformation",  # ETL operations
        "compression"           # Data compression/decompression
    ]
```

#### Integration Actions
```python
@action_type("integration")
class IntegrationAction:
    capabilities = [
        "api_calls",           # External API integration
        "database_ops",        # Local database operations
        "message_queues",      # MQTT, AMQP, etc.
        "webhook_handling",    # Incoming webhook processing
        "protocol_adapters"    # Custom protocol support
    ]
```

### 5. Action Lifecycle

#### Planning Phase
```yaml
action_planning:
  goal_decomposition:
    method: hierarchical_task_network
    max_depth: 5
    planning_timeout: 30s
  resource_estimation:
    cpu_predictor: historical_average
    memory_predictor: peak_usage_model
    time_predictor: ml_based
  dependency_resolution:
    check_prerequisites: true
    install_missing: prompt_user
```

#### Execution Phase
```python
class ActionExecutor:
    def execute(self, action: Action) -> ActionResult:
        # Pre-execution checks
        self.verify_permissions(action)
        self.allocate_resources(action)
        
        # Create isolated execution environment
        with self.create_sandbox(action) as sandbox:
            # Execute with monitoring
            process = sandbox.run(
                command=action.command,
                timeout=action.timeout,
                capture_output=True
            )
            
            # Stream output to action log
            for line in process.stdout:
                self.log_output(action.id, line)
                self.check_cancel_request(action.id)
            
        return ActionResult(
            status=process.returncode,
            output=process.stdout,
            metrics=sandbox.get_metrics()
        )
```

#### Post-Execution Phase
```yaml
post_execution:
  result_processing:
    - store_output
    - update_agent_memory
    - trigger_dependent_actions
  cleanup:
    - remove_temp_files
    - release_resources
    - archive_logs
  learning:
    - analyze_performance
    - update_execution_model
    - refine_future_plans
```

### 6. Scheduling Strategies

#### Time-Based Scheduling
```cron
# Minute Hour Day Month Weekday Command
*/5 * * * * systemprompt-os action run --agent monitor-001 --task health_check
0 2 * * * systemprompt-os action run --agent backup-001 --task daily_backup
0 0 * * 0 systemprompt-os action run --agent maintenance-001 --task weekly_cleanup
```

#### Condition-Based Scheduling
```yaml
conditions:
  disk_space_low:
    trigger: disk_usage > 90%
    action: cleanup_old_files
    cooldown: 1h
  
  high_cpu_temp:
    trigger: cpu_temp > 80C
    action: throttle_agents
    cooldown: 5m
  
  network_available:
    trigger: internet_connected
    action: sync_remote_data
    cooldown: 30m
```

#### Adaptive Scheduling
```python
class AdaptiveScheduler:
    def optimize_schedule(self, agent_id: str):
        # Analyze historical execution patterns
        patterns = self.analyze_execution_history(agent_id)
        
        # Identify optimal execution windows
        windows = self.find_low_usage_periods()
        
        # Reschedule tasks for efficiency
        for task in self.get_scheduled_tasks(agent_id):
            optimal_time = self.calculate_optimal_time(
                task, patterns, windows
            )
            self.reschedule_task(task, optimal_time)
```

### 7. Error Handling & Recovery

#### Failure Detection
```yaml
failure_detection:
  methods:
    - exit_code_monitoring
    - output_pattern_matching
    - resource_exhaustion
    - timeout_detection
    - heartbeat_missing
```

#### Recovery Strategies
```python
@recovery_strategy
def exponential_backoff_retry(action: Action, failure: Failure):
    retry_count = failure.retry_count
    wait_time = min(300, 2 ** retry_count)  # Max 5 minutes
    
    logger.info(f"Retrying action {action.id} in {wait_time}s")
    time.sleep(wait_time)
    
    # Checkpoint recovery if available
    if action.has_checkpoint():
        return action.resume_from_checkpoint()
    else:
        return action.restart()
```

### 8. Monitoring & Observability

#### Real-time Monitoring
```bash
# Monitor all active agent actions
systemprompt-os action monitor --live

# Watch specific agent
systemprompt-os action watch --agent research-001

# Resource usage dashboard
systemprompt-os action resources --format table
```

#### Metrics Collection
```yaml
metrics:
  action_metrics:
    - execution_time
    - cpu_usage
    - memory_peak
    - io_operations
    - network_bytes
  success_metrics:
    - completion_rate
    - retry_count
    - error_frequency
    - performance_trend
```

### 9. Security Boundaries

#### Capability-Based Permissions
```yaml
capabilities:
  research_agent:
    allowed:
      - read: ["/data/research", "/data/papers"]
      - write: ["/data/research/output"]
      - network: ["https://arxiv.org", "https://scholar.google.com"]
      - execute: ["python3", "jupyter"]
    denied:
      - write: ["/etc", "/usr", "/boot"]
      - network: ["*:22", "*:3389"]  # No SSH/RDP
      - execute: ["sudo", "su", "passwd"]
```

#### Sandboxing
```python
class ActionSandbox:
    def __init__(self, action: Action):
        self.namespaces = {
            "mount": True,    # Isolated filesystem
            "pid": True,      # Separate process tree
            "net": False,     # Shared network (configurable)
            "ipc": True,      # Isolated IPC
            "uts": True,      # Separate hostname
        }
        self.cgroups = {
            "memory": action.memory_limit,
            "cpu": action.cpu_quota,
            "blkio": action.io_weight
        }
```

## Example Implementation

### Research Agent with Long-Running Tasks
```python
# Agent configuration
agent_config = {
    "id": "research-001",
    "actions": {
        "daily_arxiv_scan": {
            "schedule": "0 9 * * *",
            "timeout": "2h",
            "steps": [
                "fetch_new_papers",
                "extract_abstracts",
                "classify_relevance",
                "summarize_findings",
                "update_knowledge_base"
            ]
        }
    }
}

# Cron entry generated
# 0 9 * * * /usr/bin/systemprompt-os action execute \
#   --agent research-001 \
#   --task daily_arxiv_scan \
#   --checkpoint-enabled \
#   --notify-on-completion
```

### IoT Sensor Monitor
```python
# Continuous monitoring action
@continuous_action(interval="5s")
def monitor_temperature_sensor(context):
    reading = read_sensor("/dev/ttyUSB0")
    
    if reading.temperature > context.threshold:
        trigger_action("cooling_system_activate")
        send_alert(f"High temperature: {reading.temperature}°C")
    
    context.memory.record_reading(reading)
    
    if len(context.memory.recent_readings) > 1000:
        trigger_action("compress_historical_data")
```

## Future Enhancements

1. **Distributed Actions**: Coordinate actions across multiple devices
2. **Hardware Acceleration**: GPU/TPU support for ML actions
3. **Real-time Scheduling**: Microsecond-precision action timing
4. **Quantum Integration**: Support for quantum computing actions