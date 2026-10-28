import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { CandyGameIcon } from 'candy-ui';
import { LIBRARY_CATEGORIES } from '../../web/src/library';

const files = [
  'app/NavHeader.tsx', 'app/page.tsx', 'app/library/page.tsx', 'app/room/[code]/page.tsx',
  'web/src/App.tsx', 'web/src/components.tsx', 'web/src/icons/GameIcons.tsx', 'web/src/WaitingRoom.tsx', 'web/src/PlayingRoom.tsx',
  'web/src/GameExperience.tsx', 'web/src/LibraryBrowser.tsx',
  'web/src/GameHeader.tsx', 'web/src/HeaderDialogs.tsx', 'web/src/PageContainer.tsx',
  'web/src/LegacyHome.tsx', 'web/src/LegacyRoom.tsx', 'web/src/RoomLobbyModal.tsx',
  'web/src/RoomEntryState.tsx', 'web/src/SharedStory.tsx', 'web/src/TurnCountdown.tsx', 'web/src/HintNotice.tsx', 'web/src/Leaderboard.tsx',
  'web/src/DrawingCanvas.tsx', 'web/src/PartyModeDeck.tsx',
];
it('所有页面与共享控件使用 CandyUI，不再拼装原生控件或 PNG 操作图标', () => {
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    expect(source, path).not.toMatch(/<(?:button|input|textarea|select|svg)\b/);
    expect(source, path).not.toMatch(/(?:\/assets\/icons\/|lucide-react|candy-btn|modal-dialog|ask-textarea)/);
    expect(source, path).not.toMatch(/\bprompt\s*\(/);
    // Route adapters reuse audited CandyUI components rather than importing unused controls.
    expect(source, path).toMatch(/candy-ui|PageContainer|GameHeader/);
  }
});
it('图标名称对应 CandyUI 真实图形，而非缺失名称的 controller 回退', () => {
  const names = new Set<string>(LIBRARY_CATEGORIES.map(item => item.icon));
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    // Input/radio names are not icon names; only inspect actual icon components/helpers.
    for (const match of source.matchAll(/<CandyGameIcon\b[^>]*\bname="([a-z0-9-]+)"|\bicon\('([a-z0-9-]+)'\)/g)) names.add(match[1] || match[2]);
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
