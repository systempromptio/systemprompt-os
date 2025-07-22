# API Module

The API module provides comprehensive API key management and rate limiting functionality for SystemPrompt OS. It handles API key generation, validation, rate limiting, and usage tracking.

## Features

- **API Key Management**
  - Secure API key generation with cryptographic randomness
  - Key validation and authentication
  - Scoped permissions
  - Key expiration support
  - Key revocation with reason tracking

- **Rate Limiting**
  - Sliding window rate limiting
  - Per-key rate limit configuration
  - Real-time rate limit tracking
  - Rate limit status monitoring
  - Manual rate limit reset capability

- **Usage Analytics**
  - Request logging and tracking
  - Usage statistics and metrics
  - Per-endpoint analytics
  - Response time tracking
  - Error rate monitoring

## Architecture

### Services

- **ApiKeyService**: Manages API key lifecycle, validation, and usage tracking
- **RateLimitService**: Implements sliding window rate limiting and monitoring

### Repository

- **ApiRepository**: Database operations for API keys, rate limits, and request logs

### Database Schema

The module uses three main tables:
- `api_keys`: Stores API key information and metadata
- `api_rate_limits`: Tracks rate limit windows and request counts
- `api_requests`: Logs API request details for analytics

## CLI Commands

### Key Management

```bash
# Create a new API key
prompt api:keys:create --name "Production API" --user "user@example.com" --limit 5000 --expires 30d

# List all API keys
prompt api:keys:list [--user <user_id>] [--active] [--format json]

# Get detailed information about a key
prompt api:keys:info <key_id> [--no-stats] [--no-ratelimit] [--format json]

# Revoke an API key
prompt api:keys:revoke <key> [--reason "Security breach"] [--force]
```

### Rate Limiting

```bash
# Check rate limit status
prompt api:ratelimit:status <key_id> [--format json]

# Reset rate limit
prompt api:ratelimit:reset <key_id> [--force]

# Update rate limit
prompt api:ratelimit:update <key_id> <new_limit>
```

### Usage Statistics

```bash
# View overall API usage statistics
prompt api:usage [--period 7d] [--key <key_id>] [--format json]
```

## API Key Format

API keys follow the format: `sk_<base64url_encoded_random_bytes>`

Example: `sk_1a2b3c4d5e6f7g8h9i0j...`

## Rate Limiting

The module implements sliding window rate limiting:
- Default window size: 1 hour
- Configurable per-key rate limits
- Automatic cleanup of old rate limit windows
- Real-time tracking of request counts

## Security

- API keys are hashed using SHA-256 before storage
- Only the key prefix is stored for identification
- Keys are shown only once during creation
- Support for key expiration and revocation
- Audit logging for all key operations

## Usage Example

```typescript
// Module exports
const apiModule = moduleLoader.getModule('api');
const { ApiKeyService, RateLimitService } = apiModule.exports;

// Create an API key
const keyInfo = await ApiKeyService.createApiKey({
  user_id: 'user123',
  name: 'Production API',
  scopes: ['read', 'write'],
  rate_limit: 5000,
  expires_in: 30 * 24 * 60 * 60 * 1000 // 30 days
});

// Validate an API key
const validation = await ApiKeyService.validateApiKey('sk_...');
if (validation.valid) {
  // Check rate limit
  const allowed = await RateLimitService.checkRateLimit(validation.key_id);
  if (allowed) {
    // Process request
    await ApiKeyService.recordApiRequest(validation.key_id, {
      endpoint: '/api/v1/data',
      method: 'GET',
      status_code: 200,
      response_time: 45,
      ip_address: '192.168.1.1',
      user_agent: 'MyApp/1.0'
    });
  }
}
```

## Configuration

The module can be configured through `module.yaml`:

```yaml
name: api
type: service
config:
  defaultRateLimit: 1000
  rateLimitWindowSize: 3600000  # 1 hour in milliseconds
  keyPrefix: "sk_"
  cleanupInterval: 300000  # 5 minutes
```

## Dependencies

- `logger`: For audit logging
- `database`: For persistent storage
- `crypto`: For secure key generation