import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build --mode demo` swaps the real API client for an in-browser mock (no server needed).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'demo' ? './' : '/',
  resolve: {
    alias: mode === 'demo' ? [{ find: /^(\.\.?\/)+api\.js$/, replacement: fileURLToPath(new URL('./src/demo/mockApi.js', import.meta.url)) }] : [],
  },
  build: mode === 'demo' ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 } : {},
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
}));
