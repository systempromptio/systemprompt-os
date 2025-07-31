/**
 * Server Auth Adapter Service
 * 
 * Provides a clean interface between the server layer and auth module services.
 * Handles server-specific concerns like HTTP request/response patterns, error transformation,
 * and caching while maintaining loose coupling with the auth module.
 * 
 * @module server/services/auth-adapter
 */

import type { Request as ExpressRequest } from 'express';
import { randomBytes, createHash } from 'crypto';
import { getAuthModule } from '@/modules/core/auth/index';
import type { AuthService } from '@/modules/core/auth/services/auth.service';
import type { TokenService } from '@/modules/core/auth/services/token.service';
import type { SessionService } from '@/modules/core/auth/services/session.service';
import type { ProvidersService } from '@/modules/core/auth/services/providers.service';
import type { OAuth2ConfigurationService } from '@/modules/core/auth/services/oauth2-config.service';
import type { AuthCodeService } from '@/modules/core/auth/services/auth-code.service';
import type { 
  TokenValidationResult,
  LoginResult,
  IAuthSessionsRow,
  IAuthTokensRow 
} from '@/modules/core/auth/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';

const logger = LoggerService.getInstance();

/**
 * OAuth state data stored during authorization flow
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
 * Token creation options
 */
export interface CreateTokenOptions {
  userId: string;
  clientId: string;
  scopes: string[];
  sessionId?: string;
  expiresIn?: number;
}

/**
 * Authorization code creation options
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
 * HTTP-friendly auth result
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
 * Token response format
 */
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope: string;
}

