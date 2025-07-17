# Configuration Architecture - Disk-Based Agent Management

## Overview

systemprompt-os implements a file-based configuration system where all agent configurations, personalities, and operational parameters are stored directly on disk within the project structure. This approach ensures version control, easy backup, and transparent configuration management without external dependencies.

## Core Configuration Structure

### 1. Project Directory Layout

```
/var/www/html/systemprompt-os/
├── agents/                      # Agent configurations
│   ├── templates/              # Reusable agent templates
│   │   ├── researcher.yaml
│   │   ├── assistant.yaml
│   │   └── monitor.yaml
│   ├── instances/              # Active agent instances
│   │   ├── research-001/
│   │   │   ├── config.yaml    # Main configuration
│   │   │   ├── character.yaml # Personality definition
│   │   │   ├── tools.yaml     # Available tools
│   │   │   └── state.json     # Runtime state
│   │   └── assistant-001/
│   │       └── ...
├── config/                     # System-wide configuration
│   ├── system.yaml            # Core system settings
│   ├── security.yaml          # Security policies
│   ├── resources.yaml         # Resource limits
│   └── network.yaml           # Network configuration
└── schemas/                   # Configuration schemas
    ├── agent.schema.yaml
    ├── character.schema.yaml
    └── tools.schema.yaml
```

### 2. Agent Configuration Format

#### Main Configuration (config.yaml)
```yaml
# /agents/instances/research-001/config.yaml
agent:
  id: research-001
  name: "Research Assistant"
  version: "1.0.0"
  template: researcher  # Inherits from template
  
  lifecycle:
    auto_start: true
    restart_policy: always
    max_restarts: 3
    health_check:
      interval: 60s
      timeout: 10s
      command: "/healthcheck.sh"
  
  resources:
    memory:
      limit: 2Gi
      request: 512Mi
    cpu:
      limit: 2000m
      request: 500m
    storage:
      data: 50Gi
      temp: 10Gi
  
  environment:
    LOG_LEVEL: info
    RESEARCH_DOMAINS:
      - "artificial intelligence"
      - "machine learning"
      - "robotics"
    UPDATE_FREQUENCY: daily
```

#### Character Definition (character.yaml)
```yaml
# /agents/instances/research-001/character.yaml
character:
  personality:
    traits:
      curiosity: 0.9
      thoroughness: 0.8
      skepticism: 0.6
      creativity: 0.7
    
  communication:
    style: academic
    verbosity: balanced
    formality: professional
    
    templates:
      greeting: "Hello! I'm your research assistant, ready to help explore {topic}."
      summary: "Based on my analysis of {source_count} sources, here are the key findings:"
      uncertainty: "I found conflicting information about {topic}. Let me provide multiple perspectives:"
  
  behavioral_rules:
    - always_cite_sources
    - verify_information_accuracy
    - acknowledge_limitations
    - maintain_objectivity
    
  knowledge_domains:
    primary:
      - computer_science
      - artificial_intelligence
    secondary:
      - mathematics
      - physics
    learning_enabled: true
```

#### Tools Configuration (tools.yaml)
```yaml
# /agents/instances/research-001/tools.yaml
tools:
  enabled:
    - name: web_search
      config:
        engines: [google_scholar, arxiv, pubmed]
        results_per_query: 20
        rate_limit: 60/hour
    
    - name: document_analyzer
      config:
        formats: [pdf, html, markdown, tex]
        extraction_method: neural
        summarization: true
    
    - name: knowledge_graph
      config:
        storage: neo4j_embedded
        max_nodes: 100000
        relationship_types:
          - cites
          - contradicts
          - supports
          - extends
    
    - name: citation_manager
      config:
        style: ieee
        storage: bibtex
        deduplication: true
  
  disabled:
    - name: code_executor
      reason: "Not required for research tasks"
```

### 3. Configuration Management

