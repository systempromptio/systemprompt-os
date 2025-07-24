/**
 * @file Multi-factor authentication service.
 * @module modules/core/auth/services/mfa.service
 */

import type { DatabaseService } from '@/modules/core/database/services/database.service.js';
import type { ILogger } from '@/modules/core/logger/types/index.js';

export class MFAService {
  constructor(
    // @ts-expect-error - Will be used when MFA is implemented
    private readonly _db: DatabaseService,
    private readonly logger: ILogger,
  ) {}

  async generateSecret(userId: string): Promise<{ secret: string; qrCode: string }> {
    this.logger.warn('MFA not implemented', { userId });
    throw new Error('MFA not implemented');
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    this.logger.warn('MFA not implemented', {
 userId,
token
});
    throw new Error('MFA not implemented');
  }

  async enableMFA(userId: string, _secret: string): Promise<void> {
    this.logger.warn('MFA not implemented', { userId });
    throw new Error('MFA not implemented');
  }

  async disableMFA(_userId: string): Promise<void> {
    this.logger.warn('MFA not implemented', { userId: _userId });
    throw new Error('MFA not implemented');
  }

  async isEnabled(_userId: string): Promise<boolean> {
    return false;
  }
}
