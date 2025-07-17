# Key Generation Tool

This tool generates cryptographic keys for JWT signing in systemprompt-os.

## Usage

```bash
# Generate RSA keys for JWT signing (default: RS256, PEM format)
systemprompt generatekey

# Generate RS512 keys
systemprompt generatekey --algorithm RS512

# Generate keys in JWK format
systemprompt generatekey --format jwk

# Specify output directory
systemprompt generatekey --output /path/to/keys
```

## Output

### PEM Format (default)
- `private.key` - RSA private key for signing JWTs
- `public.key` - RSA public key for verifying JWTs

### JWK Format
- `jwks.json` - JSON Web Key Set containing the key pair

## Extending the Key Generation

The key generation tool is designed to be simple and extensible. Here's how to add support for additional key types:

### 1. Add a New Key Type

Create a new file in `tools/generate-key/` for your key type:

```typescript
// tools/generate-key/my-key-type.ts
import { generateKeyPair } from 'crypto';
import { promisify } from 'util';

const generateKeyPairAsync = promisify(generateKeyPair);

export async function generateMyKeyType(options: any) {
  // Your key generation logic here
  const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
    // Your options
  });
  
  return { publicKey, privateKey };
}
```

### 2. Update the Main Index

Modify `tools/generate-key/index.ts` to support your new type:

```typescript
// Add to KeyGenerationOptions type
export interface KeyGenerationOptions {
  type: 'jwt' | 'my-key-type';  // Add your type
  // ... other options
}

// Add case in generateJWTKeyPair (or rename to generateKeyPair)
if (options.type === 'my-key-type') {
  const keys = await generateMyKeyType(options);
  // Handle output
}
```

### 3. Update the CLI

Add support in `bin/systemprompt.js`:

```javascript
program
  .command('generatekey')
  .option('-t, --type <type>', 'Key type (jwt, my-key-type)', 'jwt')
  // ... rest of options
```

## Example: Adding HMAC Key Generation

Here's a complete example of adding HMAC secret generation:

1. Create `tools/generate-key/hmac.ts`:

```typescript
import { randomBytes } from 'crypto';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function generateHMACSecret(options: {
  length?: number;
  outputDir: string;
}) {
  const length = options.length || 32; // 256 bits default
  const secret = randomBytes(length);
  
  // Save as base64
  const secretBase64 = secret.toString('base64');
  await writeFile(
    path.join(options.outputDir, 'hmac.secret'),
    secretBase64
  );
  
  console.log('HMAC secret generated:');
  console.log(`  Secret: ${path.join(options.outputDir, 'hmac.secret')}`);
  console.log(`  Length: ${length * 8} bits`);
}
```

2. Update `index.ts`:

```typescript
import { generateHMACSecret } from './hmac.js';

// In the main function
if (options.type === 'hmac') {
  await generateHMACSecret({
    length: options.length,
    outputDir: options.outputDir
  });
  return;
}
```

3. Update CLI with new option:

```javascript
.option('-l, --length <bytes>', 'Key length in bytes (for HMAC)', '32')
```

## Security Considerations

1. **Private Key Security**: Always keep private keys secure and never commit them to version control
2. **Key Rotation**: Implement a key rotation strategy for production use
3. **Key Storage**: Consider using a key management service (KMS) in production
4. **Permissions**: Ensure generated key files have appropriate permissions (600 for private keys)

## Testing

Test key generation:

```bash
# Generate test keys
node bin/systemprompt.js generatekey --output ./test-keys

# Verify files were created
ls -la ./test-keys/

# Test JWK format
node bin/systemprompt.js generatekey --format jwk --output ./test-keys
```