/**
 * Server Auth Adapter - Bridges server layer with auth module services
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

  // Token validation cache (1 minute TTL)
  private tokenCache = new Map<string, { result: TokenValidationResult; expiresAt: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  // OAuth state storage (10 minute TTL for OAuth flows)
  private stateCache = new Map<string, { state: OAuthStateData; expiresAt: number }>();
  private readonly STATE_TTL = 600000; // 10 minutes

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ServerAuthAdapter {
    if (!ServerAuthAdapter.instance) {
      ServerAuthAdapter.instance = new ServerAuthAdapter();
    }
    return ServerAuthAdapter.instance;
  }

  /**
   * Initialize the adapter with auth module services
   * Simply gets the already-initialized services from the auth module
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Get the already bootstrapped and healthy auth module
      const authModule = getAuthModule();
      
      // Get the service instances from the module exports
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
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Ensure services are initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ServerAuthAdapter not initialized. Call initialize() first.');
    }
  }

  /**
   * Extract token from Express request
   */
  extractTokenFromRequest(req: ExpressRequest): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookies
    if (req.cookies?.auth_token) {
      return req.cookies.auth_token;
    }

    // Check query params (for websocket upgrades)
    if (typeof req.query.token === 'string') {
      return req.query.token;
    }

    return null;
  }

  /**
   * Validate token with caching
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    this.ensureInitialized();

    // Check cache
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    // Validate with service
    const result = await this.tokenService!.validateToken(token);

    // Cache successful validations
    if (result.valid) {
      this.tokenCache.set(token, {
        result,
        expiresAt: Date.now() + this.CACHE_TTL
      });
    }

    return result;
  }

  /**
   * Validate token and return HTTP-friendly result
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
        user: result.userId,
        scopes: result.scopes
      };
    } catch (error) {
      logger.error(LogSource.AUTH, 'Token validation error', { error });

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
   * Create OAuth state for authorization flow
   */
  async createAuthorizationState(data: OAuthStateData): Promise<string> {
    this.ensureInitialized();

    // Create state object
    const state = {
      ...data,
      nonce: data.nonce || randomBytes(16).toString('hex'),
      timestamp: Date.now()
    };

    // Store in memory cache (expires in 10 minutes)
    this.stateCache.set(state.nonce, {
      state,
      expiresAt: Date.now() + this.STATE_TTL
    });

    return state.nonce;
  }

  /**
   * Validate OAuth state
   */
  async validateAuthorizationState(stateNonce: string): Promise<OAuthStateData | null> {
    this.ensureInitialized();

    // Get state from memory cache
    const cached = this.stateCache.get(stateNonce);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expiresAt <= Date.now()) {
      this.stateCache.delete(stateNonce);
      return null;
    }

    // Delete state after validation (one-time use)
    this.stateCache.delete(stateNonce);

    return cached.state;
  }

  /**
   * Get provider by ID
   */
  async getProvider(providerId: string): Promise<any> {
    this.ensureInitialized();
    return this.providersService!.getProvider(providerId);
  }

  /**
   * Get all providers
   */
  async getAllProviders(): Promise<any[]> {
    this.ensureInitialized();
    return this.providersService!.getAllProviderInstances();
  }

  /**
   * Get provider callback URL
   */
  async getProviderCallbackUrl(provider: string): Promise<string> {
    this.ensureInitialized();
    return this.oauth2ConfigService!.getProviderCallbackUrl(provider);
  }

  /**
   * Authenticate user via OAuth
   */
  async authenticateOAuthUser(params: {
    provider: string;
    providerUserId: string;
    email: string;
    profile: any;
  }): Promise<{ userId: string; isNewUser: boolean }> {
    this.ensureInitialized();

    // Use auth service to create/update user via OAuth
    const user = await this.authService!.createOrUpdateUserFromOAuth(
      params.provider,
      params.providerUserId,
      {
        email: params.email,
        name: params.profile.name,
        avatar: params.profile.picture || params.profile.avatar_url
      }
    );

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    return {
      userId: user.id,
      isNewUser: false // TODO: Track if user is new
    };
  }

  /**
   * Create user session
   */
  async createSession(userId: string, metadata?: any): Promise<IAuthSessionsRow> {
    this.ensureInitialized();
    return this.sessionService!.createSession({
      user_id: userId,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      metadata
    });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<IAuthSessionsRow | null> {
    this.ensureInitialized();
    return this.sessionService!.getSession(sessionId);
  }

  /**
   * Update session activity
   */
  async touchSession(sessionId: string): Promise<void> {
    this.ensureInitialized();
    await this.sessionService!.touchSession(sessionId);
  }

  /**
   * Create access token
   */
  async createAccessToken(options: CreateTokenOptions): Promise<TokenResponse> {
    this.ensureInitialized();

    const token = await this.tokenService!.createToken({
      user_id: options.userId,
      type: 'access',
      name: `Access token for ${options.clientId}`,
      scopes: options.scopes,
      expires_in: options.expiresIn || 3600 // 1 hour default
    });

    return {
      accessToken: token.token,
      tokenType: 'Bearer',
      expiresIn: options.expiresIn || 3600,
      scope: options.scopes.join(' ')
    };
  }

  /**
   * Create refresh token
   */
  async createRefreshToken(options: CreateTokenOptions): Promise<string> {
    this.ensureInitialized();

    const token = await this.tokenService!.createToken({
      user_id: options.userId,
      type: 'refresh',
      name: `Refresh token for ${options.clientId}`,
      scopes: ['offline_access'],
      expires_in: 30 * 24 * 60 * 60 // 30 days
    });

    return token.token;
  }

  /**
   * Create authorization code
   */
  async createAuthorizationCode(options: CreateAuthCodeOptions): Promise<string> {
    this.ensureInitialized();

    const code = await this.authCodeService!.createAuthorizationCode({
      client_id: options.clientId,
      user_id: options.userId,
      redirect_uri: options.redirectUri,
      scope: options.scope,
      code_challenge: options.codeChallenge,
      code_challenge_method: options.codeChallengeMethod
    });

    return code.code;
  }

  /**
   * Validate authorization code
   */
  async validateAuthorizationCode(
    code: string, 
    clientId: string, 
    redirectUri: string,
    codeVerifier?: string
  ): Promise<any> {
    this.ensureInitialized();

    return this.authCodeService!.validateAuthorizationCode(
      code,
      clientId,
      redirectUri,
      codeVerifier
    );
  }

  /**
   * Create tokens from authorization code
   */
  async createTokensFromCode(codeData: any): Promise<TokenResponse & { refreshToken: string }> {
    this.ensureInitialized();

    // Create access token
    const accessTokenResponse = await this.createAccessToken({
      userId: codeData.user_id,
      clientId: codeData.client_id,
      scopes: codeData.scope.split(' ')
    });

    // Create refresh token
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
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    this.ensureInitialized();

    const result = await this.authService!.refreshAccessToken(refreshToken);

    if (!result.success || !result.accessToken) {
      throw new Error(result.reason || 'Failed to refresh token');
    }

    // Parse the token to get expiry info
    const validation = await this.tokenService!.validateToken(result.accessToken);

    return {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600, // Default 1 hour
      scope: validation.scopes?.join(' ') || ''
    };
  }

  /**
   * Revoke token
   */
  async revokeToken(tokenId: string): Promise<void> {
    this.ensureInitialized();
    await this.tokenService!.revokeToken(tokenId);
  }

  /**
   * Clear token cache
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [token, cached] of this.tokenCache.entries()) {
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