'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CandyPanel, CandySpinner, useFloatingText } from 'candy-ui';
import { useLoading } from './loading';
import { playJuiceSound, subscribeFloatingText } from './juice';

const editable = (target: EventTarget | null) => {
  // Native selectstart is dispatched from a Text node in Chrome, not just its parent element.
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return !!element?.closest('input, textarea, [contenteditable="true"], [role="textbox"], .shared-story-surface');
};

const interactiveControl = (target: EventTarget | null) => {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return element?.closest('button:not(:disabled), [role="button"]:not([aria-disabled="true"]), [role="tab"], [role="option"], .mascot-fidget-trigger');
};

export function GameExperience({ children }: { children: ReactNode }) {
  const loading = useLoading();
  const [visible, setVisible] = useState(false);
  const { spawnText, FloatingTextContainer } = useFloatingText();
  const lastPointer = useRef({ x: 0, y: 0 });
  const armedControl = useRef<Element | null>(null);

  // Fast operations need no transition animation; slow ones never replace the scene.
  useEffect(() => {
    if (!loading.active) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(timer);
  }, [loading.active]);

  useEffect(() => {
    return subscribeFloatingText(({ text, x, y, color }) => {
      const fallbackX = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 320;
      const fallbackY = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.38) : 220;
      spawnText({
        text,
        x: x ?? (lastPointer.current.x || fallbackX),
        y: y ?? (lastPointer.current.y || fallbackY),
        color,
      });
    });
  }, [spawnText]);

  useEffect(() => {
    const suppress = (event: Event) => { if (!editable(event.target)) event.preventDefault(); };
    const press = (event: PointerEvent) => {
      if (event.clientX || event.clientY) {
        lastPointer.current = { x: event.clientX, y: event.clientY };
      }
      if (event.pointerType === 'mouse') document.documentElement.dataset.cursorPressed = 'true';
      const control = interactiveControl(event.target);
      if (control) {
        armedControl.current = control;
        playJuiceSound('pressDown');
      } else {
        armedControl.current = null;
      }
    };
    const release = (event?: PointerEvent) => {
      delete document.documentElement.dataset.cursorPressed;
      if (event && armedControl.current) {
        const releasedOn = interactiveControl(event.target);
        if (releasedOn === armedControl.current) {
          playJuiceSound('pressUp');
        }
      }
      armedControl.current = null;
    };
    const cancel = () => {
      delete document.documentElement.dataset.cursorPressed;
      armedControl.current = null;
    };
    document.addEventListener('contextmenu', suppress);
    document.addEventListener('dragstart', suppress);
    document.addEventListener('selectstart', suppress);
    document.addEventListener('pointerdown', press);
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      document.removeEventListener('contextmenu', suppress);
      document.removeEventListener('dragstart', suppress);
      document.removeEventListener('selectstart', suppress);
      document.removeEventListener('pointerdown', press);
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      cancel();
    };
  }, []);

  return <>
    <div className="game-background" aria-hidden="true" />
    <div className="game-experience" aria-busy={loading.active}>{children}</div>
    <FloatingTextContainer />
    {visible && loading.active && <div className="game-loading-indicator" role="status" aria-live="polite" aria-label="场景加载">
      <CandyPanel theme="frosted" className="game-loading-panel">
        <CandySpinner size="sm" /><span>{loading.label}</span>
      </CandyPanel>
    </div>}
  </>;
}
