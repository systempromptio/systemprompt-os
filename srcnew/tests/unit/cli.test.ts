import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateJWTKeyPair } from '../../tools/generate-key/index.js';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'fs';
import path from 'path';
import os from 'os';

describe('CLI Key Generation', () => {
  let testDir: string;
  
  beforeEach(() => {
    // Create a temporary directory for test output
    testDir = mkdtempSync(path.join(os.tmpdir(), 'systemprompt-test-'));
  });
  
  afterEach(() => {
    // Clean up test directory after each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('should generate RSA key pair in PEM format', async () => {
    await generateJWTKeyPair({
      type: 'jwt',
      algorithm: 'RS256',
      outputDir: testDir,
      format: 'pem'
    });
    
    // Check files exist
    expect(existsSync(path.join(testDir, 'private.key'))).toBe(true);
    expect(existsSync(path.join(testDir, 'public.key'))).toBe(true);
    
    // Check key format
    const privateKey = readFileSync(path.join(testDir, 'private.key'), 'utf8');
    const publicKey = readFileSync(path.join(testDir, 'public.key'), 'utf8');
    
    expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(privateKey).toContain('-----END PRIVATE KEY-----');
    expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(publicKey).toContain('-----END PUBLIC KEY-----');
  });
  
  it('should generate keys in JWK format', async () => {
    await generateJWTKeyPair({
      type: 'jwt',
      algorithm: 'RS256',
      outputDir: testDir,
      format: 'jwk'
    });
    
    // Check JWK file exists
    expect(existsSync(path.join(testDir, 'jwks.json'))).toBe(true);
    
    // Parse and validate JWK
    const jwksContent = readFileSync(path.join(testDir, 'jwks.json'), 'utf8');
    const jwks = JSON.parse(jwksContent);
    
    expect(jwks).toHaveProperty('keys');
    expect(jwks.keys).toBeInstanceOf(Array);
    expect(jwks.keys[0]).toHaveProperty('kty', 'RSA');
    expect(jwks.keys[0]).toHaveProperty('use', 'sig');
    expect(jwks.keys[0]).toHaveProperty('alg', 'RS256');
    expect(jwks.keys[0]).toHaveProperty('kid');
  });
  
  it('should support RS512 algorithm', async () => {
    await generateJWTKeyPair({
      type: 'jwt',
      algorithm: 'RS512',
      outputDir: testDir,
      format: 'jwk'
    });
    
    const jwksContent = readFileSync(path.join(testDir, 'jwks.json'), 'utf8');
    const jwks = JSON.parse(jwksContent);
    
    expect(jwks.keys[0]).toHaveProperty('alg', 'RS512');
  });
});