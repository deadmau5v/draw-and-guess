import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('HTML 提供中文无障碍与 React 入口', () => {
  const html = readFileSync('web/index.html', 'utf8');
  expect(html).toContain('lang="zh-CN"');
  expect(html).toContain('name="viewport"');
  expect(html).toContain('id="root"');
  expect(html).toContain('/src/main.tsx');
});
it('主题使用冷色薄荷强调和真实 Mantine 入口，在 900px 以下单列', () => {
  const main = readFileSync('web/src/main.tsx', 'utf8');
  expect(main).toContain('GameProvider');
  const css = readFileSync('web/src/styles.css', 'utf8');
  expect(css).toContain('#5eead4');
  expect(css).not.toContain('soup-art');
  expect(css).not.toContain('gradient');
  expect(css).toMatch(/@media\s*\(max-width:\s*899px\)/);
  expect(css).toContain('prefers-reduced-motion');
  expect(css).toContain('.verdict.darkred');
});
