'use client';

import React, { useEffect, useState } from 'react';
import { CandyButton, CandyEmptyState, CandyGameIcon, CandyList, CandyListItem, CandyModal } from 'candy-ui';
import type { RoomLobbySummary } from '@shared/protocol';
import { api } from './api';
import { SectionLoading } from './PageContainer';

export default function RoomLobbyModal({ onClose, onJoin, onCreate }: { onClose: () => void; onJoin: (code: string) => void; onCreate?: () => void }) {
  const [rooms, setRooms] = useState<RoomLobbySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void api.rooms(controller.signal).then(value => { if (!controller.signal.aborted) setRooms(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '房间加载失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  return <CandyModal isOpen onClose={onClose} title="房间大厅" titleStyle="ribbon" ribbonColor="blue">
    <div className="lobby-toolbar"><span>在线房间</span><CandyButton size="sm" variant="blue" loading={loading} disabled={loading} onClick={() => setRefresh(value => value + 1)} leftIcon={<CandyGameIcon name="refresh" size={18} />}>刷新</CandyButton></div>
    <div className="room-lobby-body" aria-busy={loading}>
      {loading ? <SectionLoading label="正在加载房间…" skeleton />
        : error ? <CandyEmptyState title="房间加载失败" description={error} action={<CandyButton size="sm" onClick={() => setRefresh(value => value + 1)}>重试</CandyButton>} />
        : !rooms.length ? <CandyEmptyState title="暂无在线房间" description="创建房间并邀请好友，或输入房间码加入。" icon={<CandyGameIcon name="users" size={40} />} action={onCreate ? <CandyButton size="sm" variant="blue" leftIcon={<CandyGameIcon name="plus" size={16} />} onClick={onCreate}>创建房间</CandyButton> : undefined} />
        : <CandyList>{rooms.map(room => <CandyListItem key={room.code} title={`${room.hostName} · ${room.code}`} description={`${room.players}/${room.maxPlayers} 人 · ${room.phase === 'lobby' ? '等待开始' : '游戏中'}`} trailing={<CandyButton size="sm" variant="yellow" onClick={() => onJoin(room.code)}>加入</CandyButton>} />)}</CandyList>}
    </div>
  </CandyModal>;
}
