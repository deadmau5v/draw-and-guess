import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from '../web/src/theme';
import { AppShell } from '../web/src/PageContainer';
import { NavHeader } from './NavHeader';
import { GameNotifications } from './GameNotifications';
import { GameRouteTransition } from './gameNavigation';

export const metadata: Metadata = {
  title: '你画我猜 · 好友联机画画猜词',
  description: '创建或加入房间，轮流画画、看画猜词，回合结束结算得分。',
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
