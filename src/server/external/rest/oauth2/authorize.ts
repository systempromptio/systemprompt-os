/**
 * OAuth2 Authorization endpoint.
 * @description Handles OAuth2 authorization flow including provider callbacks and consent.
 * @module server/external/rest/oauth2/authorize
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { z } from 'zod';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import type {
  IAuthCodeParams,
  IAuthCodeService,
  IAuthRepository,
  IAuthenticatedUser,
  IAuthorizeRequestParams,
  IDatabaseUser,
  IIdentityProvider,
  IOAuth2Error,
  IOAuthUserData,
  IProviderRegistry,
  IStateData
} from '@/server/external/rest/oauth2/types/authorize.types';

/**
 * Mock OAuth2 error implementation - needs to be replaced with actual implementation.
 */
const oauth2Error = {
  invalidRequest: (message: string): IOAuth2Error => {
    return {
      code: 400,
      toJSON(): { error: string; message: string } {
        return {
          error: 'invalid_request',
          message
        };
      }
    };
  },
  serverError: (message: string): IOAuth2Error => {
    return {
      code: 500,
      toJSON(): { error: string; message: string } {
        return {
          error: 'server_error',
          message
        };
      }
    };
  }
};

/**
 * Mock provider registry - needs to be replaced with actual implementation.
 */
const mockProviders: Record<string, IIdentityProvider> = {
  google: {
    name: 'google',
    getAuthorizationUrl: (state: string): string => {
      return `https://accounts.google.com/oauth/authorize?state=${state}`;
    },
    exchangeCodeForTokens: async (): Promise<{ accessToken: string }> => {
      return await Promise.resolve({ accessToken: 'mock_token' });
    },
    getUserInfo: async (): Promise<{ id: string; email: string }> => {
      return await Promise.resolve({
        id: 'mock_id',
        email: 'mock@email.com'
      });
    }
  }
};

/**
 * Mock auth code service - needs to be replaced with actual implementation.
 */
const mockAuthCodeService: IAuthCodeService = {
  createAuthorizationCode: async (): Promise<string> => {
    return await Promise.resolve('mock_auth_code');
  },
  cleanupExpiredCodes: async (): Promise<void> => {
    await Promise.resolve();
  }
};

/**
 * Mock auth module getter - needs to be replaced with actual implementation.
 * @returns Auth module with provider registry and auth code service exports.
 */
const getAuthModule = (): {
  exports: {
    getProviderRegistry: () => IProviderRegistry;
    authCodeService: () => IAuthCodeService;
  };
} => {
  return {
    exports: {
      getProviderRegistry: (): IProviderRegistry => {
        return {
          getProvider: (name: string): IIdentityProvider | undefined => {
            return mockProviders[name];
          },
          getAllProviders: (): IIdentityProvider[] => {
            return Object.values(mockProviders);
          }
        };
      },
      authCodeService: (): IAuthCodeService => {
        return mockAuthCodeService;
      }
    }
  };
};

/**
 * Mock auth repository - needs to be replaced with actual implementation.
 */
