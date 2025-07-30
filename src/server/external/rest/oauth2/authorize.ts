/**
 * OAuth2 Authorization endpoint.
 * @description Handles OAuth2 authorization flow including provider callbacks and consent.
 * @module server/external/rest/oauth2/authorize
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { z } from 'zod';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { getAuthModule } from '@/modules/core/auth/index';
import { AuthRepository } from '@/modules/core/auth/database/repository';
import type {
  IAuthCodeService,
  IAuthenticatedUser,
  IAuthorizeRequestParams,
  IIdentityProvider,
  IOAuth2Error,
  IOAuthUserData,
  IProviderRegistry,
  IStateData
} from '@/server/external/rest/oauth2/types/authorize.types';
import type { IAuthorizationCodeData } from '@/modules/core/auth/types/auth-code.types';

/**
 * Mock OAuth2 error implementation - needs to be replaced with actual implementation.
 */
const oauth2Error = {
  invalidRequest: (message: string): IOAuth2Error => {
    return {
      code: 400,
      toJSON(): { error: string; error_description: string } {
        return {
          error: 'invalid_request',
          error_description: message
        };
      }
    };
  },
  unsupportedResponseType: (message: string): IOAuth2Error => {
    return {
      code: 400,
      toJSON(): { error: string; error_description: string } {
        return {
          error: 'unsupported_response_type',
          error_description: message
        };
      }
    };
  },
  serverError: (message: string): IOAuth2Error => {
    return {
      code: 500,
      toJSON(): { error: string; error_description: string } {
        return {
          error: 'server_error',
          error_description: message
        };
      }
    };
  },
  accessDenied: (message: string): IOAuth2Error => {
    return {
      code: 400,
      toJSON(): { error: string; error_description: string } {
        return {
          error: 'access_denied',
          error_description: message
        };
      }
    };
  }
};

const logger = LoggerService.getInstance();

/**
 * Schema for authorization request validation.
 */
