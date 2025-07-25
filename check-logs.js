#!/usr/bin/env node

import Database from 'better-sqlite3';

const db = new Database('./state/database.db');

try {
  // Check if system_logs table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_logs'").all();
  console.log('Tables found:', tables);
  
  if (tables.length > 0) {
    // Get recent logs
    const logs = db.prepare("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 10").all();
    console.log('\nRecent system logs:');
    console.log(logs);
    
    // Check specifically for error logs
    const errors = db.prepare("SELECT * FROM system_logs WHERE level='error' ORDER BY timestamp DESC LIMIT 5").all();
    console.log('\nRecent error logs:');
    console.log(errors);
  } else {
    console.log('system_logs table does not exist');
  }
} catch (error) {
  console.error('Error querying database:', error);
} finally {
  db.close();
}