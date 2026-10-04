import { it, expect } from 'vitest';
import { Lru } from '../../server/util/lru.js';
it('访问更新顺序并淘汰最旧项',()=>{const l=new Lru<string,number>(2); l.set('a',1); l.set('b',2); expect(l.get('a')).toBe(1); l.set('c',3); expect(l.get('b')).toBeUndefined(); l.set('a',4); expect(l.get('a')).toBe(4); expect(()=>new Lru(0)).toThrow();});
