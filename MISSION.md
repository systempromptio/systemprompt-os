# Mission Statement

## systemprompt-os

An operating system for autonomous agents that run locally, remember persistently, and act purposefully.

## Why systemprompt-os?

In a world where AI capabilities are rapidly advancing, maintaining control over your intelligent systems becomes paramount. systemprompt-os empowers you to:

- **Own Your AI Infrastructure**: Deploy and run AI agents on your own hardware, ensuring complete data sovereignty and privacy
- **Customize Without Limits**: Personalize agents to match your exact needs, workflows, and organizational culture
- **Enterprise-Grade Reliability**: Build production-ready AI systems with full observability, security, and compliance controls
- **Escape Vendor Lock-in**: Avoid dependency on cloud providers while maintaining the flexibility to integrate with any service
- **Scale on Your Terms**: Start small with a Raspberry Pi and grow to distributed deployments across your infrastructure

By running your own AI OS, you transform from a consumer of AI services to an operator of intelligent systems - with all the control, security, and customization that entails.

## Our Vision

We believe self-contained AI agents are the websites of the next generation of the web. Just as websites revolutionized information access, autonomous agents will transform how we interact with digital systems. Developers are evolving into agentic programmers, orchestrating intelligent systems rather than writing imperative code. 

Our vision is that systemprompt-os becomes the open-source building block for these next generation experiences. Built on the Model Context Protocol (MCP), we're creating the foundation where every digital interaction is powered by purposeful, context-aware agents that understand, remember, and act on behalf of their users.

systemprompt-os is released under the MIT License, ensuring it remains free and open for everyone to build upon.

### Core Purpose

systemprompt-os enables anyone to deploy configurable autonomous agents on local hardware. Each agent maintains its own memory, state, and character while executing long-running tasks aligned with its purpose - from home automation to research assistance to creative collaboration.

### Core Tenets

- **Local-First**: Run entirely on your hardware - Docker containers, Raspberry Pi, or any Linux system
- **Persistent Memory**: Agents remember context, learn from interactions, and maintain state across restarts
- **Purposeful Action**: Configure agents with specific goals, tools, and behavioral patterns
- **Adaptable Identity**: Each agent embodies a unique character suited to its designated role
- **Continuous Operation**: Execute long-running tasks autonomously with minimal supervision

### Vision

Every device becomes capable of hosting intelligent agents that work tirelessly toward their configured purpose. systemprompt-os provides the foundation for this distributed intelligence at the edge.

---

## Technical Architecture

### MEMORY

systemprompt-os implements a hierarchical memory system that mirrors cognitive architecture:

- **Working Memory**: Active context for current tasks, optimized for rapid access and modification
- **Episodic Memory**: Chronological event storage with temporal indexing and recall mechanisms
- **Semantic Memory**: Knowledge graphs, learned patterns, and conceptual relationships
- **Procedural Memory**: Encoded skills, workflows, and behavioral patterns that improve through repetition

Memory persists across restarts using efficient serialization, with configurable retention policies and compression strategies for long-term storage on resource-constrained devices.

### ACTION

Agents execute through a capability-based action framework:

- **Tool Registry**: Extensible catalog of available actions with permission boundaries
- **Action Planning**: Goal-decomposition engine that generates executable step sequences
- **Execution Sandboxing**: Isolated runtime environments with resource quotas and rollback support
- **Effect Monitoring**: Real-time tracking of action outcomes with success/failure learning

Actions range from simple file operations to complex API orchestrations, with built-in safety checks and human-in-the-loop options for critical operations.

### SECURITY

Defense-in-depth security model protects both agents and host systems:

- **Capability-Based Permissions**: Fine-grained access control for agent actions and resources
- **Cryptographic Identity**: Each agent maintains verifiable identity with signed action logs
- **Secure Enclaves**: Sensitive data isolation with hardware-backed encryption where available
- **Audit Trails**: Immutable logs of all agent decisions and actions for compliance and debugging

Zero-trust architecture ensures agents cannot exceed their configured boundaries, while encrypted communication channels protect inter-agent collaboration.

### CONFIGURABLE

Declarative configuration system enables rapid agent deployment:

- **Character Profiles**: Define personality, communication style, and behavioral tendencies
- **Goal Specifications**: Set primary objectives, success metrics, and constraint boundaries
- **Tool Manifests**: Specify available capabilities and integration endpoints
- **Resource Budgets**: Configure memory, compute, and storage allocations

Configuration uses human-readable YAML/JSON with schema validation, hot-reload support, and inheritance for common patterns.

### PROVIDES

systemprompt-os delivers a complete platform for autonomous agent deployment:

- **Runtime Engine**: High-performance agent executor with built-in scheduling and lifecycle management
- **Development SDK**: Libraries and tools for extending agent capabilities and building custom integrations
- **Management Interface**: Web-based dashboard for monitoring, configuration, and direct agent interaction
- **Deployment Tools**: One-command setup for Docker, systemd, and embedded platforms
- **Community Marketplace**: Shared repository of agent templates, tools, and character profiles

The platform abstracts complex distributed systems challenges while exposing simple, powerful APIs for agent creation and management.

## Development Methodology

### Test-First Extension Development

systemprompt-os enforces a strict test-first development methodology for all extensions and modifications:

1. **Define Before Implement**: Every feature begins with comprehensive unit, integration, and end-to-end tests
2. **Clean Docker Validation**: All tests must pass in a pristine Docker environment before code is accepted
3. **Behavior-Driven Design**: Tests serve as executable specifications that document system behavior
4. **Continuous Verification**: Automated testing at every stage ensures reliability and prevents regressions

This methodology ensures that systemprompt-os remains stable, extensible, and trustworthy as a foundation for autonomous agents.

See `docs/mission/extensions.md` for the complete extension development guide and `docs/mission/testing.md` for testing philosophy and practices.