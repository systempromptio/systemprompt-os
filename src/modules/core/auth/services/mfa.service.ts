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
  }

  async generateSecret(_userId: string): Promise<{ secret: string; qrCode: string }> {
    throw new Error('MFA not implemented');
  }

  async verifyToken(_userId: string, _token: string): Promise<boolean> {
    throw new Error('MFA not implemented');
  }

  async enableMFA(_userId: string, _secret: string): Promise<void> {
    throw new Error('MFA not implemented');
  }

  async disableMFA(_userId: string): Promise<void> {
    throw new Error('MFA not implemented');
  }

  async isEnabled(_userId: string): Promise<boolean> {
    return false;
  }
}
