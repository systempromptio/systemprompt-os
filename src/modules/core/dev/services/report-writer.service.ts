/**
 * Report Writer Service - Writes timestamped JSON reports to mirror directory structure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { EventBusService } from '@/modules/core/events/services/event-bus.service';
import { DevEvents, type DevReportRequestEvent } from '@/modules/core/events/types/index';

export interface BaseReport {
  timestamp: string;
  command: string;
  module?: string;
  target?: string;
  success: boolean;
  duration: number;
}

export interface LintReport extends BaseReport {
  command: 'lint';
  totalErrors: number;
  totalWarnings: number;
  totalFiles: number;
  results: Array<{
    filePath: string;
    errorCount: number;
    warningCount: number;
    messages: Array<{
      ruleId: string | null;
      severity: number;
      message: string;
      line: number;
      column: number;
    }>;
  }>;
}

export interface TypecheckReport extends BaseReport {
  command: 'typecheck';
  totalErrors: number;
  files: Array<{
    filePath: string;
    errors: Array<{
      line: number;
      column: number;
      code: string;
      message: string;
    }>;
  }>;
}

export interface TestReport extends BaseReport {
  command: 'test';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalTestSuites: number;
  passedTestSuites: number;
  failedTestSuites: number;
  coverage?: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  };
  suites: Array<{
    name: string;
    status: 'passed' | 'failed';
    tests: number;
    duration: number;
  }>;
}

export type DevReport = LintReport | TypecheckReport | TestReport;

export class ReportWriterService {
  private static instance: ReportWriterService;
  private readonly logger = LoggerService.getInstance();
  private readonly eventBus: EventBusService;

  private constructor() {
    this.eventBus = EventBusService.getInstance();
    this.setupEventHandlers();
  }

  static getInstance(): ReportWriterService {
    ReportWriterService.instance ||= new ReportWriterService();
    return ReportWriterService.instance;
  }

  /**
   * Set up event handlers for dev report requests.
   */
  private setupEventHandlers(): void {
    this.eventBus.on<DevReportRequestEvent>(
      DevEvents.REPORT_WRITE_REQUEST,
      async (data: unknown) => {
        try {
          const event = data as DevReportRequestEvent;
          await this.writeReport(event.report as unknown as DevReport);
        } catch (error) {
          this.logger.error(
            LogSource.CLI,
            `Failed to handle dev report event: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  }

  /**
   * Write a report to the appropriate mirror directory.
   * @param report - The report data to write.
   */
  async writeReport(report: DevReport): Promise<void> {
    try {
      const reportPath = this.getReportPath(report);
      const reportDir = path.dirname(reportPath);

      await fs.promises.mkdir(reportDir, { recursive: true });
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));

      await this.updateStatusFile(report);

      this.logger.debug(LogSource.CLI, `Report written to: ${reportPath}`);
    } catch (error) {
      this.logger.error(
        LogSource.CLI,
        `Failed to write report: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get the appropriate report file path based on the module or target.
   * @param report - The report data.
   * @returns The full path where the report should be written.
   */
  private getReportPath(report: DevReport): string {
    const baseReportsDir = '/var/www/html/systemprompt-os/reports';
    const timestamp = new Date().toISOString()
.replace(/[:.]/g, '-')
.slice(0, -5);
    const filename = `${report.command}-report-${timestamp}.json`;

    if (report.module) {
      return path.join(baseReportsDir, 'src', 'modules', 'core', report.module, filename);
    }

    if (report.target) {
      const targetPath = report.target.replace(/^src\//, '');
      return path.join(baseReportsDir, 'src', targetPath, filename);
    }

    return path.join(baseReportsDir, filename);
  }

  /**
   * Get the latest report for a specific command and module/target.
   * @param command - The command type (lint, typecheck, test).
   * @param module - Optional module name.
   * @param target - Optional target path.
   * @returns The latest report or null if not found.
   */
  async getLatestReport(
    command: string,
    module?: string,
    target?: string
  ): Promise<DevReport | null> {
    try {
      const reportDir = this.getReportDirectory(command, module, target);

      if (!fs.existsSync(reportDir)) {
        return null;
      }

      const files = await fs.promises.readdir(reportDir);
      const reportFiles = files
        .filter(file => { return file.startsWith(`${command}-report-`) && file.endsWith('.json') })
        .sort()
        .reverse();

      if (reportFiles.length === 0 || !reportFiles[0]) {
        return null;
      }

      const latestFile = path.join(reportDir, reportFiles[0]);
      const content = await fs.promises.readFile(latestFile, 'utf-8');
      return JSON.parse(content) as DevReport;
    } catch (error) {
      this.logger.error(
        LogSource.CLI,
        `Failed to read latest report: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Get the report directory path for a given command and module/target.
   * @param command - The command type.
   * @param module - Optional module name.
   * @param target - Optional target path.
   * @returns The directory path where reports should be stored.
   */
  private getReportDirectory(_command: string, module?: string, target?: string): string {
    const baseReportsDir = '/var/www/html/systemprompt-os/reports';

    if (module) {
      return path.join(baseReportsDir, 'src', 'modules', 'core', module);
    }

    if (target) {
      const targetPath = target.replace(/^src\//, '');
      return path.join(baseReportsDir, 'src', targetPath);
    }

    return baseReportsDir;
  }

  /**
   * Update status.json file with the latest report information.
   * @param report - The newly written report.
   */
  private async updateStatusFile(report: DevReport): Promise<void> {
    try {
      const statusPath = this.getStatusPath(report);
      const statusDir = path.dirname(statusPath);

      await fs.promises.mkdir(statusDir, { recursive: true });

      let status: Record<string, any> = {};

      if (fs.existsSync(statusPath)) {
        const content = await fs.promises.readFile(statusPath, 'utf-8');
        status = JSON.parse(content);
      }

      status[report.command] = {
        timestamp: report.timestamp,
        success: report.success,
        duration: report.duration,
        summary: this.createReportSummary(report)
      };

      const overallSummary = this.createOverallSummary(status);
      const newStatus = {
        summary: overallSummary,
        ...status,
        _meta: {
          lastUpdated: new Date().toISOString(),
          module: report.module,
          target: report.target
        }
      };

      status = newStatus;

      await fs.promises.writeFile(statusPath, JSON.stringify(status, null, 2));
    } catch (error) {
      this.logger.debug(LogSource.CLI, `Failed to update status file: ${error}`);
    }
  }

  /**
   * Get the status.json file path for a given report.
   * @param report - The report data.
   * @returns The full path where status.json should be written.
   */
  private getStatusPath(report: DevReport): string {
    const baseReportsDir = '/var/www/html/systemprompt-os/reports';

    if (report.module) {
      return path.join(baseReportsDir, 'src', 'modules', 'core', report.module, 'status.json');
    }

    if (report.target) {
      const targetPath = report.target.replace(/^src\//, '');
      return path.join(baseReportsDir, 'src', targetPath, 'status.json');
    }

    return path.join(baseReportsDir, 'status.json');
  }

  /**
   * Create a summary object for the status file based on report type.
   * @param report - The report data.
   * @returns A summary object with key metrics.
   */
  private createReportSummary(report: DevReport): Record<string, any> {
    switch (report.command) {
      case 'lint':
        return {
          totalErrors: report.totalErrors,
          totalWarnings: report.totalWarnings,
          totalFiles: report.totalFiles
        };
      case 'typecheck':
        return {
          totalErrors: report.totalErrors,
          totalFiles: report.files.length
        };
      case 'test':
        return {
          totalTests: report.totalTests,
          passedTests: report.passedTests,
          failedTests: report.failedTests,
          coverage: report.coverage
        };
      default:
        return {};
    }
  }

  /**
   * Create an overall summary combining all command results.
   * @param status - The current status object containing all command results.
   * @returns An overall summary object.
   */
  private createOverallSummary(status: Record<string, any>): Record<string, any> {
    const summary: Record<string, any> = {
      totalCommands: 0,
      passedCommands: 0,
      failedCommands: 0,
      commands: {}
    };

    for (const [key, value] of Object.entries(status)) {
      if (key === '_meta' || key === 'summary') { continue; }

      summary.totalCommands++;
      summary.commands[key] = {
        status: value.success ? 'passed' : 'failed',
        timestamp: value.timestamp
      };

      if (value.success) {
        summary.passedCommands++;
      } else {
        summary.failedCommands++;
      }
    }

    summary.overallStatus = summary.failedCommands === 0 ? 'passed' : 'failed';

    return summary;
  }
}
