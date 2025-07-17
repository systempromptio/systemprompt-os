/**
 * @fileoverview Simple JWT implementation (placeholder)
 * @module server/external/auth/jwt
 */

import { createHmac } from 'crypto';

interface JWTPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

export async function jwtSign(payload: JWTPayload, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function jwtVerify(token: string, secret: string): Promise<{ payload: JWTPayload }> {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Invalid token format');
  }
  
  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
  
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as JWTPayload;
  
  // Check expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  
  return { payload };
}