'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCandy, CandyAvatar, CandyButton, CandyIconButton, CandyModal,
  CandyGameIcon, CandyEmptyState, CandyList, CandyListItem, CandyBadge,
} from 'candy-ui';
import { notify } from '../web/src/store';

export function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { soundEnabled, setSoundEnabled } = useCandy();
  const [name, setName] = useState('推理小海龟');
  const [avatarSrc, setAvatarSrc] = useState('/assets/user-smile.png');
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    const syncProfile = () => {
      try {
        setName(localStorage.getItem('turtle:name') || '推理小海龟');
        const saved = localStorage.getItem('turtle:avatar');
        setAvatarSrc(saved?.startsWith('/assets/') ? saved : saved ? `/assets/avatars/player-${saved}.png` : '/assets/user-smile.png');
      } catch {}
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
    <header className="game-top-header">
      <div className="game-header-inner">
        <nav className="header-nav-group" aria-label="主导航">
          <CandyButton variant={pathname === '/' ? 'yellow' : 'cream'} size="sm" shape="pill" aria-current={pathname === '/' ? 'page' : undefined} leftIcon={<CandyGameIcon name="house" size={22} />} onClick={() => router.push('/')}>首页</CandyButton>
          <CandyButton variant={pathname === '/library' ? 'yellow' : 'cream'} size="sm" shape="pill" aria-current={pathname === '/library' ? 'page' : undefined} leftIcon={<CandyGameIcon name="book" size={22} />} onClick={() => router.push('/library')}>题库</CandyButton>
          <CandyButton variant="cream" size="sm" shape="pill" leftIcon={<CandyGameIcon name="trophy" size={22} />} onClick={() => setLeaderboardOpen(true)}>排行榜</CandyButton>
          <CandyButton variant="cream" size="sm" shape="pill" leftIcon={<CandyGameIcon name="book" size={22} />} onClick={() => setGuideOpen(true)}>新手指南</CandyButton>
        </nav>
        <div className="header-center-logo"><img src="/assets/banner-logo.png" alt="海龟汤推理局" className="header-banner-img" /></div>
        <div className="header-right-group">
          <CandyIconButton variant="yellow" size="sm" shape="circle" aria-label="系统通知" icon={<CandyGameIcon name="notification" size={22} />} onClick={() => notify('欢迎来到海龟汤推理局！邀请好友一起推理吧。')} />
          <CandyButton className="header-profile" variant="cream" size="md" shape="pill" onClick={() => setLeaderboardOpen(true)} leftIcon={<CandyAvatar src={avatarSrc} size="sm" />} rightIcon={<CandyGameIcon name="arrow-down" size={16} />}><span className="header-profile-name">{name}</span></CandyButton>
          <CandyIconButton variant="cream" size="sm" shape="circle" aria-label={soundEnabled ? '关闭音效' : '开启音效'} aria-pressed={soundEnabled} icon={<CandyGameIcon name={soundEnabled ? 'volume' : 'cross'} size={22} />} onClick={() => setSoundEnabled(!soundEnabled)} />
        </div>
      </div>
    </header>
    {leaderboardOpen && <CandyModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} title="推理排行榜" titleStyle="ribbon" ribbonColor="gold">
      <CandyEmptyState title="排行榜暂未开放" description="战绩榜单接入后将在这里展示，当前不展示模拟排名。" icon={<CandyGameIcon name="trophy" size={40} />} />
    </CandyModal>}
    {guideOpen && <CandyModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} title="海龟汤新手指南" titleStyle="ribbon" ribbonColor="blue">
      <p>海龟汤是一种情境推理游戏。阅读反常的故事片段，通过是非提问寻找线索，最终还原完整真相。</p>
      <CandyList>
        <CandyListItem leading={<CandyBadge variant="blue">1</CandyBadge>} title="阅读汤面" description="先观察故事中反常的人物、地点和事件。" />
        <CandyListItem leading={<CandyBadge variant="blue">2</CandyBadge>} title="提出是非问题" description="AI 会回答是、不是、不相关或不确定。" />
        <CandyListItem leading={<CandyBadge variant="blue">3</CandyBadge>} title="还原真相" description="默认每人 8 次提问，结合线索提交完整故事。" />
      </CandyList>
    </CandyModal>}
  </>;
}
