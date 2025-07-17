/**
 * @fileoverview OAuth2 Token endpoint
 * @module server/external/rest/oauth2/token
 */

import { Request, Response } from 'express';
// import { SignJWT, jwtVerify } from 'jose';
// TODO: Add proper JWT library
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { CONFIG } from '../../../config.js';
import { AuthorizeEndpoint } from './authorize.js';

// Schema for token request
const TokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string(),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  code_verifier: z.string().optional(),
});

// In-memory storage for refresh tokens (should be Redis/DB in production)
const refreshTokens = new Map<string, {
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: Date;
}>();

export class TokenEndpoint {
  private jwtSecret: Uint8Array;
  
  constructor() {
    this.jwtSecret = new TextEncoder().encode(CONFIG.JWT_SECRET);
  }
  
  /**
   * POST /oauth2/token
   * Exchange authorization code or refresh token for access token
   */
  postToken = async (req: Request, res: Response): Promise<Response | void> => {
    try {
      const params = TokenRequestSchema.parse(req.body);
      
      // TODO: Validate client credentials (Basic auth or client_secret)
      
      if (params.grant_type === 'authorization_code') {
        await this.handleAuthorizationCodeGrant(params, res);
      } else if (params.grant_type === 'refresh_token') {
        await this.handleRefreshTokenGrant(params, res);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'invalid_request', 
          error_description: error.message 
        });
      } else {
        res.status(500).json({ error: 'server_error' });
      }
    }
  };
  
  private async handleAuthorizationCodeGrant(
    params: z.infer<typeof TokenRequestSchema>,
    res: Response
  ): Promise<Response | void> {
    if (!params.code || !params.redirect_uri) {
      return res.status(400).json({ 
        error: 'invalid_request',
        error_description: 'Missing required parameters' 
      });
    }
    
    // Get stored authorization code
    const codeData = AuthorizeEndpoint.getAuthorizationCode(params.code);
    if (!codeData) {
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Invalid authorization code' 
      });
    }
    
    // Validate code hasn't expired
    if (codeData.expiresAt < new Date()) {
      AuthorizeEndpoint.deleteAuthorizationCode(params.code);
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Authorization code expired' 
      });
    }
    
    // Validate client_id and redirect_uri match
    if (codeData.clientId !== params.client_id || 
        codeData.redirectUri !== params.redirect_uri) {
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Invalid client or redirect URI' 
      });
    }
    
    // Validate PKCE if used
    if (codeData.codeChallenge) {
      if (!params.code_verifier) {
        return res.status(400).json({ 
          error: 'invalid_request',
          error_description: 'Code verifier required' 
        });
      }
      
      const verifierHash = createHash('sha256')
        .update(params.code_verifier)
        .digest('base64url');
      
      if (verifierHash !== codeData.codeChallenge) {
        return res.status(400).json({ 
          error: 'invalid_grant',
          error_description: 'Invalid code verifier' 
        });
      }
    }
    
    // Delete authorization code (one-time use)
    AuthorizeEndpoint.deleteAuthorizationCode(params.code);
    
    // Generate tokens
    const tokens = await this.generateTokens(
      codeData.userId || 'anonymous',
      params.client_id,
      codeData.scope
    );
    
    res.json(tokens);
  }
  
  private async handleRefreshTokenGrant(
    params: z.infer<typeof TokenRequestSchema>,
    res: Response
  ): Promise<Response | void> {
    if (!params.refresh_token) {
      return res.status(400).json({ 
        error: 'invalid_request',
        error_description: 'Missing refresh token' 
      });
    }
    
    // Get stored refresh token
    const tokenData = refreshTokens.get(params.refresh_token);
    if (!tokenData) {
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Invalid refresh token' 
      });
    }
    
    // Validate token hasn't expired
    if (tokenData.expiresAt < new Date()) {
      refreshTokens.delete(params.refresh_token);
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Refresh token expired' 
      });
    }
    
    // Validate client_id matches
    if (tokenData.clientId !== params.client_id) {
      return res.status(400).json({ 
        error: 'invalid_grant',
        error_description: 'Invalid client' 
      });
    }
    
    // Delete old refresh token
    refreshTokens.delete(params.refresh_token);
    
    // Generate new tokens
    const tokens = await this.generateTokens(
      tokenData.userId,
      tokenData.clientId,
      tokenData.scope
    );
    
    res.json(tokens);
  }
  
  private async generateTokens(
    userId: string,
    clientId: string,
    scope: string
  ) {
    const now = Math.floor(Date.now() / 1000);
    
    // Generate access token (simplified for now)
    // TODO: Use proper JWT library
    const accessToken = Buffer.from(JSON.stringify({
      sub: userId,
      client_id: clientId,
      scope,
      token_type: 'access',
      iss: CONFIG.JWT_ISSUER,
      aud: CONFIG.JWT_AUDIENCE,
      iat: now,
      exp: now + 3600,
      jti: randomBytes(16).toString('hex')
    })).toString('base64url');
    
    // Generate refresh token
    const refreshToken = randomBytes(32).toString('base64url');
    
    // Store refresh token
    refreshTokens.set(refreshToken, {
      clientId,
      userId,
      scope,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope,
    };
  }
}