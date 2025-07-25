/**
 * @fileoverview Configuration type definitions for SystemPrompt OS
 * @module modules/core/config/types
 *
 * This module defines the configuration structure for SystemPrompt OS.
 * Provider-specific configurations use types directly from their SDKs.
 */

// Google client configuration

/**
 * Main configuration structure for SystemPrompt OS
 */
export interface SystemPromptConfig {
  /** System-wide settings */
  system: SystemConfig;

  /** Google GenAI configuration */
  google?: any; // Using the official SDK types from provider configs

  /** Model configurations stored by name */
  models?: Record<string, any>; // Values should match provider SDK types

  /** Extension configurations */
  extensions?: ExtensionConfig;

  /** Security settings */
  security?: SecurityConfig;
}

/**
 * System-wide configuration
 */
export interface SystemConfig {
  /** Server port */
  port: number;

  /** Server host */
  host: string;

  /** Environment (development, staging, production) */
  environment: 'development' | 'staging' | 'production';

  /** Debug mode */
  debug?: boolean;

  /** Log level */
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';

  /** State directory path */
  statePath?: string;
}

/**
 * Extension configuration
 */
export interface ExtensionConfig {
  /** Enabled extensions */
  enabled: string[];

  /** Extension-specific settings */
  settings?: Record<string, any>;

  /** Auto-load extensions from directory */
  autoLoad?: boolean;

  /** Extension directory paths */
  paths?: string[];
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Authentication settings */
  auth?: AuthConfig;

  /** CORS settings */
  cors?: CorsConfig;

  /** Rate limiting */
  rateLimit?: RateLimitConfig;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Authentication provider */
  provider: 'oauth2' | 'jwt' | 'apikey' | 'none';

  /** Provider-specific settings */
  settings?: Record<string, any>;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  /** Allowed origins */
  allowedOrigins: string[];

  /** Allowed methods */
  allowedMethods?: string[];

  /** Allowed headers */
  allowedHeaders?: string[];

  /** Allow credentials */
  credentials?: boolean;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Enable rate limiting */
  enabled: boolean;

  /** Window duration in milliseconds */
  windowMs?: number;

  /** Maximum requests per window */
  max?: number;
}

/**
 * Configuration source
 */
export enum ConfigSource {
  /** Default values */
  DEFAULT = 'default',

  /** Configuration file */
  FILE = 'file',

  /** Environment variables */
  ENVIRONMENT = 'environment',

  /** Runtime override */
  RUNTIME = 'runtime'
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings?: string[];
}