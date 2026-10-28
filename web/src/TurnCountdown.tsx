'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CandyBadge } from 'candy-ui';
import type { RoomView } from '@shared/protocol';
import { playJuiceSound } from './juice';

export function TurnCountdown({ room, disabled }: {
  room: Pick<RoomView, 'phase' | 'settings' | 'turnKey' | 'turnDeadline' | 'turnRemainingMs' | 'serverNow'>;
  disabled: boolean;
}) {
  const active = room.phase === 'playing' && room.settings.turnMode === 'turns' && room.turnKey !== null;
  // A local tick never advances the turn; only the server's state may do that.
  const offset = useMemo(() => room.serverNow - Date.now(), [room.serverNow]);
  const [now, setNow] = useState(Date.now);
  const prevTickRef = useRef<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (!active || disabled || room.turnDeadline === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active, disabled, room.turnDeadline, room.serverNow]);

  const paused = room.turnDeadline === null && room.turnRemainingMs !== null;
  const seconds = active
    ? Math.max(0, Math.ceil((paused ? room.turnRemainingMs! : (room.turnDeadline ?? room.serverNow) - (now + offset)) / 1000))
    : 0;
  const urgent = active && !disabled && !paused && seconds <= 10;

  useEffect(() => {
    if (!urgent || seconds <= 0) {
      prevTickRef.current = null;
      return;
    }
    if (prevTickRef.current !== null && prevTickRef.current !== seconds) {
      playJuiceSound(seconds <= 3 ? 'countdownUrgent' : 'countdownTick');
    }
    prevTickRef.current = seconds;
  }, [urgent, seconds]);

  if (!active) return null;
  const label = disabled ? '重连后同步倒计时' : paused ? `判题暂停 · ${seconds} 秒` : seconds === 0 ? '时间到，正在切换…' : `剩余 ${seconds} 秒`;
  const urgentClass = urgent ? (seconds <= 3 ? 'countdown-critical' : 'countdown-urgent') : undefined;
  return <CandyBadge role="timer" aria-label="提问倒计时" aria-live="off" className={urgentClass} variant={urgent ? 'red' : 'blue'}>{label}</CandyBadge>;
}
