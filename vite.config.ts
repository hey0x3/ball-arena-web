import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { rollupOptions: { output: { manualChunks: (id: string) => id.includes('node_modules/pixi') || id.includes('node_modules/@pixi') ? 'pixi' : id.includes('node_modules/planck') ? 'physics' : undefined } } },
  test: { include: ['tests/**/*.test.ts'] },
});
