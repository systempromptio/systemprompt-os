# Security Architecture - Zero Trust with Pomerium

## Overview

systemprompt-os implements a comprehensive zero-trust security model using Pomerium as the identity-aware access proxy. Every agent interaction, API call, and resource access is authenticated, authorized, and encrypted, with no implicit trust based on network location or previous authentication.

## Core Security Principles

### 1. Zero Trust Foundation

#### Never Trust, Always Verify
```yaml
security_policy:
  default_action: deny
  authentication:
    required: always
    methods: [oidc, mtls, api_key]
  authorization:
    required: per_request
    cache_ttl: 0  # No authorization caching
  encryption:
    in_transit: mandatory
    at_rest: mandatory
```

#### Pomerium Integration
```yaml
# /etc/systemprompt-os/pomerium.yaml
authenticate_service_url: https://auth.systemprompt.local
authorize_service_url: https://auth.systemprompt.local/authorize

routes:
  - from: https://agent-api.systemprompt.local
    to: http://localhost:8080
    policy:
      - allow:
          and:
            - domain:
                is: systemprompt.local
            - claim:
                is: agent-operator
    cors_allow_preflight: true
    timeout: 30s

  - from: https://agent-memory.systemprompt.local
    to: http://localhost:8081
    policy:
      - allow:
          and:
            - claim:
                agent_id: {subject}
            - action:
                in: [read, write]
    enable_google_cloud_serverless_authentication: false
```

### 2. Identity & Authentication

#### Agent Identity
```yaml
agent_identity:
  certificate:
    subject: /CN=agent-{id}/O=systemprompt-os
    key_type: ECDSA_P384
    validity: 90d
    storage: TPM 2.0 | HSM | encrypted_file
  
  attestation:
    method: measured_boot
    pcr_banks: [sha256, sha384]
    quote_signing: TPM_endorsement_key
```

#### Multi-Factor Authentication
```python
class AgentAuthenticator:
    def authenticate(self, request: AuthRequest) -> AuthResult:
        # Factor 1: Certificate validation
        if not self.validate_certificate(request.client_cert):
            return AuthResult.denied("Invalid certificate")
        
        # Factor 2: Hardware attestation
        if not self.verify_tpm_quote(request.tpm_quote):
            return AuthResult.denied("Hardware attestation failed")
        
        # Factor 3: Behavioral analysis
        if not self.verify_behavior_pattern(request.agent_id):
            return AuthResult.mfa_required()
        
        return AuthResult.authenticated(
            agent_id=request.agent_id,
            session_id=self.create_session()
        )
```

### 3. Authorization & Access Control

#### Policy Engine
```yaml
# Pomerium policy with OPA integration
policy_engine:
  type: open_policy_agent
  endpoint: http://localhost:8181
  decision_logging: true
  
  policies:
    - name: agent_memory_access
      rule: |
        allow {
          input.agent_id == input.resource.owner
          input.action in ["read", "write"]
          time.now() - input.resource.created < 86400
        }
    
    - name: cross_agent_communication
      rule: |
        allow {
          input.source_agent.trust_level >= 3
          input.target_agent.accepts_external
          input.message.type in ["query", "notify"]
        }
```

#### Capability-Based Access Control
```python
@dataclass
class AgentCapability:
    resource: str
    actions: List[str]
    constraints: Dict[str, Any]
    expiry: datetime
    
class CapabilityManager:
    def grant_capability(self, agent_id: str, capability: AgentCapability):
        # Sign capability with system key
        signed_cap = self.sign_capability(capability)
        
        # Store in distributed ledger
        self.capability_ledger.append(
            agent_id=agent_id,
            capability=signed_cap,
            granted_by=self.current_admin,
            timestamp=time.now()
        )
        
        # Update Pomerium policy
        self.update_pomerium_policy(agent_id, capability)
```

### 4. Secure Communication

#### mTLS Everywhere
```nginx
# Nginx configuration for agent API
server {
    listen 443 ssl http2;
    server_name agent-api.systemprompt.local;
    
    # Mutual TLS
    ssl_client_certificate /etc/systemprompt-os/ca/agents-ca.crt;
    ssl_verify_client on;
    ssl_verify_depth 2;
    
    # Strong cipher suites only
    ssl_protocols TLSv1.3;
    ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256';
    
    # Pass client cert to backend
    proxy_set_header X-Client-Cert $ssl_client_escaped_cert;
    proxy_set_header X-Client-Verify $ssl_client_verify;
}
```

#### End-to-End Encryption
```python
class SecureChannel:
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.session_key = self.negotiate_session_key()
        
    def send_message(self, recipient: str, message: bytes):
        # Encrypt with recipient's public key
        recipient_key = self.get_agent_public_key(recipient)
        encrypted = self.hybrid_encrypt(message, recipient_key)
        
        # Sign with sender's private key
        signature = self.sign_message(encrypted)
        
        # Send through Pomerium-protected channel
        return self.transport.send(
            to=recipient,
            payload=encrypted,
            signature=signature,
            timestamp=time.now()
        )
```

### 5. Audit & Compliance

#### Immutable Audit Logs
```yaml
audit_configuration:
  storage:
    type: append_only_ledger
    blockchain: hyperledger_fabric
    replication: 3
  
  events:
    - authentication_attempt
    - authorization_decision
    - capability_grant
    - data_access
    - configuration_change
    - security_violation
  
  retention:
    hot: 90d
    warm: 1y
    cold: 7y  # Compliance requirement
```

