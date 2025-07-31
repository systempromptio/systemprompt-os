/**
 * Lint service for running ESLint and parsing results.
 * @file Lint service for running ESLint and parsing results.
 * @module modules/core/dev/services/lint
 */

import { spawn } from 'child_process';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Lint result interface.
 */
export interface LintResult {
  success: boolean;
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  results: Array<{
    filePath: string;
    errorCount: number;
    warningCount: number;
    messages: Array<{
      line: number;
      column: number;
      message: string;
      ruleId: string;
      severity: number;
    }>;
  }>;
}

/**
 * Service for running ESLint and parsing results.
 */
export class LintService {
  private static instance: LintService;
  private logger!: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns LintService instance.
   */
  public static getInstance(): LintService {
    LintService.instance ??= new LintService();
    return LintService.instance;
  }

  /**
   * Initialize the service.
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    this.initialized = true;
    this.logger.info(LogSource.CLI, 'LintService initialized');
  }

  /**
   * Run ESLint for a specific file or folder.
   * @param target - File or folder path to lint.
   * @param options - Lint options.
   * @param options.fix
   * @returns Promise resolving to lint results.
   */
  public async runLint(target?: string, options: { fix?: boolean } = {}): Promise<LintResult> {
    const targetInfo = target ? ` for ${target}` : '';
    this.logger.info(LogSource.CLI, `Running ESLint${targetInfo}`);

    return await new Promise((resolve, reject) => {
      const lintCommand = 'npm';
      const lintArgs: string[] = ['run', 'lint'];

      if (target) {
        lintArgs.push('--', target);
      }

      if (options.fix) {
        lintArgs.push('--fix');
      }

      const eslintProcess = spawn(lintCommand, lintArgs, {
        cwd: process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      eslintProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      eslintProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      eslintProcess.on('close', (code) => {
        try {
          const result = this.parseLintOutput(stdout, stderr, code, target);
          this.logger.info(LogSource.CLI, `ESLint completed with ${result.totalErrors} errors, ${result.totalWarnings} warnings`);
          resolve(result);
        } catch (error) {
          this.logger.error(LogSource.CLI, `Failed to parse lint output: ${error instanceof Error ? error.message : String(error)}`);
          reject(error);
        }
      });

      eslintProcess.on('error', (error) => {
        this.logger.error(LogSource.CLI, `ESLint process error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Parse lint output from ESLint.
   * @param stdout - Standard output from ESLint.
   * @param stderr - Standard error from ESLint.
   * @param exitCode - Exit code from ESLint process.
   * @param targetPath - Optional target path to filter results.
   * @returns Parsed lint results.
   */
  private parseLintOutput(stdout: string, stderr: string, exitCode: number | null, targetPath?: string): LintResult {
    const result: LintResult = {
      success: exitCode === 0,
      totalFiles: 0,
      totalErrors: 0,
      totalWarnings: 0,
      results: []
    };

    const lines = (stdout + stderr).split('\n').filter(line => { return line.trim() });

    let currentFile = '';
    let currentFileErrors = 0;
    let currentFileWarnings = 0;
    const currentMessages: Array<{
      line: number;
      column: number;
      message: string;
      ruleId: string;
      severity: number;
    }> = [];

    for (const line of lines) {
      if (line.match(/^[/\w].*\.(ts|tsx|js|jsx)$/)) {
        if (currentFile) {
          if (!targetPath || currentFile.includes(targetPath)) {
            result.results.push({
              filePath: currentFile,
              errorCount: currentFileErrors,
              warningCount: currentFileWarnings,
              messages: [...currentMessages]
            });
            result.totalFiles++;
          }
        }

        currentFile = line.trim();
        currentFileErrors = 0;
        currentFileWarnings = 0;
        currentMessages.length = 0;
      }
      else if (line.match(/^\s+\d+:\d+/) && currentFile) {
        const messageMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([^\s]+)$/);
        if (messageMatch) {
          const [, lineNum, column, severity, message, ruleId] = messageMatch;
          const severityNum = severity === 'error' ? 2 : 1;

          if (severityNum === 2) {
            currentFileErrors++;
          } else {
            currentFileWarnings++;
          }

          currentMessages.push({
            line: parseInt(lineNum!, 10),
            column: parseInt(column!, 10),
            message: message!,
            ruleId: ruleId!,
            severity: severityNum
          });
        }
      }
    }

    if (currentFile) {
      if (!targetPath || currentFile.includes(targetPath)) {
        result.results.push({
          filePath: currentFile,
          errorCount: currentFileErrors,
          warningCount: currentFileWarnings,
          messages: [...currentMessages]
        });
        result.totalFiles++;
      }
    }

    result.totalErrors = 0;
    result.totalWarnings = 0;
    for (const file of result.results) {
      result.totalErrors += file.errorCount;
      result.totalWarnings += file.warningCount;
    }

    result.success = result.totalErrors === 0 && result.totalWarnings === 0;

    return result;
  }
}
