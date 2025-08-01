/**
 * Server Auth Adapter Service.
 * Provides a clean interface between the server layer and auth module services.
 * Handles server-specific concerns like HTTP request/response patterns, error transformation,
 * and caching while maintaining loose coupling with the auth module.
 * @module server/services/auth-adapter
 */

import type { Request as ExpressRequest } from 'express';
import { randomBytes } from 'crypto';

// ========================================
// Local Type Definitions
// ========================================

/**
 * Database session row interface.
 */
export interface IAuthSessionsRow {
  id: string;
  user_id: string;
  type: string;
  created_at: string;
  expires_at: string;
  last_accessed: string;
  data?: Record<string, unknown>;
}

/**
 * Token validation result interface.
 */
export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  scopes?: string[];
  reason?: string;
  expiresAt?: Date;
}

/**
 * Log source enumeration.
 */
export enum LogSource {
  SERVER = 'server',
  AUTH = 'auth',
}

/**
 * Simple logger interface.
 */
interface ILogger {
  info(source: LogSource, message: string, context?: Record<string, unknown>): void;
  error(source: LogSource, message: string, context?: Record<string, unknown>): void;
}

/**
 * Simple logger implementation.
 */
class SimpleLogger implements ILogger {
  private static instance: SimpleLogger;

  static getInstance(): SimpleLogger {
    SimpleLogger.instance ||= new SimpleLogger();
    return SimpleLogger.instance;
  }

  info(source: LogSource, message: string, context?: Record<string, unknown>): void {
    console.log(`[${source.toUpperCase()}] INFO: ${message}`, context ? JSON.stringify(context) : '');
  }

  error(source: LogSource, message: string, context?: Record<string, unknown>): void {
    console.error(`[${source.toUpperCase()}] ERROR: ${message}`, context ? JSON.stringify(context) : '');
  }
}

/**
 * Mock auth module interface for compilation.
 */
interface AuthModule {
  exports: {
    authService: () => AuthService;
    tokenService: () => TokenService;
    sessionService: () => SessionService;
    providersService: () => ProvidersService;
    oauth2ConfigService: () => OAuth2ConfigurationService;
    authCodeService: () => AuthCodeService;
  };
}

/**
 * Minimal service interfaces for compilation.
 */
interface AuthService {
  createOrUpdateUserFromOAuth(provider: string, providerId: string, profile: {
    email: string;
    name?: string;
    avatar?: string;
  }): Promise<{ userId: string; isNewUser: boolean } | null>;
  refreshAccessToken(refreshToken: string): Promise<{ accessToken?: string }>;
}

interface TokenService {
  validateToken(token: string): Promise<TokenValidationResult>;
  createToken(params: {
    user_id: string;
    type: 'api' | 'personal' | 'service';
    name: string;
    scopes: string[];
    expires_in: number;
  }): Promise<{ token: string }>;
  revokeToken(tokenId: string): Promise<void>;
}

interface SessionService {
  createSession(params: { userId: string; type: string }): Promise<IAuthSessionsRow>;
  getSession(sessionId: string): Promise<IAuthSessionsRow | null>;
}

interface ProvidersService {
  getProvider(providerId: string): Promise<unknown>;
  getAllProviderInstances(): Promise<unknown[]>;
}

interface OAuth2ConfigurationService {
  getProviderCallbackUrl(provider: string): Promise<string>;
}

