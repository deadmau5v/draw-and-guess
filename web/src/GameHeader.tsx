'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useCandy, CandyAvatar, CandyButton, CandyGameIcon, CandyIconButton, CandySpinner } from 'candy-ui';
import { notify } from './store';
import { readPlayerAvatar } from './avatars';
import { cdnUrl } from './cdn';

const HeaderDialogs = lazy(() => import('./HeaderDialogs'));

/** Shared header for Next.js and the compatibility SPA; routing is injected. */
export function GameHeader({ pathname, onNavigate, name: providedName }: {
  pathname: string; onNavigate: (href: string) => void; name?: string;
}) {
  const { soundEnabled, setSoundEnabled } = useCandy();
  const [name, setName] = useState('推理小海龟');
  const [avatarSrc, setAvatarSrc] = useState('/assets/avatars/player-panda.png');
  const [dialog, setDialog] = useState<'leaderboard' | 'guide' | null>(null);
  useEffect(() => {
    const syncProfile = () => {
      try { setName(localStorage.getItem('turtle:name') || '推理小海龟'); setAvatarSrc(readPlayerAvatar()); } catch {}
    };
    syncProfile();
    window.addEventListener('turtle:profile', syncProfile);
    window.addEventListener('storage', syncProfile);
    return () => {
      window.removeEventListener('turtle:profile', syncProfile);
      window.removeEventListener('storage', syncProfile);
    };
  }, []);
  return <>
    <header className="game-top-header" style={{ '--candy-text': '#ffffff', '--candy-surface-alt': 'transparent', '--candy-track': 'transparent' } as React.CSSProperties}>
      <div className="game-header-inner">
        <nav className="header-nav-group" aria-label="主导航">
          <CandyButton variant="ghost" size="sm" aria-current={pathname === '/' ? 'page' : undefined} leftIcon={<CandyGameIcon name="house" size={24} />} onClick={() => onNavigate('/')}><span className={pathname === '/' ? 'nav-active-label' : undefined}>首页</span></CandyButton>
          <CandyButton variant="ghost" size="sm" aria-current={pathname === '/library' ? 'page' : undefined} leftIcon={<CandyGameIcon name="book" size={24} />} onClick={() => onNavigate('/library')}><span className={pathname === '/library' ? 'nav-active-label' : undefined}>题库</span></CandyButton>
          <CandyButton variant="ghost" size="sm" leftIcon={<CandyGameIcon name="trophy" size={24} />} onClick={() => setDialog('leaderboard')}>排行榜</CandyButton>
          <CandyButton variant="ghost" size="sm" leftIcon={<CandyGameIcon name="compass" size={24} />} onClick={() => setDialog('guide')}>新手指南</CandyButton>
        </nav>
        <div className="header-center-logo"><img src={cdnUrl('/assets/banner-logo.png')} alt="海龟汤推理局" className="header-banner-img" width={1298} height={432} /></div>
        <div className="header-right-group">
          <CandyIconButton variant="ghost" size="sm" shape="circle" aria-label="系统通知" icon={<CandyGameIcon name="notification" size={24} />} onClick={() => notify('欢迎来到海龟汤推理局！邀请好友一起推理吧。')} />
          <div className="header-profile" aria-label="当前玩家"><CandyAvatar src={cdnUrl(avatarSrc)} size="sm" alt="我的头像" /><span className="header-profile-name">{providedName || name}</span></div>
          <CandyIconButton variant="ghost" size="sm" shape="circle" aria-label={soundEnabled ? '关闭音效' : '开启音效'} aria-pressed={soundEnabled} icon={<CandyGameIcon name={soundEnabled ? 'volume' : 'cross'} size={24} />} onClick={() => setSoundEnabled(!soundEnabled)} />
        </div>
      </div>
    </header>
    {dialog && <Suspense fallback={<div className="header-dialog-loading" role="status" aria-label="正在加载菜单"><CandySpinner size="sm" /></div>}>
      <HeaderDialogs kind={dialog} onClose={() => setDialog(null)} />
    </Suspense>}
  </>;
}
