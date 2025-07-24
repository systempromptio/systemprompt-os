/**
 * @file OAuth2 Authorization endpoint.
 * @module server/external/rest/oauth2/authorize
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { OAuth2Error } from '@/server/external/rest/oauth2/errors.js';
import { getAuthModule } from '@/modules/core/auth/singleton.js';
import { LoggerService } from '@/modules/core/logger/index.js';
import type { IdentityProvider } from '@/modules/core/auth/types/provider-interface.js';
import { AuthRepository } from '@/modules/core/auth/database/repository.js';
import type { AuthCodeService } from '@/modules/core/auth/services/auth-code-service.js';

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
let authCodeService: AuthCodeService;

function getAuthCodeService(): AuthCodeService {
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

      // Get the auth module to access provider registry
      const authModule = getAuthModule();
      const providerRegistry = authModule.exports.getProviderRegistry();

      if (!providerRegistry) {
        throw new Error('Provider registry not initialized');
      }

      // If a specific provider is requested, redirect to that provider
      if (params.provider) {
        logger.info('Redirecting to OAuth provider', { provider: params.provider });

        // Provider names are case-insensitive
        const provider = providerRegistry.getProvider(params.provider.toLowerCase());
        if (!provider) {
          throw new Error(`Unknown provider: ${params.provider}`);
        }

        /*
         * Store the original request parameters in session
         * In production, use proper session management
         */
        const stateData = {
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scope: params.scope,
          originalState: params.state,
          codeChallenge: params.code_challenge,
          codeChallengeMethod: params.code_challenge_method,
        };

        // Generate state parameter for provider
        const providerState = Buffer.from(JSON.stringify(stateData)).toString('base64url');

        // Get the provider's authorization URL
        if (!provider) {
          throw new Error('provider is required');
        }
        const providerAuthUrl = provider.getAuthorizationUrl(providerState);

        // Redirect to the provider
        res.redirect(providerAuthUrl);
        return;
      }

      // If no provider specified, show provider selection

      // Get available providers
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
      logger.error('OAuth2 authorize GET error:', error);
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

      // User approved - generate authorization code
      const params = AuthorizeRequestSchema.parse(req.body);

      // Get authenticated user from session/token
      const { user } = req;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Store authorization code in database
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

      // Clean up expired codes
      await authCodeService.cleanupExpiredCodes();

      // Redirect back to client with authorization code
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

      logger.info('OAuth provider callback received', {
        provider,
        hasCode: Boolean(code),
        hasError: Boolean(error),
      });

      // Handle error from provider
      if (error) {
        logger.error('Provider returned error', {
          provider,
          error,
          error_description,
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

      // Decode the state to get original request parameters
      let stateData: any;
      try {
        stateData = JSON.parse(Buffer.from(state as string, 'base64url').toString());
      } catch (error) {
        logger.error('Failed to decode state parameter', {
          state,
          error,
        });
        throw new Error('Invalid state parameter');
      }

      // Get the auth module and provider
      const authModule = getAuthModule();
      const providerRegistry = authModule.exports.getProviderRegistry();

      if (!providerRegistry) {
        throw new Error('Provider registry not initialized');
      }

      const providerInstance = providerRegistry.getProvider(providerName);

      if (!providerInstance) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // Exchange the provider's code for tokens
      const providerTokens = await providerInstance.exchangeCodeForTokens(code as string);

      // Get user info from provider
      const userInfo = await providerInstance.getUserInfo(providerTokens.access_token);

      logger.info('User authenticated via provider', {
        provider,
        userId: userInfo.id,
        email: userInfo.email,
      });

      // Create or update user in database
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

      logger.info('User upserted in database', {
        userId: user.id,
        email: user.email,
        isNew: user.createdAt === user.updatedAt,
      });

      // Store authorization code with user info
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
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      // Clean up expired codes
      await authCodeService.cleanupExpiredCodes();

      // Redirect back to client with authorization code
      const responseParams = new URLSearchParams({ code: authCode });
      if (stateData.originalState) {
        responseParams.append('state', stateData.originalState);
      }

      logger.info('Redirecting to client with authorization code', {
        redirectUri: stateData.redirectUri,
        hasState: Boolean(stateData.originalState),
      });

      res.redirect(`${stateData.redirectUri}?${responseParams}`);
    } catch (error) {
      logger.error('Provider callback error', { error });
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
