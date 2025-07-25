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
  
  // Default resolution
  return nextResolve(specifier, context);
}