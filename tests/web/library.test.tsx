// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CandyProvider } from 'candy-ui';
import type { PuzzleSummary } from '../../shared/protocol';
const fake = vi.hoisted(() => ({ puzzles: vi.fn(), puzzle: vi.fn(), createRoom: vi.fn(), push: vi.fn() }));
vi.mock('../../web/src/api', () => ({ api: fake }));
vi.mock('../../app/gameNavigation', () => ({ useGameRouter: () => ({ push: fake.push }) }));
import { LibraryBrowser } from '../../web/src/LibraryBrowser';
import LibraryPage from '../../app/library/page';
import { difficultyLabel, matchesCategory, matchesDifficulty, pickRecommendation, puzzleCover } from '../../web/src/library';

const puzzle = (id: string, difficulty: number | null = 3, tags = ['经典']): PuzzleSummary => ({
  id, title: `题目 ${id}`, surfacePreview: `公开汤面 ${id}`, difficulty, tags, nsfl: false,
  hintCount: 3, goodRate: null, tier: 'none', funny: 0, ratings: 0, plays: 0, solves: 0, sourceKey: 'test',
});
const items = [puzzle('easy', 1, ['轻松']), puzzle('medium'), puzzle('hard', 5, ['校园']), puzzle('unknown', null)];
const view = (onChoose = vi.fn()) => render(<CandyProvider><LibraryBrowser onChoose={onChoose} onBack={() => {}} /></CandyProvider>);
const results = () => within(screen.getByRole('region', { name: '题库列表' }));
const loaded = async () => { await screen.findByText(`找到 ${items.length} 道题目`); };
beforeEach(() => {
  fake.puzzles.mockReset().mockResolvedValue(items);
  fake.puzzle.mockReset().mockResolvedValue({ ...puzzle('easy'), surface: '完整公开汤面', source: { key: 'test', repo: '', url: '', license: 'MIT' }, bottom: '绝不显示的秘密', hints: ['未公开提示'] });
  fake.createRoom.mockReset().mockResolvedValue({ code: 'ABC234' });
  fake.push.mockReset();
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('分类和难度规则保留未标注状态，不编造难度', () => {
  expect(matchesDifficulty(items[0], 'easy')).toBe(true);
  expect(matchesDifficulty(items[1], 'medium')).toBe(true);
  expect(matchesDifficulty(items[2], 'hard')).toBe(true);
  expect(matchesDifficulty(items[3], 'hard')).toBe(false);
  expect(matchesDifficulty(items[3], 'unknown')).toBe(true);
  expect(difficultyLabel(items[3])).toBe('未标注');
  expect(matchesCategory(items[2], 'school')).toBe(true);
  expect(matchesCategory(items[0], 'horror')).toBe(false);
});
it('封面选择只依据公开汤面，推荐使用真实评价与挑战次数', () => {
  const publicPuzzle = { ...puzzle('x'), title: '灯塔看守员' };
  expect(puzzleCover(publicPuzzle)).toBe('/assets/puzzle-covers/lighthouse.webp');
  expect(puzzleCover({ ...publicPuzzle, bottom: '酒吧 狗 学校', hints: ['海岛'] } as PuzzleSummary)).toBe(puzzleCover(publicPuzzle));
  const rated = { ...items[2], goodRate: 0.9, ratings: 10, plays: 3 };
  expect(pickRecommendation([...items, rated])).toEqual(rated);
});
it('完整题库筛选难度、分类、重置，默认排除重口', async () => {
  view(); await loaded();
  expect(fake.puzzles).toHaveBeenCalledWith(expect.objectContaining({ excludeNsfl: true, limit: 200 }), expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('radio', { name: '简单 · 1–2 星' }));
  expect(results().getByText('题目 easy')).toBeTruthy();
  expect(results().queryByText('题目 hard')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重置筛选' }));
  fireEvent.click(screen.getByRole('button', { name: '校园' }));
  expect(results().getByText('题目 hard')).toBeTruthy();
  expect(results().queryByText('题目 easy')).toBeNull();
});
it('收藏本地持久化，取消收藏会更新已收藏题单', async () => {
  view(); await loaded();
  fireEvent.click(screen.getByRole('button', { name: '收藏：题目 easy' }));
  expect(JSON.parse(localStorage.getItem('turtle:library-bookmarks')!)).toEqual(['easy']);
  fireEvent.click(screen.getByRole('checkbox', { name: '只看已收藏' }));
  expect(results().getByText('题目 easy')).toBeTruthy();
  expect(results().queryByText('题目 medium')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '取消收藏：题目 easy' }));
  expect(results().getByText('未找到题目')).toBeTruthy();
});
it('汤面详情不显示汤底或未公开提示，可直接选择开房', async () => {
  const onChoose = vi.fn();
  view(onChoose); await loaded();
  fireEvent.click(results().getAllByRole('button', { name: '查看详情' })[0]);
  await screen.findByText('完整公开汤面');
  expect(document.body.textContent).not.toContain('绝不显示的秘密');
  expect(document.body.textContent).not.toContain('未公开提示');
  fireEvent.click(screen.getByRole('button', { name: '用这题开房' }));
  expect(onChoose).toHaveBeenCalledWith('easy');
});
it('加载失败可重试，空列表有明确空状态', async () => {
  fake.puzzles.mockRejectedValueOnce(Error('暂时断网')).mockResolvedValue([]);
  view();
  await screen.findByText('暂时断网');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('未找到题目');
});
it('增量展示卡片而非丢掉筛选范围外的题目', async () => {
  fake.puzzles.mockResolvedValue(Array.from({ length: 15 }, (_, i) => puzzle(`${i}`)));
  view(); await screen.findByText('找到 15 道题目');
  expect(results().getAllByRole('button', { name: '开始挑战' })).toHaveLength(12);
  fireEvent.click(screen.getByRole('button', { name: /加载更多故事/ }));
  expect(results().getAllByRole('button', { name: '开始挑战' })).toHaveLength(15);
});
it('Next 入口填写昵称后创建房间并保留自动选题参数', async () => {
  render(<CandyProvider><LibraryPage /></CandyProvider>); await loaded();
  fireEvent.click(results().getAllByRole('button', { name: '开始挑战' })[0]);
  fireEvent.change(screen.getByRole('textbox', { name: '侦探昵称' }), { target: { value: '小侦探' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '开始挑战' }));
  await waitFor(() => expect(fake.createRoom).toHaveBeenCalledWith({ name: '小侦探', playerKey: expect.any(String) }));
  await waitFor(() => expect(fake.push).toHaveBeenCalledWith('/room/ABC234?start=easy'));
});
