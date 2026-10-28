// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CandyProvider } from 'candy-ui';
import type { PuzzleSummary } from '../../shared/protocol';
const fake = vi.hoisted(() => ({ puzzles: vi.fn(), createRoom: vi.fn(), push: vi.fn() }));
vi.mock('../../web/src/api', () => ({ api: fake }));
vi.mock('../../app/gameNavigation', () => ({ useGameRouter: () => ({ push: fake.push }) }));
import { LibraryBrowser } from '../../web/src/LibraryBrowser';
import LibraryPage from '../../app/library/page';
import { difficultyLabel, matchesCategory, matchesDifficulty, puzzleCover } from '../../web/src/library';

const puzzle = (id: string, tags = ['动物'], difficulty: number | null = 2): PuzzleSummary => ({
  id, title: `词组 ${id}`, surfacePreview: '不应展示的旧提示', difficulty, tags, nsfl: false,
  hintCount: 3, goodRate: null, tier: 'none', funny: 0, ratings: 0, plays: 0, solves: 0, sourceKey: 'test',
});
const items = [puzzle('animals'), puzzle('food', ['食物']), puzzle('plants', ['水果']), puzzle('unknown', [], null)];
const view = (onChoose = vi.fn()) => render(<CandyProvider><LibraryBrowser onChoose={onChoose} onBack={() => {}} /></CandyProvider>);
const results = () => within(screen.getByRole('region', { name: '词组列表' }));
const loaded = async () => { await screen.findByText(`共 ${items.length} 组词`); };
beforeEach(() => {
  fake.puzzles.mockReset().mockResolvedValue(items);
  fake.createRoom.mockReset().mockResolvedValue({ code: 'ABC234' });
  fake.push.mockReset(); localStorage.clear();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('分类依据词组标签，不沿用旧故事分类，未标注难度不编造', () => {
  expect(matchesCategory(items[0], 'animal')).toBe(true);
  expect(matchesCategory(items[1], 'food')).toBe(true);
  expect(matchesCategory(items[2], 'plant')).toBe(true);
  expect(matchesCategory(puzzle('悬疑', ['恐怖']), 'food')).toBe(false);
  expect(matchesDifficulty(items[3], 'hard')).toBe(false);
  expect(matchesDifficulty(items[3], 'unknown')).toBe(true);
  expect(difficultyLabel(items[3])).toBe('未标注');
  expect(puzzleCover({ title: '萌趣动物', surfacePreview: '' })).toBe('/assets/puzzle-covers/animal.webp');
});
it('以分类词组卡片浏览，搜索只匹配词组和分类，无旧提示或审查控件', async () => {
  view(); await loaded();
  expect(fake.puzzles).toHaveBeenCalledWith(expect.objectContaining({ excludeNsfl: true, limit: 200 }), expect.any(AbortSignal));
  expect(document.body.textContent).not.toMatch(/提示|重口|好评|NSFL|提问|接近|海龟汤/);
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '食物' }));
  expect(results().getByText('词组 food')).toBeTruthy();
  expect(results().queryByText('词组 animals')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '全部' }));
  fireEvent.change(screen.getByRole('textbox', { name: '搜索词组' }), { target: { value: 'plants' } });
  expect(results().getByText('词组 plants')).toBeTruthy();
  expect(results().queryByText('词组 animals')).toBeNull();
});
it('选择词组直接开房，不加载答案详情', async () => {
  const onChoose = vi.fn(); view(onChoose); await loaded();
  fireEvent.click(results().getAllByRole('button', { name: '用这组词开房' })[0]);
  expect(onChoose).toHaveBeenCalledWith('animals');
});
it('加载失败可重试，空列表有明确空状态', async () => {
  fake.puzzles.mockRejectedValueOnce(Error('暂时断网')).mockResolvedValue([]); view();
  await screen.findByText('暂时断网'); fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('未找到词组');
});
it('分页展示所有加载到的词组', async () => {
  fake.puzzles.mockResolvedValue(Array.from({ length: 15 }, (_, i) => puzzle(`${i}`)));
  view(); await screen.findByText('共 15 组词');
  expect(results().getAllByRole('button', { name: '用这组词开房' })).toHaveLength(12);
  fireEvent.click(screen.getByRole('button', { name: '加载更多词组' }));
  expect(results().getAllByRole('button', { name: '用这组词开房' })).toHaveLength(15);
});
it('Next 入口填写昵称后创建房间并保留选词组参数', async () => {
  render(<CandyProvider><LibraryPage /></CandyProvider>); await loaded();
  fireEvent.click(results().getAllByRole('button', { name: '用这组词开房' })[0]);
  fireEvent.change(screen.getByRole('textbox', { name: '你的昵称' }), { target: { value: '小画家' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '创建房间' }));
  await waitFor(() => expect(fake.createRoom).toHaveBeenCalledWith({ name: '小画家', playerKey: expect.any(String) }));
  await waitFor(() => expect(fake.push).toHaveBeenCalledWith('/room/ABC234?start=animals'));
});
