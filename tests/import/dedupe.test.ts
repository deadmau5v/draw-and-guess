import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SeedPuzzle } from '../../shared/protocol.js';
import { dedupePuzzles, normalizeText, bigramJaccard } from '../../scripts/import/dedupe.js';
import { normalizePuzzle } from '../../scripts/import/normalize.js';
import { parseAnchorTxt } from '../../scripts/import/parsers/anchorTxt.js';
import { parseZeroTangJson } from '../../scripts/import/parsers/zeroTangJson.js';
import { SOURCES } from '../../scripts/import/sources.js';

const puzzle = (key:string, title:string, surface:string, bottom='真相', hints:string[]=[], license='AGPL-3.0') => normalizePuzzle({id:title,title,surface,bottom,hints}, {key,repo:key,url:key,license}, 1);
const snapshots = SOURCES.filter(s => s.key === 'anchor' || s.key === 'zerotang').flatMap(source => {
 const text = readFileSync(new URL(`../../data/sources/${source.key}.${source.ext}`, import.meta.url), 'utf8');
 const rows = source.key === 'anchor' ? parseAnchorTxt(text) : parseZeroTangJson(text);
 const {key,repo,url,license}=source;
 return rows.map((row, i) => normalizePuzzle(row, {key,repo,url,license}, i + 1));
});
const real = (id:string) => { const p=snapshots.find(p=>p.id===id); if(!p) throw Error(`缺少真实快照题目 ${id}`); return p; };
const gun='一个男人走进酒吧向酒保要一杯水，酒保却掏出枪指着他，男人说了声谢谢就离开了';

describe('去重', () => {
 it('酒吧的枪与酒保的枪合并，优先有提示的 zerotang', () => {
  const a=real('anchor-004'), b=real('zerotang-seed-classic-bar-hiccups');
  expect(bigramJaccard(a.surface,b.surface)).toBeLessThan(0.6);
  expect(dedupePuzzles([a,b])).toEqual([{...b,alsoIn:['anchor']}]);
 });
 it('半根火柴的真实两个版本合并', () => {
  const a=real('anchor-012'), b=real('zerotang-seed-classic-short-match');
  expect(bigramJaccard(a.surface,b.surface)).toBeLessThan(0.6);
  expect(bigramJaccard(a.bottom,b.bottom)).toBeLessThan(0.5);
  expect(dedupePuzzles([a,b])).toEqual([{...b,alsoIn:['anchor']}]);
 });
 it('真实一巴掌与酒吧的枪不合并', () => {
  expect(dedupePuzzles([real('anchor-006'),real('anchor-004'),real('zerotang-seed-classic-bar-hiccups')])).toEqual([
   real('anchor-006'), {...real('zerotang-seed-classic-bar-hiccups'),alsoIn:['anchor']},
  ]);
 });
 it.each(['anchor-004','anchor-012'])('经典标题 %s 不应合并无核心因果的另一个故事',id=>{
  const a=real(id), b={...a,id:'other-1',surface:'邮递员今天没有出门',bottom:'桥梁维修导致道路封闭',source:{...a.source,key:'other'}};
  expect(dedupePuzzles([a,b])).toHaveLength(2);
 });
 it('经典题无提示时按许可证宽松度保留',()=>{
  const a={...real('anchor-012'),source:{...real('anchor-012').source,license:'MIT'}};
  const b={...real('zerotang-seed-classic-short-match'),hints:[]};
  expect(dedupePuzzles([a,b])).toEqual([{...a,alsoIn:['zerotang']}]);
 });
 it('许可相同时优先更长汤底，不丢失已有合并来源且不修改输入',()=>{
  const a={...puzzle('anchor','短',gun,'打嗝'),alsoIn:['deepturtle']};
  const b=puzzle('anchor','长',gun,'打嗝被惊吓治好，男人感谢酒保');
  const copy=JSON.stringify([a,b]);
  expect(dedupePuzzles([a,b])).toEqual([{...b,alsoIn:['deepturtle']}]);
  expect(JSON.stringify([a,b])).toBe(copy);
 });
 it('去标点空白转小写，按字符 bigram 集合计算 Jaccard', () => {
  expect(normalizeText(' A，B!　 c ')).toBe('abc');
  expect(bigramJaccard('abcd','abce')).toBe(0.5);
  expect(bigramJaccard('','')).toBe(0);
 });
 it('真实生成题库与来源声明包含合并后的经典题',()=>{
  const generated:SeedPuzzle[]=JSON.parse(readFileSync(new URL('../../data/puzzles.json',import.meta.url),'utf8'));
  const notice=readFileSync(new URL('../../NOTICE-puzzles.md',import.meta.url),'utf8');
  for(const [removed,winner] of [['anchor-004','zerotang-seed-classic-bar-hiccups'],['anchor-012','zerotang-seed-classic-short-match']]) {
   expect(generated.some(p=>p.id===removed)).toBe(false);
   expect(generated.find(p=>p.id===winner)).toMatchObject({id:winner,surface:real(winner).surface,alsoIn:['anchor']});
   expect(notice.split(`| ${winner} |`)).toHaveLength(3);
  }
  expect(generated.length).toBeGreaterThanOrEqual(60);
 });
});
