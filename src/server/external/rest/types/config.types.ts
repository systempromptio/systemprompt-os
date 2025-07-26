/**
 * @file Configuration endpoint type definitions.
 * @description Type definitions for the configuration REST endpoints.
 * @module server/external/rest/types/config.types
 */

import type { Request as ExpressRequest } from 'express';

/**
 * Extended Request interface to include authenticated user information.
 * Extends Express Request with optional user data containing roles.
 */
export interface IAuthenticatedRequest extends ExpressRequest {
  user?: Express.User & {
    name?: string;
    [key: string]: unknown;
  };
}
