/**
 * @file OAuth2 Well-Known endpoints for OAuth 2.1 discovery.
 * @module server/external/rest/oauth2/well-known
 */

import type { Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { createPublicKey } from 'crypto';

export class WellKnownEndpoint {
  private publicKeyJWK: any | null = null;
  
  constructor() {
    this.loadPublicKey();
  }
  
  private loadPublicKey(): void {
    try {
      const keyPaths = [
        join(process.cwd(), 'state/auth/keys/public.key'),
        join(process.cwd(), './state/auth/keys/public.key'),
        resolve('./state/auth/keys/public.key'),
        '/data/state/auth/keys/public.key',
        '/app/state/auth/keys/public.key'
      ];
      
      let publicKeyPem: string | null = null;
      
      for (const keyPath of keyPaths) {
        if (existsSync(keyPath)) {
          publicKeyPem = readFileSync(keyPath, 'utf8');
          break;
        }
      }
      
      if (!publicKeyPem) {
        console.error('Public key not found in any expected location');
        return;
      }
      
      const publicKey = createPublicKey(publicKeyPem);
      const jwk = publicKey.export({ format: 'jwk' });
      
      this.publicKeyJWK = {
        ...jwk,
        use: 'sig',
        kid: 'default',
        alg: 'RS256'
      };
    } catch (error) {
      console.error('Failed to load public key for JWKS:', error);
    }
  }
  
  getJWKS = async (_req: Request, res: Response): Promise<Response | void> => {
    if (!this.publicKeyJWK) {
      return res.status(500).json({ error: 'Keys not initialized' });
    }

    const jwks = {
      keys: [this.publicKeyJWK],
    };

    return res.json(jwks);
  };
}
