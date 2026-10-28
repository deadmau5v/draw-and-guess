import React, { useEffect, useRef, useState } from 'react';
import { CandyAlert, CandyButton, CandyGameIcon, CandyModal } from 'candy-ui';
import type { HintAnnouncement, RoomView } from '@shared/protocol';
import { emitFloatingText, playJuiceSound } from './juice';

/** Only a newly received announcement interrupts the current view; joining never replays history. */
export function HintNotice({ room, onOpened }: { room: RoomView; onOpened: () => void }) {
 const seen = useRef(room.hintAnnouncement?.id ?? null);
 const [notice, setNotice] = useState<(HintAnnouncement & { text: string }) | null>(null);
 useEffect(() => {
  const announcement = room.hintAnnouncement;
  if (!announcement) { seen.current = null; setNotice(null); return; }
  if (announcement.round !== room.round || announcement.id === seen.current) return;
  const text = room.hints[announcement.index - 1];
  // Use only the already-public hint; wait if state and announcement arrive separately.
  if (typeof text !== 'string' || !text) return;
  seen.current = announcement.id;
  playJuiceSound('hintReveal');
  emitFloatingText({ text: `💡 第 ${announcement.index} 条线索公开`, color: 'purple' });
  setNotice({ ...announcement, text }); onOpened();
 }, [room.hintAnnouncement, room.hints, room.round, onOpened]);
 return notice && notice.round === room.round ? <CandyModal isOpen title={`${notice.playerName} 开启了提示`} onClose={() => setNotice(null)}>
  <CandyAlert tone="info" title={`第 ${notice.index} 条提示`} icon={<CandyGameIcon name="notification" size={24} />}>{notice.text}</CandyAlert>
  <p>已向全员公开，提示页已同步。</p>
  <CandyButton variant="purple" onClick={() => setNotice(null)}>知道了</CandyButton>
 </CandyModal> : null;
}
