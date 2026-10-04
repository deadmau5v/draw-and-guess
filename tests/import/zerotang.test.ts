import { expect, it } from 'vitest';
import { parseZeroTangJson } from '../../scripts/import/parsers/zeroTangJson.js';
it('把 JSON story/answer/hints 映射为标准原始题目', () => {
 expect(parseZeroTangJson(JSON.stringify([{id:1,title:'酒保的枪',story:'汤面',answer:'打嗝',hints:['水']}]))).toEqual([{id:1,title:'酒保的枪',surface:'汤面',bottom:'打嗝',hints:['水']}]);
});
