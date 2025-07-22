/**
 * MFA management CLI commands
 */

import { Command } from 'commander';
import type { AuthModule } from '../index.js';

export function createMFACommand(module: AuthModule): Command {
  const cmd = new Command('mfa')
    .description('Multi-factor authentication management');

  // Enable MFA
  cmd.command('enable <userId>')
    .description('Enable MFA for a user')
    .action(async (userId) => {
      try {
        const result = await module.setupMFA(userId);
        console.log('\nMFA Setup Instructions:');
        console.log('1. Scan the QR code with your authenticator app');
        console.log('2. Or manually enter this secret:', result.secret);
        console.log('\nQR Code URL:', result.qrCodeUrl.substring(0, 50) + '...');
        console.log('\nBackup Codes (save these in a secure place):');
        result.backupCodes.forEach((code, i) => {
          console.log(`  ${i + 1}. ${code}`);
        });
        console.log('\nRun "mfa verify <userId> <code>" to complete setup');
      } catch (error: any) {
        console.error('Error enabling MFA:', error.message);
        process.exit(1);
      }
    });

  // Verify MFA setup
  cmd.command('verify <userId> <code>')
    .description('Verify MFA setup with a code')
    .action(async (userId, code) => {
      try {
        const enabled = await module.enableMFA(userId, code);
        if (enabled) {
          console.log('✓ MFA enabled successfully!');
        } else {
          console.log('✗ Invalid code. Please try again.');
          process.exit(1);
        }
      } catch (error: any) {
        console.error('Error verifying MFA:', error.message);
        process.exit(1);
      }
    });

  // Disable MFA
  cmd.command('disable <userId>')
    .description('Disable MFA for a user')
    .action(async (userId) => {
      try {
        await module.disableMFA(userId);
        console.log('✓ MFA disabled successfully');
      } catch (error: any) {
        console.error('Error disabling MFA:', error.message);
        process.exit(1);
      }
    });

  // Regenerate backup codes
  cmd.command('regenerate-codes <userId>')
    .description('Regenerate backup codes for a user')
    .action(async (userId) => {
      try {
        const codes = await module.regenerateBackupCodes(userId);
        console.log('\nNew Backup Codes (save these in a secure place):');
        codes.forEach((code, i) => {
          console.log(`  ${i + 1}. ${code}`);
        });
      } catch (error: any) {
        console.error('Error regenerating backup codes:', error.message);
        process.exit(1);
      }
    });

  return cmd;
}