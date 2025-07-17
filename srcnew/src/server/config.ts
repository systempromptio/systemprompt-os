/**
 * @fileoverview Server configuration management
 * @module server/config
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

export interface ServerConfig {
  // Server settings
  PORT: string;
  BASE_URL: string;
  NODE_ENV: string;
  
  // OAuth2 settings
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  ACCESS_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_EXPIRY: string;
  AUTHORIZATION_CODE_EXPIRY: string;
  
  // Security settings
  BCRYPT_ROUNDS: number;
  
  // Path settings
  CONFIG_PATH: string;
  STATE_DIR: string;
  
  // Logging settings
  LOG_LEVEL: string;
  LOG_MAX_SIZE: string;
  LOG_MAX_FILES: number;
}

/**
 * Get configuration dynamically to support testing
 * This function returns fresh config based on current environment
 */
function getConfig(): ServerConfig {
  return {
    // Server settings
    PORT: process.env.PORT || '3000',
    BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || '3000'}`,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // OAuth2 settings
    JWT_SECRET: process.env.JWT_SECRET || 'change-this-in-production',
    JWT_ISSUER: process.env.JWT_ISSUER || 'systemprompt-os',
    JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'systemprompt-os-clients',
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '1h',
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '30d',
    AUTHORIZATION_CODE_EXPIRY: process.env.AUTHORIZATION_CODE_EXPIRY || '10m',
    
    // Security settings
    BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    
    // Path settings - Now dynamic!
    CONFIG_PATH: process.env.CONFIG_PATH || join(process.cwd(), 'config'),
    STATE_DIR: process.env.STATE_DIR || join(process.cwd(), 'state'),
    
    // Logging settings
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || '10m',
    LOG_MAX_FILES: parseInt(process.env.LOG_MAX_FILES || '7', 10),
  };
}

/**
 * CONFIG proxy that always returns fresh values from environment
 * This allows tests to modify process.env and have it take effect
 */
export const CONFIG = new Proxy({} as ServerConfig, {
  get(target, prop: keyof ServerConfig) {
    return getConfig()[prop];
  },
  // Prevent accidental modification
  set() {
    throw new Error('CONFIG is read-only');
  }
});

// Validate critical configuration
export function validateConfig() {
  const config = getConfig();
  if (config.NODE_ENV === 'production') {
    if (config.JWT_SECRET === 'change-this-in-production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    if (config.BASE_URL.includes('localhost')) {
      console.warn('WARNING: BASE_URL contains localhost in production');
    }
  }
}

// Run validation on module load in production
if (process.env.NODE_ENV === 'production') {
  validateConfig();
}