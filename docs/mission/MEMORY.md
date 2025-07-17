# Memory Architecture - On-Device Cognitive Storage

## Overview

The systemprompt-os memory system implements a fully on-device, hierarchical storage architecture that mirrors human cognitive processes. All memory operations, storage, and retrieval happen locally on your hardware, ensuring complete data sovereignty and privacy.

## Core Principles

### 1. Device-First Storage
- **No Cloud Dependencies**: All memory persists directly on the host device's filesystem
- **Local Database**: SQLite for structured memory with full-text search capabilities
- **File-Based Archives**: Long-term memory stored as compressed JSON/MessagePack files
- **Memory Mapped Files**: High-performance access to frequently used memory segments

### 2. Hierarchical Memory Types

#### Working Memory (Hot Storage)
- **Location**: `/var/lib/systemprompt-os/agents/{agent-id}/memory/working/`
- **Format**: In-memory Redis instance with local persistence
- **Capacity**: Configurable based on device RAM (default: 256MB per agent)
- **Retention**: Last 24 hours of active context
- **Access Pattern**: Sub-millisecond retrieval for active task execution

```yaml
working_memory:
  type: redis
  persistence: AOF
  max_memory: 256mb
  eviction_policy: allkeys-lru
  snapshot_interval: 5m
```

#### Episodic Memory (Warm Storage)
- **Location**: `/var/lib/systemprompt-os/agents/{agent-id}/memory/episodic/`
- **Format**: Time-series database (InfluxDB or TimescaleDB)
- **Structure**: Chronological event streams with metadata
- **Retention**: Configurable (default: 30 days active, then compressed)
- **Indexing**: Temporal indices for rapid time-range queries

```yaml
episodic_memory:
  type: timeseries
  retention:
    hot: 30d
    warm: 90d
    cold: 365d
  compression:
    algorithm: zstd
    level: 3
```

#### Semantic Memory (Knowledge Graph)
- **Location**: `/var/lib/systemprompt-os/agents/{agent-id}/memory/semantic/`
- **Format**: Embedded graph database (DuckDB with graph extensions)
- **Structure**: Entity-relationship graphs with weighted edges
- **Updates**: Incremental learning through pattern recognition
- **Query**: SPARQL-like interface for complex relationship queries

```yaml
semantic_memory:
  type: graph
  storage: duckdb
  index_type: HNSW
  embedding_dim: 768
  similarity_threshold: 0.85
```

#### Procedural Memory (Skill Storage)
- **Location**: `/var/lib/systemprompt-os/agents/{agent-id}/memory/procedural/`
- **Format**: Versioned workflow definitions (YAML/JSON)
- **Learning**: Reinforcement through successful execution tracking
- **Optimization**: Automatic workflow refinement based on outcomes

### 3. Memory Management Strategies

#### Garbage Collection
```bash
# Automated memory cleanup via systemd timer
/etc/systemd/system/systemprompt-memory-gc.timer

[Timer]
OnCalendar=daily
Persistent=true

[Service]
ExecStart=/usr/bin/systemprompt-os memory gc --compress --archive
```

#### Memory Pressure Handling
- **Low Memory**: Automatic migration of old episodic memories to compressed storage
- **Critical Memory**: Suspend non-essential agents, preserve core agent memory
- **OOM Prevention**: Pre-emptive memory offloading based on usage patterns

### 4. Persistence Mechanisms

#### Snapshot Strategy
```yaml
persistence:
  snapshot:
    interval: 1h
    format: messagepack
    compression: lz4
    verify: crc32
  incremental:
    interval: 5m
    format: append-only-log
```

#### Crash Recovery
- **Write-Ahead Logging**: All memory operations logged before execution
- **Atomic Commits**: Memory updates use ACID transactions
- **Rollback Support**: Point-in-time recovery from any snapshot

### 5. Privacy & Encryption

#### At-Rest Encryption
```yaml
encryption:
  algorithm: AES-256-GCM
  key_derivation: Argon2id
  key_storage: TPM 2.0 | software-keyring
  per_agent_keys: true
```

#### Memory Isolation
- **Process Separation**: Each agent runs in isolated memory space
- **Namespace Isolation**: Linux namespaces prevent cross-agent access
- **Secure Deletion**: Cryptographic erasure of retired memories

## Implementation Example

```python
class OnDeviceMemory:
    def __init__(self, agent_id: str, config: MemoryConfig):
        self.base_path = f"/var/lib/systemprompt-os/agents/{agent_id}/memory"
        self.working = RedisMemory(f"{self.base_path}/working")
        self.episodic = TimeSeriesMemory(f"{self.base_path}/episodic")
        self.semantic = GraphMemory(f"{self.base_path}/semantic")
        self.procedural = SkillMemory(f"{self.base_path}/procedural")
        
    def remember(self, experience: Experience):
        # Store in working memory immediately
        self.working.add(experience)
        
        # Async pipeline to other memory types
        if experience.is_significant():
            self.episodic.record(experience)
            self.semantic.extract_entities(experience)
            self.procedural.learn_from(experience)
```

## Storage Requirements

### Minimum Requirements
- **Storage**: 10GB free space per agent
- **RAM**: 512MB minimum, 2GB recommended per agent
- **CPU**: Background indexing requires ~5% CPU

### Scaling Considerations
- **Linear Growth**: Memory grows ~100MB/day per active agent
- **Compression Ratio**: 10:1 for archived memories
- **Index Size**: ~10% of raw memory size

## Monitoring & Observability

```yaml
metrics:
  memory_usage:
    working: prometheus_gauge
    episodic: prometheus_histogram
    semantic: prometheus_summary
  performance:
    query_latency: prometheus_histogram
    write_throughput: prometheus_counter
  health:
    gc_runs: prometheus_counter
    compression_ratio: prometheus_gauge
```

## Backup & Recovery

### Automated Backups
```bash
# Daily backup via cron
0 3 * * * /usr/bin/systemprompt-os memory backup \
  --destination /backup/systemprompt-os \
  --compress --encrypt \
  --retention 7d
```

### Manual Recovery
```bash
# Restore agent memory from backup
systemprompt-os memory restore \
  --agent-id assistant-001 \
  --from /backup/systemprompt-os/2024-01-15 \
  --verify
```

## Future Enhancements

1. **Federated Memory**: Optional peer-to-peer memory sharing between trusted agents
2. **Hardware Acceleration**: GPU-accelerated similarity search for semantic memory
3. **Neuromorphic Storage**: Integration with emerging memory technologies
4. **Quantum-Resistant Encryption**: Post-quantum cryptography for long-term security