import { resolve as resolvePath, join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, 'build');

// Path alias mappings
const aliases = {
  '@/': buildDir + '/',
  '@modules/': join(buildDir, 'modules') + '/',
  '@server/': join(buildDir, 'server') + '/',
  '@cli/': join(buildDir, 'cli') + '/',
  '@utils/': join(buildDir, 'utils') + '/',
  '@types/': join(buildDir, 'types') + '/'
};

export async function resolve(specifier, context, nextResolve) {
  // Check if this is one of our aliases
  for (const [alias, path] of Object.entries(aliases)) {
    if (specifier.startsWith(alias)) {
      let resolved = specifier.replace(alias, path);
      // Add .js extension if missing and not already a full filename
      if (!resolved.endsWith('.js') && !resolved.endsWith('.json')) {
        resolved += '.js';
      }
      return nextResolve(resolved, context);
    }
  }
  
  // Handle relative imports that might need .js extension
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    if (!specifier.endsWith('.js') && !specifier.endsWith('.json') && !specifier.endsWith('/')) {
      // Check if it's likely a JS/TS file import
      if (!specifier.includes('.')) {
        return nextResolve(specifier + '.js', context);
      }
    }
  }
  
  // Default resolution
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  return nextLoad(url, context);
}

export async function getFormat(url, context, nextGetFormat) {
  // Handle directory imports by trying to load index.js
  if (url.startsWith('file://') && !url.endsWith('.js') && !url.endsWith('.json') && !url.endsWith('.mjs')) {
    try {
      const indexUrl = url + '/index.js';
      await import.meta.resolve(indexUrl);
      return { format: 'module' };
    } catch {
      // Fall through to default
    }
  }
  return nextGetFormat(url, context);
}