/**
 * @fileoverview OAuth2 Authorization endpoint with IDP support
 * @module server/external/rest/oauth2/authorize-v2
 */

import { Request, Response } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getProviderRegistry } from "../../auth/providers/registry.js";
import { OAuth2Error } from './errors.js';

// Schema for authorization request - follows OAuth2 RFC standards
const AuthorizeRequestSchema = z.object({
  response_type: z.string(), // We'll validate this manually to provide proper error
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  nonce: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
  provider: z.string().optional(), // IDP to use (google, github, etc)
});

// Store authorization sessions
const authorizationSessions = new Map<
  string,
  {
    clientId: string;
    redirectUri: string;
    scope: string;
    state?: string;
    nonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    provider?: string;
    expiresAt: Date;
  }
>();

// Store authorization codes with provider info
const authorizationCodes = new Map<string, {
  code: string;
  clientId: string;
  redirectUri?: string;
  scope: string;
  userId?: string;
  provider: string;
  providerTokens?: any;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
}>();

export class AuthorizeV2Endpoint {
  /**
   * GET /oauth2/authorize
   * Display provider selection or redirect to IDP
   */
  getAuthorize = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const params = AuthorizeRequestSchema.parse(req.query);
      
      // Check for unsupported response types
      const supportedResponseTypes = ['code', 'code id_token'];
      if (!supportedResponseTypes.includes(params.response_type)) {
        const error = OAuth2Error.unsupportedResponseType(`Response type '${params.response_type}' is not supported`);
        return res.status(error.code).json(error.toJSON());
      }
      
      const registry = getProviderRegistry();

      // If provider is specified, redirect to that provider
      if (params.provider) {
        const provider = registry.get(params.provider);
        if (!provider) {
          const error = OAuth2Error.invalidRequest(`Unknown provider: ${params.provider}`);
          return res.status(error.code).json(error.toJSON());
        }

        // Store session for callback
        const sessionId = randomBytes(32).toString("base64url");
        authorizationSessions.set(sessionId, {
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scope: params.scope || 'openid',
          state: params.state,
          nonce: params.nonce,
          codeChallenge: params.code_challenge,
          codeChallengeMethod: params.code_challenge_method,
          provider: params.provider,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });

        // Set session cookie
        res.cookie("authsession", sessionId, {
          httpOnly: true,
          secure: process.env.NODEENV === "production",
          sameSite: "lax",
          maxAge: 10 * 60 * 1000,
        });

        // Redirect to provider
        const providerState = randomBytes(32).toString("base64url");
        const authUrl = provider.getAuthorizationUrl(providerState, params.nonce);

        // Store provider state mapping
        authorizationSessions.set(providerState, {
          ...authorizationSessions.get(sessionId)!,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        return res.redirect(authUrl);
      }

      // No provider specified - show provider selection
      const providers = registry.list();

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sign In - systemprompt-os</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 400px; 
              margin: 100px auto; 
              padding: 20px;
              background: #f5f5f5;
            }
            .container { 
              background: white;
              border-radius: 8px; 
              padding: 40px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { 
              color: #333; 
              text-align: center;
              margin-bottom: 30px;
            }
            .provider-list {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            .provider-button {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              padding: 12px 20px;
              border: 1px solid #ddd;
              border-radius: 6px;
              background: white;
              color: #333;
              text-decoration: none;
              font-size: 16px;
              transition: all 0.2s;
            }
            .provider-button:hover {
              background: #f8f8f8;
              border-color: #999;
            }
            .provider-google {
              border-color: #4285f4;
              color: #4285f4;
            }
            .provider-google:hover {
              background: #4285f41a;
            }
            .provider-github {
              border-color: #333;
              color: #333;
            }
            .provider-github:hover {
              background: #3331a;
            }
            .client-info {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 14px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Select Identity Provider</h1>
            <div class="provider-list">
              ${providers
                .map(
                  (provider) => `
                <a href="/oauth2/authorize?${new URLSearchParams({
                  ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
                  provider: provider.id,
                }).toString()}" class="provider-button provider-${provider.id}">
                  <span>Continue with ${provider.name}</span>
                </a>
              `,
                )
                .join("")}
            </div>
            <div class="client-info">
              <p>You'll be redirected to:<br><strong>${params.client_id}</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;

      return res.type("html").send(html);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const oauthError = OAuth2Error.invalidRequest(error.message);
        return res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        console.error("Authorization error:", error);
        const oauthError = OAuth2Error.serverError('Internal server error');
        return res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };

  /**
   * GET /oauth2/callback/:provider
   * Handle callback from IDP
   */
  handleProviderCallback = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const providerId = req.params.provider;
      const { code, state, error, error_description } = req.query;

      if (error) {
        // Provider returned an error
        const session = state ? authorizationSessions.get(state as string) : null;
        if (session) {
          const params = new URLSearchParams({
            error: error as string,
            error_description: (error_description as string) || "Provider authentication failed",
          });
          if (session.state) params.append("state", session.state);
          return res.redirect(`${session.redirectUri}?${params}`);
        }
        return res.status(400).send("Authentication failed");
      }

      if (!code || !state) {
        const error = OAuth2Error.invalidRequest('Missing code or state');
        return res.status(error.code).json(error.toJSON());
      }

      // Get session from state
      const session = authorizationSessions.get(state as string);
      if (!session) {
        const error = OAuth2Error.invalidRequest('Invalid or expired state');
        return res.status(error.code).json(error.toJSON());
      }

      // Get provider
      const registry = getProviderRegistry();
      const provider = registry.get(providerId);
      if (!provider) {
        const error = OAuth2Error.invalidRequest('Unknown provider');
        return res.status(error.code).json(error.toJSON());
      }

      try {
        // Exchange code for tokens with provider
        const tokens = await provider.exchangeCodeForTokens(code as string);

        // Get user info from provider
        const userInfo = await provider.getUserInfo(tokens.accesstoken);

        // Generate our authorization code
        const authCode = randomBytes(32).toString("base64url");

        // Store authorization code with user info
        authorizationCodes.set(authCode, {
          code: authCode,
          clientId: session.clientId,
          redirectUri: session.redirectUri,
          scope: session.scope,
          userId: `${providerId}:${userInfo.id}`,
          provider: providerId,
          providerTokens: tokens,
          codeChallenge: session.codeChallenge,
          codeChallengeMethod: session.codeChallengeMethod,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        // Clean up session
        authorizationSessions.delete(state as string);

        // Redirect back to client with our authorization code
        const params = new URLSearchParams({ code: authCode });
        if (session.state) params.append("state", session.state);

        return res.redirect(`${session.redirectUri}?${params}`);
      } catch (providerError) {
        console.error("Provider error:", providerError);
        const oauthError = OAuth2Error.serverError('Failed to authenticate with provider');
        const params = new URLSearchParams(oauthError.toJSON() as any);
        if (session.state) params.append("state", session.state);
        return res.redirect(`${session.redirectUri}?${params}`);
      }
    } catch (error) {
      console.error("Callback error:", error);
      const oauthError = OAuth2Error.serverError('Internal server error');
      return res.status(oauthError.code).json(oauthError.toJSON());
    }
  };

  // Export for use in token endpoint
  static getAuthorizationCode(code: string) {
    return authorizationCodes.get(code);
  }

  static deleteAuthorizationCode(code: string) {
    authorizationCodes.delete(code);
  }
}
