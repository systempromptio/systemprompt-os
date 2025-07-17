/**
 * @fileoverview OAuth2 Authorization endpoint with IDP support
 * @module server/external/rest/oauth2/authorize-v2
 */

import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getProviderRegistry } from '../../auth/providers/registry.js';

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
});

// Store authorization sessions
const authorizationSessions = new Map<string, {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  provider?: string;
  expiresAt: Date;
}>();

// Store authorization codes
const authorizationCodes = new Map<string, {
  clientId: string;
  redirectUri: string;
  scope: string;
  userId: string;
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
      const registry = getProviderRegistry();
      
      // If provider is specified, redirect to that provider
      if (params.provider) {
        const provider = registry.get(params.provider);
        if (!provider) {
          return res.status(400).json({ 
            error: 'invalid_request', 
            error_description: `Unknown provider: ${params.provider}` 
          });
        }
        
        // Store session for callback
        const sessionId = randomBytes(32).toString('base64url');
        authorizationSessions.set(sessionId, {
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scope: params.scope,
          state: params.state,
          nonce: params.nonce,
          codeChallenge: params.code_challenge,
          codeChallengeMethod: params.code_challenge_method,
          provider: params.provider,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });
        
        // Set session cookie
        res.cookie('auth_session', sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 10 * 60 * 1000,
        });
        
        // Redirect to provider
        const providerState = randomBytes(32).toString('base64url');
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
            <h1>Sign In</h1>
            <div class="provider-list">
              ${providers.map(provider => `
                <a href="/oauth2/authorize?${new URLSearchParams({
                  ...Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== undefined)),
                  provider: provider.id,
                }).toString()}" class="provider-button provider-${provider.id}">
                  <span>Continue with ${provider.name}</span>
                </a>
              `).join('')}
            </div>
            <div class="client-info">
              <p>You'll be redirected to:<br><strong>${params.client_id}</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      return res.type('html').send(html);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'invalid_request', 
          error_description: error.message 
        });
      } else {
        console.error('Authorization error:', error);
        return res.status(500).json({ error: 'server_error' });
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
            error_description: error_description as string || 'Provider authentication failed',
          });
          if (session.state) params.append('state', session.state);
          return res.redirect(`${session.redirectUri}?${params}`);
        }
        return res.status(400).send('Authentication failed');
      }
      
      if (!code || !state) {
        return res.status(400).json({ 
          error: 'invalid_request', 
          error_description: 'Missing code or state' 
        });
      }
      
      // Get session from state
      const session = authorizationSessions.get(state as string);
      if (!session) {
        return res.status(400).json({ 
          error: 'invalid_request', 
          error_description: 'Invalid or expired state' 
        });
      }
      
      // Get provider
      const registry = getProviderRegistry();
      const provider = registry.get(providerId);
      if (!provider) {
        return res.status(400).json({ 
          error: 'invalid_request', 
          error_description: 'Unknown provider' 
        });
      }
      
      try {
        // Exchange code for tokens with provider
        const tokens = await provider.exchangeCodeForTokens(code as string);
        
        // Get user info from provider
        const userInfo = await provider.getUserInfo(tokens.access_token);
        
        // Generate our authorization code
        const authCode = randomBytes(32).toString('base64url');
        
        // Store authorization code with user info
        authorizationCodes.set(authCode, {
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
        if (session.state) params.append('state', session.state);
        
        return res.redirect(`${session.redirectUri}?${params}`);
      } catch (providerError) {
        console.error('Provider error:', providerError);
        const params = new URLSearchParams({
          error: 'server_error',
          error_description: 'Failed to authenticate with provider',
        });
        if (session.state) params.append('state', session.state);
        return res.redirect(`${session.redirectUri}?${params}`);
      }
    } catch (error) {
      console.error('Callback error:', error);
      return res.status(500).json({ error: 'server_error' });
    }
  };
  
  // Export for use in token endpoint
  static getAuthorizationCode(code: string) {
    return authorizationCodes.get(code);
  }
  
  static deleteAuthorizationCode(code: string) {
    authorizationCodes.delete(code);
  }
  
  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [id, session] of authorizationSessions.entries()) {
      if (session.expiresAt < now) {
        authorizationSessions.delete(id);
      }
    }
    for (const [code, data] of authorizationCodes.entries()) {
      if (data.expiresAt < now) {
        authorizationCodes.delete(code);
      }
    }
  }
}