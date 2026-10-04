import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ViteUserConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default {
  resolve: { alias: { '@shared': path.resolve(rootDir, 'shared') } },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    testTimeout: 20000,
    // Windows 沙箱禁止 fork 的命名管道，使用线程执行测试。
    pool: 'threads',
  },
} satisfies ViteUserConfig;
