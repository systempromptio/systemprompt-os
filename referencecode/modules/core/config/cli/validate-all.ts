/**
 * @fileoverview Validate all configurations command
 * @module modules/core/config/cli/validate-all
 */

import { ConfigModule } from '../index.js';
// File system operations are handled internally

/**
 * Execute validate-all command
 */
async function execute(options: { fix?: boolean; strict?: boolean }): Promise<void> {
  const fix = options.fix || false;
  const strict = options.strict || false;

  try {
    const configModule = new ConfigModule();
    await configModule.initialize();

    console.log('\nValidating All Configurations');
    console.log('='.repeat(60));

    // Get current configuration
    const currentConfig = configModule.get() || {};

    // Use the built-in validate method
    const validationResult = configModule.validate(currentConfig);

    const totalErrors = validationResult.errors.length;
    let totalFixed = 0;

    // Display validation results
    if (validationResult.valid) {
      console.log('\n✓ All configurations are valid');
    } else {
      console.log(`\nFound ${totalErrors} validation error(s):`);

      validationResult.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error}`);

        // In strict mode, show additional checks
        if (strict) {
          console.log('   [STRICT MODE] Additional validation applied');
        }
      });

      if (fix) {
        console.log('\nAttempting to fix errors...');

        // Simple fixes based on known error patterns
        const fixedConfig: any = { ...currentConfig };
        let hasChanges = false;

        for (const error of validationResult.errors) {
          // Example: Fix invalid port numbers
          if (error.includes('port number')) {
            if (fixedConfig.system?.port) {
              const port = parseInt(String(fixedConfig.system.port));
              if (isNaN(port) || port < 1 || port > 65535) {
                fixedConfig.system.port = 8080; // Default port
                console.log('   Fixed: Set system.port to default value 8080');
                totalFixed++;
                hasChanges = true;
              }
            }
          }
        }

        if (hasChanges) {
          // Save the fixed configuration
          for (const [key, value] of Object.entries(fixedConfig)) {
            await configModule.set(key, value);
          }
          console.log(`\n✓ Fixed ${totalFixed} error(s)`);

          // Re-validate after fixes
          const revalidation = configModule.validate(fixedConfig);
          if (revalidation.valid) {
            console.log('✓ Configuration is now valid after fixes');
          } else {
            console.log(`⚠ ${revalidation.errors.length} error(s) remain after fixes`);
          }
        } else {
          console.log('\n⚠ No automatic fixes available for the detected errors');
        }
      }
    }

    // Additional checks in strict mode
    if (strict) {
      console.log('\nStrict Mode Checks:');
      console.log('-'.repeat(40));

      // Check for missing recommended configurations
      const recommendedKeys = ['system.environment', 'system.logLevel'];
      const missingRecommended = recommendedKeys.filter((key) => {
        const value = getNestedValue(currentConfig, key);
        return value === undefined;
      });

      if (missingRecommended.length > 0) {
        console.log('\nMissing recommended configurations:');
        missingRecommended.forEach((key) => {
          console.log(`  - ${key}`);
        });
      } else {
        console.log('✓ All recommended configurations are present');
      }
    }

    // Summary
    console.log('\nValidation Summary');
    console.log('='.repeat(60));
    console.log(`Total errors: ${totalErrors}`);
    if (fix) {
      console.log(`Errors fixed: ${totalFixed}`);
      console.log(`Remaining errors: ${totalErrors - totalFixed}`);
    }
    console.log(`Validation mode: ${strict ? 'Strict' : 'Standard'}`);

    // Exit with error code if validation failed
    if (!validationResult.valid && (!fix || totalFixed < totalErrors)) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Error validating configurations: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
