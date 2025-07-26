/**
 * Enterprise-grade JWT implementation with RSA and HMAC support.
 * Provides comprehensive JWT signing and verification capabilities with support for
 * both RSA and HMAC algorithms, following RFC 7519 standards.
 * @file Enterprise-grade JWT implementation with RSA and HMAC support.
 * @module server/external/auth/jwt
 */

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

import type {
  IJwtAlgorithm,
  IJwtHeader,
  IJwtInfo,
  IJwtPayload,
  IJwtVerifyResult,
  IKeyConfig,
  ISignOptions,
  IVerifyOptions,
} from '@/server/external/auth/types/jwt.types';

/**
 * Re-export types for backward compatibility.
 */
export type {
  IKeyConfig,
  IJwtAlgorithm,
  IJwtHeader,
  IJwtInfo,
  IJwtPayload,
  IJwtVerifyResult,
  ISignOptions,
  IVerifyOptions,
};

/**
 * Singleton key manager for efficient key handling.
 */
class KeyManager {
  private static instance: KeyManager;
  private readonly keyPath: string;
  private config: IKeyConfig = { availableAlgorithms: [] };
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    const envJwtKeyPath = process.env.JWT_KEY_PATH;
    const envStatePath = process.env.STATE_PATH ?? './state';
    this.keyPath = envJwtKeyPath ?? resolve(envStatePath, 'auth/keys');
  }

  /**
   * Get singleton instance.
   * @returns The KeyManager instance.
   */
  static getInstance(): KeyManager {
    if (KeyManager.instance === undefined) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }

  /**
   * Get configuration.
   * @returns The key configuration.
   */
  getConfig(): IKeyConfig {
    this.initialize();
    return this.config;
  }

  /**
   * Get default algorithm based on available keys.
   * @returns The default JWT algorithm.
   */
  getDefaultAlgorithm(): IJwtAlgorithm {
    const config = this.getConfig();
    return config.privateKey === undefined ? 'HS256' : 'RS256';
  }

  /**
   * Clear cache for key rotation.
   */
  clearCache(): void {
    this.initialized = false;
    this.config = { availableAlgorithms: [] };
  }

  /**
   * Initialize keys based on available configuration.
   */
  private initialize(): void {
    if (this.initialized) {
      return;
    }

    const algorithms: IJwtAlgorithm[] = [];
    this.initializeRsaKeys(algorithms);
    this.initializeHmacFallback(algorithms);

    this.config.availableAlgorithms = algorithms;
    this.initialized = true;
  }

  /**
   * Initialize RSA keys if available.
   * @param algorithms - Array to populate with available algorithms.
   */
  private initializeRsaKeys(algorithms: IJwtAlgorithm[]): void {
    const privateKeyPath = resolve(this.keyPath, 'private.key');
    const publicKeyPath = resolve(this.keyPath, 'public.key');

    if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
      try {
        this.config.privateKey = createPrivateKey(readFileSync(privateKeyPath));
        this.config.publicKey = createPublicKey(readFileSync(publicKeyPath));
        algorithms.push('RS256', 'RS384', 'RS512');
      } catch {
      }
    }
  }

  /**
   * Initialize HMAC fallback if no RSA keys are available.
   * @param algorithms - Array to populate with available algorithms.
   * @throws {Error} If RSA keys are not found in production mode.
   */
  private initializeHmacFallback(algorithms: IJwtAlgorithm[]): void {
    if (algorithms.length === 0) {
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'production') {
        const errorMessage = 'JWT RSA keys not found in production. '
          + 'Keys should be generated during container startup.';
        throw new Error(errorMessage);
      } else {
        this.config.secret = randomBytes(32).toString('base64');
        algorithms.push('HS256');
      }
    }
  }
}

/**
 * Sign a JWT token.
 * @param payload - Token payload.
 * @param options - Signing options.
 * @returns Signed JWT token.
 * @throws {Error} If the specified algorithm is not available.
 */
export const jwtSign = (payload: IJwtPayload, options: ISignOptions = {}): string => {
  const keyManager = KeyManager.getInstance();
  const config = keyManager.getConfig();
  const algorithm = options.algorithm ?? keyManager.getDefaultAlgorithm();

  if (!config.availableAlgorithms.includes(algorithm)) {
    const availableAlgs = config.availableAlgorithms.join(', ');
    throw new Error(`Algorithm ${algorithm} not available. Available: ${availableAlgs}`);
  }

  const header = buildJwtHeader(algorithm, options.keyId);
  const now = Math.floor(Date.now() / 1000);
  const finalPayload = buildJwtPayload(payload, options, now);

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(finalPayload)).toString('base64url');
  const message = `${encodedHeader}.${encodedPayload}`;

  const signature = algorithm.startsWith('RS')
    ? generateRsaSignature(message, algorithm, config)
    : generateHmacSignature(message, algorithm, config);

  return `${message}.${signature}`;
};

/**
 * Generate RSA signature.
 * @param message - Message to sign.
 * @param algorithm - RSA algorithm.
 * @param config - Key configuration.
 * @returns Base64URL encoded signature.
 * @throws {Error} If RSA private key is not available or algorithm is unsupported.
 */
