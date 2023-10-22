import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 60000, // 60 seconds in milliseconds
  },
});
