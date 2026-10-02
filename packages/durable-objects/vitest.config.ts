import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

declare const process: {
  cwd(): string;
};

const sqlStorageEntry = `${process.cwd()}/../sql-storage/src/index.ts`;
const sqlStorageTestEntry = `${process.cwd()}/../sql-storage/src/test/index.ts`;

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.test.jsonc' } })],
  resolve: {
    alias: {
      '@cashu/coco-sql-storage/test': sqlStorageTestEntry,
      '@cashu/coco-sql-storage': sqlStorageEntry,
    },
  },
  test: {
    include: ['src/test/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
});
