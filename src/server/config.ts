/**
 * Server configuration management.
 * @description Manages server configuration settings with support for environment variables and dynamic configuration.
 * @module server/config
 */

import * as dotenv from "dotenv";
import { join } from "path";
import type { IServerConfig } from '@/server/types/config.types';

dotenv.config();

/**
 * Re-export for backward compatibility.
 */
export type { IServerConfig };

/**
 * Get configuration dynamically to support testing.
 * This function returns fresh config based on current environment.
 * @returns Server configuration object.
 */
const getConfig = (): IServerConfig => {
  return {
    PORT: process.env.PORT ?? "3000",
    BASEURL: process.env.BASE_URL ?? process.env.BASEURL
      ?? `http://localhost:${process.env.PORT ?? "3000"}`,
    NODEENV: process.env.NODEENV ?? "development",
    SERVERNAME: "systemprompt-os",
    SERVERVERSION: "0.1.0",

    JWTISSUER: process.env.JWTISSUER ?? "systemprompt-os",
    JWTAUDIENCE: process.env.JWTAUDIENCE ?? "systemprompt-os-clients",
    ACCESSTOKEN_EXPIRY: process.env.ACCESSTOKEN_EXPIRY ?? "1h",
    REFRESHTOKEN_EXPIRY: process.env.REFRESHTOKEN_EXPIRY ?? "30d",
    AUTHORIZATIONCODE_EXPIRY: process.env.AUTHORIZATIONCODE_EXPIRY ?? "10m",

    CONFIGPATH: process.env.CONFIGPATH ?? join(process.cwd(), "config"),
    STATEDIR: process.env.STATEDIR ?? join(process.cwd(), "state"),

    LOGLEVEL: process.env.LOGLEVEL ?? "info",
    LOGMAX_SIZE: process.env.LOGMAX_SIZE ?? "10m",
    LOGMAX_FILES: parseInt(process.env.LOGMAX_FILES ?? "7", 10),
  };
};

/**
 * CONFIG proxy that always returns fresh values from environment
 * This allows tests to modify process.env and have it take effect.
 */
export const CONFIG = new Proxy(getConfig(), {
  get(_, prop: string | symbol): any {
    const config = getConfig();
    return config[prop as keyof IServerConfig];
  },
  /**
   * Prevent accidental modification.
   */
  set(): never {
    throw new Error("CONFIG is read-only");
  },
});

/**
 * Validate critical configuration.
 */
export const validateConfig = (): void => {
  const config = getConfig();
  if (config.NODEENV === "production") {
    if (config.BASEURL.includes("localhost")) {
      console.warn("WARNING: BASEURL contains localhost in production");
    }
  }
};

/**
 * Run validation on module load in production.
 */
if (process.env.NODEENV === "production") {
  validateConfig();
}
