'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CandyButton, CandyEmptyState, CandyGameIcon, CandyList, CandyListItem, CandyModal, CandyPagination } from 'candy-ui';
import type { RoomLobbySummary } from '@shared/protocol';
import { api } from './api';
import { SectionLoading } from './PageContainer';

/** Loading stays inside this dialog. Closing it cancels the in-flight request. */
export default function RoomLobbyModal({ onClose, onJoin, onCreate }: { onClose: () => void; onJoin: (code: string) => void; onCreate?: () => void }) {
  const [rooms, setRooms] = useState<RoomLobbySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const version = ++request.current;
    const controller = new AbortController();
    setLoading(true); setError('');
    void api.rooms(controller.signal).then(value => {
      if (!controller.signal.aborted && version === request.current) { setRooms(value); setPage(1); }
    }).catch(reason => {
      if (!controller.signal.aborted && version === request.current) setError(reason instanceof Error ? reason.message : '房间加载失败');
    }).finally(() => {
      if (!controller.signal.aborted && version === request.current) setLoading(false);
    });
    return () => controller.abort();
  }, [refresh]);
  return <CandyModal isOpen onClose={onClose} title="房间大厅" titleStyle="ribbon" ribbonColor="blue">
    <div className="lobby-toolbar"><span>选择一个在线房间，加入推理</span><CandyButton size="sm" variant="blue" loading={loading} disabled={loading} onClick={() => setRefresh(value => value + 1)} leftIcon={<CandyGameIcon name="refresh" size={18} />}>刷新</CandyButton></div>
    <div className="room-lobby-body" aria-busy={loading}>
      {loading ? <SectionLoading label="正在寻找房间…" skeleton />
        : error ? <CandyEmptyState title="房间加载失败" description={error} action={<CandyButton size="sm" onClick={() => setRefresh(value => value + 1)}>重试</CandyButton>} />
        : !rooms.length ? <CandyEmptyState title="暂时没有可加入的房间" description="可以创建房间邀请好友，或输入好友的房间号加入。" icon={<CandyGameIcon name="users" size={40} />} action={onCreate ? <CandyButton size="sm" variant="blue" leftIcon={<CandyGameIcon name="plus" size={16} />} onClick={onCreate}>立即创建房间</CandyButton> : undefined} />
        : <><CandyList>{rooms.slice((page - 1) * 6, page * 6).map(room => <CandyListItem key={room.code} title={`${room.hostName}的房间 · ${room.code}`} description={`${room.players}/${room.maxPlayers} 人 · ${room.phase === 'lobby' ? '等待开局' : '推理中'}`} trailing={<CandyButton size="sm" variant="yellow" aria-label={`加入房间 ${room.code}`} onClick={() => onJoin(room.code)}>加入</CandyButton>} />)}</CandyList>
          {rooms.length > 6 && <div className="avatar-pagination"><CandyPagination page={page} totalPages={Math.ceil(rooms.length / 6)} onPageChange={setPage} size="sm" /></div>}
        </>}
    </div>
  </CandyModal>;
}
