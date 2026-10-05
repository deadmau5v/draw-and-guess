'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCandy,
  CandyAvatar,
  CandyBadge,
  CandyButton,
  CandyIconButton,
  CandyModal,
  candySound,
} from 'candy-ui';
import { notify } from '../web/src/store';

export function NavHeader() {
  const pathname = usePathname();
  const { soundEnabled, setSoundEnabled } = useCandy();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('推理小海龟');
  const [avatarSrc, setAvatarSrc] = useState('/assets/user-smile.png');
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedName = localStorage.getItem('turtle:name');
      if (savedName) setName(savedName);
      const savedAvatar = localStorage.getItem('turtle:avatar');
      if (savedAvatar && (savedAvatar.startsWith('/') || savedAvatar.startsWith('http'))) {
        setAvatarSrc(savedAvatar);
      }
    } catch {}
  }, []);

  const handleBellClick = () => {
    candySound.play('pop');
    notify('欢迎来到海龟汤推理局！当前精选 105 道原汁原味开源推理谜题，快来挑战吧！');
  };

  const handleGuideClick = () => {
    candySound.play('pop');
    setGuideOpen(true);
  };

  const handleLeaderboardClick = () => {
    candySound.play('pop');
    setLeaderboardOpen(true);
  };

  return (
    <>
      <header className="game-top-header">
        <div className="game-header-inner">
          {/* 左侧导航标签：使用 CandyButton，禁止用 Emoji 作为图标 */}
          <nav className="header-nav-group" aria-label="主导航">
            <Link href="/" style={{ textDecoration: 'none' }}>
              <CandyButton
                variant={pathname === '/' ? 'yellow' : 'ghost'}
                size="sm"
                shape="pill"
                appearance={pathname === '/' ? 'solid' : 'soft'}
                leftIcon={
                  <img
                    src="/assets/icons/nav-home.png"
                    alt=""
                    style={{ width: '18px', height: '18px', display: 'block' }}
                  />
                }
              >
                首页
              </CandyButton>
            </Link>

            <Link href="/library" style={{ textDecoration: 'none' }}>
              <CandyButton
                variant={pathname === '/library' ? 'yellow' : 'ghost'}
                size="sm"
                shape="pill"
                appearance={pathname === '/library' ? 'solid' : 'soft'}
                leftIcon={
                  <img
                    src="/assets/icons/nav-library.png"
                    alt=""
                    style={{ width: '18px', height: '18px', display: 'block' }}
                  />
                }
              >
                题库
              </CandyButton>
            </Link>

            <CandyButton
              variant="ghost"
              size="sm"
              shape="pill"
              appearance="soft"
              onClick={handleLeaderboardClick}
              leftIcon={
                <img
                  src="/assets/icons/nav-rank.png"
                  alt=""
                  style={{ width: '18px', height: '18px', display: 'block' }}
                />
              }
            >
              排行榜
            </CandyButton>

            <CandyButton
              variant="ghost"
              size="sm"
              shape="pill"
              appearance="soft"
              onClick={handleGuideClick}
              leftIcon={
                <img
                  src="/assets/icons/nav-guide.png"
                  alt=""
                  style={{ width: '18px', height: '18px', display: 'block' }}
                />
              }
            >
              新手指南
            </CandyButton>
          </nav>

          {/* 中间 LOGO 区域：使用素材库完整标题横幅 */}
          <Link href="/" className="header-center-logo">
            <img
              src="/assets/banner-logo.png"
              alt="海龟汤推理局"
              className="header-banner-img"
            />
          </Link>

          {/* 右侧通知、个人胶囊、音效 */}
          <div className="header-right-group">
            <CandyIconButton
              variant="ghost"
              size="md"
              shape="circle"
              onClick={handleBellClick}
              title="系统通知"
              aria-label="系统通知"
              icon={
                <img
                  src="/assets/icons/bell-button.png"
                  alt="通知"
                  style={{ width: '38px', height: '38px', display: 'block' }}
                />
              }
            />

            <div
              className="header-user-pill"
              onClick={handleLeaderboardClick}
              title="查看个人推理战绩"
            >
              <div className="user-pill-avatar">
                {mounted ? (
                  <CandyAvatar src={avatarSrc} size="xs" />
                ) : (
                  <img src="/assets/user-smile.png" alt="" style={{ width: '28px', height: '28px' }} />
                )}
              </div>
              <span className="user-pill-name">{mounted ? name : '推理小海龟'}</span>
              <CandyBadge variant="yellow" size="sm">Lv.12</CandyBadge>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>▼</span>
            </div>

            <CandyButton
              variant="ghost"
              size="xs"
              shape="pill"
              appearance="outline"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? '音效已开启' : '音效已静音'}
              style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.4)' }}
            >
              {soundEnabled ? '声音' : '静音'}
            </CandyButton>
          </div>
        </div>
      </header>

      {/* 排行榜弹窗 - 使用 CandyModal 组件 */}
      {mounted && leaderboardOpen && (
        <CandyModal
          isOpen={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
          title="推理排行榜"
          titleStyle="ribbon"
          ribbonColor="gold"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#fef9c3', border: '2px solid #fef08a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CandyBadge variant="yellow" size="sm">1</CandyBadge>
                <span style={{ fontWeight: 800 }}>逻辑鬼才 · 福尔摩汤</span>
              </div>
              <CandyBadge variant="yellow" size="md">128 汤破解</CandyBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#f1f5f9', border: '2px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CandyBadge variant="gray" size="sm">2</CandyBadge>
                <span style={{ fontWeight: 800 }}>名侦探可可</span>
              </div>
              <CandyBadge variant="gray" size="md">96 汤破解</CandyBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#f8fafc', border: '2px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CandyBadge variant="choco" size="sm">3</CandyBadge>
                <span style={{ fontWeight: 800 }}>机智小汤圆</span>
              </div>
              <CandyBadge variant="gray" size="md">74 汤破解</CandyBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#e0f2fe', border: '2px solid #bae6fd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CandyBadge variant="blue" size="sm">4</CandyBadge>
                <span style={{ fontWeight: 800 }}>{mounted ? name : '推理小海龟'} (你)</span>
              </div>
              <CandyBadge variant="blue" size="md">42 汤破解</CandyBadge>
            </div>
          </div>
        </CandyModal>
      )}

      {/* 新手指南弹窗 - 使用 CandyModal 组件 */}
      {mounted && guideOpen && (
        <CandyModal
          isOpen={guideOpen}
          onClose={() => setGuideOpen(false)}
          title="海龟汤新手指南"
          titleStyle="ribbon"
          ribbonColor="blue"
        >
          <div style={{ fontSize: '0.92rem', lineHeight: 1.6, color: '#334155', marginTop: '12px' }}>
            <p><strong>什么是海龟汤？</strong></p>
            <p>海龟汤是一种情境推理游戏（Lateral Thinking Puzzle）。出题者给出一个反常或看似矛盾的案发现场（汤面），玩家通过提问获取线索，最终推理出故事的完整全貌（汤底）。</p>
            <p><strong>提问规则：</strong></p>
            <ul>
              <li>玩家只能提出<strong>一般疑问句</strong>（答案可以用“是”或“不是”回答的问题）。</li>
              <li>AI 裁判仅会回答：<strong>是</strong>、<strong>不是</strong>、<strong>不相关</strong>或<strong>不确定</strong>。</li>
              <li>每人拥有 8 次提问机会，可申请补充线索，最终提交真相还原！</li>
            </ul>
          </div>
        </CandyModal>
      )}
    </>
  );
}
