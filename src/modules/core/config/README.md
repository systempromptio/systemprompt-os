# Config Module

The Config module provides centralized configuration management for SystemPrompt OS, storing and managing configuration values that are consumed by AI providers and other modules.

## Purpose

The Config module **does not define its own types**. Instead, it:
- Stores configuration values that match the types expected by AI provider SDKs (e.g., Google GenAI SDK)
- Provides getter/setter methods to retrieve and update these configurations
- Manages environment variable overrides and file persistence
- Offers validation to ensure configurations match provider requirements

## Overview

The Config module acts as a configuration store that:
- Maintains configuration objects compatible with provider SDK types
- Provides default configurations for various AI providers
- Allows runtime configuration updates
- Persists configurations to disk
- Supports environment variable overrides

## Architecture

### Configuration Structure

The configuration structure uses types directly from provider SDKs:

```typescript
{
  // System-wide settings
  "system": {
    "port": 8080,
    "host": "localhost",
    "environment": "development"
  },

  // Google GenAI SDK configuration (matches GoogleGenAIOptions)
  "google": {
    "apiKey": "${GOOGLE_AI_API_KEY}",      // From environment variable
    "vertexai": false,                     // Use Gemini API by default
    "project": "${GOOGLE_CLOUD_PROJECT}",  // For Vertex AI (optional)
    "location": "${GOOGLE_CLOUD_LOCATION}" // For Vertex AI (optional)
  },

  // Model configurations (matches SDK's GenerationConfig)
  "models": {
    "default": {
      "model": "gemini-1.5-flash",
      "generationConfig": {
        "temperature": 0.7,
        "topK": 40,
        "topP": 0.95,
        "maxOutputTokens": 8192,
        "candidateCount": 1
      },
      "safetySettings": [
        {
          "category": "HARM_CATEGORY_HATE_SPEECH",
          "threshold": "BLOCK_ONLY_HIGH"
        }
      ],
      "systemInstruction": "You are a helpful AI assistant."
    },
    "coder": {
      "model": "gemini-1.5-pro",
      "generationConfig": {
        "temperature": 0.2,
        "maxOutputTokens": 16384
      },
      "systemInstruction": "You are an expert software engineer.",
      "tools": [{
        "codeExecution": {}
      }]
    }
  }
}
```

## Provider Configuration

### Google GenAI Configuration

The config module stores values that match the Google GenAI SDK's expected types:

#### GoogleGenAIOptions (for client initialization)
- `apiKey`: API key for Gemini API
- `vertexai`: Boolean to use Vertex AI instead of Gemini API
- `project`: Google Cloud project ID (for Vertex AI)
- `location`: Google Cloud location (for Vertex AI)

#### GenerationConfig (from @google/genai)
- `temperature`: Controls randomness (0.0-2.0)
- `topK`: Top-K sampling parameter
- `topP`: Top-P (nucleus) sampling parameter  
- `maxOutputTokens`: Maximum tokens in response
- `stopSequences`: Array of stop sequences
- `candidateCount`: Number of response candidates
- `frequencyPenalty`: Penalty based on token frequency
- `presencePenalty`: Penalty for repeated content
- `responseMimeType`: Output format
- `responseSchema`: JSON schema for structured outputs

#### SafetySetting (from @google/genai)
- `category`: HarmCategory enum value
- `threshold`: HarmBlockThreshold enum value
- `method`: HarmBlockMethod enum value (optional)

#### Other SDK Types
- `systemInstruction`: string | Part | Content
- `tools`: Array of tool configurations
- `toolConfig`: ToolConfig from SDK
- `functionCallingConfig`: FunctionCallingConfig from SDK

## CLI Commands

### config:get
Get configuration values with support for nested keys.

```bash
# Get all configuration
systemprompt config:get

# Get specific agent config
systemprompt config:get --key agents.default

# Get nested value
systemprompt config:get --key agents.default.generationConfig.temperature
```

### config:set
Set configuration values with type validation.

```bash
# Set agent temperature
systemprompt config:set --key agents.default.generationConfig.temperature --value 0.8

# Set system instruction
systemprompt config:set --key agents.coder.systemInstruction --value "You are a Python expert"

# Add new agent
systemprompt config:set --key agents.researcher --value '{
  "model": "gemini-1.5-pro",
  "generationConfig": {"temperature": 0.5}
}'
```

### config:list
Display configuration in a formatted view.

