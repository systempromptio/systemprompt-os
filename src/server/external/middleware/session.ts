/**
 * Session Middleware.
 * Manages user sessions using the auth module's SessionService.
 * Provides session tracking, validation, and automatic refresh.
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
 * Extended Express Request with session.
 */
declare module 'express-serve-static-core' {
  interface Request {
    session?: IAuthSessionsRow;
    sessionId?: string;
    userId?: string;
  }
}

/**
 * Session middleware options.
 */
export interface SessionMiddlewareOptions {
    cookieName?: string;

    autoRefresh?: boolean;

    sessionTimeout?: number;

    createIfMissing?: boolean;
}

/**
 * Extract session ID from request.
 * @param req
 * @param cookieName
 */
const extractSessionId = (req: ExpressRequest, cookieName: string): string | null => {
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  const sessionHeader = req.headers['x-session-id'] || req.headers['mcp-session-id'];
  if (sessionHeader && typeof sessionHeader === 'string') {
    return sessionHeader;
  }

  return null;
};

/**
 * Check if session is expired.
 * @param session
 */
const isSessionExpired = (session: IAuthSessionsRow): boolean => {
  if (!session.expires_at) {
    return false
  }

  const expiryTime = new Date(session.expires_at).getTime();
  return Date.now() > expiryTime;
};

/**
 * Check if session is active.
 * @param session
 */
const isSessionActive = (session: IAuthSessionsRow): boolean => {
  if (session.revoked_at) {
    return false;
  }

  if (isSessionExpired(session)) {
    return false;
  }

  return true;
};

/**
 * Set session cookie.
 * @param res
 * @param sessionId
 * @param cookieName
 * @param maxAge
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
 * Creates session middleware with options.
 * @param options
 */
export const createSessionMiddleware = (
  options: SessionMiddlewareOptions = {}
): ((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => Promise<void>) => {
  const {
    cookieName = 'session_id',
    autoRefresh = true,
    sessionTimeout = 24 * 60 * 60 * 1000,
    createIfMissing = false
  } = options;

  return async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      try {
        authAdapter.initialize();
      } catch (error) {
        logger.warn(LogSource.AUTH, 'Auth adapter initialization failed, continuing without session support', { error: error instanceof Error ? error : String(error) });
        next();
        return;
      }
      const sessionId = extractSessionId(req, cookieName);

      if (!sessionId) {
        if (createIfMissing && req.user?.id) {
          const newSession = await authAdapter.createSession(req.user.id, {
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip
          });

          req.session = newSession;
          req.sessionId = newSession.id;
          req.userId = newSession.user_id;

          setSessionCookie(res, newSession.id, cookieName, sessionTimeout);

          logger.info(LogSource.AUTH, 'New session created', {
            sessionId: newSession.id,
            userId: newSession.user_id
          });
        }
        next();
        return;
      }

      const session = await authAdapter.getSession(sessionId);

      if (!session) {
        res.clearCookie(cookieName);
        next();
        return;
      }

      if (!isSessionActive(session)) {
        res.clearCookie(cookieName);

        logger.info(LogSource.AUTH, 'Session inactive', {
          sessionId,
          userId: session.user_id,
          expired: isSessionExpired(session),
          revoked: Boolean(session.revoked_at)
        });

        next();
        return;
      }

      req.session = session;
      req.sessionId = session.id;
      req.userId = session.user_id;

      if (autoRefresh) {
        try {
          await authAdapter.touchSession(sessionId);
        } catch (error) {
          logger.error(LogSource.AUTH, 'Failed to refresh session', {
            sessionId,
            error: error instanceof Error ? error : String(error)
          });
        }
      }

      setSessionCookie(res, sessionId, cookieName, sessionTimeout);

      next();
    } catch (error) {
      logger.error(LogSource.AUTH, 'Session middleware error', { error: error instanceof Error ? error : String(error) });

      res.clearCookie(cookieName);

      next();
    }
  };
};

/**
 * Default session middleware.
 */
export const sessionMiddleware = createSessionMiddleware();

/**
 * Session-required middleware - ensures session exists.
 */
export const requireSession = createSessionMiddleware({
  createIfMissing: false
});

/**
 * Auto-create session middleware - creates session if missing.
 */
export const autoCreateSession = createSessionMiddleware({
  createIfMissing: true
});
