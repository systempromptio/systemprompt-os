/**
 * @file Enterprise-grade JWT implementation with RSA and HMAC support.
 * @module server/external/auth/jwt
 */

import type {KeyObject} from 'crypto';
import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
} from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Supported JWT algorithms.
 */
export type JWTAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'HS256' | 'HS384' | 'HS512';

/**
 * JWT header structure compliant with RFC 7519.
 */
export interface JWTHeader {
    alg: JWTAlgorithm;
    typ: 'JWT';
    kid?: string;
}

/**
 * JWT payload structure with standard registered claims.
 * @see https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
 */
export interface JWTPayload {
    iss?: string;
    sub?: string;
    aud?: string | string[];
    exp?: number;
    nbf?: number;
    iat?: number;
    jti?: string;
    [key: string]: any;
}

/**
 * JWT signing options.
 */
export interface SignOptions {
    algorithm?: JWTAlgorithm;
    keyId?: string;
    expiresIn?: number;
    notBefore?: number;
    issuer?: string;
    audience?: string | string[];
    jwtId?: string;
    includeIssuedAt?: boolean;
}

/**
 * JWT verification options.
 */
export interface VerifyOptions {
    algorithms?: JWTAlgorithm[];
    issuer?: string | string[];
    audience?: string | string[];
    clockTolerance?: number;
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    maxAge?: number;
}

/**
 * JWT verification result.
 */
export interface JWTVerifyResult {
    payload: JWTPayload;
    header: JWTHeader;
}

/**
 * Crypto key configuration.
 */
interface KeyConfig {
    privateKey?: KeyObject;
    publicKey?: KeyObject;
    secret?: string;
    availableAlgorithms: JWTAlgorithm[];
}

/**
 * Singleton key manager for efficient key handling.
 */
class KeyManager {
  private static instance: KeyManager;
  private config: KeyConfig = { availableAlgorithms: [] };
  private initialized = false;
  private readonly keyPath: string;

  private constructor() {
    this.keyPath
      = process.env['JWT_KEY_PATH'] || resolve(process.env['STATE_PATH'] || './state', 'auth/keys');
  }

  /**
   * Get singleton instance.
   */
  static getInstance(): KeyManager {
    KeyManager.instance ||= new KeyManager();
    return KeyManager.instance;
  }

  /**
   * Initialize keys based on available configuration.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) { return; }

    const algorithms: JWTAlgorithm[] = [];

    // Try to load RSA keys
    const privateKeyPath = resolve(this.keyPath, 'private.key');
    const publicKeyPath = resolve(this.keyPath, 'public.key');

    if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
      try {
        this.config.privateKey = createPrivateKey(readFileSync(privateKeyPath));
        this.config.publicKey = createPublicKey(readFileSync(publicKeyPath));
        algorithms.push('RS256', 'RS384', 'RS512');
      } catch (error) {
        console.error('Failed to load RSA keys:', error);
      }
    }

    // In production, we require RSA keys
    if (algorithms.length === 0) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error(
          'JWT RSA keys not found in production. Keys should be generated during container startup.',
        );
      } else {
        // Development only: use ephemeral HMAC secret
        console.warn('No JWT RSA keys found, using ephemeral HMAC secret (development only)');
        this.config.secret = randomBytes(32).toString('base64');
        algorithms.push('HS256');
      }
    }

    this.config.availableAlgorithms = algorithms;
    this.initialized = true;
  }

  /**
   * Get configuration.
   */
  async getConfig(): Promise<KeyConfig> {
    await this.initialize();
    return this.config;
  }

  /**
   * Get default algorithm based on available keys.
   */
  async getDefaultAlgorithm(): Promise<JWTAlgorithm> {
    const config = await this.getConfig();
    // Prefer RSA over HMAC for better security
    return config.privateKey ? 'RS256' : 'HS256';
  }

  /**
   * Clear cache for key rotation.
   */
  clearCache(): void {
    this.initialized = false;
    this.config = { availableAlgorithms: [] };
  }
}

/**
 * Sign a JWT token.
 * @param payload - Token payload.
 * @param options - Signing options.
 * @returns Signed JWT token.
 */
export async function jwtSign(payload: JWTPayload, options: SignOptions = {}): Promise<string> {
  const keyManager = KeyManager.getInstance();
  const config = await keyManager.getConfig();
  const algorithm = options.algorithm || await keyManager.getDefaultAlgorithm();

  // Validate algorithm is available
  if (!config.availableAlgorithms.includes(algorithm)) {
    throw new Error(
      `Algorithm ${algorithm} not available. Available: ${config.availableAlgorithms.join(', ')}`,
    );
  }

  // Build header
  const header: JWTHeader = {
    alg: algorithm,
    typ: 'JWT',
    ...options.keyId && { kid: options.keyId },
  };

  // Build payload with standard claims
  const now = Math.floor(Date.now() / 1000);
  const finalPayload: JWTPayload = {
    ...payload,
    ...options.includeIssuedAt !== false && { iat: now },
    ...options.expiresIn && { exp: now + options.expiresIn },
    ...options.notBefore && { nbf: now + options.notBefore },
    ...options.issuer && { iss: options.issuer },
    ...options.audience && { aud: options.audience },
    ...options.jwtId && { jti: options.jwtId },
  };

  // Set default expiration if not provided
  if (!finalPayload.exp && options.expiresIn !== 0) {
    finalPayload.exp = now + (options.expiresIn || 3600);
  }

  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(finalPayload)).toString('base64url');
  const message = `${encodedHeader}.${encodedPayload}`;

  // Sign based on algorithm type
  let signature: string;
  if (algorithm.startsWith('RS')) {
    if (!config.privateKey) {
      throw new Error('RSA private key not available');
    }
    // Map RS algorithms to their digest names
    const digestMap: Record<string, string> = {
      RS256: 'RSA-SHA256',
      RS384: 'RSA-SHA384',
      RS512: 'RSA-SHA512',
    };
    const digest = digestMap[algorithm];
    if (!digest) {
      throw new Error(`Unsupported RSA algorithm: ${algorithm}`);
    }
    const signer = createSign(digest);
    signer.update(message);
    signature = signer.sign(config.privateKey, 'base64url');
  } else {
    if (!config.secret) {
      throw new Error('HMAC secret not available');
    }
    signature = createHmac(algorithm.toLowerCase().replace('hs', 'sha'), config.secret)
      .update(message)
      .digest('base64url');
  }

  return `${message}.${signature}`;
}

