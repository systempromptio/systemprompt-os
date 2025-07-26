/**
 * @fileoverview Tests for CLI error classes
 * @module tests/unit/modules/core/cli/utils
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CliError,
  CLIError,
  CommandNotFoundError,
  CommandExecutionError,
  InvalidArgumentsError,
  MissingRequiredOptionError,
  CommandDiscoveryError,
  CliInitializationError,
  CLIInitializationError,
  OutputFormattingError,
  DocumentationGenerationError,
} from '@/modules/core/cli/utils/errors';

describe('CLI Error Classes', () => {
  describe('CliError (base class)', () => {
    it('should create error with message and code', () => {
      const error = new CliError('Test error', 'TESTerror');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TESTerror');
      expect(error.name).toBe('CliError');
    });

    it('should have stack trace', () => {
      const error = new CliError('Test error', 'TESTerror');
      expect(error.stack).toBeDefined();
    });

    it('should call Error.captureStackTrace', () => {
      const spy = vi.spyOn(Error, 'captureStackTrace');
      new CliError('Test error', 'TESTerror');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('CommandNotFoundError', () => {
    it('should create error with command name', () => {
      const error = new CommandNotFoundError('test:command');

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe('Command not found: test:command');
      expect(error.code).toBe('COMMAND_NOT_FOUND');
      expect(error.name).toBe('CommandNotFoundError');
      expect(error.commandName).toBe('test:command');
    });
  });

  describe('CommandExecutionError', () => {
    it('should create error with command name and original error', () => {
      const originalError = new Error('Execution failed');
      const error = new CommandExecutionError('test:command', originalError);

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe('Failed to execute command "test:command": Execution failed');
      expect(error.code).toBe('COMMAND_EXECUTION_FAILED');
      expect(error.name).toBe('CommandExecutionError');
      expect(error.commandName).toBe('test:command');
      expect(error.originalError).toBe(originalError);
    });

    it('should use custom message if provided', () => {
      const originalError = new Error('Execution failed');
      const error = new CommandExecutionError(
        'test:command',
        originalError,
        'Custom error message',
      );

      expect(error.message).toBe('Custom error message');
    });
  });

  describe('InvalidArgumentsError', () => {
    it('should create error with command name and details', () => {
      const error = new InvalidArgumentsError('test:command', 'Missing required argument');

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe(
        'Invalid arguments for command "test:command": Missing required argument',
      );
      expect(error.code).toBe('INVALID_ARGUMENTS');
      expect(error.name).toBe('InvalidArgumentsError');
      expect(error.commandName).toBe('test:command');
      expect(error.details).toBe('Missing required argument');
    });
  });

  describe('MissingRequiredOptionError', () => {
    it('should create error with command and option names', () => {
      const error = new MissingRequiredOptionError('test:command', 'username');

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe('Missing required option "username" for command "test:command"');
      expect(error.code).toBe('MISSING_REQUIRED_OPTION');
      expect(error.name).toBe('MissingRequiredOptionError');
      expect(error.commandName).toBe('test:command');
      expect(error.optionName).toBe('username');
    });
  });

  describe('CommandDiscoveryError', () => {
    it('should create error with path and original error', () => {
      const originalError = new Error('File not found');
      const error = new CommandDiscoveryError('/path/to/commands', originalError);

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe(
        'Failed to discover commands at "/path/to/commands": File not found',
      );
      expect(error.code).toBe('COMMAND_DISCOVERY_FAILED');
      expect(error.name).toBe('CommandDiscoveryError');
      expect(error.path).toBe('/path/to/commands');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('CliInitializationError', () => {
    it('should create error with original error', () => {
      const originalError = new Error('Init failed');
      const error = new CliInitializationError(originalError);

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe('Failed to initialize CLI module: Init failed');
      expect(error.code).toBe('CLI_INITIALIZATION_FAILED');
      expect(error.name).toBe('CliInitializationError');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('OutputFormattingError', () => {
    it('should create error with format and original error', () => {
      const originalError = new Error('JSON parse failed');
      const error = new OutputFormattingError('json', originalError);

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe('Failed to format output as "json": JSON parse failed');
      expect(error.code).toBe('OUTPUT_FORMATTING_FAILED');
      expect(error.name).toBe('OutputFormattingError');
      expect(error.format).toBe('json');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('DocumentationGenerationError', () => {
    it('should create error with format and original error', () => {
      const originalError = new Error('Template error');
      const error = new DocumentationGenerationError('markdown', originalError);

      expect(error).toBeInstanceOf(CliError);
      expect(error.message).toBe(
        'Failed to generate documentation in "markdown" format: Template error',
      );
      expect(error.code).toBe('DOCUMENTATION_GENERATION_FAILED');
      expect(error.name).toBe('DocumentationGenerationError');
      expect(error.format).toBe('markdown');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('Export aliases', () => {
    it('CLIError should be an alias for CliError', () => {
      const error = new CLIError('Test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(CliError);
      expect(error).toBeInstanceOf(CLIError);
      expect(error.name).toBe('CliError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
    });

    it('CLIInitializationError should be an alias for CliInitializationError', () => {
      const originalError = new Error('Init failed');
      const error = new CLIInitializationError(originalError);
      expect(error).toBeInstanceOf(CliError);
      expect(error).toBeInstanceOf(CliInitializationError);
      expect(error).toBeInstanceOf(CLIInitializationError);
      expect(error.name).toBe('CliInitializationError');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string message in CliError', () => {
      const error = new CliError('', 'EMPTY_MESSAGE');
      expect(error.message).toBe('');
      expect(error.code).toBe('EMPTY_MESSAGE');
      expect(error.name).toBe('CliError');
    });

    it('should handle empty string code in CliError', () => {
      const error = new CliError('Test message', '');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('');
      expect(error.name).toBe('CliError');
    });

    it('should handle empty command name in CommandNotFoundError', () => {
      const error = new CommandNotFoundError('');
      expect(error.message).toBe('Command not found: ');
      expect(error.commandName).toBe('');
      expect(error.code).toBe('COMMAND_NOT_FOUND');
    });

    it('should handle empty command name in CommandExecutionError', () => {
      const originalError = new Error('Test error');
      const error = new CommandExecutionError('', originalError);
      expect(error.message).toBe('Failed to execute command "": Test error');
      expect(error.commandName).toBe('');
    });

    it('should handle empty details in InvalidArgumentsError', () => {
      const error = new InvalidArgumentsError('test:command', '');
      expect(error.message).toBe('Invalid arguments for command "test:command": ');
      expect(error.details).toBe('');
    });

    it('should handle empty option name in MissingRequiredOptionError', () => {
      const error = new MissingRequiredOptionError('test:command', '');
      expect(error.message).toBe('Missing required option "" for command "test:command"');
      expect(error.optionName).toBe('');
    });

    it('should handle empty path in CommandDiscoveryError', () => {
      const originalError = new Error('Test error');
      const error = new CommandDiscoveryError('', originalError);
      expect(error.message).toBe('Failed to discover commands at "": Test error');
      expect(error.path).toBe('');
    });

    it('should handle empty format in OutputFormattingError', () => {
      const originalError = new Error('Test error');
      const error = new OutputFormattingError('', originalError);
      expect(error.message).toBe('Failed to format output as "": Test error');
      expect(error.format).toBe('');
    });

    it('should handle empty format in DocumentationGenerationError', () => {
      const originalError = new Error('Test error');
      const error = new DocumentationGenerationError('', originalError);
      expect(error.message).toBe('Failed to generate documentation in "" format: Test error');
      expect(error.format).toBe('');
    });

    it('should handle errors with empty message in originalError', () => {
      const originalError = new Error('');
      const error = new CommandExecutionError('test:command', originalError);
      expect(error.message).toBe('Failed to execute command "test:command": ');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('Error inheritance', () => {
    it('all error classes should be instanceof Error and CliError', () => {
      const errors = [
        new CommandNotFoundError('test'),
        new CommandExecutionError('test', new Error()),
        new InvalidArgumentsError('test', 'details'),
        new MissingRequiredOptionError('test', 'option'),
        new CommandDiscoveryError('/path', new Error()),
        new CliInitializationError(new Error()),
        new OutputFormattingError('json', new Error()),
        new DocumentationGenerationError('markdown', new Error()),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(CliError);
        expect(error.stack).toBeDefined();
      });
    });
  });
});
