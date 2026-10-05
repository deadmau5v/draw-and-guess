'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { CandyProvider } from 'candy-ui';

export function GameProvider({ children }: { children: ReactNode }) {
  return (
    <CandyProvider defaultSoundEnabled={true} defaultVolume={0.4}>
      {children}
    </CandyProvider>
  );
}
