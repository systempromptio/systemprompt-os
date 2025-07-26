import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { command } from '@/modules/core/cli/cli/docs';
import { CLIModule } from '@/modules/core/cli';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('@/modules/core/cli');
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

    it('should handle empty commands map', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      mockCLIModule.getAllCommands.mockResolvedValue(new Map());

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'markdown');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n✓ Generated documentation for 0 commands');
    });

    it('should handle null args object', async () => {
      const context = {
        cwd: '/test',
        args: null
      };

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'markdown');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n# Generated Documentation\n\nTest documentation content');
    });

    it('should handle undefined args object', async () => {
      const context = {
        cwd: '/test',
        args: undefined
      };

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'markdown');
      expect(consoleLogSpy).toHaveBeenCalledWith('\n# Generated Documentation\n\nTest documentation content');
    });

    it('should handle empty string format', async () => {
      const context = {
        cwd: '/test',
        args: {
          format: ''
        }
      };

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'markdown');
    });

    it('should handle null format', async () => {
      const context = {
        cwd: '/test',
        args: {
          format: null
        }
      };

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'markdown');
    });

    it('should handle undefined format', async () => {
      const context = {
        cwd: '/test',
        args: {
          format: undefined
        }
      };

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'markdown');
    });

    it('should handle empty string output path', async () => {
      const context = {
        cwd: '/test',
        args: {
          output: ''
        }
      };

      await command.execute(context);

      // Should not write to file with empty output path
      expect(writeFileSync).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('\n# Generated Documentation\n\nTest documentation content');
    });

    it('should handle null output path', async () => {
      const context = {
        cwd: '/test',
        args: {
          output: null
        }
      };

      await command.execute(context);

      // Should not write to file with null output path
      expect(writeFileSync).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('\n# Generated Documentation\n\nTest documentation content');
    });

    it('should handle both format and output parameters together', async () => {
      const context = {
        cwd: '/test',
        args: {
          format: 'json',
          output: 'docs/commands.json'
        }
      };

      mockCLIModule.generateDocs.mockReturnValue('{"commands": []}');

      await command.execute(context);

      expect(mockCLIModule.generateDocs).toHaveBeenCalledWith(expect.any(Map), 'json');
      expect(resolve).toHaveBeenCalledWith('/test', 'docs/commands.json');
      expect(writeFileSync).toHaveBeenCalledWith('/test/docs/commands.json', '{"commands": []}');
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Documentation generated: /test/docs/commands.json');
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('{"commands": []}'));
    });

    it('should handle error during getAllCommands', async () => {
      const context = {
        cwd: '/test',
        args: {}
      };

      mockCLIModule.getAllCommands.mockRejectedValue(new Error('Failed to get commands'));

      await expect(command.execute(context)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating documentation:', expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle different output file extensions', async () => {
      const context = {
        cwd: '/project',
        args: {
          format: 'html',
          output: 'documentation/api.html'
        }
      };

      mockCLIModule.generateDocs.mockReturnValue('<html><head><title>API Docs</title></head><body><h1>Commands</h1></body></html>');

      await command.execute(context);

      expect(resolve).toHaveBeenCalledWith('/project', 'documentation/api.html');
      expect(writeFileSync).toHaveBeenCalledWith(
        '/project/documentation/api.html',
        '<html><head><title>API Docs</title></head><body><h1>Commands</h1></body></html>'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Documentation generated: /project/documentation/api.html');
    });

    it('should handle complex cwd path', async () => {
      const context = {
        cwd: '/complex/path/with/spaces and special chars',
        args: {
          output: 'output.md'
        }
      };

      await command.execute(context);

      expect(resolve).toHaveBeenCalledWith('/complex/path/with/spaces and special chars', 'output.md');
    });

    it('should handle absolute output path', async () => {
      const context = {
        cwd: '/test',
        args: {
          output: '/absolute/path/docs.md'
        }
      };

      await command.execute(context);

      expect(resolve).toHaveBeenCalledWith('/test', '/absolute/path/docs.md');
    });
  });
});