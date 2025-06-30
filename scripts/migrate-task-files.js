#!/usr/bin/env node

/**
 * Migration script to clean up task files and enforce new naming convention
 * - Removes duplicate tasks with same description
 * - Renames files to use UUID only (no task_ prefix)
 * - Fixes task IDs in JSON to match filename
 */

import fs from 'fs/promises';
import path from 'path';

const STATE_PATH = process.env.STATE_PATH || '/data/state';
const TASKS_DIR = path.join(STATE_PATH, 'tasks');

async function migrateTaskFiles() {
  console.log('🔧 Starting task file migration...\n');
  
  try {
    // Get all task files
    const files = await fs.readdir(TASKS_DIR);
    const taskFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${taskFiles.length} task files to process\n`);
    
    // Track tasks by description to find duplicates
    const tasksByDescription = new Map();
    const tasksToDelete = [];
    const tasksToRename = [];
    
    // Read all tasks and categorize them
    for (const file of taskFiles) {
      const filePath = path.join(TASKS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      try {
        const task = JSON.parse(content);
        const description = task.description;
        
        // Extract UUID from filename or task ID
        let uuid = null;
        
        // Try to extract from filename first
        const fileMatch = file.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
        if (fileMatch) {
          uuid = fileMatch[1];
        }
        
        // If not in filename, try task ID
        if (!uuid && task.id) {
          const idMatch = task.id.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
          if (idMatch) {
            uuid = idMatch[1];
          }
        }
        
        if (!uuid) {
          console.log(`❌ Could not extract UUID from ${file}`);
          continue;
        }
        
        // Check for duplicates
        if (tasksByDescription.has(description)) {
          const existing = tasksByDescription.get(description);
          
          // Keep the newer task
          const existingDate = new Date(existing.task.created_at);
          const currentDate = new Date(task.created_at);
          
          if (currentDate > existingDate) {
            // Current is newer, delete the old one
            tasksToDelete.push(existing.file);
            tasksByDescription.set(description, { file, task, uuid });
          } else {
            // Existing is newer, delete current
            tasksToDelete.push(file);
          }
        } else {
          tasksByDescription.set(description, { file, task, uuid });
        }
        
      } catch (error) {
        console.log(`❌ Failed to parse ${file}: ${error.message}`);
      }
    }
    
    // Process remaining tasks for renaming
    for (const [description, data] of tasksByDescription) {
      const { file, task, uuid } = data;
      const newFilename = `${uuid}.json`;
      
      if (file !== newFilename) {
        tasksToRename.push({ 
          oldFile: file, 
          newFile: newFilename, 
          task, 
          uuid 
        });
      }
    }
    
    console.log(`\n📊 Migration Plan:`);
    console.log(`   - Tasks to delete (duplicates): ${tasksToDelete.length}`);
    console.log(`   - Tasks to rename: ${tasksToRename.length}`);
    console.log(`   - Unique tasks remaining: ${tasksByDescription.size}\n`);
    
    // Delete duplicates
    for (const file of tasksToDelete) {
      const filePath = path.join(TASKS_DIR, file);
      await fs.unlink(filePath);
      console.log(`🗑️  Deleted duplicate: ${file}`);
    }
    
    // Rename and fix task files
    for (const { oldFile, newFile, task, uuid } of tasksToRename) {
      const oldPath = path.join(TASKS_DIR, oldFile);
      const newPath = path.join(TASKS_DIR, newFile);
      
      // Update task ID to be just the UUID
      task.id = uuid;
      
      // Write updated task
      await fs.writeFile(newPath, JSON.stringify(task, null, 2));
      
      // Delete old file if different
      if (oldFile !== newFile) {
        await fs.unlink(oldPath);
        console.log(`✅ Renamed: ${oldFile} → ${newFile}`);
      } else {
        console.log(`✅ Updated: ${newFile}`);
      }
    }
    
    console.log('\n✨ Migration complete!');
    
    // Final count
    const finalFiles = await fs.readdir(TASKS_DIR);
    const finalTaskFiles = finalFiles.filter(f => f.endsWith('.json'));
    console.log(`\n📈 Final state: ${finalTaskFiles.length} unique tasks`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateTaskFiles();
}