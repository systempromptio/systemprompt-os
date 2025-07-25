/**
 *  *
 * MFAService class.
 *
 */

export class MFAService {
  private static instance: MFAService;

  /**
   *  * Get singleton instance.
   */
  public static getInstance(): MFAService {
    MFAService.instance ||= new MFAService();
    return MFAService.instance;
  }

  /**
   *  * Private constructor for singleton.
   */
  private constructor() {
    // Initialize
  }

  async generateSecret(_userId: string): Promise<{ secret: string; qrCode: string }> {
    // This.logger.warn('MFA not implemented', { _userId });
    throw new Error('MFA not implemented');
  }

  async verifyToken(_userId: string, _token: string): Promise<boolean> {
    // This.logger.warn('MFA not implemented', { _userId, _token });
    throw new Error('MFA not implemented');
  }

  async enableMFA(_userId: string, _secret: string): Promise<void> {
    // This.logger.warn('MFA not implemented', { _userId });
    throw new Error('MFA not implemented');
  }

  async disableMFA(_userId: string): Promise<void> {
    // This.logger.warn('MFA not implemented', { userId: _userId });
    throw new Error('MFA not implemented');
  }

  async isEnabled(_userId: string): Promise<boolean> {
    return false;
  }
}
