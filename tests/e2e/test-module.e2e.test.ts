/**
 * @file E2E tests for test-module module.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('TestModule Module E2E Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../bin/systemprompt');
  let createdId: string;

  beforeAll(() => {
    // Ensure clean state - delete all test-modules
    try {
      const listOutput = execSync(`${CLI_PATH} test-module list`, { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      // Extract IDs from output and delete each one
      const idMatches = listOutput.matchAll(/([a-f0-9]{32})/g);
      for (const match of idMatches) {
        try {
          execSync(`${CLI_PATH} test-module delete ${match[1]}`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
        } catch {
          // Ignore errors during cleanup
        }
      }
    } catch {
      // List might fail if no items exist, which is fine
    }
  });

  afterAll(() => {
    // Cleanup created test data
    if (createdId) {
      try {
        execSync(`${CLI_PATH} test-module delete ${createdId}`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should display help for test-module command', () => {
    const output = execSync(`${CLI_PATH} test-module --help`, {
      encoding: 'utf8'
    });

    expect(output).toContain('test-module');
    expect(output).toContain('Test module for validation');
    expect(output).toContain('list');
    expect(output).toContain('create');
    expect(output).toContain('Commands:');
  });

  it('should list test-modules (initially empty)', () => {
    const output = execSync(`${CLI_PATH} test-module list`, {
      encoding: 'utf8'
    });

    expect(output).toContain('No test-modules found');
  });

  it('should create a new test-module', () => {
    const output = execSync(`${CLI_PATH} test-module create "Test TestModule" -d "Test description"`, {
      encoding: 'utf8'
    });

    expect(output).toContain('Successfully created test-module');
    expect(output).toContain('Created test-module:');
    expect(output).toContain('Test TestModule');
    expect(output).toContain('Test description');
    
    // Extract ID from output
    const idMatch = output.match(/ID: ([a-f0-9]+)/);
    expect(idMatch).toBeTruthy();
    createdId = idMatch![1];
  });

  it('should list test-modules after creation', () => {
    const output = execSync(`${CLI_PATH} test-module list`, {
      encoding: 'utf8'
    });

    expect(output).toContain('Found 1 test-modules');
    expect(output).toContain('Test TestModule');
    expect(output).toContain('Test description');
    expect(output).toContain(createdId);
  });

  it('should handle list command with options', () => {
    // Create another item for testing
    const createOutput = execSync(`${CLI_PATH} test-module create "Another TestModule"`, {
      encoding: 'utf8'
    });
    const anotherIdMatch = createOutput.match(/ID: ([a-f0-9]+)/);
    const anotherId = anotherIdMatch![1];

    try {
      // Test with limit
      const limitOutput = execSync(`${CLI_PATH} test-module list --limit 1`, {
        encoding: 'utf8'
      });
      expect(limitOutput).toContain('Showing 1 of 2 items');

      // Test with sort
      const sortOutput = execSync(`${CLI_PATH} test-module list --sort name`, {
        encoding: 'utf8'
      });
      expect(sortOutput).toContain('Another TestModule');
      expect(sortOutput).toContain('Test TestModule');

      // Cleanup
      execSync(`${CLI_PATH} test-module delete ${anotherId}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error) {
      // Cleanup on error
      try {
        execSync(`${CLI_PATH} test-module delete ${anotherId}`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch {}
      throw error;
    }
  });

  it('should handle create command with metadata', () => {
    const metadata = { key: 'value', number: 42 };
    const output = execSync(
      `${CLI_PATH} test-module create "With Metadata" --metadata '${JSON.stringify(metadata)}'`,
      {
        encoding: 'utf8'
      }
    );

    expect(output).toContain('Successfully created test-module');
    expect(output).toContain('With Metadata');

    // Extract and cleanup
    const idMatch = output.match(/ID: ([a-f0-9]+)/);
    if (idMatch) {
      execSync(`${CLI_PATH} test-module delete ${idMatch[1]}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    }
  });

  it('should handle errors gracefully', () => {
    // Test creating with empty name
    let error: any;
    try {
      execSync(`${CLI_PATH} test-module create ""`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(1);
    expect(error.stderr || error.stdout).toContain('Failed to create test-module');
  });

  it('should handle missing subcommand', () => {
    const output = execSync(`${CLI_PATH} test-module`, {
      encoding: 'utf8'
    });

    // Should show help when no subcommand is provided
    expect(output).toContain('Commands:');
    expect(output).toContain('list');
    expect(output).toContain('create');
  });
});
