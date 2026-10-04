import { expect, it } from 'vitest';
import { parseAnchorTxt } from '../../scripts/import/parsers/anchorTxt.js';
it('跳过注释并拼接多行字段，保留缺标题题目', () => {
 expect(parseAnchorTxt('# 注释头\nID: 1\n标题: 枪\n汤面: 第一行\n第二行\n# 注释\n汤底: 原因\n续写\n难度: 2\n标签: 经典，短篇\n---\n汤面: 没标题\n汤底: 真相')).toEqual([{id:'1', title:'枪',surface:'第一行\n第二行',bottom:'原因\n续写',difficulty:'2',tags:'经典，短篇'}, {surface:'没标题',bottom:'真相'}]);
});
