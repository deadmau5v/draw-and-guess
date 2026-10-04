import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { importPuzzles } from '../../scripts/import/run.js';
import type { SeedPuzzle } from '../../shared/protocol.js';
const directories: string[] = [];
afterEach(async()=>{
 vi.unstubAllGlobals();vi.restoreAllMocks();
 for(const dir of directories.splice(0)) if(dir.startsWith(path.resolve('tests/import/run-'))) await rm(dir,{recursive:true,force:true});
});
it('离线快照端到端产出 SeedPuzzle 和统计，损坏来源不阻断', async()=>{
 const root=await mkdtemp(path.resolve('tests/import/run-')); directories.push(root); const dir=path.join(root,'data/sources'); await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,'anchor.txt'),'ID: 1\n汤面: 好天气\n汤底: 晴天\n---\nID: 1\n标题: 尸体\n汤面: 深夜有人发现了一具尸体\n汤底: 谋杀');
 await writeFile(path.join(dir,'zerotang.json'),'{invalid');
 await writeFile(path.join(dir,'deepturtle.json'),JSON.stringify([{id:'d',title:'好天气',surface:'好天气',truth:'晴天'}]));
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('断网');})); vi.spyOn(console,'warn').mockImplementation(()=>{});vi.spyOn(console,'log').mockImplementation(()=>{});
 const stats=await importPuzzles(root);
 expect(stats).toEqual({sources:{anchor:2,zerotang:0,haiguitang:0,deepturtle:1},merged:1,total:2,nsfl:1});
 const output: SeedPuzzle[]=JSON.parse(await readFile(path.join(root,'data/puzzles.json'),'utf8'));
 expect(new Set(output.map(x=>x.id)).size).toBe(2); expect(output.find(x=>x.source.key==='deepturtle')?.alsoIn).toEqual(['anchor']);
 expect(await readFile(path.join(root,'NOTICE-puzzles.md'),'utf8')).toContain('仅供学习与私用');
});
