#!/usr/bin/env node

import Database from 'better-sqlite3';

const db = new Database('./state/database.db');

try {
  // Check if cli_commands table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cli_commands'").all();
  console.log('CLI Commands table found:', tables);
  
  if (tables.length > 0) {
    // Get all CLI commands
    const commands = db.prepare("SELECT * FROM cli_commands").all();
    console.log('\nAll CLI commands:');
    console.log(commands);
    
    // Check specifically for active commands
    const activeCommands = db.prepare("SELECT * FROM cli_commands WHERE active=1").all();
    console.log('\nActive CLI commands:');
    console.log(activeCommands);
  } else {
    console.log('cli_commands table does not exist');
    
    // Show all tables
    const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('\nAll tables in database:');
    console.log(allTables);
  }
} catch (error) {
  console.error('Error querying database:', error);
} finally {
  db.close();
}