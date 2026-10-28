// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import type { SurfaceHighlight } from '../../shared/protocol';
const fake = vi.hoisted(() => ({ highlight: vi.fn(), removeHighlight: vi.fn() }));
vi.mock('../../web/src/socket', () => ({ actions: fake }));
import { SharedStory } from '../../web/src/SharedStory';

afterEach(() => { cleanup(); window.getSelection()?.removeAllRanges(); vi.resetAllMocks(); });
const surface = '他😀走进房间，发现门开着。';
const view = (highlights: SurfaceHighlight[] = [], round = 1, disabled = false, text = surface) => <CandyProvider><SharedStory surface={text} highlights={highlights} round={round} disabled={disabled} /></CandyProvider>;
function select(start: Node, startOffset: number, end = start, endOffset = startOffset) {
  const range = document.createRange();
  range.setStart(start, startOffset); range.setEnd(end, endOffset);
  const selection = window.getSelection()!;
  selection.removeAllRanges(); selection.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  const paragraph = start.nodeType === Node.TEXT_NODE ? start.parentElement?.closest('p') : (start as Element).closest('p');
  if (paragraph) fireEvent.mouseUp(paragraph);
}
it('uses UTF16 offsets for selected surface text and clears selection after acknowledgement', async () => {
  let resolve!: (value: undefined) => void;
  fake.highlight.mockReturnValue(new Promise<undefined>(done => { resolve = done; }));
  const { container } = render(view());
  const paragraph = container.querySelector('p')!;
  expect(paragraph.style.userSelect).toBe('text');
  select(paragraph.firstChild!, 1, paragraph.firstChild!, 5);
  const button = screen.getByRole('button', { name: '高亮选中文字' });
  expect(button.textContent).toContain('高亮');
  fireEvent.mouseDown(button); fireEvent.click(button);
  expect(fake.highlight).toHaveBeenCalledWith({ round: 1, start: 1, end: 5 });
  expect(window.getSelection()?.toString()).toBe('😀走进');
  await act(async () => { resolve(undefined); });
  expect(window.getSelection()?.rangeCount).toBe(0);
  expect(screen.queryByRole('button', { name: '高亮选中文字' })).toBeNull();
});
const shared: SurfaceHighlight = { id: 'shared-1', start: 3, end: 5, playerKey: 'other', playerName: '小林' };
it('renders shared marks and cancels them through mouse or a keyboard-accessible Candy control', async () => {
  fake.removeHighlight.mockResolvedValue(undefined);
  const { container } = render(view([shared]));
  const paragraph = container.querySelector('p')!;
  const mark = paragraph.querySelector('mark')!;
  expect(paragraph.textContent).toBe(surface);
  expect(mark.textContent).toBe('走进');
  expect(mark.title).toContain('小林');
  expect(mark.querySelector('.candy-badge')).toBeTruthy();
  expect(screen.getByRole('button', { name: '取消高亮：走进' }).textContent).toContain('小林 标记');
  await act(async () => { fireEvent.click(mark); });
  expect(fake.removeHighlight).toHaveBeenCalledWith({ round: 1, id: 'shared-1' });
  const cancel = screen.getByRole('button', { name: '取消高亮：走进' });
  expect(cancel.className).toContain('candy');
  cancel.focus();
  expect(document.activeElement).toBe(cancel);
  // Native Candy buttons provide Enter/Space activation in browsers; click models that activation.
  await act(async () => { fireEvent.click(cancel); });
  expect(fake.removeHighlight).toHaveBeenCalledTimes(2);
});
it('clears a selection on round change and ignores an old acknowledgement without clearing the new round selection', async () => {
  let resolve!: (value: undefined) => void;
  fake.highlight.mockReturnValueOnce(new Promise<undefined>(done => { resolve = done; }));
  const { container, rerender } = render(view());
  let paragraph = container.querySelector('p')!;
  select(paragraph.firstChild!, 0, paragraph.firstChild!, 1);
  fireEvent.click(screen.getByRole('button', { name: '高亮选中文字' }));
  rerender(view([], 2));
  expect(window.getSelection()?.rangeCount).toBe(0);
  expect(screen.queryByRole('button', { name: '高亮选中文字' })).toBeNull();
  paragraph = container.querySelector('p')!;
  select(paragraph.firstChild!, 3, paragraph.firstChild!, 5);
  const button = screen.getByRole('button', { name: '高亮选中文字' });
  expect(button.hasAttribute('disabled')).toBe(false);
  await act(async () => { resolve(undefined); });
  expect(window.getSelection()?.toString()).toBe('走进');
  expect(screen.getByRole('button', { name: '高亮选中文字' })).toBeTruthy();
  fake.highlight.mockResolvedValueOnce(undefined);
  await act(async () => { fireEvent.click(button); });
  expect(fake.highlight).toHaveBeenLastCalledWith({ round: 2, start: 3, end: 5 });
});
it('preserves the surface exactly when highlights overlap or contain invalid ranges', () => {
  const invalid = [
    { ...shared, id: 'overlap', start: 4, end: 8 },
    { ...shared, id: 'negative', start: -2, end: 1 },
    { ...shared, id: 'outside', start: 9, end: 999 },
    { ...shared, id: 'fraction', start: 1.5, end: 3 },
    { ...shared, id: 'empty', start: 6, end: 6 },
    { ...shared, id: 'reverse', start: 8, end: 6 },
  ];
  const { container } = render(view([...invalid, shared, { ...shared }]));
  const paragraph = container.querySelector('p')!;
  expect(paragraph.textContent).toBe(surface);
  expect(paragraph.querySelectorAll('mark').length).toBe(1);
  expect(screen.getAllByRole('button', { name: '取消高亮：走进' }).length).toBe(1);
});
it('accepts selections across existing marks without treating a drag as cancellation', async () => {
  fake.highlight.mockResolvedValue(undefined);
  const { container } = render(view([shared]));
  const paragraph = container.querySelector('p')!;
  const mark = paragraph.querySelector('mark')!;
  select(paragraph.firstChild!, 1, paragraph.lastChild!, 2);
  fireEvent.click(mark);
  expect(fake.removeHighlight).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '高亮选中文字' })); });
  expect(fake.highlight).toHaveBeenCalledWith({ round: 1, start: 1, end: 7 });
});
it('rejects collapsed and cross-boundary selections in both directions', () => {
  const { container } = render(<><span>before</span>{view()}<span>after</span></>);
  const paragraph = container.querySelector('p')!;
  const before = container.firstChild!.firstChild!;
  const after = container.lastChild!.firstChild!;
  select(paragraph.firstChild!, 0, paragraph.firstChild!, 1);
  expect(screen.getByRole('button', { name: '高亮选中文字' })).toBeTruthy();
  select(paragraph.firstChild!, 1);
  expect(screen.queryByRole('button', { name: '高亮选中文字' })).toBeNull();
  select(before, 1, paragraph.firstChild!, 3);
  expect(screen.queryByRole('button', { name: '高亮选中文字' })).toBeNull();
  select(paragraph.firstChild!, 1, after, 3);
  expect(screen.queryByRole('button', { name: '高亮选中文字' })).toBeNull();
  expect(fake.highlight).not.toHaveBeenCalled();
});
it('does not send highlight or cancellation while disabled', () => {
  const { container } = render(view([shared], 1, true));
  const paragraph = container.querySelector('p')!;
  select(paragraph.firstChild!, 0, paragraph.firstChild!, 1);
  const button = screen.getByRole('button', { name: '高亮选中文字' });
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.click(button);
  window.getSelection()?.removeAllRanges();
  fireEvent.click(paragraph.querySelector('mark')!);
  const cancel = screen.getByRole('button', { name: '取消高亮：走进' });
  expect(cancel.hasAttribute('disabled')).toBe(true);
  fireEvent.click(cancel);
  expect(fake.highlight).not.toHaveBeenCalled();
  expect(fake.removeHighlight).not.toHaveBeenCalled();
});
it('retains a failed selection for retry and prevents duplicate submissions while awaiting acknowledgement', async () => {
  let reject!: (error: Error) => void;
  fake.highlight.mockReturnValueOnce(new Promise<undefined>((_, fail) => { reject = fail; }));
  const { container } = render(view());
  const paragraph = container.querySelector('p')!;
  select(paragraph.firstChild!, 0, paragraph.firstChild!, 1);
  const button = screen.getByRole('button', { name: '高亮选中文字' });
  fireEvent.click(button); fireEvent.click(button);
  expect(fake.highlight).toHaveBeenCalledTimes(1);
  expect(button.hasAttribute('disabled')).toBe(true);
  await act(async () => { reject(Error('与已有高亮重叠')); });
  expect(window.getSelection()?.toString()).toBe('他');
  expect(button.hasAttribute('disabled')).toBe(false);
  fake.highlight.mockResolvedValueOnce(undefined);
  await act(async () => { fireEvent.click(button); });
  expect(fake.highlight).toHaveBeenCalledTimes(2);
});
it('does not clear a newer same-round selection when an earlier highlight succeeds', async () => {
  let resolve!: (value: undefined) => void;
  fake.highlight.mockReturnValueOnce(new Promise<undefined>(done => { resolve = done; }));
  const { container } = render(view());
  const paragraph = container.querySelector('p')!;
  select(paragraph.firstChild!, 0, paragraph.firstChild!, 1);
  fireEvent.click(screen.getByRole('button', { name: '高亮选中文字' }));
  select(paragraph.firstChild!, 3, paragraph.firstChild!, 5);
  await act(async () => { resolve(undefined); });
  expect(window.getSelection()?.toString()).toBe('走进');
  expect(screen.getByRole('button', { name: '高亮选中文字' }).hasAttribute('disabled')).toBe(false);
});
it('clears the acknowledged selection even if the browser repeats selectionchange for the same range', async () => {
  let resolve!: (value: undefined) => void;
  fake.highlight.mockReturnValueOnce(new Promise<undefined>(done => { resolve = done; }));
  const { container } = render(view());
  const paragraph = container.querySelector('p')!;
  select(paragraph.firstChild!, 0, paragraph.firstChild!, 1);
  fireEvent.click(screen.getByRole('button', { name: '高亮选中文字' }));
  fireEvent(document, new Event('selectionchange'));
  await act(async () => { resolve(undefined); });
  expect(window.getSelection()?.rangeCount).toBe(0);
  expect(screen.queryByRole('button', { name: '高亮选中文字' })).toBeNull();
});
