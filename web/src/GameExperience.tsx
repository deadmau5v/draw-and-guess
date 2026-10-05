'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CandyPanel, CandySpinner } from 'candy-ui';
import { useLoading } from './loading';

const editable = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"], [role="textbox"]');

export function GameExperience({ children }: { children: ReactNode }) {
  const loading = useLoading();
  const [booting, setBooting] = useState(true);
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const shownAt = useRef(0);
  const active = booting || loading.active;
  useEffect(() => { const timer = setTimeout(() => setBooting(false), 250); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    if (active) { shownAt.current = Date.now(); setVisible(true); setLeaving(false); return; }
    const timer = setTimeout(() => setLeaving(true), Math.max(0, 350 - (Date.now() - shownAt.current)));
    return () => clearTimeout(timer);
  }, [active]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setVisible(false), 220);
    return () => clearTimeout(timer);
  }, [leaving]);
  useEffect(() => { content.current?.toggleAttribute('inert', visible); }, [visible]);
  useEffect(() => {
    const suppress = (event: Event) => { if (!editable(event.target)) event.preventDefault(); };
    const press = (event: PointerEvent) => { if (event.pointerType === 'mouse') document.documentElement.dataset.cursorPressed = 'true'; };
    const release = () => { delete document.documentElement.dataset.cursorPressed; };
    document.addEventListener('contextmenu', suppress);
    document.addEventListener('dragstart', suppress);
    document.addEventListener('selectstart', suppress);
    document.addEventListener('pointerdown', press);
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      document.removeEventListener('contextmenu', suppress);
      document.removeEventListener('dragstart', suppress);
      document.removeEventListener('selectstart', suppress);
      document.removeEventListener('pointerdown', press);
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release); release();
    };
  }, []);
  return <>
    <div ref={content} className="game-experience" aria-busy={active}>{children}</div>
    {visible && <div className={`game-loading-overlay${leaving ? ' game-loading-leaving' : ''}`} role="status" aria-live="polite" aria-label="场景加载">
      <CandyPanel theme="frosted" className="game-loading-panel">
        <img src="/assets/turtle-think.png" alt="" className="game-loading-mascot" draggable={false} />
        <h2>真相即将登场</h2>
        <div className="game-loading-caption"><CandySpinner size="sm" /><span>{loading.label}</span></div>
        <p>一碗汤，一个谜</p>
      </CandyPanel>
    </div>}
  </>;
}
