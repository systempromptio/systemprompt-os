/**
 * @fileoverview Validate extension command
 * @module modules/core/extension/cli/validate
 */

import { validateModule, validateAllModules } from '../services/module-validator.service.js';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import formatter from '../../../../cli/utils/formatting.js';

const { style, icons, format, output } = formatter;

// Local interface definition
export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { args } = context;
    
    try {
      const path = args.path as string;
      const validateAll = args.all as boolean;
      const strict = args.strict as boolean;
      const fix = args.fix as boolean;
      
      if (!path && !validateAll) {
        output.error('Either --path or --all must be specified');
        console.error(style.muted('Usage: systemprompt extension:validate --path <path> [--strict] [--fix]'));
        console.error(style.muted('       systemprompt extension:validate --all [--strict]'));
        process.exit(1);
      }
      
      if (validateAll) {
        // Validate all core modules
        const corePath = join(context.cwd, 'src', 'modules', 'core');
        
        // Fancy header
        console.log(format.boxTitle('SystemPrompt OS Module Validator', icons.search));
        console.log();
        console.log(`  ${format.keyValue('Target Path', style.path(corePath), 12)}`);
        console.log(`  ${format.keyValue('Scan Mode', format.badge('ALL MODULES', 'info'), 12)}`);
        console.log();
        console.log(format.gradientDivider(65));
        
        const results = await validateAllModules(corePath);
        let hasErrors = false;
        let totalWarnings = 0;
        
        // Calculate stats first
        const moduleCount = results.size;
        const validCount = Array.from(results.values()).filter(r => r.valid).length;
        const errorCount = Array.from(results.values()).reduce((sum, r) => sum + r.errors.length, 0);
        
        // Show progress
        console.log(`\n  ${style.bold('Scanning modules...')}`);
        console.log(`  ${format.gradientProgressBar(validCount, moduleCount, 40)}\n`);
        
        // Module results
        for (const [moduleName, result] of results.entries()) {
          totalWarnings += result.warnings.length;
          
          // Module header with status indicator
          const statusBadge = result.valid 
            ? format.badge(' PASS ', 'success')
            : format.badge(' FAIL ', 'error');
          
          const warningBadge = result.warnings.length > 0 
            ? ` ${format.badge(` ${result.warnings.length} ⚠ `, 'warning')}` 
            : '';
          
          console.log(`\n  ${statusBadge} ${style.bold(style.cyan(moduleName))}${warningBadge}`);
          
          if (result.errors.length > 0) {
            hasErrors = true;
            console.log(`\n    ${style.error('▸ Errors')}`);
            result.errors.forEach(err => {
              console.log(`      ${style.error('●')} ${style.bold(`[${err.type}]`)} ${err.message}`);
              if (err.path) {
                console.log(`        ${style.muted('└')} ${style.path(err.path)}`);
              }
            });
          }
          
          if (result.warnings.length > 0) {
            console.log(`\n    ${style.warning('▸ Warnings')}`);
            result.warnings.forEach(warn => {
              console.log(`      ${style.warning('▲')} ${style.bold(`[${warn.type}]`)} ${warn.message}`);
              console.log(`        ${style.muted('└ Recommendation:')} ${style.italic(style.muted(warn.recommendation))}`);
            });
          }
          
          if (result.valid && result.warnings.length === 0) {
            console.log(`    ${style.green('✨')} ${style.success('Perfect! No issues found.')}`);
          }
        }
        
        // Summary section
        console.log('\n' + format.gradientDivider(65));
        console.log(format.section('Summary Report', icons.chart));
        
        // Stats table
        const statsTable = format.table(
          ['Metric', 'Count', 'Status'],
          [
            ['Total Modules', moduleCount.toString(), ''],
            ['Valid Modules', validCount.toString(), validCount === moduleCount ? '✓' : '⚠'],
            ['Total Errors', errorCount.toString(), errorCount === 0 ? '✓' : '✗'],
            ['Total Warnings', totalWarnings.toString(), totalWarnings === 0 ? '✓' : '⚠']
          ]
        );
        
        console.log(format.indent(statsTable, 2));
        
        // Final result
        console.log('\n' + format.heavyDivider(65));
        
        if (hasErrors) {
          console.log(format.resultBox('error', 'Validation failed! Fix errors and try again.'));
          process.exit(1);
        } else if (totalWarnings > 0) {
          console.log(format.resultBox('warning', `All modules valid with ${totalWarnings} warning${totalWarnings > 1 ? 's' : ''}`));
        } else {
          console.log(format.resultBox('success', 'Perfect! All modules pass validation.'));
        }
      } else {
        // Validate single module
        const modulePath = resolve(context.cwd, path);
        
        if (!existsSync(modulePath)) {
          output.error(`Path does not exist: ${modulePath}`);
          process.exit(1);
        }
        
        console.log(format.title('SystemPrompt OS Module Validator', icons.search));
        console.log(format.keyValue('Module Path', style.path(modulePath)));
        console.log(format.keyValue('Strict Mode', strict ? style.warning('enabled') : style.muted('disabled')));
        if (fix) {
          console.log(format.keyValue('Fix Mode', style.warning('enabled')));
        }
        console.log(format.divider());
        
        const result = await validateModule(modulePath, { strict, fix });
        
        const moduleName = modulePath.split('/').pop() || 'module';
        const moduleStatus = result.valid 
          ? `${style.success(icons.success)} ${style.bold(moduleName)}`
          : `${style.error(icons.error)} ${style.bold(moduleName)}`;
        
        console.log(`\n${moduleStatus}`);
        
        if (result.errors.length > 0) {
          console.log(format.indent(style.error('Errors:')));
          result.errors.forEach(err => {
            console.log(format.indent(`${style.error(icons.cross)} ${style.muted(`[${err.type}]`)} ${err.message}`, 4));
            if (err.path) {
              console.log(format.indent(`${style.muted('Path:')} ${style.path(err.path)}`, 6));
            }
          });
        }
        
        if (result.warnings.length > 0) {
          console.log(format.indent(style.warning('Warnings:')));
          result.warnings.forEach(warn => {
            console.log(format.indent(`${style.warning(icons.warning)} ${style.muted(`[${warn.type}]`)} ${warn.message}`, 4));
            console.log(format.indent(`${style.muted(icons.arrow)} ${style.muted(warn.recommendation)}`, 6));
          });
        }
        
        if (result.valid && result.warnings.length === 0) {
          console.log(format.indent(`${style.success('Perfect!')} No issues found.`));
        }
        
        // Summary
        console.log('\n' + format.divider());
        console.log(format.section(`${icons.chart} Summary`));
        
        const statusColor = result.valid ? style.success : style.error;
        console.log(format.indent(format.keyValue('Status', statusColor(result.valid ? 'VALID' : 'INVALID'), 10)));
        console.log(format.indent(format.keyValue('Errors', result.errors.length > 0 ? style.error(result.errors.length.toString()) : style.success('0'), 10)));
        console.log(format.indent(format.keyValue('Warnings', result.warnings.length > 0 ? style.warning(result.warnings.length.toString()) : style.success('0'), 10)));
        
        console.log();
        if (!result.valid) {
          output.error('Validation failed! Fix the errors above and try again.');
        } else if (result.warnings.length > 0) {
          output.success(`Module is valid! ${style.warning(`(${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''})`)} `);
        } else {
          output.success('Perfect! Module passes validation with no issues.');
        }
        
        process.exit(result.valid ? 0 : 1);
      }
    } catch (error) {
      output.error(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(style.muted(error.stack));
      }
      process.exit(1);
    }
  }
};