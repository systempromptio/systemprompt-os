import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testAuthImport() {
  try {
    const authPath = join(__dirname, 'src/modules/core/auth/index.ts');
    const moduleUrl = pathToFileURL(authPath).href;
    console.log('Attempting to import:', moduleUrl);
    
    const module = await import(moduleUrl);
    console.log('Import successful');
    console.log('Exports:', Object.keys(module));
    
    if (module.createModule) {
      console.log('Creating module instance...');
      const instance = module.createModule();
      console.log('Module instance created:', instance.name);
    }
  } catch (error) {
    console.error('Import failed:');
    console.error('Error name:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testAuthImport();