#### Hot Reload System
```python
class ConfigurationManager:
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.watchers = {}
        self.validators = {}
        
    def watch_config(self, agent_id: str):
        config_path = self.base_path / "agents" / "instances" / agent_id
        
        watcher = FileWatcher(config_path)
        watcher.on_change = lambda path: self.reload_config(agent_id, path)
        
        self.watchers[agent_id] = watcher
        watcher.start()
    
    def reload_config(self, agent_id: str, changed_file: Path):
        # Validate before applying
        if not self.validate_config(changed_file):
            logger.error(f"Invalid configuration in {changed_file}")
            return
        
        # Apply configuration atomically
        with self.config_lock(agent_id):
            old_config = self.get_config(agent_id)
            try:
                new_config = self.load_config(changed_file)
                self.apply_config(agent_id, new_config)
                logger.info(f"Configuration reloaded for {agent_id}")
            except Exception as e:
                self.apply_config(agent_id, old_config)
                logger.error(f"Rollback config for {agent_id}: {e}")
```

#### Schema Validation
```yaml
# /schemas/agent.schema.yaml
$schema: http://json-schema.org/draft-07/schema#
title: Agent Configuration Schema
type: object
required: [agent, resources]

properties:
  agent:
    type: object
    required: [id, name, version]
    properties:
      id:
        type: string
        pattern: "^[a-z0-9-]+$"
      name:
        type: string
        maxLength: 64
      version:
        type: string
        pattern: "^\\d+\\.\\d+\\.\\d+$"
      template:
        type: string
        enum: [researcher, assistant, monitor, developer]
  
  resources:
    type: object
    required: [memory, cpu]
    properties:
      memory:
        $ref: "#/definitions/resource_spec"
      cpu:
        $ref: "#/definitions/resource_spec"

definitions:
  resource_spec:
    type: object
    required: [limit]
    properties:
      limit:
        type: string
        pattern: "^\\d+(Mi|Gi|m)$"
      request:
        type: string
        pattern: "^\\d+(Mi|Gi|m)$"
```

### 4. Template System

#### Base Templates
```yaml
# /agents/templates/researcher.yaml
template:
  name: researcher
  description: "Base template for research-focused agents"
  
  defaults:
    character:
      personality:
        traits:
          curiosity: 0.8
          analytical: 0.9
      communication:
        style: academic
    
    tools:
      required:
        - web_search
        - document_analyzer
      optional:
        - knowledge_graph
        - citation_manager
    
    resources:
      memory:
        limit: 2Gi
        request: 1Gi
      cpu:
        limit: 1000m
        request: 500m
```

#### Template Inheritance
```python
class TemplateEngine:
    def create_agent_from_template(self, template_name: str, overrides: dict):
        # Load base template
        template = self.load_template(template_name)
        
        # Deep merge with overrides
        config = self.deep_merge(template.defaults, overrides)
        
        # Validate final configuration
        if not self.validate_against_schema(config):
            raise ValueError("Invalid configuration after merge")
        
        # Generate unique instance ID
        instance_id = f"{template_name}-{uuid.uuid4().hex[:8]}"
        
        # Create instance directory
        instance_path = self.base_path / "agents" / "instances" / instance_id
        instance_path.mkdir(parents=True)
        
        # Write configuration files
        self.write_yaml(instance_path / "config.yaml", config)
        
        return instance_id
```

### 5. Environment-Specific Configuration

#### Development Environment
```yaml
# /config/environments/development.yaml
environment: development

overrides:
  system:
    debug: true
    log_level: debug
    hot_reload: true
  
  security:
    strict_mode: false
    allow_insecure: true
  
  resources:
    enforce_limits: false
```

#### Production Environment
```yaml
# /config/environments/production.yaml
environment: production

overrides:
  system:
    debug: false
    log_level: warning
    hot_reload: false
  
  security:
    strict_mode: true
    require_encryption: true
    audit_all: true
  
  resources:
    enforce_limits: true
    auto_scaling: true
```

### 6. Configuration CLI Tools

#### Agent Management
```bash
# Create new agent from template
systemprompt-os agent create \
  --template researcher \
  --name "AI Ethics Researcher" \
  --override character.knowledge_domains.primary=ethics

# List all agents
systemprompt-os agent list

# Update agent configuration
systemprompt-os agent update research-001 \
  --set resources.memory.limit=4Gi

# Validate configuration
systemprompt-os config validate \
  --agent research-001
```

