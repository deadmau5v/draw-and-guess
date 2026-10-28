import React from 'react';
import { LibraryBrowser } from './LibraryBrowser';

export function Library({ onChoose, busy = false }: { onChoose: (id: string) => void; busy?: boolean }) {
  return <LibraryBrowser onChoose={onChoose} onBack={() => { location.hash = '/'; }} busy={busy} />;
}
