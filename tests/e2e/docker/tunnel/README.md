# Cloudflared Tunnel E2E Tests

This directory contains end-to-end tests for the Cloudflared tunnel functionality in SystemPrompt OS.

## Overview

The tunnel service allows SystemPrompt OS to receive OAuth callbacks and external requests through a secure Cloudflare tunnel. This is essential for:

- OAuth2 authentication flows in development
- Webhook reception
- External API integrations

## Test Components

1. **cloudflared-tunnel.spec.ts** - Main E2E test suite
2. **docker-compose.test.yml** - Docker Compose configuration for test environment
3. **mock-oauth-server.js** - Mock OAuth provider for testing OAuth flows
4. **run-tunnel-test.sh** - Shell script to run the complete test suite

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- Valid Cloudflare tunnel token (optional, tests will use mock mode without it)

## Running Tests

### Quick Start

```bash
# Run the complete test suite
./run-tunnel-test.sh
```

### Manual Testing

1. Set up environment variables:
```bash
export CLOUDFLARE_TUNNEL_TOKEN="your-tunnel-token"  # Optional
export OAUTH_DOMAIN="your-tunnel-domain.com"        # Optional
```

2. Start Docker containers:
```bash
docker-compose -f docker-compose.test.yml up -d
```

3. Run the test:
```bash
npm test -- tests/e2e/tunnel/cloudflared-tunnel.spec.ts
```

4. Clean up:
```bash
docker-compose -f docker-compose.test.yml down
```

## Test Scenarios

### 1. Docker Container Setup
- Verifies Docker is available
- Starts cloudflared container
- Checks container health and logs

### 2. Tunnel Service Lifecycle
- Initializes TunnelService
- Starts tunnel connection
- Verifies tunnel status
- Tests graceful shutdown

### 3. Network Connectivity
- Tests container can reach local services
- Verifies tunnel URL accessibility
- Checks DNS resolution

### 4. OAuth Flow
- Simulates OAuth provider redirect
- Tests callback handling through tunnel
- Verifies token exchange

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel authentication token | No (uses mock mode) |
| `OAUTH_DOMAIN` | Public domain for the tunnel | No |
| `TUNNEL_URL` | Override tunnel URL for testing | No |

## Troubleshooting

### Docker Issues

If Docker containers fail to start:
```bash
# Check Docker daemon
docker info

# View container logs
docker-compose -f docker-compose.test.yml logs

# Remove orphaned containers
docker-compose -f docker-compose.test.yml down --remove-orphans
```

### Network Issues

If the tunnel cannot connect:
1. Check your internet connection
2. Verify the tunnel token is valid
3. Check Cloudflare dashboard for tunnel status
4. Review firewall settings

### Test Failures

Common reasons for test failures:
- No Docker installed
- Invalid tunnel token
- Port conflicts (3456, 4567)
- Insufficient permissions

## CI/CD Integration

To run these tests in CI/CD:

```yaml
# GitHub Actions example
- name: Run Tunnel E2E Tests
  env:
    CLOUDFLARE_TUNNEL_TOKEN: ${{ secrets.CLOUDFLARE_TUNNEL_TOKEN }}
  run: |
    ./tests/e2e/tunnel/run-tunnel-test.sh
```

## Mock Mode

When running without a valid Cloudflare tunnel token, tests run in "mock mode":
- Container starts but won't establish real tunnel
- OAuth flows are simulated locally
- Network tests are limited to local connectivity

## Security Notes

- Never commit tunnel tokens to version control
- Use environment variables or secrets management
- Rotate tokens regularly
- Monitor tunnel access logs