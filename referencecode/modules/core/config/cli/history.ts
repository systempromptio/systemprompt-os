/**
 * @fileoverview View configuration change history command
 * @module modules/core/config/cli/history
 */

import { ConfigModule } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Execute history command
 */
async function execute(options: { limit?: number; since?: string; key?: string }): Promise<void> {
  const limit = options.limit || 10;

  try {
    const configModule = new ConfigModule();
    await configModule.initialize();

    // Check if history file exists
    const historyPath = path.join('./state/config', 'history.json');

    let history: any[] = [];
    try {
      const historyContent = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(historyContent);
    } catch {
      // History file doesn't exist or is invalid
      console.log('\nNo configuration history found.');
      console.log('History tracking may not be enabled for this configuration.');
      return;
    }

    // Filter history if needed
    let filteredHistory = history;

    // Filter by key if specified
    if (options.key) {
      filteredHistory = filteredHistory.filter(
        (entry) => entry.key?.includes(options.key),
      );
    }

    // Filter by date if specified
    if (options.since) {
      const sinceDate = parseSinceDate(options.since);
      filteredHistory = filteredHistory.filter((entry) => new Date(entry.timestamp) >= sinceDate);
    }

    // Apply limit
    filteredHistory = filteredHistory.slice(-limit);

    // Display history
    console.log('\nConfiguration History');
    console.log('='.repeat(60));

    if (filteredHistory.length === 0) {
      console.log('\nNo configuration changes found matching the criteria.');
      return;
    }

    filteredHistory.forEach((entry, index) => {
      const timestamp = entry.timestamp
        ? new Date(entry.timestamp).toLocaleString()
        : 'Unknown time';

      console.log(`\n[${timestamp}]`);
      console.log(`  Key: ${entry.key || 'Unknown'}`);
      console.log(`  Action: ${entry.action || 'modified'}`);

      if (entry.oldValue !== undefined) {
        console.log(`  Old Value: ${formatValue(entry.oldValue)}`);
      }

      if (entry.newValue !== undefined) {
        console.log(`  New Value: ${formatValue(entry.newValue)}`);
      }

      if (index < filteredHistory.length - 1) {
        console.log(`  ${  '-'.repeat(40)}`);
      }
    });

    console.log(`\nTotal entries shown: ${filteredHistory.length}`);
  } catch (error) {
    console.error(
      `Error viewing configuration history: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

function parseSinceDate(since: string): Date {
  // Check if it's a relative time format (e.g., "1d", "2h", "30m")
  const relativeMatch = since.match(/^(\d+)([dhms])$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const now = new Date();
    const value = parseInt(amount!, 10) || 0;

    switch (unit) {
      case 'd': // days
        now.setDate(now.getDate() - value);
        break;
      case 'h': // hours
        now.setHours(now.getHours() - value);
        break;
      case 'm': // minutes
        now.setMinutes(now.getMinutes() - value);
        break;
      case 's': // seconds
        now.setSeconds(now.getSeconds() - value);
        break;
    }

    return now;
  }

  // Otherwise, try to parse as ISO date
  const date = new Date(since);
  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date format: ${since}. Use ISO format or relative time (e.g., "1d", "2h")`,
    );
  }

  return date;
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
