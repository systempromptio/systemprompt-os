/**
 * Base MFA error class.
 * Extends Error to provide MFA-specific error handling.
 */
export class MFAError extends Error {
  /**
   * Creates an MFA error.
   * @param message - Error message.
   * @param code - Error code for identification.
   * @param userId - Optional user ID associated with the error.
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly userId?: string
  ) {
    super(message);
    this.name = 'MFAError';
  }
}

/**
 * MFA setup error class.
 * Thrown when MFA setup operations fail.
 */
export class MFASetupError extends MFAError {
  /**
   * Creates an MFA setup error.
   * @param message - Error message.
   * @param userId - Optional user ID associated with the error.
   */
  constructor(message: string, userId?: string) {
    super(message, 'MFA_SETUP_ERROR', userId);
    this.name = 'MFASetupError';
  }
}

/**
 * MFA verification error class.
 * Thrown when MFA verification operations fail.
 */
export class MFAVerificationError extends MFAError {
  /**
   * Creates an MFA verification error.
   * @param message - Error message.
   * @param userId - Optional user ID associated with the error.
   */
  constructor(message: string, userId?: string) {
    super(message, 'MFA_VERIFICATION_ERROR', userId);
    this.name = 'MFAVerificationError';
  }
}
