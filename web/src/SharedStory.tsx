'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CandyBadge, CandyButton, CandyGameIcon } from 'candy-ui';
import type { SurfaceHighlight } from '@shared/protocol';
import { actions } from './socket';
import { notify } from './store';
import { emitFloatingText, playJuiceSound } from './juice';

type SelectedText = { start: number; end: number; round: number; surface: string };
function markerColor(key: string) {
  const colors = ['yellow', 'purple', 'blue', 'green'] as const;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

export function SharedStory({ surface, highlights, round, disabled }: {
  surface: string; highlights: SurfaceHighlight[]; round: number; disabled: boolean;
}) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [selected, setSelected] = useState<SelectedText | null>(null);
  const [pending, setPending] = useState(false);
  const latestSelection = useRef(selected);
  latestSelection.current = selected;
  const version = useRef(0);
  const busy = useRef(false);
  const current = useRef({ round, surface });
  current.current = { round, surface };
  useEffect(() => {
    ++version.current;
    busy.current = false;
    setPending(false);
    setSelected(null);
    const selection = window.getSelection();
    if (selection && paragraph.current && (paragraph.current.contains(selection.anchorNode) || paragraph.current.contains(selection.focusNode))) selection.removeAllRanges();
    return () => { ++version.current; };
  }, [round, surface]);
  const captureSelection = () => {
    const root = paragraph.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.isCollapsed || selection.rangeCount !== 1) { setSelected(null); return; }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) { setSelected(null); return; }
    const prefix = range.cloneRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    const end = start + range.toString().length;
    setSelected(start < end ? { start, end, round, surface } : null);
  };
  useEffect(() => {
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  }, [round, surface]);
  const highlight = async () => {
    if (disabled || busy.current || !selected || selected.round !== round || selected.surface !== surface) return;
    const requestVersion = version.current;
    const isCurrent = () => version.current === requestVersion && current.current.round === round && current.current.surface === surface;
    busy.current = true;
    setPending(true);
    try {
      await actions.highlight({ round, start: selected.start, end: selected.end });
      playJuiceSound('highlight');
      emitFloatingText({ text: '★ 线索已标记', color: 'yellow' });
      const latest = latestSelection.current;
      if (isCurrent() && latest?.round === selected.round && latest.surface === selected.surface && latest.start === selected.start && latest.end === selected.end) {
        setSelected(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch (error) { if (isCurrent()) notify(error instanceof Error ? error.message : '高亮失败，请重试'); }
    finally { if (isCurrent()) { busy.current = false; setPending(false); } }
  };
  const remove = async (id: string) => {
    if (disabled || busy.current) return;
    const requestVersion = version.current;
    const isCurrent = () => version.current === requestVersion && current.current.round === round && current.current.surface === surface;
    busy.current = true;
    setPending(true);
    try { await actions.removeHighlight({ round, id }); }
    catch (error) { if (isCurrent()) notify(error instanceof Error ? error.message : '取消高亮失败，请重试'); }
    finally { if (isCurrent()) { busy.current = false; setPending(false); } }
  };
  const contents: React.ReactNode[] = [];
  const visibleHighlights: SurfaceHighlight[] = [];
  const seen = new Set<string>();
  let cursor = 0;
  for (const highlight of [...highlights].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id))) {
    // Keep author labels outside the paragraph: they must never contaminate UTF-16 selection offsets.
    if (!Number.isInteger(highlight.start) || !Number.isInteger(highlight.end) || highlight.start < cursor || highlight.start < 0 || highlight.end <= highlight.start || highlight.end > surface.length || seen.has(highlight.id)) continue;
    seen.add(highlight.id);
    visibleHighlights.push(highlight);
    contents.push(surface.slice(cursor, highlight.start));
    contents.push(<mark key={highlight.id} className="shared-story-mark" title={`${highlight.playerName} 的高亮`} style={{ background: 'transparent' }} onClick={() => { if (window.getSelection()?.isCollapsed !== false) void remove(highlight.id); }}><CandyBadge variant={markerColor(highlight.playerKey)} style={{ fontSize: 'inherit', lineHeight: 'inherit', whiteSpace: 'normal', maxWidth: '100%', verticalAlign: 'baseline' }}>{surface.slice(highlight.start, highlight.end)}</CandyBadge></mark>);
    cursor = highlight.end;
  }
  contents.push(surface.slice(cursor));
  return <div className="shared-story">
    <p ref={paragraph} className="story-body shared-story-surface" style={{ userSelect: 'text', WebkitUserSelect: 'text' }} onMouseUp={captureSelection}>{contents}</p>
    <div className="shared-story-actions">
      {selected && <CandyButton size="xs" variant="yellow" aria-label="高亮选中文字" disabled={disabled || pending} onMouseDown={event => event.preventDefault()} onClick={() => { void highlight(); }}><CandyGameIcon name="star" size={16} /> 高亮选中文字</CandyButton>}
      {visibleHighlights.map(highlight => {
        const text = surface.slice(highlight.start, highlight.end);
        const characters = Array.from(text);
        const snippet = characters.length > 18 ? `${characters.slice(0, 18).join('')}…` : text;
        return <CandyButton key={highlight.id} size="xs" variant={markerColor(highlight.playerKey)} aria-label={`取消高亮：${text}`} title={`${highlight.playerName} 标记：${text}（点击取消）`} disabled={disabled || pending} onClick={() => { void remove(highlight.id); }}><span>{highlight.playerName} 标记</span><span className="shared-story-label">「{snippet}」</span><CandyGameIcon name="cross" size={12} /></CandyButton>;
      })}
    </div>
  </div>;
}