const authorizeRequestSchema = z.object({
  response_type: z.enum(['code', 'code id_token']),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  /**
   * Default scope for OAuth authorization requests.
   */
  scope: z.string().optional()
.default('openid email profile'),
  state: z.string().optional(),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['S256', 'plain']).optional(),
  provider: z.string().optional(),
  /**
   * Support both 'provider' and 'idp' for backwards compatibility.
   */
  idp: z.string().optional(),
  provider_code: z.string().optional()
}).transform((input): IAuthorizeRequestParams => {
  const params: IAuthorizeRequestParams = {
    response_type: input.response_type,
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    scope: input.scope
  };

  if (input.state) {
    params.state = input.state;
  }
  if (input.nonce) {
    params.nonce = input.nonce;
  }
  if (input.code_challenge) {
    params.code_challenge = input.code_challenge;
  }
  if (input.code_challenge_method) {
    params.code_challenge_method = input.code_challenge_method;
  }
  const providerValue = input.provider ?? input.idp;
  if (providerValue) {
    params.provider = providerValue;
  }
  if (input.provider_code) {
    params.provider_code = input.provider_code;
  }

  return params;
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

  providerParams.set('response_type', params.response_type);
  providerParams.set('client_id', params.client_id);
  providerParams.set('redirect_uri', params.redirect_uri);
  providerParams.set('scope', params.scope);
  providerParams.set('provider', providerName);

  if (params.state !== undefined) {
    providerParams.set('state', params.state);
  }
  if (params.nonce !== undefined) {
    providerParams.set('nonce', params.nonce);
  }
  if (params.code_challenge !== undefined) {
    providerParams.set('code_challenge', params.code_challenge);
  }
  if (params.code_challenge_method !== undefined) {
    providerParams.set('code_challenge_method', params.code_challenge_method);
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
  const scopeItems = (params.scope || '')
    .split(' ')
    .map((scope): string => { return `<li class="scope-item">${scope}</li>` })
    .join('');

  const providerButtons = availableProviders
    .map((provider): string => { return generateProviderButton(provider, params) })
    .join('');

  const cancelUrl = `${params.redirect_uri}?error=access_denied${
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
          <strong>Application:</strong> ${params.client_id}<br>
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
      ${description != null && description !== '' ? `<p>${description}</p>` : ''}
    </body>
    </html>
  `;
};

/**
 * Extract avatar URL from user info.
 * @param userInfo - User information from OAuth provider.
 * @param userInfo.picture - Optional picture URL.
 * @param userInfo.raw - Raw user data that may contain avatar URL.
 * @returns Avatar URL or undefined.
 */
const extractAvatarUrl = (userInfo: { picture?: string; raw?: unknown }): string | undefined => {
  if (userInfo.picture !== undefined) {
    return userInfo.picture;
  }

  if (userInfo.raw !== undefined
      && userInfo.raw !== null
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
const handleAuthorizationDenial = (
  res: ExpressResponse,
  redirectUri: string,
  state?: string
): void => {
  const params = new URLSearchParams({
    error: 'access_denied',
    errorDescription: 'User denied the authorization request'
  });

  if (state !== undefined) {
    params.append('state', state);
  }

  res.redirect(`${redirectUri}?${params.toString()}`);
};

/**
 * Create authorization code parameters.
 * @param params - Authorization request parameters.
 * @param params.clientId - OAuth client ID.
 * @param params.redirectUri - Redirect URI for authorization response.
 * @param params.scope - Requested OAuth scopes.
 * @param params.provider - OAuth provider name.
 * @param params.providerCode - Authorization code from provider.
 * @param params.codeChallenge - PKCE code challenge.
 * @param params.codeChallengeMethod - PKCE challenge method.
 * @param user - Authenticated user.
 * @returns Authorization code parameters.
 */
const createAuthCodeParams = (
  params: IAuthorizeRequestParams,
  user: IAuthenticatedUser
): IAuthorizationCodeData => {
  const authCodeParams: IAuthorizationCodeData = {
    clientId: params.client_id,
    redirectUri: params.redirect_uri,
    scope: params.scope,
    userId: user.sub ?? user.id ?? '',
    userEmail: user.email ?? '',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  };

  const {
 provider, provider_code, code_challenge, code_challenge_method
} = params;
  if (provider !== undefined) {
    authCodeParams.provider = provider;
  }
  if (provider_code !== undefined) {
    authCodeParams.providerTokens = { code: provider_code };
  }
  if (code_challenge !== undefined) {
    authCodeParams.codeChallenge = code_challenge;
  }
  if (code_challenge_method !== undefined) {
    authCodeParams.codeChallengeMethod = code_challenge_method;
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
    const authCodeServiceExport = authModule.exports.authCodeService();
    if (!authCodeServiceExport || typeof authCodeServiceExport !== 'object') {
      throw new Error('Invalid auth code service export');
    }
    authCodeService = authCodeServiceExport;
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
   * @returns Response or void.
   */
  public getAuthorize = (
    req: ExpressRequest,
    res: ExpressResponse
  ): ExpressResponse | void => {
    try {
      const params = authorizeRequestSchema.parse(req.query);

      const extendedReq = req as ExpressRequest & { user?: IAuthenticatedUser };
      if (params.provider === undefined && !extendedReq.user) {
        const loginParams = new URLSearchParams({
          redirect_uri: `/oauth2/authorize?${new URLSearchParams(req.query as any).toString()}`
        });
        res.redirect(`/auth?${loginParams.toString()}`);
        return;
      }

      const authModule = getAuthModule();
      const providerRegistryExport = authModule.exports.getProviderRegistry();
      const providerRegistry = providerRegistryExport as IProviderRegistry | null;

      if (providerRegistry === null) {
        throw new Error('Provider registry not initialized');
      }

      if (params.provider !== undefined) {
        logger.info(LogSource.AUTH, 'Redirecting to OAuth provider', {
          category: 'oauth2',
          action: 'redirect',
          persistToDb: false
        });

        const provider = providerRegistry.getProvider(
          params.provider.toLowerCase()
        );
        if (provider === undefined) {
          throw new Error(`Unknown provider: ${params.provider}`);
        }

        const stateData: IStateData = {
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scope: params.scope
        };

        if (params.state !== undefined) {
          stateData.originalState = params.state;
        }
        if (params.code_challenge !== undefined) {
          stateData.codeChallenge = params.code_challenge;
        }
        if (params.code_challenge_method !== undefined) {
          stateData.codeChallengeMethod = params.code_challenge_method;
        }

        const providerState = Buffer.from(
          JSON.stringify(stateData)
        ).toString('base64url');

        const providerAuthUrl = provider.getAuthorizationUrl(providerState);

        res.redirect(providerAuthUrl);
        return;
      }

      const availableProviders = providerRegistry.getAllProviders();
      const html = generateConsentPageHtml(params, availableProviders);
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
        const missingFields = error.errors.filter(e => { return e.code === 'invalid_type' && e.message === 'Required' });

        if (missingFields.some(e => { return e.path[0] === 'client_id' })) {
          const oauthError = oauth2Error.invalidRequest('client_id is required');
          res.status(oauthError.code).json(oauthError.toJSON());
        } else if (missingFields.some(e => { return e.path[0] === 'response_type' })) {
          const oauthError = oauth2Error.invalidRequest('response_type is required');
          res.status(oauthError.code).json(oauthError.toJSON());
        } else if (error.errors.some(e => { return e.path[0] === 'response_type' && e.code === 'invalid_enum_value' })) {
          const oauthError = oauth2Error.unsupportedResponseType('Unsupported response_type');
          res.status(oauthError.code).json(oauthError.toJSON());
        } else {
          const oauthError = oauth2Error.invalidRequest(error.errors[0]?.message || 'Invalid request');
          res.status(oauthError.code).json(oauthError.toJSON());
        }
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
        if (redirectUri === undefined) {
          throw new Error('Redirect URI is required');
        }
        handleAuthorizationDenial(res, redirectUri, state);
        return;
      }

      const params = authorizeRequestSchema.parse(req.body);

      if (params.provider !== undefined) {
        const authModule = getAuthModule();
        const providerRegistryExport = authModule.exports.getProviderRegistry();
      const providerRegistry = providerRegistryExport as IProviderRegistry | null;

        if (providerRegistry === null) {
          throw new Error('Provider registry not initialized');
        }

        const provider = providerRegistry.getProvider(
          params.provider.toLowerCase()
        );
        if (provider === undefined) {
          throw new Error(`Unknown provider: ${params.provider}`);
        }

        const stateData: IStateData = {
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scope: params.scope
        };

        if (params.state !== undefined) {
          stateData.originalState = params.state;
        }
        if (params.code_challenge !== undefined) {
          stateData.codeChallenge = params.code_challenge;
        }
        if (params.code_challenge_method !== undefined) {
          stateData.codeChallengeMethod = params.code_challenge_method;
        }

        const providerState = Buffer.from(
          JSON.stringify(stateData)
        ).toString('base64url');

        const providerAuthUrl = provider.getAuthorizationUrl(providerState);

        res.redirect(providerAuthUrl);
        return;
      }

      const extendedReq = req as ExpressRequest & { user?: IAuthenticatedUser };
      const { user } = extendedReq;
      if (user === undefined) {
        const loginParams = new URLSearchParams({
          redirect_uri: `/oauth2/authorize`
        });
        res.redirect(`/auth?${loginParams.toString()}`);
        return;
      }

      const authCodeServiceInstance = getAuthCodeService();
      const authCodeParams = createAuthCodeParams(params, user);

      const code = await authCodeServiceInstance.createAuthorizationCode(
        authCodeParams
      );

      await authCodeServiceInstance.cleanupExpiredCodes();

      const responseParams = new URLSearchParams({ code });
      if (params.state !== undefined) {
        responseParams.append('state', params.state);
      }

      res.redirect(`${params.redirect_uri}?${responseParams.toString()}`);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const missingFields = error.errors.filter(e => { return e.code === 'invalid_type' && e.message === 'Required' });

        if (missingFields.some(e => { return e.path[0] === 'client_id' })) {
          const oauthError = oauth2Error.invalidRequest('client_id is required');
          res.status(oauthError.code).json(oauthError.toJSON());
        } else if (missingFields.some(e => { return e.path[0] === 'response_type' })) {
          const oauthError = oauth2Error.invalidRequest('response_type is required');
          res.status(oauthError.code).json(oauthError.toJSON());
        } else if (error.errors.some(e => { return e.path[0] === 'response_type' && e.code === 'invalid_enum_value' })) {
          const oauthError = oauth2Error.unsupportedResponseType('Unsupported response_type');
          res.status(oauthError.code).json(oauthError.toJSON());
        } else {
          const oauthError = oauth2Error.invalidRequest(error.errors[0]?.message || 'Invalid request');
          res.status(oauthError.code).json(oauthError.toJSON());
        }
      } else {
        const oauthError = oauth2Error.serverError('Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };
  handleProviderCallback = async (req: ExpressRequest, res: ExpressResponse): Promise<ExpressResponse | void> => {
    try {
      const { provider } = req.params;

      if (provider == null || provider === '') {
        const {
 error, error_description: errorDescription, state, code
} = req.query as {
          error?: string;
          error_description?: string;
          state?: string;
          code?: string;
        };

        if (error != null && error !== '') {
          const oauthError = oauth2Error.accessDenied(errorDescription || 'User denied access');
          return res.status(oauthError.code).json(oauthError.toJSON());
        }

        if (code && state) {
          try {
            const decodedState = Buffer.from(state, 'base64url').toString();
            JSON.parse(decodedState) as IStateData;
          } catch (parseError: unknown) {
            const invalidError = oauth2Error.invalidRequest('Invalid state parameter');
            return res.status(invalidError.code).json(invalidError.toJSON());
          }
        }

        const invalidError = oauth2Error.invalidRequest('Provider parameter is required');
        return res.status(invalidError.code).json(invalidError.toJSON());
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

      if (code == null || code === '' || state == null || state === '') {
        const missingParam = !code ? 'code' : 'state';
        const invalidError = oauth2Error.invalidRequest(`Missing ${missingParam} parameter`);
        return res.status(invalidError.code).json(invalidError.toJSON());
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
        const invalidError = oauth2Error.invalidRequest('Invalid state parameter');
        return res.status(invalidError.code).json(invalidError.toJSON());
      }

      const authModule = getAuthModule();
      const providerRegistryExport = authModule.exports.getProviderRegistry();
      const providerRegistry = providerRegistryExport as IProviderRegistry | null;

      if (providerRegistry === null) {
        throw new Error('Provider registry not initialized');
      }

      const providerInstance = providerRegistry.getProvider(providerName);

      if (providerInstance === undefined) {
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

      const avatarUrl = extractAvatarUrl(userInfo);

      const userData: IOAuthUserData = {
        email: userInfo.email ?? ''
      };

      const { name } = userInfo;
      if (name !== undefined) {
        userData.name = name;
      }
      if (avatarUrl !== undefined) {
        userData.avatar = avatarUrl;
      }

      const authService = authModule.exports.service();
      const user = await authService.createOrUpdateUserFromOAuth(
        providerName,
        userInfo.id,
        userData
      );

      if (!user) {
        throw new Error('Failed to create or update user');
      }

      logger.info(LogSource.AUTH, 'User upserted in database', {
        category: 'oauth2',
        action: 'user_upsert',
        persistToDb: true
      });

      const authCodeServiceInstance = getAuthCodeService();
      const authCodeParams: IAuthorizationCodeData = {
        clientId: stateData.clientId,
        redirectUri: stateData.redirectUri,
        scope: stateData.scope,
        userId: user.id,
        userEmail: user.email,
        provider: providerName,
        providerTokens: providerTokens as unknown as Record<string, unknown>,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      };

      const { codeChallenge, codeChallengeMethod } = stateData;
      if (codeChallenge !== undefined) {
        authCodeParams.codeChallenge = codeChallenge;
      }
      if (codeChallengeMethod !== undefined) {
        authCodeParams.codeChallengeMethod = codeChallengeMethod;
      }

      const authCode = await authCodeServiceInstance.createAuthorizationCode(
        authCodeParams
      );

      await authCodeServiceInstance.cleanupExpiredCodes();

      const responseParams = new URLSearchParams({ code: authCode });
      const { originalState } = stateData;
      if (originalState !== undefined) {
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
