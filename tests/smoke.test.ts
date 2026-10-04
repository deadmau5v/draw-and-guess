import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const root = new URL('../', import.meta.url);

test('标准构建使用原生配置加载并包含类型检查', () => {
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  expect(pkg.scripts.build).toBe('vite build --configLoader native && tsc -p tsconfig.json --noEmit');
});

test('Vitest 可以运行', () => {
  expect(1).toBe(1);
});

test('脚手架提供严格 TypeScript 配置', () => {
  const configPath = fileURLToPath(new URL('tsconfig.json', root));
  expect(existsSync(configPath)).toBe(true);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  expect(config.compilerOptions).toMatchObject({
    target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
    strict: true, jsx: 'react-jsx', skipLibCheck: true, noEmit: true,
    types: ['node', 'vite/client'], paths: { '@shared/*': ['shared/*'] },
  });
  expect(config.include).toEqual(['server', 'shared', 'scripts', 'tests', 'web/src', '*.ts']);
});
