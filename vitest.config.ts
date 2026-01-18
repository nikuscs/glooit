import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.cursor', '.roo', '.glooit'],
    coverage: {
      provider: 'istanbul',
      enabled: true,
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'src/cli/index.ts'
      ],
      thresholds: {
        statements: 99,
        lines: 99,
        functions: 100,
        branches: 80
      }
    }
  }
});
