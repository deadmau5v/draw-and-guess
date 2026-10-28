import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('8道新故事符合海龟汤规范且具有现实逻辑大方向标签', () => {
  const puzzles = JSON.parse(readFileSync(new URL('../../data/puzzles.json', import.meta.url), 'utf8'));
  const newIds = [
    'custom-daily-01', 'custom-daily-02', 'custom-daily-03', 'custom-daily-04',
    'custom-suspense-01', 'custom-suspense-02', 'custom-suspense-03', 'custom-suspense-04'
  ];
  for (const id of newIds) {
    const p = puzzles.find((item: { id: string }) => item.id === id);
    expect(p, `puzzle ${id} must exist`).toBeDefined();
    expect(p.surface.length).toBeGreaterThanOrEqual(20);
    expect(p.surface.length).toBeLessThanOrEqual(100);
    expect(p.bottom.length).toBeGreaterThanOrEqual(150);
    expect(p.bottom.length).toBeLessThanOrEqual(450);
    expect(p.hints).toHaveLength(3);
    for (const h of p.hints) {
      expect(h.length).toBeGreaterThanOrEqual(12);
      expect(h.length).toBeLessThanOrEqual(40);
    }
    expect(p.tags[0]).toBe('常理');
  }
});
