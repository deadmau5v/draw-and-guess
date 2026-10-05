import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { CandyGameIcon } from 'candy-ui';

const files = [
  'app/NavHeader.tsx', 'app/page.tsx', 'app/library/page.tsx', 'app/room/[code]/page.tsx',
  'web/src/App.tsx', 'web/src/components.tsx', 'web/src/icons/GameIcons.tsx',
];
it('所有页面与共享控件使用 CandyUI，不再拼装原生控件或 PNG 操作图标', () => {
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    expect(source, path).not.toMatch(/<(?:button|input|textarea|select|svg)\b/);
    expect(source, path).not.toMatch(/(?:\/assets\/icons\/|lucide-react|candy-btn|modal-dialog|ask-textarea)/);
    expect(source, path).not.toMatch(/\bprompt\s*\(/);
    expect(source, path).toContain('candy-ui');
  }
});
it('图标名称对应 CandyUI 真实图形，而非缺失名称的 controller 回退', () => {
  const names = new Set<string>();
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/name="([a-z0-9-]+)"|\bicon\('([a-z0-9-]+)'\)/g)) names.add(match[1] || match[2]);
  }
  // Dynamic sound toggles are explicit to prevent the library's unsupported mute alias regression.
  names.add('volume'); names.add('cross');
  const body = (name: string) => renderToStaticMarkup(React.createElement(CandyGameIcon, { name })).match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1];
  const fallback = body('controller');
  for (const name of names) {
    expect(body(name), name).toBeTruthy();
    if (name !== 'controller' && name !== 'gamepad') expect(body(name), `unsupported icon: ${name}`).not.toBe(fallback);
  }
});