interface AuthCodeService {
  createAuthorizationCode(params: {
    code: string;
    provider: string;
    user_id: string;
    redirect_uri: string;
    scopes: string[];
    expires_at: Date;
    clientId: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<string>;
  getAuthorizationCode(code: string): Promise<{
    clientId: string;
    redirect_uri: string;
    user_id: string;
    client_id: string;
    scope: string;
  } | null>;
}

/**
 * Mock function to get auth module - returns a stub for compilation.
 */
function getAuthModule(): AuthModule {
  throw new Error('getAuthModule not implemented - this is a compilation stub');
}

const logger = SimpleLogger.getInstance();

// ========================================
// Main Service Implementation
// ========================================

/**
 * OAuth state data stored during authorization flow.
 */
export interface OAuthStateData {
  nonce: string;
  timestamp: number;
  clientId: string;
  redirectUri: string;
  scope: string;
  provider: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  originalState?: string;
}

/**
 * Token creation options.
 */
export interface CreateTokenOptions {
  userId: string;
  clientId: string;
  scopes: string[];
  sessionId?: string;
  expiresIn?: number;
}

/**
 * Authorization code creation options.
 */
export interface CreateAuthCodeOptions {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/**
 * HTTP-friendly auth result.
 */
export interface HttpAuthResult {
  success: boolean;
  statusCode: number;
  error?: string;
  errorDescription?: string;
  user?: string;
  scopes?: string[];
}

/**
 * Token response format.
 */
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope: string;
}

/**
 * Server Auth Adapter - Bridges server layer with auth module services.
 */
export class ServerAuthAdapter {
  private static instance: ServerAuthAdapter;
  private authService?: AuthService;
  private tokenService?: TokenService;
  private sessionService?: SessionService;
  private providersService?: ProvidersService;
  private oauth2ConfigService?: OAuth2ConfigurationService;
  private authCodeService?: AuthCodeService;
  private initialized = false;
  private readonly tokenCache = new Map<string, { result: TokenValidationResult; expiresAt: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly stateCache = new Map<string, { state: OAuthStateData; expiresAt: number }>();
  private readonly STATE_TTL = 600000; // 10 minutes

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   */
  static getInstance(): ServerAuthAdapter {
    ServerAuthAdapter.instance ||= new ServerAuthAdapter();
    return ServerAuthAdapter.instance;
  }

  /**
   * Initialize the adapter with auth module services
   * Simply gets the already-initialized services from the auth module.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      const authModule = getAuthModule();

      this.authService = authModule.exports.authService();
      this.tokenService = authModule.exports.tokenService();
      this.sessionService = authModule.exports.sessionService();
      this.providersService = authModule.exports.providersService();
      this.oauth2ConfigService = authModule.exports.oauth2ConfigService();
      this.authCodeService = authModule.exports.authCodeService();
      this.initialized = true;

      logger.info(LogSource.SERVER, 'ServerAuthAdapter initialized successfully');
    } catch (error) {
      logger.error(LogSource.SERVER, 'ServerAuthAdapter initialization failed', {
        error: error instanceof Error ? error : String(error),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Ensure services are initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ServerAuthAdapter not initialized. Call initialize() first.');
    }
  }

  /**
   * Extract token from Express request.
   * @param req
   */
  extractTokenFromRequest(req: ExpressRequest): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    if (req.cookies?.auth_token) {
      return req.cookies.auth_token;
    }

    if (typeof req.query.token === 'string') {
      return req.query.token;
    }

    return null;
  }

  /**
   * Validate token with caching.
   * @param token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    this.ensureInitialized();

    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await this.tokenService!.validateToken(token);

    if (result.valid) {
      this.tokenCache.set(token, {
        result,
        expiresAt: Date.now() + this.CACHE_TTL
      });
    }

    return result;
  }

  /**
   * Validate token and return HTTP-friendly result.
   * @param token
   */
  async validateTokenWithHttpResponse(token: string): Promise<HttpAuthResult> {
    try {
      const result = await this.validateToken(token);

      if (!result.valid) {
        return {
          success: false,
          statusCode: 401,
          error: 'invalid_token',
          errorDescription: result.reason || 'Token validation failed'
        };
      }

      return {
        success: true,
        statusCode: 200,
        ...result.userId && { user: result.userId },
        ...result.scopes && { scopes: result.scopes }
      };
    } catch (error) {
      logger.error(LogSource.AUTH, 'Token validation error', { error: error instanceof Error ? error : String(error) });

      if (error instanceof Error && error.message.includes('expired')) {
        return {
          success: false,
          statusCode: 401,
          error: 'token_expired',
          errorDescription: 'The access token has expired'
        };
      }

      return {
        success: false,
        statusCode: 500,
        error: 'server_error',
        errorDescription: 'Authentication service unavailable'
      };
    }
  }

  /**
   * Create OAuth state for authorization flow.
   * @param data
   */
  async createAuthorizationState(data: OAuthStateData): Promise<string> {
    this.ensureInitialized();

    const state = {
      ...data,
      nonce: data.nonce || randomBytes(16).toString('hex'),
      timestamp: Date.now()
    };

    this.stateCache.set(state.nonce, {
      state,
      expiresAt: Date.now() + this.STATE_TTL
    });

    return state.nonce;
  }

  /**
   * Validate OAuth state.
   * @param stateNonce
   */
  async validateAuthorizationState(stateNonce: string): Promise<OAuthStateData | null> {
    this.ensureInitialized();

    const cached = this.stateCache.get(stateNonce);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.stateCache.delete(stateNonce);
      return null;
    }

    this.stateCache.delete(stateNonce);

    return cached.state;
  }

  /**
   * Get provider by ID.
   * @param providerId
   */
  async getProvider(providerId: string): Promise<unknown> {
    this.ensureInitialized();
    return await this.providersService!.getProvider(providerId);
  }

  /**
   * Get all providers.
   */
  async getAllProviders(): Promise<unknown[]> {
    this.ensureInitialized();
    return this.providersService!.getAllProviderInstances();
  }

  /**
   * Get provider callback URL.
   * @param provider
   */
  async getProviderCallbackUrl(provider: string): Promise<string> {
    this.ensureInitialized();
    return await this.oauth2ConfigService!.getProviderCallbackUrl(provider);
  }

  /**
   * Authenticate user via OAuth.
   * @param params
   * @param params.provider
   * @param params.providerUserId
   * @param params.email
   * @param params.profile
   */
  async authenticateOAuthUser(params: {
    provider: string;
    providerUserId: string;
    email: string;
    profile: unknown;
  }): Promise<{ userId: string; isNewUser: boolean }> {
    this.ensureInitialized();

    const profile = params.profile as { name?: string; picture?: string; avatar_url?: string };

    const user = await this.authService!.createOrUpdateUserFromOAuth(
      params.provider,
      params.providerUserId,
      {
        email: params.email,
        name: profile.name,
        avatar: profile.picture || profile.avatar_url
      }
    );

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    return {
      userId: user.userId,
      isNewUser: user.isNewUser
    };
  }

  /**
   * Create user session.
   * @param userId
   * @param metadata
   * @param _metadata
   */
  async createSession(userId: string, _metadata?: unknown): Promise<IAuthSessionsRow> {
    this.ensureInitialized();
    return await this.sessionService!.createSession({
      userId,
      type: 'web'
    });
  }

  /**
   * Get session by ID.
   * @param sessionId
   */
  async getSession(sessionId: string): Promise<IAuthSessionsRow | null> {
    this.ensureInitialized();
    return await this.sessionService!.getSession(sessionId);
  }

  /**
   * Update session activity.
   * @param sessionId
   * @param _sessionId
   */
  async touchSession(_sessionId: string): Promise<void> {
    this.ensureInitialized();
  }

  /**
   * Create access token.
   * @param options
   */
  async createAccessToken(options: CreateTokenOptions): Promise<TokenResponse> {
    this.ensureInitialized();

    const token = await this.tokenService!.createToken({
      user_id: options.userId,
      type: 'api' as 'api' | 'personal' | 'service',
      name: `Access token for ${options.clientId}`,
      scopes: options.scopes,
      expires_in: options.expiresIn || 360
    });

    return {
      accessToken: token.token,
      tokenType: 'Bearer',
      expiresIn: options.expiresIn || 3600,
      scope: options.scopes.join(' ')
    };
  }

  /**
   * Create refresh token.
   * @param options
   */
  async createRefreshToken(options: CreateTokenOptions): Promise<string> {
    this.ensureInitialized();

    const token = await this.tokenService!.createToken({
      user_id: options.userId,
      type: 'api' as 'api' | 'personal' | 'service',
      name: `Refresh token for ${options.clientId}`,
      scopes: ['offline_access'],
      expires_in: 30 * 24 * 60 * 6
    });

    return token.token;
  }

  /**
   * Create authorization code.
   * @param options
   */
  async createAuthorizationCode(options: CreateAuthCodeOptions): Promise<string> {
    this.ensureInitialized();

    const code = await this.authCodeService!.createAuthorizationCode({
      code: '',
      provider: 'oauth2',
      user_id: options.userId,
      redirect_uri: options.redirectUri,
      scopes: options.scope.split(' '),
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      clientId: options.clientId,
      ...options.codeChallenge && { codeChallenge: options.codeChallenge },
      ...options.codeChallengeMethod && { codeChallengeMethod: options.codeChallengeMethod }
    });

    return code;
  }

  /**
   * Validate authorization code.
   * @param code
   * @param clientId
   * @param redirectUri
   * @param codeVerifier
   * @param _codeVerifier
   */
  async validateAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string,
    _codeVerifier?: string
  ): Promise<unknown> {
    this.ensureInitialized();

    const codeData = await this.authCodeService!.getAuthorizationCode(code);

    if (!codeData) {
      throw new Error('Invalid authorization code');
    }

    if (codeData.clientId !== clientId) {
      throw new Error('Client ID mismatch');
    }

    if (codeData.redirect_uri !== redirectUri) {
      throw new Error('Redirect URI mismatch');
    }

    return codeData;
  }

