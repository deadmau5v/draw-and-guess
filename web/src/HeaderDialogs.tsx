import React from 'react';
import { CandyBadge, CandyButton, CandyList, CandyListItem, CandyModal } from 'candy-ui';
import Leaderboard from './Leaderboard';

export default function HeaderDialogs({ kind, onClose }: { kind: 'leaderboard' | 'guide'; onClose: () => void }) {
  return <CandyModal isOpen onClose={onClose} closeLabel="关闭" title={kind === 'leaderboard' ? '排行榜' : '玩法'} titleStyle="ribbon" ribbonColor="blue"
    width={kind === 'leaderboard' ? 600 : undefined} className={kind === 'leaderboard' ? 'leaderboard-modal' : undefined}>
    {kind === 'leaderboard' ? <Leaderboard /> : <>
      <CandyList variant="card" size="sm" aria-label="玩法步骤">
        {['创建或加入房间并邀请好友。', '画手画词，其他玩家看画猜词。', '回合结束结算分数，再开始下一轮。'].map((text, index) => <CandyListItem key={text} leading={<CandyBadge variant="blue">{index + 1}</CandyBadge>} title={text} />)}
      </CandyList>
      <div className="actions-row"><CandyButton variant="blue" size="sm" onClick={onClose}>关闭</CandyButton></div>
    </>}
  </CandyModal>;
}
