/**
 * @file JWT-related type definitions.
 * @module server/external/auth/types/jwt
 */

import type { KeyObject } from 'crypto';

/**
 * Supported JWT algorithms.
 */
export type IJwtAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'HS256' | 'HS384' | 'HS512';

/**
 * JWT header structure compliant with RFC 7519.
 */
export interface IJwtHeader {
  alg: IJwtAlgorithm;
  typ: 'JWT';
  kid?: string;
}

/**
 * JWT payload structure with standard registered claims.
 * @see https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
 */
export interface IJwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

/**
 * JWT signing options.
 */
export interface ISignOptions {
  algorithm?: IJwtAlgorithm;
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
export interface IVerifyOptions {
  algorithms?: IJwtAlgorithm[];
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
export interface IJwtVerifyResult {
  payload: IJwtPayload;
  header: IJwtHeader;
}

/**
 * Crypto key configuration.
 */
export interface IKeyConfig {
  privateKey?: KeyObject;
  publicKey?: KeyObject;
  secret?: string;
  availableAlgorithms: IJwtAlgorithm[];
}

/**
 * JWT configuration information for diagnostics.
 */
export interface IJwtInfo {
  mode: 'rsa' | 'hmac' | 'hybrid';
  algorithms: IJwtAlgorithm[];
  keyPath?: string;
}

/**
 * Parameters for signature verification operations.
 */
export interface ISignatureVerifyParams {
  message: string;
  signature: string;
  algorithm: IJwtAlgorithm;
  config: IKeyConfig;
}

/**
 * Parameters for time-based claims validation.
 */
export interface ITimeValidationParams {
  payload: IJwtPayload;
  options: IVerifyOptions;
  now: number;
  clockTolerance: number;
}

/**
 * Parameters for signature generation operations.
 */
export interface ISignatureGenerateParams {
  message: string;
  algorithm: IJwtAlgorithm;
  config: IKeyConfig;
}
