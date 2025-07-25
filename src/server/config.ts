/**
 * @file Server configuration management.
 * @module server/config
 */

import dotenv from "dotenv";
import { join } from "path";

dotenv.config();

export interface ServerConfig {
  // Server settings
  PORT: string;
  BASEURL: string;
  NODEENV: string;
  SERVERNAME: string;
  SERVERVERSION: string;

  // OAuth2 settings
  JWTISSUER: string;
  JWTAUDIENCE: string;
  ACCESSTOKEN_EXPIRY: string;
  REFRESHTOKEN_EXPIRY: string;
  AUTHORIZATIONCODE_EXPIRY: string;

  // Security settings
  BCRYPTROUNDS: number;

  // Path settings
  CONFIGPATH: string;
  STATEDIR: string;

  // Logging settings
  LOGLEVEL: string;
  LOGMAX_SIZE: string;
  LOGMAX_FILES: number;
}

/**
 * Get configuration dynamically to support testing
 * This function returns fresh config based on current environment.
 */
function getConfig(): ServerConfig {
  return {
    PORT: process.env.PORT || "3000",
    BASEURL: process.env.BASE_URL || process.env.BASEURL || `http://localhost:${process.env.PORT || "3000"}`,
    NODEENV: process.env.NODEENV || "development",
    SERVERNAME: "systemprompt-os",
    SERVERVERSION: "0.1.0",

    JWTISSUER: process.env.JWTISSUER || "systemprompt-os",
    JWTAUDIENCE: process.env.JWTAUDIENCE || "systemprompt-os-clients",
    ACCESSTOKEN_EXPIRY: process.env.ACCESSTOKEN_EXPIRY || "1h",
    REFRESHTOKEN_EXPIRY: process.env.REFRESHTOKEN_EXPIRY || "30d",
    AUTHORIZATIONCODE_EXPIRY: process.env.AUTHORIZATIONCODE_EXPIRY || "10m",

    BCRYPTROUNDS: parseInt(process.env.BCRYPTROUNDS || "10", 10),

    CONFIGPATH: process.env.CONFIGPATH || join(process.cwd(), "config"),
    STATEDIR: process.env.STATEDIR || join(process.cwd(), "state"),

    LOGLEVEL: process.env.LOGLEVEL || "info",
    LOGMAX_SIZE: process.env.LOGMAX_SIZE || "10m",
    LOGMAX_FILES: parseInt(process.env.LOGMAX_FILES || "7", 10),
  };
}

/**
 * CONFIG proxy that always returns fresh values from environment
 * This allows tests to modify process.env and have it take effect.
 */
export const CONFIG = new Proxy({} as ServerConfig, {
  get(_target, prop: keyof ServerConfig) {
    return getConfig()[prop];
  },
  // Prevent accidental modification
  set() {
    throw new Error("CONFIG is read-only");
  },
});

// Validate critical configuration
export function validateConfig() {
  const config = getConfig();
  if (config.NODEENV === "production") {
    if (config.BASEURL.includes("localhost")) {
      console.warn("WARNING: BASEURL contains localhost in production");
    }
  }
}

// Run validation on module load in production
if (process.env.NODEENV === "production") {
  validateConfig();
}
