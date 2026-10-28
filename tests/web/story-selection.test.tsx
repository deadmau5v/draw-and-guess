// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { GameExperience } from '../../web/src/GameExperience';
afterEach(cleanup);
it('全局交互保护允许汤面及高亮文字的原生鼠标选择，其他装饰仍禁选', () => {
  const { container } = render(<GameExperience><p className="shared-story-surface">汤面<mark>线索</mark></p><div className="decoration">装饰</div></GameExperience>);
  for (const target of [container.querySelector('mark')!, container.querySelector('mark')!.firstChild!, container.querySelector('.shared-story-surface')!.firstChild!]) {
    const selection = new Event('selectstart', { bubbles: true, cancelable: true });
    target.dispatchEvent(selection);
    expect(selection.defaultPrevented).toBe(false);
  }
  const decoration = new Event('selectstart', { bubbles: true, cancelable: true });
  container.querySelector('.decoration')!.firstChild!.dispatchEvent(decoration);
  expect(decoration.defaultPrevented).toBe(true);
});
