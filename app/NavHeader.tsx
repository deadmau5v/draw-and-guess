'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useGameRouter } from './gameNavigation';
import { GameHeader } from '../web/src/GameHeader';

export function NavHeader() {
  const pathname = usePathname();
  const router = useGameRouter();
  return <GameHeader pathname={pathname} onNavigate={router.push} />;
}
