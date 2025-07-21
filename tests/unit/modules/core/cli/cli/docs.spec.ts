import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '../../../../../../src/modules/core/cli/cli/docs';
import { CLIModule } from '../../../../../../src/modules/core/cli/index.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../../../../../src/modules/core/cli/index.js');
vi.mock('fs');
vi.mock('path');

describe('CLI Docs Command', () => {
  let mockCLIModule: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Mock CLIModule
    mockCLIModule = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getAllCommands: vi.fn().mockResolvedValue(new Map([
        ['test:command', { description: 'Test command' }],
        ['another:command', { description: 'Another command' }]
      ])),
      generateDocs: vi.fn().mockReturnValue('# Generated Documentation\n\nTest documentation content')
    };

    vi.mocked(CLIModule).mockImplementation(() => mockCLIModule);
    
    // Mock path.resolve
    vi.mocked(resolve).mockImplementation((...paths) => paths.join('/'));
    
    // Mock fs.writeFileSync
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should generate documentation and output to console by default', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      await command.execute(context);

      expect(consoleLogSpy).toHaveBeenCalledWith('Generating command documentation...');
      expect(mockCLIModule.initialize).toHaveBeenCalledWith({ config: {} });
      expect(mockCLIModule.getAllCommands).toHaveBeenCalled();
      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'markdown');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n# Generated Documentation\n\nTest documentation content');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n✓ Generated documentation for 2 commands');
    });

    it('should write documentation to file when output specified', async () => {
      const context = {
        cwd: '/test',
        args: {
          output: 'docs/commands.md'
        }
      };

      await command.execute(context);

      expect(resolve).toHaveBeenCalledWith('/test', 'docs/commands.md');
      expect(writeFileSync).toHaveBeenCalledWith(
        '/test/docs/commands.md',
        '# Generated Documentation\n\nTest documentation content'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Documentation generated: /test/docs/commands.md');
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('# Generated Documentation'));
    });

    it('should support different formats', async () => {
      const context = {
        cwd: '/test',
        args: {
          format: 'html'
        }
      };

      mockCLIModule.generateDocs.mockReturnValue('<html><body>Documentation</body></html>');

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'html');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n<html><body>Documentation</body></html>');
    });

    it('should handle errors during initialization', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      mockCLIModule.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating documentation:', expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle errors during doc generation', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      mockCLIModule.generateDocs.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating documentation:', expect.any(Error));
    });

    it('should handle file write errors', async () => {
      const context = {
        cwd: '/test',
        args: {
          output: 'invalid/path/file.md'
        }
      };

      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating documentation:', expect.any(Error));
    });
  });
});