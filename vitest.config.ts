import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts', 'tools/**/*.test.ts'],
    environment: 'node',
  },
});
