import { it, expect } from 'vitest';
import { RateLimiter } from '../../server/util/rateLimit.js';
it('只检查不消费额度，成功提交才计入间隔和分钟上限',()=>{
 let now=0;const r=new RateLimiter({now:()=>now,maxPerMinute:2});
 for(let i=0;i<21;i++) expect(r.check('a')).toBe(true);
 r.commit('a');expect(r.check('a')).toBe(false);
 now=2000;expect(r.check('a')).toBe(true);r.commit('a');
 now=4000;expect(r.check('a')).toBe(false);
 now=60000;expect(r.check('a')).toBe(true);
});
it('按 key 限制间隔和滚动分钟窗口，拒绝不消耗次数',()=>{let now=0;const r=new RateLimiter({now:()=>now,minIntervalMs:2000,maxPerMinute:2}); expect(r.allow('a')).toBe(true); expect(r.allow('a')).toBe(false); expect(r.allow('b')).toBe(true); now=2000;expect(r.allow('a')).toBe(true); now=4000;expect(r.allow('a')).toBe(false); now=60000;expect(r.allow('a')).toBe(true);});
