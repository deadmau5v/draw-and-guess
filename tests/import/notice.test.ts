import { expect, it } from 'vitest';
import { renderNotice } from '../../scripts/import/notice.js';
import { SOURCES } from '../../scripts/import/sources.js';
import { normalizePuzzle } from '../../scripts/import/normalize.js';
it('按来源逐题归属并保留被合并来源的许可说明',()=>{
 const anchor=SOURCES.find(x=>x.key==='anchor')!; const zero=SOURCES.find(x=>x.key==='zerotang')!;
 const puzzle={...normalizePuzzle({id:'1',title:'酒保|枪',surface:'面',bottom:'底'},zero,1),alsoIn:['anchor']};
 const notice=renderNotice([puzzle],SOURCES);
 expect(notice).toContain('题目版权归原作者；程序许可证不等于故事授权；仅供学习与私用');
 expect(notice).toContain('## anchor'); expect(notice).toContain('## zerotang');
 expect(notice).toContain(anchor.repo); expect(notice).toContain('AGPL-3.0'); expect(notice).toContain('GPL-3.0');
 expect(notice.match(/zerotang-1/g)).toHaveLength(2); expect(notice).toContain('酒保\\|枪');
});
