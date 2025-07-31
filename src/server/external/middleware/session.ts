/**
 * Session Middleware
 * 
 * Manages user sessions using the auth module's SessionService.
 * Provides session tracking, validation, and automatic refresh.
 * 
 * @module server/external/middleware/session
 */

import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from 'express';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { ServerAuthAdapter } from '@/server/services/auth-adapter.service';
import type { IAuthSessionsRow } from '@/modules/core/auth/types/index';

const logger = LoggerService.getInstance();
const authAdapter = ServerAuthAdapter.getInstance();

/**
 * Extended Express Request with session
 */
declare module 'express-serve-static-core' {
  interface Request {
    session?: IAuthSessionsRow;
    sessionId?: string;
    userId?: string;
  }
}

/**
 * Session middleware options
 */
export interface SessionMiddlewareOptions {
  /**
   * Cookie name for session ID
   */
  cookieName?: string;
  
  /**
   * Whether to automatically refresh session activity
   */
  autoRefresh?: boolean;
  
  /**
   * Session timeout in milliseconds
   */
  sessionTimeout?: number;
  
  /**
   * Whether to create a new session if none exists
   */
  createIfMissing?: boolean;
}

/**
 * Extract session ID from request
 */
const extractSessionId = (req: ExpressRequest, cookieName: string): string | null => {
  // Check cookies first
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  // Check session header (for API clients)
  const sessionHeader = req.headers['x-session-id'] || req.headers['mcp-session-id'];
  if (sessionHeader && typeof sessionHeader === 'string') {
    return sessionHeader;
  }

  return null;
};

/**
 * Check if session is expired
 */
const isSessionExpired = (session: IAuthSessionsRow): boolean => {
  if (!session.expires_at) {
    return false; // No expiry set
  }

  const expiryTime = new Date(session.expires_at).getTime();
  return Date.now() > expiryTime;
};

/**
 * Check if session is active
 */
const isSessionActive = (session: IAuthSessionsRow): boolean => {
  // Check if session is revoked
  if (session.is_active === false || session.is_active === 0) {
    return false;
  }

  // Check if session is expired
  if (isSessionExpired(session)) {
    return false;
  }

  return true;
};

/**
 * Set session cookie
 */
const setSessionCookie = (
  res: ExpressResponse,
  sessionId: string,
  cookieName: string,
  maxAge: number
): void => {
  res.cookie(cookieName, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge
  });
};

/**
 * Creates session middleware with options
 */
export const createSessionMiddleware = (
  options: SessionMiddlewareOptions = {}
): ((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => Promise<void>) => {
  // Default options
  const {
    cookieName = 'session_id',
    autoRefresh = true,
    sessionTimeout = 24 * 60 * 60 * 1000, // 24 hours
    createIfMissing = false
  } = options;

  return async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Ensure auth adapter is initialized (lazy initialization)
      if (!authAdapter['initialized']) {
        try {
          authAdapter.initialize();
        } catch (error) {
          // If auth adapter fails to initialize, continue without session support
          logger.warn(LogSource.AUTH, 'Auth adapter initialization failed, continuing without session support', { error });
          next();
          return;
        }
      }
      // Extract session ID
      const sessionId = extractSessionId(req, cookieName);

      if (!sessionId) {
        if (createIfMissing && req.user?.id) {
          // Create new session for authenticated user
          const newSession = await authAdapter.createSession(req.user.id, {
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip
          });

          req.session = newSession;
          req.sessionId = newSession.id;
          req.userId = newSession.user_id;

          // Set session cookie
          setSessionCookie(res, newSession.id, cookieName, sessionTimeout);

          logger.info(LogSource.AUTH, 'New session created', {
            sessionId: newSession.id,
            userId: newSession.user_id
          });
        }
        // No session and not creating one
        next();
        return;
      }

      // Get session from auth service
      const session = await authAdapter.getSession(sessionId);

      if (!session) {
        // Invalid session ID - clear cookie
        res.clearCookie(cookieName);
        next();
        return;
      }

      // Check if session is active
      if (!isSessionActive(session)) {
        // Session expired or revoked - clear cookie
        res.clearCookie(cookieName);
        
        logger.info(LogSource.AUTH, 'Session inactive', {
          sessionId,
          userId: session.user_id,
          expired: isSessionExpired(session),
          revoked: !session.is_active
        });

        next();
        return;
      }

      // Attach session to request
      req.session = session;
      req.sessionId = session.id;
      req.userId = session.user_id;

      // Auto-refresh session activity
      if (autoRefresh) {
        try {
          await authAdapter.touchSession(sessionId);
        } catch (error) {
          // Log but don't fail the request
          logger.error(LogSource.AUTH, 'Failed to refresh session', {
            sessionId,
            error
          });
        }
      }

      // Refresh cookie expiry
      setSessionCookie(res, sessionId, cookieName, sessionTimeout);

      next();
    } catch (error) {
      logger.error(LogSource.AUTH, 'Session middleware error', { error });
      
      // Clear potentially corrupt session
      res.clearCookie(cookieName);
      
      // Continue without session
      next();
    }
  };
};

/**
 * Default session middleware
 */
export const sessionMiddleware = createSessionMiddleware();

/**
 * Session-required middleware - ensures session exists
 */
export const requireSession = createSessionMiddleware({
  createIfMissing: false
});

/**
 * Auto-create session middleware - creates session if missing
 */
export const autoCreateSession = createSessionMiddleware({
  createIfMissing: true
});