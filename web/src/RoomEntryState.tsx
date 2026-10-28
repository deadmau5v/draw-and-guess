'use client';

import React from 'react';
import { CandyButton, CandyGameIcon, CandyPanel, CandySkeleton, CandySpinner } from 'candy-ui';

/** Loading, nickname and join errors share the same full-height room frame. */
export function RoomEntryState({ code, error, needsName = false, onBack }: {
  code: string; error?: string | null; needsName?: boolean; onBack: () => void;
}) {
  const loading = !error && !needsName;
  return <CandyPanel theme="frosted" className="room-entry-panel" aria-busy={loading}>
    <header className="room-entry-heading"><h2>房间 {code}</h2></header>
    <div className="room-entry-body">
      {error ? <p role="alert">{error}</p> : needsName ? <p>填写昵称后即可加入房间。</p> : <>
        <div className="room-entry-status" role="status" aria-live="polite">
          <span aria-hidden="true"><CandySpinner size="md" /></span><span>正在加入房间...</span>
        </div>
        <p>正在同步房间信息，请稍候。</p>
        <div className="room-entry-skeleton" aria-hidden="true"><CandySkeleton lines={4} /></div>
      </>}
    </div>
    <footer className="room-entry-footer">
      <small>{error ? '可以返回首页，重新选择或创建房间。' : '等待期间，你也可以返回首页。'}</small>
      <CandyButton variant="gray" size="md" onClick={onBack} leftIcon={<CandyGameIcon name="house" size={20} />}>返回首页</CandyButton>
    </footer>
  </CandyPanel>;
}
