import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from '../web/src/theme';
import { AppShell } from '../web/src/PageContainer';
import { NavHeader } from './NavHeader';
import { GameNotifications } from './GameNotifications';
import { GameRouteTransition } from './gameNavigation';

export const metadata: Metadata = {
  title: '你画我猜派对 · 多模态 JEV 联机速写与10大派对玩法',
  description: '支持压感画板、JEV多模态视觉鉴画、Drawful妙笔生谎、猜拆画画内鬼、妙笔神猜、MonsDRAWsity怪兽目击与传声筒5大变体的多人联机派对游戏',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" suppressHydrationWarning>
    <head>
      <link rel="preconnect" href="https://rw-img.denox.cc" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://rw-img.denox.cc" />
    </head>
    <body suppressHydrationWarning>
      <GameProvider>
        <GameRouteTransition />
        <AppShell header={<NavHeader />} notifications={<GameNotifications />}>{children}</AppShell>
      </GameProvider>
    </body>
  </html>;
}
