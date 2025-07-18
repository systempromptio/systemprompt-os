/**
 * @fileoverview OAuth2 Authorization endpoint
 * @module server/external/rest/oauth2/authorize
 */

import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { OAuth2Error } from './errors.js';

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
});

// In-memory storage for authorization codes (should be Redis/DB in production)
const authorizationCodes = new Map<string, {
  clientId: string;
  redirectUri: string;
  scope: string;
  userId?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
}>();

export class AuthorizeEndpoint {
  /**
   * GET /oauth2/authorize
   * Display authorization consent screen
   */
  getAuthorize = async ( req: Request, res: Response): Promise<Response | void> => {
    try {
      const params = AuthorizeRequestSchema.parse(req.query);
      
      // TODO: Validate clientid and redirecturi
      // TODO: Check if user is already authenticated
      // For now, return a simple consent form
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authorize - systemprompt-os</title>
          <style>
            body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
            .container { border: 1px solid #ccc; border-radius: 8px; padding: 30px; }
            h1 { color: #333; }
            .client { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 20px 0; }
            .scopes { margin: 20px 0; }
            .scope-item { margin: 10px 0; }
            button { background: #007bff; color: white; border: none; padding: 10px 20px; 
                     border-radius: 4px; cursor: pointer; margin-right: 10px; }
            button.deny { background: #dc3545; }
            form { display: inline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authorization Request</h1>
            <div class="client">
              <strong>Client ID:</strong> ${params.client_id}
            </div>
            <p>This application is requesting access to your systemprompt-os account.</p>
            <div class="scopes">
              <strong>Requested permissions:</strong>
              <ul>
                ${params.scope.split(' ').map(scope => `<li class="scope-item">${scope}</li>`).join('')}
              </ul>
            </div>
            <form method="POST" action="/oauth2/authorize" style="display: inline;">
              <input type="hidden" name="response_type" value="${params.response_type}">
              <input type="hidden" name="client_id" value="${params.client_id}">
              <input type="hidden" name="redirect_uri" value="${params.redirect_uri}">
              <input type="hidden" name="scope" value="${params.scope}">
              <input type="hidden" name="state" value="${params.state || ''}">
              <input type="hidden" name="nonce" value="${params.nonce || ''}">
              <input type="hidden" name="code_challenge" value="${params.code_challenge || ''}">
              <input type="hidden" name="code_challenge_method" value="${params.code_challenge_method || ''}">
              <input type="hidden" name="action" value="approve">
              <button type="submit">Approve</button>
            </form>
            <form method="POST" action="/oauth2/authorize" style="display: inline;">
              <input type="hidden" name="redirect_uri" value="${params.redirect_uri}">
              <input type="hidden" name="state" value="${params.state || ''}">
              <input type="hidden" name="action" value="deny">
              <button type="submit" class="deny">Deny</button>
            </form>
          </div>
        </body>
        </html>
      `;
      
      res.type('html').send( html);
    } catch ( error) {
      if (error instanceof z.ZodError) {
        const oauthError = OAuth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = OAuth2Error.serverError('Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };

  /**
   * POST /oauth2/authorize
   * Handle authorization approval/denial
   */
  postAuthorize = async ( req: Request, res: Response): Promise<Response | void> => {
    try {
      const { action, redirect_uri, state } = req.body;
      
      if (action === 'deny') {
        const params = new URLSearchParams({
          error: 'access_denied',
          error_description: 'User denied the authorization request',
        });
        if ( state) params.append('state', state);
        
        return res.redirect(`${redirect_uri}?${params}`);
      }
      
      // User approved - generate authorization code
      const params = AuthorizeRequestSchema.parse(req.body);
      const code = randomBytes(32).toString('base64url');
      
      // Store authorization code (expires in 10 minutes)
      authorizationCodes.set(code, {
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        scope: params.scope,
        userId: 'user-001', // TODO: Get from authenticated session
        codeChallenge: params.code_challenge,
        codeChallengeMethod: params.code_challenge_method,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      
      // Clean up expired codes
      this.cleanupExpiredCodes();
      
      // Redirect back to client with authorization code
      const responseParams = new URLSearchParams({ code });
      if ( state) responseParams.append('state', state);
      
      res.redirect(`${params.redirect_uri}?${responseParams}`);
    } catch ( error) {
      if (error instanceof z.ZodError) {
        const oauthError = OAuth2Error.invalidRequest(error.message);
        res.status(oauthError.code).json(oauthError.toJSON());
      } else {
        const oauthError = OAuth2Error.serverError('Internal server error');
        res.status(oauthError.code).json(oauthError.toJSON());
      }
    }
  };
  
  private cleanupExpiredCodes(): void {
    const now = new Date();
    for (const [code, data] of authorizationCodes.entries()) {
      if (data.expiresAt < now) {
        authorizationCodes.delete( code);
      }
    }
  }
  
  // Export for use in token endpoint
  static getAuthorizationCode( code: string) {
    return authorizationCodes.get( code);
  }
  
  static deleteAuthorizationCode( code: string) {
    authorizationCodes.delete( code);
  }
}