  /**
   * Create tokens from authorization code.
   * @param codeData
   */
  async createTokensFromCode(codeData: {
    user_id: string;
    client_id: string;
    scope: string;
  }): Promise<TokenResponse & { refreshToken: string }> {
    this.ensureInitialized();

    const accessTokenResponse = await this.createAccessToken({
      userId: codeData.user_id,
      clientId: codeData.client_id,
      scopes: codeData.scope.split(' ')
    });

    const refreshToken = await this.createRefreshToken({
      userId: codeData.user_id,
      clientId: codeData.client_id,
      scopes: ['offline_access']
    });

    return {
      ...accessTokenResponse,
      refreshToken
    };
  }

  /**
   * Refresh access token.
   * @param refreshToken
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    this.ensureInitialized();

    const result = await this.authService!.refreshAccessToken(refreshToken);

    if (!result.accessToken) {
      throw new Error('Failed to refresh token');
    }

    const validation = await this.tokenService!.validateToken(result.accessToken);

    return {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      scope: validation.scopes?.join(' ') || ''
    };
  }

  /**
   * Revoke token.
   * @param tokenId
   */
  async revokeToken(tokenId: string): Promise<void> {
    this.ensureInitialized();
    await this.tokenService!.revokeToken(tokenId);
  }

  /**
   * Clear token cache.
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Clean up expired cache entries.
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [token, cached] of Array.from(this.tokenCache.entries())) {
      if (cached.expiresAt <= now) {
        this.tokenCache.delete(token);
      }
    }
  }
}

// Start cache cleanup interval
setInterval(() => {
  ServerAuthAdapter.getInstance().cleanupCache();
}, 60000); // Every minute