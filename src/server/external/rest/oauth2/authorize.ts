/**
 * @file OAuth2 Authorization endpoint.
 * @module server/external/rest/oauth2/authorize
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { LoggerService } from '@/modules/core/logger/index';
import { LogSource } from '@/modules/core/logger/types/index';

// Mock imports for missing modules - these need to be implemented
const OAuth2Error = {
  invalidRequest: (message: string) => { return {
 code: 400,
toJSON: () => { return {
 error: 'invalid_request',
message
} }
} },
  serverError: (message: string) => { return {
 code: 500,
toJSON: () => { return {
 error: 'server_error',
message
} }
} }
};

const getAuthModule = () => { return {
  exports: {
    getProviderRegistry: () => { return {
      getProvider: (name: string) => { return mockProviders[name] },
      getAllProviders: () => { return Object.values(mockProviders) }
    } },
    authCodeService: () => { return mockAuthCodeService }
  }
} };

// Mock provider interface
interface IdentityProvider {
  name: string;
  getAuthorizationUrl: (state: string) => string;
  exchangeCodeForTokens: (code: string) => Promise<{ access_token: string }>;
  getUserInfo: (token: string) => Promise<{ id: string; email?: string; name?: string; picture?: string; raw?: any }>;
}

const mockProviders: Record<string, IdentityProvider> = {
  google: {
    name: 'google',
    getAuthorizationUrl: (state: string) => { return `https://accounts.google.com/oauth/authorize?state=${state}` },
    exchangeCodeForTokens: async (_code: string) => { return { access_token: 'mock_token' } },
    getUserInfo: async (_token: string) => { return {
 id: 'mock_id',
email: 'mock@email.com'
} }
  }
};

const AuthRepository = {
  getInstance: () => { return {
    upsertUserFromOAuth: async (_provider: string, _providerId: string, userData: any) => { return {
      id: 'mock_user_id',
      email: userData.email,
      createdAt: new Date(),
      updatedAt: new Date()
    } }
  } }
};

const mockAuthCodeService = {
  createAuthorizationCode: async (_data: any) => { return 'mock_auth_code' },
  cleanupExpiredCodes: async () => {}
};

const logger = LoggerService.getInstance();

// Schema for authorization request
const AuthorizeRequestSchema = z.object({
  response_type: z.enum(['code', 'code id_token']),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string(),
  state: z.string().optional(),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(['S256', 'plain']).optional(),
  provider: z.string().optional(), // IDP to use (google, github, etc)
  provider_code: z.string().optional(), // Code from IDP
});

// Get auth code service instance
let authCodeService: any;

function getAuthCodeService(): any {
  if (!authCodeService) {
    const authModule = getAuthModule();
    authCodeService = authModule.exports.authCodeService();
  }
  return authCodeService;
}

export class AuthorizeEndpoint {
  /**
   * GET /oauth2/authorize
   * Display authorization consent screen.
   * @param req
   * @param res
   */
  getAuthorize = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const params = AuthorizeRequestSchema.parse(req.query);

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

        const provider = providerRegistry.getProvider(params.provider.toLowerCase());
        if (!provider) {
          throw new Error(`Unknown provider: ${params.provider}`);
        }

        const stateData = {
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scope: params.scope,
          originalState: params.state,
          codeChallenge: params.code_challenge,
          codeChallengeMethod: params.code_challenge_method,
        };

        const providerState = Buffer.from(JSON.stringify(stateData)).toString('base64url');

        if (!provider) {
          throw new Error('provider is required');
        }
        const providerAuthUrl = provider.getAuthorizationUrl(providerState);

        res.redirect(providerAuthUrl);
        return;
      }

      const availableProviders = providerRegistry.getAllProviders();

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sign In - systemprompt-os</title>
          <style>
            body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
            .container { background: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; margin-bottom: 30px; }
            .client { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
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
            .provider-icon { width: 20px; height: 20px; margin-right: 10px; }
            .divider { text-align: center; margin: 20px 0; color: #999; }
            .cancel { text-align: center; margin-top: 20px; }
            .cancel a { color: #666; text-decoration: none; }
            .cancel a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Sign in to continue</h1>
            <div class="client">
              <strong>Application:</strong> ${params.client_id}<br>
              <small style="color: #666;">This application is requesting access to your account</small>
            </div>
            <div class="scopes">
              <strong>Requested permissions:</strong>
              <ul>
                ${params.scope
                  .split(' ')
                  .map((scope) => {
                    return `<li class="scope-item">${scope}</li>`;
                  })
                  .join('')}
              </ul>
            </div>
            <div class="provider-list">
              <h3 style="text-align: center; margin-bottom: 20px;">Choose how to sign in:</h3>
              ${availableProviders
                .map((provider: IdentityProvider) => {
                  return `
                <a href="/oauth2/authorize?${new URLSearchParams({
                  ...Object.fromEntries(
                    Object.entries(params).filter(([_, v]) => {
                      return v !== undefined;
                    }),
                  ),
                  provider: provider.name,
                }).toString()}" class="provider-button provider-${provider.name}">
                  ${provider.name === 'google' ? '🔵' : '⚫'} Sign in with ${provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
                </a>
              `;
                })
                .join('')}
            </div>
            <div class="cancel">
              <a href="${params.redirect_uri}?error=access_denied&state=${params.state || ''}">Cancel</a>
            </div>
          </div>
        </body>
        </html>
      `;

      res.type('html').send(html);
    } catch (error) {
      logger.error(LogSource.AUTH, 'OAuth2 authorize GET error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'oauth2',
        action: 'authorize'
      });
      if (error instanceof z.ZodError) {
        const oauthError = OAuth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = OAuth2Error.serverError(error instanceof Error ? error.message : 'Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };
  postAuthorize = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const {
 action, redirect_uri, state
} = req.body;

      if (action === 'deny') {
        const params = new URLSearchParams({
          error: 'access_denied',
          error_description: 'User denied the authorization request',
        });
        if (state) {
          params.append('state', state);
        }

        res.redirect(`${redirect_uri}?${params}`);
        return;
      }

      const params = AuthorizeRequestSchema.parse(req.body);

      const { user } = req;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const authCodeService = getAuthCodeService();
      const code = await authCodeService.createAuthorizationCode({
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        scope: params.scope,
        userId: user.sub || user.id,
        userEmail: user.email,
        ...params.provider && { provider: params.provider },
        ...params.provider_code && { providerTokens: { code: params.provider_code } },
        ...params.code_challenge && { codeChallenge: params.code_challenge },
        ...params.code_challenge_method && { codeChallengeMethod: params.code_challenge_method },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await authCodeService.cleanupExpiredCodes();

      const responseParams = new URLSearchParams({ code });
      if (params.state) {
        responseParams.append('state', params.state);
      }

      res.redirect(`${params.redirect_uri}?${responseParams}`);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const oauthError = OAuth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = OAuth2Error.serverError('Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };
  handleProviderCallback = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const { provider } = req.params;
      if (!provider) {
        throw new Error('Provider parameter is required');
      }
      const providerName = provider.toLowerCase();
      const {
 code, state, error, error_description
} = req.query;

      logger.info(LogSource.AUTH, 'OAuth provider callback received', {
        category: 'oauth2',
        action: 'callback',
        persistToDb: true
      });

      if (error) {
        logger.error(LogSource.AUTH, 'Provider returned error', {
          error: typeof error === 'string' ? new Error(error) : error instanceof Error ? error : new Error(String(error)),
          error_description,
          category: 'oauth2',
          action: 'callback'
        });
        return res.status(400).send(`
          <html>
          <body>
            <h1>Authentication Failed</h1>
            <p>Error: ${error}</p>
            <p>${error_description || ''}</p>
          </body>
          </html>
        `);
      }

      if (!code || !state) {
        throw new Error('Missing code or state parameter');
      }

      let stateData: any;
      try {
        stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString());
      } catch (error) {
        logger.error(LogSource.AUTH, 'Failed to decode state parameter', {
          error: error instanceof Error ? error : new Error(String(error)),
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

      const providerTokens = await providerInstance.exchangeCodeForTokens(code as string);

      const userInfo = await providerInstance.getUserInfo(providerTokens.access_token);

      logger.info(LogSource.AUTH, 'User authenticated via provider', {
        category: 'oauth2',
        action: 'authenticate',
        persistToDb: true
      });

      const authRepo = AuthRepository.getInstance();
      const avatarUrl
        = userInfo.picture
        || (userInfo.raw && typeof userInfo.raw === 'object' && 'avatar_url' in userInfo.raw
          ? String(userInfo.raw.avatar_url)
          : undefined);
      const user = await authRepo.upsertUserFromOAuth(providerName, userInfo.id, {
        email: userInfo.email || '',
        ...userInfo.name && { name: userInfo.name },
        ...avatarUrl && { avatar: avatarUrl },
      });

      logger.info(LogSource.AUTH, 'User upserted in database', {
        category: 'oauth2',
        action: 'user_upsert',
        persistToDb: true
      });

      const authCodeService = getAuthCodeService();
      const authCode = await authCodeService.createAuthorizationCode({
        clientId: stateData.clientId,
        redirectUri: stateData.redirectUri,
        scope: stateData.scope,
        userId: user.id,
        userEmail: user.email,
        provider: providerName,
        providerTokens: providerTokens as unknown as Record<string, unknown>,
        codeChallenge: stateData.codeChallenge,
        codeChallengeMethod: stateData.codeChallengeMethod,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });

      await authCodeService.cleanupExpiredCodes();

      const responseParams = new URLSearchParams({ code: authCode });
      if (stateData.originalState) {
        responseParams.append('state', stateData.originalState);
      }

      logger.info(LogSource.AUTH, 'Redirecting to client with authorization code', {
        category: 'oauth2',
        action: 'auth_code_redirect',
        persistToDb: true
      });

      res.redirect(`${stateData.redirectUri}?${responseParams}`);
    } catch (error) {
      logger.error(LogSource.AUTH, 'Provider callback error', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'oauth2',
        action: 'callback'
      });
      res.status(500).send(`
        <html>
        <body>
          <h1>Authentication Error</h1>
          <p>An error occurred during authentication. Please try again.</p>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
        </html>
      `);
    }
  };
}