const authRepository = {
  getInstance: (): IAuthRepository => {
    return {
      async upsertUserFromOAuth(
        _provider: string,
        _providerId: string,
        userData: IOAuthUserData
      ): Promise<IDatabaseUser> {
        return await Promise.resolve({
          id: 'mock_user_id',
          email: userData.email,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    };
  }
};

const logger = LoggerService.getInstance();

/**
 * Schema for authorization request validation.
 */
const authorizeRequestSchema = z.object({
  responseType: z.enum(['code', 'code id_token']),
  clientId: z.string(),
  redirectUri: z.string().url(),
  scope: z.string(),
  state: z.string().optional(),
  nonce: z.string().optional(),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.enum(['S256', 'plain']).optional(),
  provider: z.string().optional(),
  providerCode: z.string().optional()
});

/**
 * Build URL search params for OAuth provider redirect.
 * @param params - Authorization request parameters.
 * @param providerName - Name of the OAuth provider.
 * @returns URLSearchParams object.
 */
const buildProviderParams = (
  params: IAuthorizeRequestParams,
  providerName: string
): URLSearchParams => {
  const providerParams = new URLSearchParams();

  providerParams.set('responseType', params.responseType);
  providerParams.set('clientId', params.clientId);
  providerParams.set('redirectUri', params.redirectUri);
  providerParams.set('scope', params.scope);
  providerParams.set('provider', providerName);

  if (params.state) {
    providerParams.set('state', params.state);
  }
  if (params.nonce) {
    providerParams.set('nonce', params.nonce);
  }
  if (params.codeChallenge) {
    providerParams.set('codeChallenge', params.codeChallenge);
  }
  if (params.codeChallengeMethod) {
    providerParams.set('codeChallengeMethod', params.codeChallengeMethod);
  }

  return providerParams;
};

/**
 * Generate provider button HTML.
 * @param provider - OAuth provider.
 * @param params - Authorization request parameters.
 * @returns HTML string for provider button.
 */
const generateProviderButton = (
  provider: IIdentityProvider,
  params: IAuthorizeRequestParams
): string => {
  const providerParams = buildProviderParams(params, provider.name);
  const providerName = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
  const icon = provider.name === 'google' ? '🔵' : '⚫';

  return `
    <a href="/oauth2/authorize?${providerParams.toString()}" 
       class="provider-button provider-${provider.name}">
      ${icon} Sign in with ${providerName}
    </a>
  `;
};

/**
 * Generate consent page CSS styles.
 * @returns CSS string.
 */
const generateConsentPageStyles = (): string => {
  return `
    body { font-family: system-ui; max-width: 600px; margin: 50px auto; 
      padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 40px; 
      box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; text-align: center; margin-bottom: 30px; }
    .client { background: #f8f9fa; padding: 15px; border-radius: 4px; 
      margin: 20px 0; }
    .scopes { margin: 20px 0; }
    .scope-item { margin: 10px 0; color: #666; }
    .provider-list { margin: 30px 0; }
    .provider-button { 
      display: flex; align-items: center; justify-content: center;
      width: 100%; padding: 12px 20px; margin: 10px 0;
      border: 1px solid #ddd; border-radius: 6px;
      background: white; color: #333;
      text-decoration: none; font-size: 16px;
      transition: all 0.2s;
    }
    .provider-button:hover { 
      background: #f8f9fa; border-color: #999;
      transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .provider-google { border-color: #4285f4; color: #4285f4; }
    .provider-google:hover { background: #f0f7ff; }
    .provider-github { border-color: #333; color: #333; }
    .provider-github:hover { background: #f6f8fa; }
    .cancel { text-align: center; margin-top: 20px; }
    .cancel a { color: #666; text-decoration: none; }
    .cancel a:hover { text-decoration: underline; }
  `;
};

/**
 * Generate authorization consent HTML page.
 * @param params - Authorization parameters.
 * @param availableProviders - List of available OAuth providers.
 * @returns HTML string for the consent page.
 */
const generateConsentPageHtml = (
  params: IAuthorizeRequestParams,
  availableProviders: IIdentityProvider[]
): string => {
  const scopeItems = params.scope
    .split(' ')
    .map((scope) => { return `<li class="scope-item">${scope}</li>` })
    .join('');

  const providerButtons = availableProviders
    .map((provider) => { return generateProviderButton(provider, params) })
    .join('');

  const cancelUrl = `${params.redirectUri ?? ''}?error=access_denied${
    params.state ? `&state=${params.state}` : ''
  }`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sign In - systemprompt-os</title>
      <style>${generateConsentPageStyles()}</style>
    </head>
    <body>
      <div class="container">
        <h1>Sign in to continue</h1>
        <div class="client">
          <strong>Application:</strong> ${params.clientId}<br>
          <small style="color: #666;">
            This application is requesting access to your account
          </small>
        </div>
        <div class="scopes">
          <strong>Requested permissions:</strong>
          <ul>
            ${scopeItems}
          </ul>
        </div>
        <div class="provider-list">
          <h3 style="text-align: center; margin-bottom: 20px;">
            Choose how to sign in:
          </h3>
          ${providerButtons}
        </div>
        <div class="cancel">
          <a href="${cancelUrl}">Cancel</a>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate error HTML page.
 * @param title - Error title.
 * @param message - Error message.
 * @param description - Optional error description.
 * @returns HTML string for the error page.
 */
const generateErrorPageHtml = (title: string, message: string, description?: string): string => {
  return `
    <html>
    <body>
      <h1>${title}</h1>
      <p>${message}</p>
      ${description ? `<p>${description}</p>` : ''}
    </body>
    </html>
  `;
};

/**
 * Extract avatar URL from user info.
 * @param userInfo - User information from OAuth provider.
 * @param userInfo.picture
 * @param userInfo.raw
 * @returns Avatar URL or undefined.
 */
const extractAvatarUrl = (userInfo: { picture?: string; raw?: unknown }): string | undefined => {
  if (userInfo.picture) {
    return userInfo.picture;
  }

  if (userInfo.raw
      && typeof userInfo.raw === 'object'
      && 'avatarUrl' in userInfo.raw
      && typeof userInfo.raw.avatarUrl === 'string') {
    return userInfo.raw.avatarUrl;
  }

  return undefined;
};

/**
 * Handle authorization denial.
 * @param res - Express response object.
 * @param redirectUri - Redirect URI.
 * @param state - State parameter.
 */
const handleAuthorizationDenial = (res: ExpressResponse, redirectUri: string, state?: string): void => {
  const params = new URLSearchParams({
    error: 'access_denied',
    errorDescription: 'User denied the authorization request'
  });

  if (state) {
    params.append('state', state);
  }

  res.redirect(`${redirectUri}?${params.toString()}`);
};

/**
 * Create authorization code parameters.
 * @param params - Authorization request parameters.
 * @param params.clientId
 * @param user - Authenticated user.
 * @param params.redirectUri
 * @param params.scope
 * @param params.provider
 * @param params.providerCode
 * @param params.codeChallenge
 * @param params.codeChallengeMethod
 * @returns Authorization code parameters.
 */
const createAuthCodeParams = (params: IAuthorizeRequestParams, user: IAuthenticatedUser): IAuthCodeParams => {
  const authCodeParams: IAuthCodeParams = {
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    userId: user.sub ?? user.id ?? '',
    userEmail: user.email ?? '',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  };

  if (params.provider) {
    authCodeParams.provider = params.provider;
  }
  if (params.providerCode) {
    authCodeParams.providerTokens = { code: params.providerCode };
  }
  if (params.codeChallenge) {
    authCodeParams.codeChallenge = params.codeChallenge;
  }
  if (params.codeChallengeMethod) {
    authCodeParams.codeChallengeMethod = params.codeChallengeMethod;
  }

  return authCodeParams;
};

/**
 * Cached auth code service instance.
 */
let authCodeService: IAuthCodeService | null = null;

/**
 * Get auth code service instance with lazy loading.
 * @returns The auth code service instance.
 */
const getAuthCodeService = (): IAuthCodeService => {
  if (authCodeService === null) {
    const authModule = getAuthModule();
    authCodeService = authModule.exports.authCodeService();
  }
  return authCodeService;
};

/**
 * OAuth2 Authorization endpoint handler.
 */
export class AuthorizeEndpoint {
  /**
   * GET /oauth2/authorize
   * Display authorization consent screen.
   * @param req - Express request object.
   * @param res - Express response object.
   * @returns Promise resolving to response or void.
   */
  public getAuthorize = async (
    req: ExpressRequest,
    res: ExpressResponse
  ): Promise<ExpressResponse | void> => {
    try {
      const params = authorizeRequestSchema.parse(req.query);

      const authModule = getAuthModule();
      const providerRegistry = authModule.exports.getProviderRegistry();

      if (!providerRegistry) {
        throw new Error('Provider registry not initialized');
      }

      if (params.provider) {
        logger.info(LogSource.AUTH, 'Redirecting to OAuth provider', {
          category: 'oauth2',
          action: 'redirect',
          persistToDb: false
        });

        const provider = providerRegistry.getProvider(
          params.provider.toLowerCase()
        );
        if (!provider) {
          throw new Error(`Unknown provider: ${params.provider}`);
        }

        const stateData: IStateData = {
          clientId: params.clientId,
          redirectUri: params.redirectUri,
          scope: params.scope
        };

        if (params.state) {
          stateData.originalState = params.state;
        }
        if (params.codeChallenge) {
          stateData.codeChallenge = params.codeChallenge;
        }
        if (params.codeChallengeMethod) {
          stateData.codeChallengeMethod = params.codeChallengeMethod;
        }

        const providerState = Buffer.from(
          JSON.stringify(stateData)
        ).toString('base64url');

        const providerAuthUrl = provider.getAuthorizationUrl(providerState);

        res.redirect(providerAuthUrl);
        return;
      }

      const availableProviders = providerRegistry.getAllProviders();
      const html = generateConsentPageHtml(params as IAuthorizeRequestParams, availableProviders);
      res.type('html').send(html);
    } catch (error: unknown) {
      const errorInstance = error instanceof Error
        ? error : new Error(String(error));

      logger.error(LogSource.AUTH, 'OAuth2 authorize GET error', {
        error: errorInstance,
        category: 'oauth2',
        action: 'authorize'
      });

      if (error instanceof z.ZodError) {
        const oauthError = oauth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = oauth2Error.serverError(
          errorInstance.message
        );
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };
  public postAuthorize = async (
    req: ExpressRequest,
    res: ExpressResponse
  ): Promise<ExpressResponse | void> => {
    try {
      const requestBody = req.body as unknown;

      if (typeof requestBody !== 'object' || requestBody === null) {
        throw new Error('Invalid request body');
      }

      const bodyObj = requestBody as Record<string, unknown>;
      const action = typeof bodyObj.action === 'string' ? bodyObj.action : undefined;
      const redirectUri = typeof bodyObj.redirectUri === 'string' ? bodyObj.redirectUri : undefined;
      const state = typeof bodyObj.state === 'string' ? bodyObj.state : undefined;

      if (action === 'deny') {
        if (!redirectUri) {
          throw new Error('Redirect URI is required');
        }
        handleAuthorizationDenial(res, redirectUri, state);
        return;
      }

      const params = authorizeRequestSchema.parse(req.body);

      const extendedReq = req as ExpressRequest & { user?: IAuthenticatedUser };
      const { user } = extendedReq;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const authCodeServiceInstance = getAuthCodeService();
      const authCodeParams = createAuthCodeParams(params as IAuthorizeRequestParams, user);

      const code = await authCodeServiceInstance.createAuthorizationCode(
        authCodeParams
      );

      await authCodeServiceInstance.cleanupExpiredCodes();

      const responseParams = new URLSearchParams({ code });
      if (params.state) {
        responseParams.append('state', params.state);
      }

      res.redirect(`${params.redirectUri}?${responseParams.toString()}`);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const oauthError = oauth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = oauth2Error.serverError('Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };
  handleProviderCallback = async (req: ExpressRequest, res: ExpressResponse): Promise<ExpressResponse | void> => {
    try {
      const { provider } = req.params;
      if (!provider) {
        throw new Error('Provider parameter is required');
      }
      const providerName = provider.toLowerCase();
      const {
 code, state, error, errorDescription
} = req.query as {
        code?: string;
        state?: string;
        error?: string;
        errorDescription?: string;
      };

      logger.info(LogSource.AUTH, 'OAuth provider callback received', {
        category: 'oauth2',
        action: 'callback',
        persistToDb: true
      });

      if (error) {
        logger.error(LogSource.AUTH, 'Provider returned error', {
          error: typeof error === 'string' ? new Error(error) : new Error(String(error)),
          errorDescription,
          category: 'oauth2',
          action: 'callback'
        });
        const errorDesc = errorDescription ? String(errorDescription) : undefined;
        return res.status(400).send(generateErrorPageHtml(
          'Authentication Failed',
          `Error: ${String(error)}`,
          errorDesc
        ));
      }

      if (!code || !state) {
        throw new Error('Missing code or state parameter');
      }

      let stateData: IStateData;
      try {
        const decodedState = Buffer.from(state, 'base64url').toString();
        stateData = JSON.parse(decodedState) as IStateData;
      } catch (parseError: unknown) {
        const errorInstance = parseError instanceof Error
          ? parseError : new Error(String(parseError));

        logger.error(LogSource.AUTH, 'Failed to decode state parameter', {
          error: errorInstance,
          category: 'oauth2',
          action: 'callback'
        });
        throw new Error('Invalid state parameter');
      }

      const authModule = getAuthModule();
      const providerRegistry = authModule.exports.getProviderRegistry();

      if (!providerRegistry) {
        throw new Error('Provider registry not initialized');
      }

      const providerInstance = providerRegistry.getProvider(providerName);

      if (!providerInstance) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const providerTokens = await providerInstance.exchangeCodeForTokens(code);

      const userInfo = await providerInstance.getUserInfo(
        providerTokens.accessToken
      );

      logger.info(LogSource.AUTH, 'User authenticated via provider', {
        category: 'oauth2',
        action: 'authenticate',
        persistToDb: true
      });

      const authRepo = authRepository.getInstance();
      const avatarUrl = extractAvatarUrl(userInfo);

      const userData: IOAuthUserData = {
        email: userInfo.email ?? ''
      };

      const { name } = userInfo;
      if (name) {
        userData.name = name;
      }
      if (avatarUrl) {
        userData.avatar = avatarUrl;
      }

      const user = await authRepo.upsertUserFromOAuth(
        providerName,
        userInfo.id,
        userData
      );

      logger.info(LogSource.AUTH, 'User upserted in database', {
        category: 'oauth2',
        action: 'user_upsert',
        persistToDb: true
      });

      const authCodeServiceInstance = getAuthCodeService();
      const authCodeParams: IAuthCodeParams = {
        clientId: stateData.clientId,
        redirectUri: stateData.redirectUri,
        scope: stateData.scope,
        userId: user.id,
        userEmail: user.email,
        provider: providerName,
        providerTokens,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      };

      const { codeChallenge, codeChallengeMethod } = stateData;
      if (codeChallenge) {
        authCodeParams.codeChallenge = codeChallenge;
      }
      if (codeChallengeMethod) {
        authCodeParams.codeChallengeMethod = codeChallengeMethod;
      }

      const authCode = await authCodeServiceInstance.createAuthorizationCode(
        authCodeParams
      );

      await authCodeServiceInstance.cleanupExpiredCodes();

      const responseParams = new URLSearchParams({ code: authCode });
      const { originalState } = stateData;
      if (originalState) {
        responseParams.append('state', originalState);
      }

      logger.info(LogSource.AUTH, 'Redirecting to client with authorization code', {
        category: 'oauth2',
        action: 'auth_code_redirect',
        persistToDb: true
      });

      res.redirect(`${stateData.redirectUri}?${responseParams.toString()}`);
    } catch (error: unknown) {
      const errorInstance = error instanceof Error
        ? error : new Error(String(error));

      logger.error(LogSource.AUTH, 'Provider callback error', {
        error: errorInstance,
        category: 'oauth2',
        action: 'callback'
      });

      return res.status(500).send(generateErrorPageHtml(
        'Authentication Error',
        'An error occurred during authentication. Please try again.',
        errorInstance.message
      ));
    }
  };
}