#### Bulk Operations
```python
#!/usr/bin/env python3
# bulk_config_update.py

import yaml
from pathlib import Path

def update_all_agents(update_func):
    agents_dir = Path("/var/www/html/systemprompt-os/agents/instances")
    
    for agent_dir in agents_dir.iterdir():
        if agent_dir.is_dir():
            config_file = agent_dir / "config.yaml"
            if config_file.exists():
                # Load current config
                with open(config_file) as f:
                    config = yaml.safe_load(f)
                
                # Apply update
                updated_config = update_func(config)
                
                # Write back
                with open(config_file, 'w') as f:
                    yaml.dump(updated_config, f)

# Example: Update all agents to use new log level
update_all_agents(
    lambda c: {**c, 'environment': {**c.get('environment', {}), 'LOG_LEVEL': 'info'}}
)
```

### 7. Version Control Integration

#### Git Hooks
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Validate all agent configurations before commit
for config in agents/instances/*/config.yaml; do
    if ! systemprompt-os config validate --file "$config"; then
        echo "Invalid configuration: $config"
        exit 1
    fi
done

# Check for secrets in configuration
if grep -r "password\|secret\|key" agents/instances/; then
    echo "Potential secrets found in configuration!"
    exit 1
fi
```

#### Configuration History
```python
class ConfigHistory:
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.history_dir = Path(f"agents/instances/{agent_id}/.history")
        self.history_dir.mkdir(exist_ok=True)
    
    def save_version(self, config: dict, message: str):
        timestamp = datetime.now().isoformat()
        version_file = self.history_dir / f"{timestamp}.yaml"
        
        with open(version_file, 'w') as f:
            yaml.dump({
                'timestamp': timestamp,
                'message': message,
                'config': config
            }, f)
    
    def rollback(self, version: str):
        version_file = self.history_dir / f"{version}.yaml"
        with open(version_file) as f:
            historical = yaml.safe_load(f)
        
        # Apply historical configuration
        current_config = self.agent_id / "config.yaml"
        with open(current_config, 'w') as f:
            yaml.dump(historical['config'], f)
```

### 8. Dynamic Configuration

#### Feature Flags
```yaml
# /config/features.yaml
features:
  experimental:
    neural_memory: false
    quantum_processing: false
    distributed_consciousness: false
  
  beta:
    advanced_reasoning: true
    multi_modal_input: true
  
  stable:
    web_search: true
    file_operations: true
    api_integration: true
```

#### A/B Testing
```python
class ConfigurationABTest:
    def get_config_variant(self, agent_id: str, feature: str):
        # Deterministic assignment based on agent ID
        variant = hash(f"{agent_id}-{feature}") % 100
        
        if variant < 10:  # 10% get experimental
            return self.load_variant(feature, "experimental")
        elif variant < 30:  # 20% get variant A
            return self.load_variant(feature, "variant_a")
        else:  # 70% get control
            return self.load_variant(feature, "control")
```

## Configuration Best Practices

### 1. Security
- Never store secrets in configuration files
- Use environment variables for sensitive data
- Encrypt configuration files at rest
- Implement configuration access audit logs

### 2. Maintainability
- Use descriptive configuration keys
- Document all configuration options
- Provide sensible defaults
- Version configuration schemas

### 3. Performance
- Cache parsed configurations
- Implement lazy loading for large configs
- Use configuration fragments for modularity
- Monitor configuration reload impact

### 4. Reliability
- Validate configurations before applying
- Implement configuration rollback
- Test configuration changes in staging
- Monitor configuration drift

## Future Enhancements

1. **Configuration as Code**: Terraform-like declarative management
2. **Distributed Configuration**: Consensus-based configuration sync
3. **AI-Optimized Configs**: ML-based configuration tuning
4. **Configuration Marketplace**: Share and discover agent configurations
5. **Visual Configuration**: Web-based configuration builder