```bash
# List all configuration
systemprompt config:list

# List agents only
systemprompt config:list --filter agents

# List with environment variable resolution
systemprompt config:list --resolve-env
```

### config:validate
Validate configuration against schema.

```bash
# Validate current configuration
systemprompt config:validate

# Validate specific agent
systemprompt config:validate --agent default

# Validate external file
systemprompt config:validate --file ./custom-config.json
```

### config:agent
Agent-specific configuration commands.

```bash
# Create new agent from template
systemprompt config:agent create --name analyst --template coder

# List all agents
systemprompt config:agent list

# Test agent configuration
systemprompt config:agent test --name default --prompt "Hello"

# Export agent config
systemprompt config:agent export --name coder --output ./coder-config.json
```

## Environment Variables

Configuration can be overridden using environment variables:

```bash
# Override system settings
export SYSTEMPROMPT_SYSTEM_PORT=3000

# Override agent settings
export SYSTEMPROMPT_AGENTS_DEFAULT_MODEL=gemini-1.5-pro
export SYSTEMPROMPT_AGENTS_DEFAULT_GENERATIONCONFIG_TEMPERATURE=0.5

# Set provider API keys
export SYSTEMPROMPT_PROVIDERS_GOOGLE_APIKEY=your-api-key
```

## Configuration Files

### Main Configuration
Primary configuration stored at `./state/config/config.json`

### Agent Templates
Pre-defined agent templates at `./state/config/templates/`
- `coder.json`: Optimized for code generation
- `analyst.json`: Data analysis and research
- `creative.json`: Creative writing and ideation

### Schema Definition
Configuration schema at `./src/modules/core/config/schema/`

## Usage with Provider SDKs

### Example: Using Config with Google GenAI SDK

```typescript
import { GoogleGenAI } from '@google/genai';
import { ConfigModule } from './config/index.js';

// Get configuration from the config module
const config = new ConfigModule();
const googleConfig = config.get('google');
const modelConfig = config.get('models.default');

// Initialize Google GenAI with configuration
const genai = new GoogleGenAI(googleConfig);

// Create a model with configuration
const model = genai.getGenerativeModel({
  model: modelConfig.model,
  generationConfig: modelConfig.generationConfig,
  safetySettings: modelConfig.safetySettings,
  systemInstruction: modelConfig.systemInstruction
});
```

### Default Configurations

The config module provides sensible defaults that match provider SDK types:

```typescript
// Default Google configuration
const defaultGoogleConfig = {
  apiKey: process.env.GOOGLE_AI_API_KEY,
  vertexai: false
};

// Default generation config (matches GenerationConfig type)
const defaultGenerationConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
  candidateCount: 1
};
```

## Module Structure

```
config/
├── README.md              # This file
├── module.yaml           # Module metadata
├── index.ts             # Main ConfigModule class
├── cli/                 # CLI commands
│   ├── get.ts
│   ├── set.ts
│   ├── list.ts
│   ├── validate.ts
│   └── agent.ts        # Agent management commands
├── types/              # TypeScript definitions
│   ├── config.ts       # Configuration interfaces
│   ├── agent.ts        # Agent-specific types
│   └── validation.ts   # Validation schemas
├── services/           # Core services
│   ├── validator.ts    # Configuration validation
│   ├── resolver.ts     # Environment variable resolution
│   └── template.ts     # Template management
└── tests/             # Test files
    ├── unit/
    └── integration/
```

## Integration with Other Modules

The Config module integrates with:
- **Agent Manager**: Provides agent configurations
- **Code Orchestrator**: Supplies model settings for code generation
- **Extension System**: Manages extension-specific configurations
- **Auth Module**: Handles provider API credentials

## Best Practices

1. **Environment-Specific Configs**: Use environment variables for sensitive data
2. **Validation**: Always validate configuration changes
3. **Templates**: Use templates for consistent agent configurations
4. **Versioning**: Track configuration changes in version control
5. **Testing**: Test agent configurations before deployment

## Security Considerations

- API keys should never be stored in configuration files
- Use environment variables for sensitive data
- Implement role-based access for configuration changes
- Audit configuration modifications
- Encrypt configuration files at rest

## Future Enhancements

- [ ] Hot-reload configuration changes
- [ ] Configuration history and rollback
- [ ] Multi-environment configuration management
- [ ] Configuration inheritance and composition
- [ ] Web UI for configuration management
- [ ] A/B testing for agent configurations