/**
 * Verify a JWT token.
 * @param token - JWT token to verify.
 * @param options - Verification options.
 * @returns Verification result with payload and header.
 */
export async function jwtVerify(
  token: string,
  options: VerifyOptions = {},
): Promise<JWTVerifyResult> {
  // Parse token
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Decode header and payload
  let header: JWTHeader;
  let payload: JWTPayload;

  try {
    header = JSON.parse(Buffer.from(encodedHeader!, 'base64url').toString());
    payload = JSON.parse(Buffer.from(encodedPayload!, 'base64url').toString());
  } catch {
    throw new Error('Invalid token encoding');
  }

  // Validate header
  if (header.typ !== 'JWT') {
    throw new Error('Invalid token type');
  }

  // Get key configuration
  const keyManager = KeyManager.getInstance();
  const config = await keyManager.getConfig();

  // Validate algorithm
  const allowedAlgorithms = options.algorithms || config.availableAlgorithms;
  if (!allowedAlgorithms.includes(header.alg)) {
    throw new Error(`Algorithm ${header.alg} not allowed`);
  }

  // Verify signature
  const message = `${encodedHeader}.${encodedPayload}`;

  if (header.alg.startsWith('RS')) {
    if (!config.publicKey) {
      throw new Error('RSA public key not available');
    }
    // Map RS algorithms to their digest names
    const digestMap: Record<string, string> = {
      RS256: 'RSA-SHA256',
      RS384: 'RSA-SHA384',
      RS512: 'RSA-SHA512',
    };
    const digest = digestMap[header.alg];
    if (!digest) {
      throw new Error(`Unsupported RSA algorithm: ${header.alg}`);
    }
    const verifier = createVerify(digest);
    verifier.update(message);
    if (!verifier.verify(config.publicKey, signature!, 'base64url')) {
      throw new Error('Invalid signature');
    }
  } else {
    if (!config.secret) {
      throw new Error('HMAC secret not available');
    }
    const expectedSignature = createHmac(
      header.alg.toLowerCase().replace('hs', 'sha'),
      config.secret,
    )
      .update(message)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }
  }

  // Verify temporal claims
  const now = Math.floor(Date.now() / 1000);
  const clockTolerance = options.clockTolerance || 0;

  if (!options.ignoreExpiration && payload.exp !== undefined) {
    if (payload.exp < now - clockTolerance) {
      throw new Error('Token expired');
    }
  }

  if (!options.ignoreNotBefore && payload.nbf !== undefined) {
    if (payload.nbf > now + clockTolerance) {
      throw new Error('Token not yet valid');
    }
  }

  if (options.maxAge !== undefined && payload.iat !== undefined) {
    if (now - payload.iat > options.maxAge + clockTolerance) {
      throw new Error('Token too old');
    }
  }

  // Verify issuer
  if (options.issuer !== undefined) {
    const issuers = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
    if (!payload.iss || !issuers.includes(payload.iss)) {
      throw new Error('Invalid issuer');
    }
  }

  // Verify audience
  if (options.audience !== undefined) {
    const expectedAudiences = Array.isArray(options.audience)
      ? options.audience
      : [options.audience];
    const tokenAudiences = Array.isArray(payload.aud)
      ? payload.aud
      : payload.aud
        ? [payload.aud]
        : [];

    const hasValidAudience = expectedAudiences.some((aud) => { return tokenAudiences.includes(aud) });

    if (!hasValidAudience) {
      throw new Error('Invalid audience');
    }
  }

  return {
 payload,
header
};
}

/**
 * Decode JWT without verification (for debugging only).
 * @param token - JWT token.
 * @returns Decoded token or null if invalid.
 */
export function jwtDecode(token: string): JWTVerifyResult | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) { return null; }

    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString()) as JWTHeader;

    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) as JWTPayload;

    return {
 header,
payload
};
  } catch {
    return null;
  }
}

/**
 * Reload keys (for key rotation).
 */
export function reloadKeys(): void {
  KeyManager.getInstance().clearCache();
}

/**
 * Get current JWT configuration for diagnostics.
 */
export async function getJWTInfo(): Promise<{
  mode: 'rsa' | 'hmac' | 'hybrid';
  algorithms: JWTAlgorithm[];
  keyPath?: string;
}> {
  const keyManager = KeyManager.getInstance();
  const config = await keyManager.getConfig();

  let mode: 'rsa' | 'hmac' | 'hybrid';
  if (config.privateKey && config.secret) {
    mode = 'hybrid';
  } else if (config.privateKey) {
    mode = 'rsa';
  } else {
    mode = 'hmac';
  }

  return {
    mode,
    algorithms: config.availableAlgorithms,
    ...process.env['JWT_KEY_PATH'] !== undefined && { keyPath: process.env['JWT_KEY_PATH'] },
  };
}
