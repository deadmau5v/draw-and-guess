import React from 'react';
import { CandyBadge, CandyButton, CandyList, CandyListItem, CandyModal } from 'candy-ui';
import Leaderboard from './Leaderboard';

export default function HeaderDialogs({ kind, onClose }: { kind: 'leaderboard' | 'guide'; onClose: () => void }) {
  return <CandyModal isOpen onClose={onClose} closeLabel="关闭" title={kind === 'leaderboard' ? '推理排行榜' : '海龟汤新手指南'} titleStyle="ribbon" ribbonColor="blue"
    width={kind === 'leaderboard' ? 600 : undefined} className={kind === 'leaderboard' ? 'leaderboard-modal' : undefined}>
    {kind === 'leaderboard'
      ? <Leaderboard />
      : <><p style={{ margin: '0 0 12px' }}>海龟汤是一种情境推理游戏。阅读反常的故事片段，通过是非提问寻找线索，最终还原完整真相。</p>
        <CandyList variant="card" size="sm" aria-label="提问规则">
          <CandyListItem leading={<CandyBadge variant="blue">1</CandyBadge>} title="阅读汤面" description="先观察故事中反常的人物、地点和事件。" />
          <CandyListItem leading={<CandyBadge variant="blue">2</CandyBadge>} title="提出是非问题" description="AI 会回答「是 / 不是 / 不相关 / 不确定」。" />
          <CandyListItem leading={<CandyBadge variant="blue">3</CandyBadge>} title="还原真相" description="默认每人 8 次提问，结合线索提交完整故事！" />
        </CandyList>
        <div className="actions-row" style={{ justifyContent: 'flex-end', marginTop: 16, marginBottom: 0 }}>
          <CandyButton variant="blue" size="sm" onClick={onClose}>我知道了</CandyButton>
        </div>
      </>}
  </CandyModal>;
}
