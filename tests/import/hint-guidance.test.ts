import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('接连死去的哥哥的提示逐层引导，不直接说出动机或行凶手法', () => {
 const puzzles=JSON.parse(readFileSync(new URL('../../data/puzzles.json',import.meta.url),'utf8'));
 const puzzle=puzzles.find((p:{id:string})=>p.id==='haiguitang-14');
 expect(puzzle.hints).toEqual([
  '杀人的动机，与一个长期形成的生活习惯有关。',
  '二哥去世后，有个每天都会遇到的变化让弟弟很难适应。',
  '留意他们原先睡觉时的位置，以及弟弟希望恢复的状态。',
 ]);
 expect(puzzle.hints.join('')).not.toMatch(/强迫症|对称|肢解|砍成|两半|双胞胎/);
 expect(puzzle.hints.every((hint:string)=>hint.length<=35)).toBe(true);
});