const generateRsaSignature = (
  message: string,
  algorithm: IJwtAlgorithm,
  config: IKeyConfig,
): string => {
  if (config.privateKey === undefined) {
    throw new Error('RSA private key not available');
  }
  const digestMap: Record<string, string> = {
    rs256: 'RSA-SHA256',
    rs384: 'RSA-SHA384',
    rs512: 'RSA-SHA512',
  };
  const { [algorithm.toLowerCase()]: digest } = digestMap;
  if (digest === undefined) {
    throw new Error(`Unsupported RSA algorithm: ${algorithm}`);
  }
  const signer = createSign(digest);
  signer.update(message);
  return signer.sign(config.privateKey, 'base64url');
};

/**
 * Generate HMAC signature.
 * @param message - Message to sign.
 * @param algorithm - HMAC algorithm.
 * @param config - Key configuration.
 * @returns Base64URL encoded signature.
 * @throws {Error} If HMAC secret is not available.
 */
const generateHmacSignature = (
  message: string,
  algorithm: IJwtAlgorithm,
  config: IKeyConfig,
): string => {
  if (config.secret === undefined) {
    throw new Error('HMAC secret not available');
  }
  const hashAlgorithm = algorithm.toLowerCase().replace('hs', 'sha');
  return createHmac(hashAlgorithm, config.secret)
    .update(message)
    .digest('base64url');
};

/**
 * Build JWT header.
 * @param algorithm - JWT algorithm.
 * @param keyId - Optional key ID.
 * @returns JWT header.
 */
const buildJwtHeader = (algorithm: IJwtAlgorithm, keyId?: string): IJwtHeader => {
  const header: IJwtHeader = {
    alg: algorithm,
    typ: 'JWT',
  };

  if (keyId !== undefined) {
    header.kid = keyId;
  }

  return header;
};

/**
 * Build JWT payload with claims.
 * @param payload - Base payload.
 * @param options - Signing options.
 * @param now - Current timestamp.
 * @returns Final JWT payload.
 */
const buildJwtPayload = (
  payload: IJwtPayload,
  options: ISignOptions,
  now: number,
): IJwtPayload => {
  const finalPayload: IJwtPayload = { ...payload };

  if (options.includeIssuedAt !== false) {
    finalPayload.iat = now;
  }

  if (options.expiresIn !== undefined) {
    finalPayload.exp = now + options.expiresIn;
  } else if (finalPayload.exp === undefined) {
    finalPayload.exp = now + 3600;
  }

  if (options.notBefore !== undefined) {
    finalPayload.nbf = now + options.notBefore;
  }

  if (options.issuer !== undefined) {
    finalPayload.iss = options.issuer;
  }

  if (options.audience !== undefined) {
    finalPayload.aud = options.audience;
  }

  if (options.jwtId !== undefined) {
    finalPayload.jti = options.jwtId;
  }

  return finalPayload;
};

/**
 * Verify a JWT token.
 * @param token - JWT token to verify.
 * @param options - Verification options.
 * @returns Verification result with payload and header.
 * @throws {Error} If token format is invalid or verification fails.
 */
export const jwtVerify = (
  token: string,
  options: IVerifyOptions = {},
): IJwtVerifyResult => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  if (encodedHeader === undefined || encodedPayload === undefined || signature === undefined) {
    throw new Error('Invalid token parts');
  }

  let header: IJwtHeader;
  let payload: IJwtPayload;

  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString()) as IJwtHeader;
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as IJwtPayload;
  } catch {
    throw new Error('Invalid token encoding');
  }

  const keyManager = KeyManager.getInstance();
  const config = keyManager.getConfig();

  const allowedAlgorithms = options.algorithms ?? config.availableAlgorithms;
  if (!allowedAlgorithms.includes(header.alg)) {
    throw new Error(`Algorithm ${header.alg} not allowed`);
  }

  const message = `${encodedHeader}.${encodedPayload}`;
  verifySignature(message, signature, header.alg, config);
  validateClaims(payload, options);

  return {
    payload,
    header,
  };
};

/**
 * Verify JWT signature.
 * @param message - Message to verify.
 * @param signature - Signature to verify against.
 * @param algorithm - JWT algorithm.
 * @param config - Key configuration.
 */
const verifySignature = (
  message: string,
  signature: string,
  algorithm: IJwtAlgorithm,
  config: IKeyConfig,
): void => {
  if (algorithm.startsWith('RS')) {
    verifyRsaSignature(message, signature, algorithm, config);
  } else {
    verifyHmacSignature(message, signature, algorithm, config);
  }
};

/**
 * Verify RSA signature.
 * @param message - Message to verify.
 * @param signature - Signature to verify against.
 * @param algorithm - RSA algorithm.
 * @param config - Key configuration.
 */
