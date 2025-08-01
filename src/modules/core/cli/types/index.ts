/**
 * Export all types from manual.ts except ICliService to avoid conflict.
 */
export type {
  ICLIContext,
  ICLIOption,
  ICLIPositional,
  ICLICommand,
  ICLILogger,
  ICommandMetadata,
  ICLIConfig,
  ICommandDiscoveryResult,
  ICLIModuleExports,
  ICLIService,
  ICliModule,
  ISummaryFormatCLI,
  ISummarySortByCLI,
  SetupArgs,
  StatusFormat,
  IStatusData,
  ISchemaVersion,
  CLIContext,
  CLIOption,
  CLIPositional,
  CLICommand,
  CLILogger,
  CommandMetadata,
  CLIConfig,
  CommandDiscoveryResult,
  CLIModuleExports
} from '@/modules/core/cli/types/manual';

/**
 * Export generated types.
 */
export * from '@/modules/core/cli/types/cli.module.generated';

/**
 * Export generated ICliService explicitly to resolve ambiguity.
 */
export type { ICliService as IGeneratedCliService } from '@/modules/core/cli/types/cli.service.generated';

export * from '@/modules/core/cli/types/database.generated';
