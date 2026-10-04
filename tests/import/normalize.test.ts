import { describe, expect, it } from 'vitest';
import { cleanText, normalizePuzzle } from '../../scripts/import/normalize.js';
const source = { key: 'anchor', repo: 'repo', url: 'url', license: 'AGPL-3.0' };
describe('归一化', () => {
  it('不把布尔值当作难度；保留合法 ID 并清理提示', () => {
    const result=normalizePuzzle({id:'abc-9',title:'　题目 ',surface:'面',bottom:'底',difficulty:true,hints:['　提示 ', '', '另一条'],tags:[' 普通 ']},source,1);
    expect(result.id).toBe('anchor-abc-9'); expect(result.difficulty).toBeNull(); expect(result.hints).toEqual(['提示','另一条']); expect(result.nsfl).toBe(false);
    expect(cleanText(' a　b ')).toBe('ab');
  });
  it.each([undefined,null,'abc',0,6,2.5])('非法难度 %s 归为 null',difficulty=>{
    expect(normalizePuzzle({surface:'面',bottom:'底',difficulty},source,1).difficulty).toBeNull();
  });
  it('清理文本、生成安全 ID 并推断标签和重口', () => {
    expect(normalizePuzzle({ id: '中文', surface: '　abcdefghijk　 ', bottom: ' 尸体　 ', tags: '推理，恐怖、经典,短篇', difficulty: '3' }, source, 2)).toEqual({ id: 'anchor-2', title: 'abcdefgh', surface: 'abcdefghijk', bottom: '尸体', hints: [], tags: ['推理','恐怖','经典','短篇'], difficulty: 3, nsfl: true, source, alsoIn: [] });
  });
});
