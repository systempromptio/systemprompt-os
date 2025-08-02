import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: __dirname,
  base: '/',
  build: {
    outDir: resolve(__dirname, '../../../dist/server/frontend'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5173,
    cors: true,
    hmr: {
      port: 5173
    }
  },
  resolve: {
    alias: {
      '@frontend': __dirname,
      '@core': resolve(__dirname, 'core'),
      '@components': resolve(__dirname, 'components'),
      '@pages': resolve(__dirname, 'pages'),
      '@themes': resolve(__dirname, 'themes')
    }
  }
});