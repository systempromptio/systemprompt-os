/**
 * Typecheck service for running TypeScript type checking and parsing results.
 * @file Typecheck service for running TypeScript type checking and parsing results.
 * @module modules/core/dev/services/typecheck
 */

import { spawn } from 'child_process';
import type { ILogger } from '@/modules/core/logger/types/manual';
import { LogSource } from '@/modules/core/logger/types/manual';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Typecheck result interface.
 */
export interface TypecheckResult {
  success: boolean;
  totalErrors: number;
  files: Array<{
    filePath: string;
    errors: Array<{
      line: number;
      column: number;
      code: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  }>;
}

/**
 * Service for running TypeScript type checking and parsing results.
 */
export class TypecheckService {
  private static instance: TypecheckService;
  private logger!: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns TypecheckService instance.
   */
  public static getInstance(): TypecheckService {
    TypecheckService.instance ??= new TypecheckService();
    return TypecheckService.instance;
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
    this.logger.info(LogSource.CLI, 'TypecheckService initialized');
  }

  /**
   * Run TypeScript type checking for a specific file or folder.
   * @param target - File or folder path to typecheck.
   * @param options - Typecheck options.
   * @param options.strict
   * @returns Promise resolving to typecheck results.
   */
  public async runTypecheck(target?: string, options: { strict?: boolean } = {}): Promise<TypecheckResult> {
    const targetInfo = target ? ` for ${target}` : '';
    this.logger.info(LogSource.CLI, `Running TypeScript type checking${targetInfo}`);

    return await new Promise((resolve, reject) => {
      const tscCommand = 'npx';
      const tscArgs: string[] = ['tsc', '--noEmit'];

      if (options.strict) {
        tscArgs.push('--strict');
      }

      if (target) {
        tscArgs.push('--listFilesOnly', 'false');
        tscArgs.push('--project', 'tsconfig.json');
        tscArgs.push('--listFiles', 'false');
      }

      const tscProcess = spawn(tscCommand, tscArgs, {
        cwd: process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      tscProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      tscProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tscProcess.on('close', (code) => {
        try {
          const result = this.parseTypecheckOutput(stdout, stderr, code, target);
          this.logger.info(LogSource.CLI, `TypeScript type checking completed with ${result.totalErrors} errors`);
          resolve(result);
        } catch (error) {
          this.logger.error(LogSource.CLI, `Failed to parse typecheck output: ${error instanceof Error ? error.message : String(error)}`);
          reject(error);
        }
      });

      tscProcess.on('error', (error) => {
        this.logger.error(LogSource.CLI, `TypeScript process error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Parse typecheck output from TypeScript compiler.
   * @param stdout - Standard output from tsc.
   * @param stderr - Standard error from tsc.
   * @param exitCode - Exit code from tsc process.
   * @param targetPath - Optional target path to filter results.
   * @returns Parsed typecheck results.
   */
  private parseTypecheckOutput(stdout: string, stderr: string, exitCode: number | null, targetPath?: string): TypecheckResult {
    const result: TypecheckResult = {
      success: exitCode === 0,
      totalErrors: 0,
      files: []
    };

    const output = stdout + stderr;
    const lines = output.split('\n').filter(line => { return line.trim() });

    const fileMap = new Map<string, TypecheckResult['files'][0]>();

    for (const line of lines) {
      const errorMatch = line.match(/^(.+\.ts[x]?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);

      if (errorMatch) {
        const [, filePath, lineNum, colNum, severity, code, message] = errorMatch;

        if (targetPath && !filePath!.includes(targetPath)) {
          continue;
        }

        if (!fileMap.has(filePath!)) {
          fileMap.set(filePath!, {
            filePath: filePath!,
            errors: []
          });
        }

        const file = fileMap.get(filePath!)!;
        file.errors.push({
          line: parseInt(lineNum!, 10),
          column: parseInt(colNum!, 10),
          code: code!,
          message: message!,
          severity: severity === 'error' ? 'error' : 'warning'
        });

        if (severity === 'error') {
          result.totalErrors++;
        }
      }
    }

    result.files = Array.from(fileMap.values()).sort((a, b) => { return a.filePath.localeCompare(b.filePath) });

    if (result.totalErrors === 0 && exitCode !== 0) {
      const summaryMatch = output.match(/Found (\d+) errors?/);
      if (summaryMatch) {
        result.totalErrors = parseInt(summaryMatch[1]!, 10);
      }
    }

    return result;
  }
}
