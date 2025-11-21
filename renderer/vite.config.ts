import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, '.'),
  base: './', // Critical: relative paths for Electron file:// protocol
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'), // Explicitly set HTML entry point
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
 
});