#### Real-time Monitoring
```python
class SecurityMonitor:
    def __init__(self):
        self.anomaly_detector = AnomalyDetector()
        self.threat_intel = ThreatIntelligence()
        
    async def monitor_agent_behavior(self, agent_id: str):
        async for event in self.event_stream(agent_id):
            # Check against baseline
            anomaly_score = self.anomaly_detector.score(event)
            
            if anomaly_score > THRESHOLD:
                await self.handle_anomaly(agent_id, event)
            
            # Check against threat intelligence
            if self.threat_intel.matches_pattern(event):
                await self.quarantine_agent(agent_id)
```

### 6. Data Protection

#### Encryption at Rest
```yaml
encryption_at_rest:
  key_management:
    provider: hashicorp_vault
    key_rotation: 30d
    algorithm: AES-256-GCM
  
  per_agent_encryption:
    enabled: true
    key_derivation: HKDF-SHA256
    salt_source: hardware_rng
```

#### Secure Deletion
```python
class SecureStorage:
    def delete_sensitive_data(self, file_path: str):
        # Overwrite with random data
        file_size = os.path.getsize(file_path)
        with open(file_path, 'wb') as f:
            for _ in range(3):  # DoD 5220.22-M standard
                f.write(os.urandom(file_size))
                f.flush()
                os.fsync(f.fileno())
        
        # Remove file system entry
        os.unlink(file_path)
        
        # Trigger TRIM on SSD
        subprocess.run(['fstrim', os.path.dirname(file_path)])
```

### 7. Container Security

#### Hardened Container Images
```dockerfile
# Minimal base image
FROM scratch

# Non-root user
USER 10001:10001

# Read-only root filesystem
VOLUME ["/tmp", "/var/cache"]

# Security capabilities
RUN setcap 'cap_net_bind_service=+ep' /app/agent

# Security labels
LABEL security.scan="enabled" \
      security.updates="automatic" \
      security.isolation="high"
```

#### Runtime Security
```yaml
container_security:
  runtime: gvisor  # Sandboxed kernel
  
  seccomp_profile:
    default_action: SCMP_ACT_ERRNO
    syscalls:
      - names: [read, write, open, close]
        action: SCMP_ACT_ALLOW
  
  apparmor_profile: |
    #include <tunables/global>
    profile systemprompt-agent {
      #include <abstractions/base>
      
      # Minimal capabilities
      capability setuid,
      capability setgid,
      
      # File access
      /var/lib/systemprompt-os/** rw,
      /etc/systemprompt-os/** r,
      
      # Deny everything else
      deny /** w,
    }
```

### 8. Network Security

#### Network Segmentation
```yaml
network_zones:
  agent_internal:
    cidr: 10.0.1.0/24
    vlan: 100
    firewall_rules:
      - allow: agent_to_agent
      - deny: external_access
  
  api_gateway:
    cidr: 10.0.2.0/24
    vlan: 200
    firewall_rules:
      - allow: https_inbound
      - allow: agent_internal
      - deny: all
```

#### DDoS Protection
```nginx
# Rate limiting configuration
limit_req_zone $binary_remote_addr zone=agent_api:10m rate=10r/s;
limit_req_zone $ssl_client_s_dn zone=per_agent:10m rate=100r/s;

server {
    location /api/ {
        limit_req zone=agent_api burst=20 nodelay;
        limit_req zone=per_agent burst=100;
        
        # Additional protection via Pomerium
        proxy_pass http://pomerium;
    }
}
```

### 9. Incident Response

#### Automated Response
```python
class IncidentResponder:
    async def handle_security_event(self, event: SecurityEvent):
        severity = self.assess_severity(event)
        
        if severity >= CRITICAL:
            # Immediate isolation
            await self.isolate_agent(event.agent_id)
            await self.snapshot_evidence(event)
            await self.notify_security_team(event)
            
        elif severity >= HIGH:
            # Restrict capabilities
            await self.reduce_agent_privileges(event.agent_id)
            await self.increase_monitoring(event.agent_id)
        
        # Log all actions
        await self.audit_logger.log_incident_response(event)
```

#### Forensics Support
```yaml
forensics:
  evidence_collection:
    - memory_dumps
    - network_captures
    - process_listings
    - file_integrity_hashes
  
  chain_of_custody:
    storage: cryptographic_evidence_locker
    signing: gpg_detached_signatures
    timestamping: rfc3161_tsa
```

## Security Checklist

### Deployment
- [ ] All certificates signed by trusted CA
- [ ] Pomerium configured with secure identity provider
- [ ] Network segmentation implemented
- [ ] Firewall rules reviewed and tested
- [ ] Audit logging enabled and verified

### Runtime
- [ ] Regular security scanning of containers
- [ ] Automated certificate rotation
- [ ] Continuous behavioral monitoring
- [ ] Incident response plan tested
- [ ] Backup encryption keys secured

### Compliance
- [ ] Data residency requirements met
- [ ] Audit retention policies configured
- [ ] Access logs meet regulatory requirements
- [ ] Encryption standards compliance verified
- [ ] Regular security assessments scheduled

## Future Enhancements

1. **Homomorphic Encryption**: Process encrypted data without decryption
2. **Secure Multi-party Computation**: Enable collaborative agent processing
3. **Post-Quantum Cryptography**: Quantum-resistant algorithms
4. **Hardware Security Modules**: Dedicated cryptographic processors
5. **Distributed Trust**: Blockchain-based trust verification