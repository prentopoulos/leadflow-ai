import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const localApiProxy = {
  target: 'http://127.0.0.1:3001',
  changeOrigin: false,
} as const;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: import.meta.dirname,
  preview: {
    host: '127.0.0.1',
    proxy: { '/v1': localApiProxy },
  },
  server: {
    host: '127.0.0.1',
    proxy: { '/v1': localApiProxy },
  },
});
