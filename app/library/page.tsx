'use client';

import React, { useState } from 'react';
import { useGameRouter } from '../gameNavigation';
import { api } from '../../web/src/api';
import { notify } from '../../web/src/store';
import { getOrCreatePlayerKey } from '../../web/src/playerKey';
import { CandyButton, CandyInput, CandyModal } from 'candy-ui';
import { usePageLoading } from '../../web/src/loading';
import { LibraryBrowser } from '../../web/src/LibraryBrowser';

export default function LibraryPage() {
  const router = useGameRouter();
  const [pendingPuzzle, setPendingPuzzle] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  usePageLoading(busy, '正在创建房间…');
  const create = async (puzzleId: string, playerName: string) => {
    if (busy || !playerName.trim()) return;
    setBusy(true);
    try {
      localStorage.setItem('turtle:name', playerName.trim());
      const playerKey = getOrCreatePlayerKey();
      const res = await api.createRoom({ name: playerName.trim(), playerKey });
      router.push(`/room/${res.code}?start=${encodeURIComponent(puzzleId)}`);
    } catch (err) { notify(err instanceof Error ? err.message : '开房失败'); }
    finally { setBusy(false); }
  };
  const onChoose = (id: string) => {
    const saved = localStorage.getItem('turtle:name') || '';
    if (saved.trim()) void create(id, saved);
    else setPendingPuzzle(id);
  };
  return <>
    <LibraryBrowser onChoose={onChoose} onBack={() => router.push('/')} busy={busy} />
    {pendingPuzzle !== null && <CandyModal isOpen onClose={() => setPendingPuzzle(null)} title="填写侦探昵称">
      <CandyInput aria-label="侦探昵称" placeholder="请输入昵称" maxLength={16} value={name} onChange={e => setName(e.target.value)} />
      <div className="actions-row"><CandyButton variant="yellow" disabled={!name.trim()} loading={busy} onClick={() => { if (pendingPuzzle) void create(pendingPuzzle, name); }}>开始挑战</CandyButton></div>
    </CandyModal>}
  </>;
}
