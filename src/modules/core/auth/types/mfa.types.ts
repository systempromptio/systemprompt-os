/**
 * MFA configuration interface.
 * Defines settings for multi-factor authentication.
 */
export interface MFAConfig {
    appName: string;
    backupCodeCount: number;
    windowSize: number;
}

/**
 * MFA setup result interface.
 * Contains data returned when setting up MFA for a user.
 */
export interface MFASetupResult {
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
}

/**
 * MFA verification parameters interface.
 * Input data for verifying MFA codes.
 */
export interface MFAVerifyParams {
    userId: string;
    code: string;
    isBackupCode?: boolean;
}

/**
 * User MFA data interface.
 * Database representation of user MFA settings.
 */
export interface UserMFAData {
    id: string;
    mfa_secret?: string | null;
    mfa_enabled?: number;
    mfa_backup_codes?: string | null;
}
