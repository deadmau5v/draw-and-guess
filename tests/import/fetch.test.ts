import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchSource } from '../../scripts/import/fetch.js';
const source = {key:'test',url:'https://example.invalid/puzzles',repo:'repo',license:'MIT',ext:'txt'};
const directories: string[] = [];
afterEach(async()=>{
 vi.unstubAllGlobals();vi.restoreAllMocks();
 for(const dir of directories.splice(0)) if(dir.startsWith(path.resolve('tests/import/fetch-'))) await rm(dir,{recursive:true,force:true});
});
it('下载失败使用快照；缺快照时跳过并警告', async()=>{
 const dir=await mkdtemp(path.resolve('tests/import/fetch-')); directories.push(dir);
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 await writeFile(path.join(dir,'test.txt'),'旧快照');
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('断网');}));
 expect(await fetchSource(source,dir)).toBe(path.join(dir,'test.txt'));
 expect(await readFile(path.join(dir,'test.txt'),'utf8')).toBe('旧快照');
 expect(await fetchSource({...source,key:'missing'},dir)).toBeNull();
 expect(warn).toHaveBeenCalled();
});
it('二进制 db 通过 arrayBuffer 无损保存',async()=>{
 const dir=await mkdtemp(path.resolve('tests/import/fetch-')); directories.push(dir);
 const bytes=new Uint8Array([0,255,128,13,10]);
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes)));
 const filename=await fetchSource({...source,ext:'db'},dir);
 expect(await readFile(filename!)).toEqual(Buffer.from(bytes));
});
it('全局 fetch 成功保存原始内容并设置超时信号', async () => {
 const dir=await mkdtemp(path.resolve('tests/import/fetch-')); directories.push(dir);
 const timeout=vi.spyOn(AbortSignal,'timeout');
 const fake=vi.fn(async()=>new Response('原始文本')); vi.stubGlobal('fetch',fake);
 expect(await fetchSource(source,dir)).toBe(path.join(dir,'test.txt'));
 expect(await readFile(path.join(dir,'test.txt'),'utf8')).toBe('原始文本');
 expect(fake.mock.calls[0]).toEqual([source.url,{signal:expect.any(AbortSignal)}]);
 expect(timeout).toHaveBeenCalledWith(15_000);
});
