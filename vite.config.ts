import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { apiMockPlugin } from './src/lib/api-mock-plugin.ts';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiMockPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
