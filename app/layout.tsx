import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from '../web/src/theme';
import { NavHeader } from './NavHeader';
import { GameNotifications } from './GameNotifications';

export const metadata: Metadata = {
  title: '海龟汤 - 多人推理游戏',
  description: '多人联机海龟汤情境推理游戏',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <GameProvider>
          <div className="app-container">
            <NavHeader />
            <div id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
              {children}
            </div>
            <GameNotifications />
          </div>
        </GameProvider>
      </body>
    </html>
  );
}
