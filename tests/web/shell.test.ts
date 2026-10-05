import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('HTML 提供中文无障碍与 React 入口', () => {
  const html = readFileSync('web/index.html', 'utf8');
  expect(html).toContain('lang="zh-CN"');
  expect(html).toContain('name="viewport"');
  expect(html).toContain('id="root"');
  expect(html).toContain('/src/main.tsx');
});
it('CandyUI 提供组件皮肤，应用样式只负责布局与响应式', () => {
  expect(readFileSync('web/src/main.tsx', 'utf8')).toContain('GameProvider');
  expect(readFileSync('app/globals.css', 'utf8')).toContain('candy-ui/style.css');
  const css = readFileSync('web/src/styles.css', 'utf8');
  expect(css).toMatch(/@media\s*\(max-width:\s*800px\)/);
  expect(css).toContain('prefers-reduced-motion');
  expect(css).not.toMatch(/\.candy-(?:btn|card|input|ribbon)/);
  expect(css).not.toMatch(/\.verdict\.|\.ask-textarea|\.modal-dialog|\.avatar-btn/);
});
