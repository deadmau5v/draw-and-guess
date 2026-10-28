import React, { useEffect, useState } from 'react';
import { api } from './api';
import { actions, joinRoom, leaveRoom } from './socket';
import { clearToast, getSnapshot, notify, useGame } from './store';
import { remainingQuota } from './game';
import { usePageLoading } from './loading';
import {
  CandyAlert, CandyBadge, CandyButton, CandyCard, CandyEmptyState,
  CandyGameIcon, CandyIconButton, CandyInput, CandyList, CandyListItem,
  CandyModal, CandyNavigation, CandyPanel, CandySelect,
  useCandy, candySound, triggerCandyConfetti,
} from 'candy-ui';
import {
  AskBox, ContentWarning, GuessModal, HostPanel, PlayerList,
  QuestionLog, ReconnectBanner, RevealModal, Toast,
} from './components';
import { copyTextToClipboard } from './clipboard';
import { cdnUrl } from './cdn';
import { PageContainer, SectionLoading } from './PageContainer';

function readStorage(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function saveStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}
function newPlayerKey(): string {
  const saved = readStorage('turtle:playerKey');
  if (saved) return saved;
  const created = `p-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  saveStorage('turtle:playerKey', created);
  return created;
}

const roomCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const AVATAR_PRESETS = [
  { id: 'turtle', name: '小海龟', icon: 'heart' },
  { id: 'smile', name: '活力笑脸', icon: 'user' },
  { id: 'corgi', name: '侦探柯基', icon: 'search' },
  { id: 'anime', name: '炫彩少年', icon: 'star' },
  { id: 'panda', name: '呆萌熊猫', icon: 'heart' },
  { id: 'burger', name: '汉堡超人', icon: 'bowl' },
  { id: 'astronaut', name: '宇航员', icon: 'earth' },
  { id: 'fox', name: '侦探狐狸', icon: 'compass' },
  { id: 'gamer', name: '电竞少女', icon: 'controller' },
  { id: 'ghost', name: '萌趣幽灵', icon: 'user' },
  { id: 'robot', name: '智能机器', icon: 'settings' },
  { id: 'witch', name: '见习魔女', icon: 'light' },
];

function Leaderboard({ name: _name }: { name?: string }) {
  return <CandyEmptyState title="排行榜暂未开放" description="战绩榜单接入后将在这里展示，当前不展示模拟排名。" icon={<CandyGameIcon name="trophy" size={40} />} />;
}

function Rules() {
  return <CandyList aria-label="新手规则">
    {[
      '出题者提供一个不完整的故事（海龟汤）。',
      '你可以通过提问来获取“是 / 否 / 无关”的答案。',
      '根据线索进行推理，猜出故事的完整真相！',
    ].map((rule, index) => <CandyListItem key={rule}
      leading={<CandyBadge variant="blue" size="sm">{index + 1}</CandyBadge>} title={rule} />)}
  </CandyList>;
}

export function Home({ name, onName, onCreate, onJoin, busy = false }: {
  name: string;
  onName: (value: string) => void;
  onCreate: (start?: 'random' | 'chosen') => void;
  onJoin: (code: string) => void;
  busy?: boolean;
}) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<string | number>('classic');
  const [difficulty, setDifficulty] = useState<string | number>('medium');
  const [selectedAvatar, setSelectedAvatar] = useState(() => readStorage('turtle:avatar') || 'turtle');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const avatar = AVATAR_PRESETS.find(preset => preset.id === selectedAvatar);
  const randomNames = ['推理小海龟', '迷雾名侦探', '机智小汤圆', '真相追踪者', '清汤名捕', '深海福尔摩斯', '超能大侦探', '逻辑探员'];
  const start = (random = false) => {
    if (busy || !name.trim()) {
      if (!name.trim()) {
        notify('先输入你的昵称');
        document.getElementById('nickname')?.focus();
      }
      return;
    }
    const clean = code.trim().toUpperCase();
    if (clean) {
      if (!roomCodePattern.test(clean)) { notify('请输入 6 位字母或数字房间码'); return; }
      onJoin(clean);
    } else if (random) onCreate('random');
    else onCreate();
  };
  const focusJoin = () => {
    const input = document.getElementById('room-code');
    input?.focus();
    input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    notify('请在左侧输入 6 位房间号快速加入');
  };

  return <PageContainer className="legacy-home">
    <div className="sr-only">汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相</div>
    <CandyPanel theme="frosted">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24 }}>
        <CandyPanel theme="frosted" ribbon="快速开始" ribbonColor="blue">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {avatar && avatar.id !== 'turtle'
              ? <CandyGameIcon name={avatar.icon} size={100} aria-label={avatar.name} aria-hidden={false} role="img" />
              : <img src={cdnUrl('/assets/turtle-hero.png')} alt="海龟汤吉祥物" style={{ width: 120, height: 120, objectFit: 'contain' }} />}
            <CandyIconButton aria-label="切换形象" size="sm" variant="blue"
              icon={<CandyGameIcon name="pencil" />} onClick={() => setAvatarModalOpen(true)} />
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="nickname-controls">
              <CandyInput id="nickname" label="你的昵称" aria-label="你的昵称" value={name}
                placeholder="输入昵称" onChange={e => onName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') start(); }} leftIcon={<CandyGameIcon name="user" />} />
              <CandyIconButton aria-label="随机昵称" size="sm" variant="blue"
                icon={<CandyGameIcon name="dice" />} onClick={() => {
                  const next = randomNames[Math.floor(Math.random() * randomNames.length)];
                  onName(next); saveStorage('turtle:name', next);
                }} />
            </div>
            <div>
              <p>游戏模式</p>
              <CandySelect id="game-mode" aria-label="游戏模式" value={mode} onChange={setMode} fullWidth
                options={[{ value: 'classic', label: '经典海龟汤' }, { value: 'free', label: '自由提问模式' }, { value: 'turns', label: '轮流提问模式' }]} />
            </div>
            <div>
              <p>难度选择</p>
              <CandySelect id="difficulty-select" aria-label="难度选择" value={difficulty} onChange={setDifficulty} fullWidth
                options={[{ value: 'all', label: '全部难度' }, { value: 'easy', label: '入门' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '极度烧脑' }]} />
            </div>
            <CandyInput id="room-code" label="房间号" aria-label="房间号" value={code} maxLength={6}
              placeholder="可不填，留空则自动创建" leftIcon={<CandyGameIcon name="door" />}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') start(true); }} />
            <CandyButton variant="yellow" size="lg" fullWidth disabled={busy || !name.trim()}
              aria-label="单人随机一碗" leftIcon={<CandyGameIcon name="play" />} onClick={() => start(true)}>
              快速开始
            </CandyButton>
            <CandyButton variant="blue" size="lg" fullWidth disabled={busy || !name.trim()}
              aria-label="创建房间 →" leftIcon={<CandyGameIcon name="plus" />} onClick={() => start()}>
              创建房间
            </CandyButton>
          </div>
        </CandyPanel>
        <div style={{ display: 'grid', gap: 20 }}>
          <CandyPanel theme="frosted" ribbon="进入游戏" ribbonColor="blue">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <CandyCard title="创建房间" description="自定义规则，邀请好友" icon={<CandyGameIcon name="house" size={48} />}
                footer={<CandyButton variant="blue" disabled={busy || !name.trim()} onClick={() => start()}>创建</CandyButton>} />
              <CandyCard title="加入房间" description="输入房间号，快速加入" icon={<CandyGameIcon name="users" size={48} />}
                footer={<CandyButton variant="yellow" onClick={focusJoin}>加入房间</CandyButton>} />
              <CandyCard title="题库挑战" description="海量题目，单人练习" icon={<CandyGameIcon name="book" size={48} />}
                footer={<CandyButton variant="green" onClick={() => { location.hash = '/library'; }}>题库挑战</CandyButton>} />
              <CandyCard title="排行榜" description="看看谁才是推理之王" icon={<CandyGameIcon name="trophy" size={48} />}
                footer={<CandyButton variant="purple" onClick={() => setLeaderboardOpen(true)}>排行榜</CandyButton>} />
            </div>
          </CandyPanel>
          <CandyPanel theme="frosted" ribbon="新手规则" ribbonColor="gold">
            <img src={cdnUrl('/assets/turtle-think.png')} alt="思考解密小海龟" style={{ width: 84, height: 84, objectFit: 'contain' }} />
            <Rules />
          </CandyPanel>
        </div>
      </div>
    </CandyPanel>
    <CandyModal isOpen={avatarModalOpen} onClose={() => setAvatarModalOpen(false)} title="选择专属形象" titleStyle="ribbon" ribbonColor="blue">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {AVATAR_PRESETS.map(preset => <CandyButton key={preset.id} variant="blue"
          appearance={selectedAvatar === preset.id ? 'solid' : 'soft'} aria-pressed={selectedAvatar === preset.id}
          leftIcon={<CandyGameIcon name={preset.icon} />} onClick={() => {
            setSelectedAvatar(preset.id); saveStorage('turtle:avatar', preset.id); setAvatarModalOpen(false);
          }}>{preset.name}</CandyButton>)}
      </div>
    </CandyModal>
    <CandyModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} closeLabel="关闭" title="推理排行榜" titleStyle="ribbon" ribbonColor="gold" width={600} className="leaderboard-modal">
      <Leaderboard />
    </CandyModal>
  </PageContainer>;
}

