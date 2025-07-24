/**
 * @fileoverview Show configuration differences command
 * @module modules/core/config/cli/diff
 */

import { ConfigModule } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Execute diff command
 */
async function execute(options: { file1?: string; file2: string; format?: string }): Promise<void> {
  const format = options.format || 'unified';

  if (!options.file2) {
    console.error('Error: Second config file (file2) is required');
    process.exit(1);
  }

  try {
    const configModule = new ConfigModule();
    await configModule.initialize();

    // Get first configuration (current or from file)
    let config1: any;
    if (options.file1) {
      const filePath = path.resolve(options.file1);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      config1 = JSON.parse(fileContent);
    } else {
      // Use current configuration
      config1 = configModule.get() || {};
    }

    // Get second configuration from file
    const file2Path = path.resolve(options.file2);
    const file2Content = await fs.readFile(file2Path, 'utf-8');
    const config2 = JSON.parse(file2Content);

    // Calculate differences
    const diff = calculateDiff(config1, config2);

    if (format === 'json') {
      console.log(JSON.stringify(diff, null, 2));
    } else {
      // Text format output
      const file1Source = options.file1 || 'current configuration';
      const file2Source = options.file2;
      console.log(`\nConfiguration Differences`);
      console.log(`Comparing: ${file1Source} with ${file2Source}`);
      console.log('='.repeat(60));

      if (diff.added.length > 0) {
        console.log('\n+ Added (in first, not in second):');
        diff.added.forEach((item) => {
          console.log(`  ${item.key}: ${formatValue(item.value)}`);
        });
      }

      if (diff.removed.length > 0) {
        console.log('\n- Removed (in second, not in first):');
        diff.removed.forEach((item) => {
          console.log(`  ${item.key}: ${formatValue(item.value)}`);
        });
      }

      if (diff.changed.length > 0) {
        console.log('\n* Changed:');
        diff.changed.forEach((item) => {
          console.log(`  ${item.key}:`);
          console.log(`    First:  ${formatValue(item.current)}`);
          console.log(`    Second: ${formatValue(item.compare)}`);
        });
      }

      // Summary
      console.log('\nSummary:');
      console.log(`  Added: ${diff.added.length}`);
      console.log(`  Removed: ${diff.removed.length}`);
      console.log(`  Changed: ${diff.changed.length}`);
      console.log(`  Unchanged: ${diff.unchanged.length}`);
    }
  } catch (error) {
    console.error(
      `Error comparing configurations: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

interface DiffResult {
  added: Array<{ key: string; value: any }>;
  removed: Array<{ key: string; value: any }>;
  changed: Array<{ key: string; current: any; compare: any }>;
  unchanged: Array<{ key: string; value: any }>;
}

function calculateDiff(current: any, compare: any, prefix = ''): DiffResult {
  const result: DiffResult = {
    added: [],
    removed: [],
    changed: [],
    unchanged: [],
  };

  // Check for added and changed items
  for (const [key, value] of Object.entries(current)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (!(key in compare)) {
      result.added.push({ key: fullKey, value });
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively compare nested objects
      const nestedDiff = calculateDiff(value, compare[key], fullKey);
      result.added.push(...nestedDiff.added);
      result.removed.push(...nestedDiff.removed);
      result.changed.push(...nestedDiff.changed);
      result.unchanged.push(...nestedDiff.unchanged);
    } else if (JSON.stringify(value) !== JSON.stringify(compare[key])) {
      result.changed.push({ key: fullKey, current: value, compare: compare[key] });
    } else {
      result.unchanged.push({ key: fullKey, value });
    }
  }

  // Check for removed items
  for (const [key, value] of Object.entries(compare)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in current)) {
      result.removed.push({ key: fullKey, value });
    }
  }

  return result;
}

function formatValue(value: any): string {
  if (value === null) {return 'null';}
  if (value === undefined) {return 'undefined';}
  if (typeof value === 'string') {return `"${value}"`;}
  if (typeof value === 'object') {return JSON.stringify(value);}
  return String(value);
}

/**
 * Command export for CLI discovery
 */
export const command = {
  execute,
};
