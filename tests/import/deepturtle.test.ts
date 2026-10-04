import { expect, it } from 'vitest';
import { parseDeepTurtle } from '../../scripts/import/parsers/deepTurtle.js';
it('JSONL 按 title+surface 去重而不是仅按标题去重', () => {
 const a = {id:1,title:'同题',surface:'汤面',truth:'真相'};
 expect(parseDeepTurtle([a,{...a,id:2},{...a,id:3,surface:'其他'}].map(x=>JSON.stringify(x)).join('\n'))).toEqual([{id:1,title:'同题',surface:'汤面',bottom:'真相'},{id:3,title:'同题',surface:'其他',bottom:'真相'}]);
});
