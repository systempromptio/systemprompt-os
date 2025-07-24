/**
 * @fileoverview Express type extensions for authenticated requests
 * @module server/external/types/express
 */

declare global {
  namespace Express {
    interface User {
      id: string;
      sub: string;
      email: string;
      roles: string[];
      scope?: string;
      clientid?: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};