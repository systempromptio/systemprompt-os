# Auth Module

The auth module provides authentication, authorization, and security utilities for the SystemPrompt OS.

## Features

- OAuth2/OIDC provider management
- JWT key generation
- Cryptographic key management
- Extensible provider configurations
- Built-in support for Google and GitHub
- Custom provider support

## CLI Commands

### auth:generatekey

Generate cryptographic keys for JWT signing.

```bash
systemprompt auth:generatekey [options]
```

Options:
- `-t, --type <type>` - Key type (default: "jwt")
- `-a, --algorithm <algorithm>` - Algorithm: RS256, RS384, or RS512 (default: "RS256")
- `-o, --output <path>` - Output directory (default: "./state/auth/keys")
- `-f, --format <format>` - Output format: pem or jwk (default: "pem")

Examples:
```bash
# Generate default RS256 JWT keys
systemprompt auth:generatekey

# Generate RS512 keys with custom output
systemprompt auth:generatekey -a RS512 -o ./keys

# Generate JWK format keys
systemprompt auth:generatekey -f jwk
```

## API Usage

Other modules can access OAuth providers through the auth module:

```typescript
import { getAuthModule } from '../core/auth/singleton.js';

const authModule = getAuthModule();

// Get a specific provider
const googleProvider = authModule.getProvider('google');

// Get all providers
const providers = authModule.getAllProviders();

// Check if a provider exists
if (authModule.hasProvider('github')) {
  // Use GitHub provider
}
```

## OAuth2/OIDC Provider Configuration

### Built-in Providers

The module includes configurations for popular providers:
- **Google** - Enable with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **GitHub** - Enable with `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

### Adding Custom Providers

1. Copy `providers/template.yaml` to `providers/custom/yourprovider.yaml`
2. Configure the OAuth2 endpoints and settings
3. Set the required environment variables
4. The provider will be automatically loaded on startup

### Provider Configuration Example

```yaml
id: custom-provider
name: My Custom Provider
type: oauth2
enabled: true
endpoints:
  authorization: https://provider.com/oauth/authorize
  token: https://provider.com/oauth/token
  userinfo: https://provider.com/oauth/userinfo
credentials:
  client_id: ${CUSTOM_CLIENT_ID}
  client_secret: ${CUSTOM_CLIENT_SECRET}
  redirect_uri: ${BASE_URL}/oauth2/callback/custom-provider
```

## Module Configuration

The module can be configured in `module.yaml`:

```yaml
config:
  keyStorePath: ./state/auth/keys
  tokenExpiry: 86400
  allowedAlgorithms:
    - RS256
    - RS384
    - RS512
  providers:
    path: ./providers  # Provider configuration directory
```

## CLI Commands

### auth:providers:list

List all configured OAuth2/OIDC providers:

```bash
systemprompt auth:providers:list
```

### auth:providers:reload

Reload provider configurations without restarting:

```bash
systemprompt auth:providers:reload
```

## Module Structure

```
auth/
├── module.yaml          # Module configuration
├── index.ts            # Module entry point
├── cli/               # CLI commands
│   ├── generatekey.ts
│   └── providers.ts
├── providers/         # OAuth2/OIDC provider configs
│   ├── google.yaml    # Google OAuth2 config
│   ├── github.yaml    # GitHub OAuth2 config
│   ├── template.yaml  # Template for custom providers
│   └── custom/        # User-defined providers
├── services/          # Core services
│   ├── provider-manager.ts  # Provider configuration manager
│   └── providers/          # Provider implementations
│       ├── generic-oauth2.ts
│       ├── google.ts
│       └── github.ts
├── types/             # TypeScript interfaces
│   └── provider-interface.ts
└── utils/             # Utility functions
    └── generate-key.ts
```