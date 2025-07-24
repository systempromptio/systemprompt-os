#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { dirname, join } from 'path';

async function fixImports() {
  // Find all TypeScript files
  const files = await glob('src/**/*.ts', { cwd: process.cwd() });
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    
    // Fix imports that use @/ alias and don't already have .js extension
    const fixed = content.replace(
      /from\s+['"](@\/[^'"]+)(?<!\.js)['"]/g,
      "from '$1.js'"
    );
    
    if (fixed !== content) {
      writeFileSync(file, fixed);
      console.log(`Fixed imports in ${file}`);
    }
  }
}

fixImports().catch(console.error);