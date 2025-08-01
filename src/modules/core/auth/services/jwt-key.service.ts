/**
 * JWT Key Management Service - handles JWT key generation and storage.
 * @module auth/services
 */

import {
 existsSync, mkdirSync, readFileSync, writeFileSync
} from 'fs';
import { join } from 'path';
import { generateKeyPairSync } from 'crypto';
import { type ILogger, LogSource } from '@/modules/core/logger/types/manual';

/**
 * Service for managing JWT signing keys.
 */
export class JwtKeyService {
  private static instance: JwtKeyService;
  private readonly keyStorePath = './state/auth/keys';
  private readonly privateKeyPath: string;
  private readonly publicKeyPath: string;
  private privateKey?: string;
  private publicKey?: string;
  private logger?: ILogger;

  /**
   * Private constructor for singleton.
   */
  private constructor() {
    this.privateKeyPath = join(this.keyStorePath, 'private.key');
    this.publicKeyPath = join(this.keyStorePath, 'public.key');
  }

  /**
   * Get singleton instance.
   * @returns The JWT key service instance.
   */
  static getInstance(): JwtKeyService {
    JwtKeyService.instance ||= new JwtKeyService();
    return JwtKeyService.instance;
  }

  /**
   * Initialize service with logger.
   * @param logger - Logger instance.
   */
  initialize(logger: ILogger): void {
    this.logger = logger;
    this.setupKeys();
  }

  /**
   * Get private key for signing.
   * @returns The private key in PEM format.
   */
  getPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('JWT keys not initialized');
    }
    return this.privateKey;
  }

  /**
   * Get public key for verification.
   * @returns The public key in PEM format.
   */
  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('JWT keys not initialized');
    }
    return this.publicKey;
  }

  /**
   * Setup JWT keys for token signing.
   */
  private setupKeys(): void {
    if (!existsSync(this.keyStorePath)) {
      mkdirSync(this.keyStorePath, { recursive: true });
      this.logger?.info(LogSource.AUTH, `Created key store directory: ${this.keyStorePath}`);
    }

    if (!existsSync(this.privateKeyPath) || !existsSync(this.publicKeyPath)) {
      this.generateKeys();
    } else {
      this.loadKeys();
    }
  }

  /**
   * Generate new JWT key pair.
   */
  private generateKeys(): void {
    this.logger?.info(LogSource.AUTH, 'JWT keys not found, generating new keys...');

    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    writeFileSync(this.privateKeyPath, keyPair.privateKey);
    writeFileSync(this.publicKeyPath, keyPair.publicKey);

    this.privateKey = keyPair.privateKey;
    this.publicKey = keyPair.publicKey;

    this.logger?.info(LogSource.AUTH, 'JWT keys generated successfully');
  }

  /**
   * Load existing JWT keys from disk.
   */
  private loadKeys(): void {
    this.privateKey = readFileSync(this.privateKeyPath, 'utf-8');
    this.publicKey = readFileSync(this.publicKeyPath, 'utf-8');
    this.logger?.info(LogSource.AUTH, 'JWT keys loaded successfully');
  }
}
