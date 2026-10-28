'use client';

import React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { CandyPanel, CandySkeleton, CandySpinner } from 'candy-ui';

/** Every route owns the same viewport frame. Only its inner viewport can scroll. */
export function PageContainer({ children, className = '', scroll = true, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode; scroll?: boolean }) {
  return <main {...props} className={`page-container ${className}`}>
    <div className={`page-viewport${scroll ? ' page-viewport-scroll' : ''}`}>{children}</div>
  </main>;
}

/** A local fallback that does not replace the header, background or page frame. */
export function SectionLoading({ label = '正在加载…', skeleton = false }: { label?: string; skeleton?: boolean }) {
  return <CandyPanel theme="frosted" className="section-loading" role="status" aria-live="polite">
    <div className="section-loading-label"><CandySpinner size="sm" /><span>{label}</span></div>
    {skeleton && <div className="section-loading-skeleton"><CandySkeleton lines={4} /></div>}
  </CandyPanel>;
}

export function AppShell({ header, children, notifications }: { header: ReactNode; children: ReactNode; notifications?: ReactNode }) {
  return <div className="app-container">
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault(); document.getElementById('main-content')?.focus();
    }}>跳到游戏内容</a>
    {header}
    <div id="main-content" className="app-route-content" tabIndex={-1}>{children}</div>
    {notifications}
  </div>;
}
