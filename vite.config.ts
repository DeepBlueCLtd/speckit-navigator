import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/debrief-future/spec-navigator/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
