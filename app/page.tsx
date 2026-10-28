'use client';

import React, { useEffect, useState } from 'react';
import { useGameRouter } from './gameNavigation';
import { api } from '../web/src/api';
import { notify } from '../web/src/store';
import { getOrCreatePlayerKey } from '../web/src/playerKey';
import { PageContainer } from '../web/src/PageContainer';
import { Home } from '../web/src/LegacyHome';

export default function HomePage() {
  const router = useGameRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(localStorage.getItem('turtle:name') || ''); }, []);
  const saveName = (value: string) => {
    setName(value);
    localStorage.setItem('turtle:name', value);
    window.dispatchEvent(new Event('turtle:profile'));
  };
  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      saveName(name.trim());
      const result = await api.createRoom({ name: name.trim(), playerKey: getOrCreatePlayerKey() });
      router.push(`/room/${result.code}`);
    } catch (error) { notify(error instanceof Error ? error.message : '创建房间失败'); }
    finally { setBusy(false); }
  };
  return <Home name={name} onName={saveName} busy={busy} onCreate={() => void create()}
    onJoin={code => { saveName(name.trim()); router.push(`/room/${code}`); }} onLibrary={() => router.push('/library')} />;
}