const verifyRsaSignature = (
  message: string,
  signature: string,
  algorithm: IJwtAlgorithm,
  config: IKeyConfig,
): void => {
  if (config.publicKey === undefined) {
    throw new Error('RSA public key not available');
  }
  const digestMap: Record<string, string> = {
    rs256: 'RSA-SHA256',
    rs384: 'RSA-SHA384',
    rs512: 'RSA-SHA512',
  };
  const { [algorithm.toLowerCase()]: digest } = digestMap;
  if (digest === undefined) {
    throw new Error(`Unsupported RSA algorithm: ${algorithm}`);
  }
  const verifier = createVerify(digest);
  verifier.update(message);
  if (!verifier.verify(config.publicKey, signature, 'base64url')) {
    throw new Error('Invalid signature');
  }
};

/**
 * Verify HMAC signature.
 * @param message - Message to verify.
 * @param signature - Signature to verify against.
 * @param algorithm - HMAC algorithm.
 * @param config - Key configuration.
 */
const verifyHmacSignature = (
  message: string,
  signature: string,
  algorithm: IJwtAlgorithm,
  config: IKeyConfig,
): void => {
  if (config.secret === undefined) {
    throw new Error('HMAC secret not available');
  }
  const hashAlgorithm = algorithm.toLowerCase().replace('hs', 'sha');
  const expectedSignature = createHmac(hashAlgorithm, config.secret)
    .update(message)
    .digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
};

/**
 * Validate JWT claims.
 * @param payload - JWT payload.
 * @param options - Verification options.
 */
const validateClaims = (payload: IJwtPayload, options: IVerifyOptions): void => {
  const now = Math.floor(Date.now() / 1000);
  const clockTolerance = options.clockTolerance ?? 0;

  validateTimeBasedClaims(payload, options, now, clockTolerance);
  validateIssuerClaim(payload, options);
  validateAudienceClaim(payload, options);
};

/**
 * Validate time-based claims (exp, nbf, iat).
 * @param payload - JWT payload.
 * @param options - Verification options.
 * @param now - Current timestamp.
 * @param clockTolerance - Clock tolerance in seconds.
 */
const validateTimeBasedClaims = (
  payload: IJwtPayload,
  options: IVerifyOptions,
  now: number,
  clockTolerance: number,
): void => {
  if (options.ignoreExpiration !== true && payload.exp !== undefined) {
    if (payload.exp < now - clockTolerance) {
      throw new Error('Token expired');
    }
  }

  if (options.ignoreNotBefore !== true && payload.nbf !== undefined) {
    if (payload.nbf > now + clockTolerance) {
      throw new Error('Token not yet valid');
    }
  }

  if (options.maxAge !== undefined && payload.iat !== undefined) {
    if (now - payload.iat > options.maxAge + clockTolerance) {
      throw new Error('Token too old');
    }
  }
};

/**
 * Validate issuer claim.
 * @param payload - JWT payload.
 * @param options - Verification options.
 */
const validateIssuerClaim = (payload: IJwtPayload, options: IVerifyOptions): void => {
  if (options.issuer !== undefined) {
    const issuers = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
    if (payload.iss === undefined || !issuers.includes(payload.iss)) {
      throw new Error('Invalid issuer');
    }
  }
};

/**
 * Validate audience claim.
 * @param payload - JWT payload.
 * @param options - Verification options.
 */
const validateAudienceClaim = (payload: IJwtPayload, options: IVerifyOptions): void => {
  if (options.audience !== undefined) {
    const expectedAudiences = Array.isArray(options.audience)
      ? options.audience
      : [options.audience];

    const tokenAudiences = payload.aud === undefined
      ? []
      : Array.isArray(payload.aud)
        ? payload.aud
        : [payload.aud];

    const hasValidAudience = expectedAudiences.some((aud): boolean => {
      return tokenAudiences.includes(aud);
    });

    if (!hasValidAudience) {
      throw new Error('Invalid audience');
    }
  }
};

/**
 * Decode JWT without verification (for debugging only).
 * @param token - JWT token.
 * @returns Decoded token or null if invalid.
 */
export const jwtDecode = (token: string): IJwtVerifyResult | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const headerPart = parts[0];
    const payloadPart = parts[1];

    if (headerPart === undefined || payloadPart === undefined) {
      return null;
    }

    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString()) as IJwtHeader;
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString()) as IJwtPayload;

    return {
      header,
      payload,
    };
  } catch {
    return null;
  }
};

/**
 * Reload keys (for key rotation).
 */
export const reloadKeys = (): void => {
  KeyManager.getInstance().clearCache();
};

/**
 * Get current JWT configuration for diagnostics.
 * @returns JWT configuration information.
 */
export const getJWTInfo = (): IJwtInfo => {
  const keyManager = KeyManager.getInstance();
  const config = keyManager.getConfig();

  let mode: 'rsa' | 'hmac' | 'hybrid';
  if (config.privateKey !== undefined && config.secret !== undefined) {
    mode = 'hybrid';
  } else if (config.privateKey !== undefined) {
    mode = 'rsa';
  } else {
    mode = 'hmac';
  }

  const result: IJwtInfo = {
    mode,
    algorithms: config.availableAlgorithms,
  };

  const { JWT_KEY_PATH: keyPath } = process.env;
  if (keyPath !== undefined) {
    result.keyPath = keyPath;
  }

  return result;
};
