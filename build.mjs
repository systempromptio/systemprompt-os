#!/usr/bin/env node
/**
 * Build script using esbuild for fast, reliable builds
 */

import * as esbuild from 'esbuild';
import { glob } from 'glob';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('Building SystemPrompt OS...');
  
  // Find all TypeScript entry points
  const entryPoints = await glob('src/**/*.ts', {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/*.d.ts']
  });

  // Build with esbuild
  await esbuild.build({
    entryPoints,
    outdir: 'build',
    format: 'esm',
    platform: 'node',
    target: 'node18',
    bundle: false,
    sourcemap: true,
    outExtension: { '.js': '.js' },
    loader: {
      '.ts': 'ts',
      '.json': 'json'
    },
    // Handle path aliases
    alias: {
      '@': path.join(__dirname, 'src'),
      '@cli': path.join(__dirname, 'src/cli'),
      '@server': path.join(__dirname, 'src/server'),
      '@modules': path.join(__dirname, 'src/modules'),
      '@tools': path.join(__dirname, 'src/tools'),
      '@services': path.join(__dirname, 'src/services'),
      '@types': path.join(__dirname, 'src/types'),
      '@utils': path.join(__dirname, 'src/utils')
    }
  });

  // Copy non-TS files
  const nonTsFiles = await glob('src/**/*.{json,yaml,yml,sql}');
  for (const file of nonTsFiles) {
    const dest = file.replace('src/', 'build/');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(file, dest);
  }

  // Copy scripts
  await fs.cp('scripts', 'build/scripts', { recursive: true }).catch(() => {});
  
  // Make index.js executable
  await fs.chmod('build/index.js', 0o755).catch(() => {});
  
  console.log('Build complete!');
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});