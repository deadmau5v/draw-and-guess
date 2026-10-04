import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import type { SeedPuzzle } from '../../shared/protocol.js';
import { SOURCES } from './sources.js';
import { fetchSource } from './fetch.js';
import { normalizePuzzle, type RawPuzzle } from './normalize.js';
import { dedupePuzzles } from './dedupe.js';
import { renderNotice } from './notice.js';
import { parseAnchorTxt } from './parsers/anchorTxt.js';
import { parseZeroTangJson } from './parsers/zeroTangJson.js';
import { parseHaiguitangDb } from './parsers/haiguitangDb.js';
import { parseDeepTurtle } from './parsers/deepTurtle.js';
export interface ImportStats { sources: Record<string, number>; merged: number; total: number; nsfl: number }
export async function importPuzzles(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')): Promise<ImportStats> {
  const directory = path.join(root, 'data/sources');
  const puzzles: SeedPuzzle[] = [];
  const counts: Record<string, number> = {};
  for (const config of SOURCES) {
    counts[config.key] = 0;
    try {
      let filename: string | null = null;
      if (config.key === 'deepturtle') {
        for (const ext of ['jsonl','json']) {
          const candidate = path.join(directory, `deepturtle.${ext}`);
          try { await access(candidate); filename = candidate; break; } catch { /* 尝试下一种格式 */ }
        }
        if (!filename) console.warn('[deepturtle] 本地文件不存在，跳过');
      } else filename = await fetchSource(config, directory);
      if (!filename) continue;
      let rows: RawPuzzle[];
      if (config.key === 'haiguitang') {
        const db = new DatabaseSync(filename, {readOnly:true});
        try { rows = parseHaiguitangDb(db); } finally { db.close(); }
      } else {
        const text = await readFile(filename, 'utf8');
        rows = config.key === 'anchor' ? parseAnchorTxt(text) : config.key === 'zerotang' ? parseZeroTangJson(text) : parseDeepTurtle(text);
      }
      const {key,repo,url,license} = config;
      const ids = new Set<string>();
      rows.forEach((row, index) => {
        const puzzle = normalizePuzzle(row, {key,repo,url,license}, index + 1);
        if (!puzzle.surface || !puzzle.bottom) return;
        const base = puzzle.id;
        let suffix = index + 1;
        while (ids.has(puzzle.id)) puzzle.id = `${base}-${suffix++}`;
        ids.add(puzzle.id);
        puzzles.push(puzzle); counts[key]++;
      });
    } catch (error) { console.warn(`[${config.key}] 解析失败，跳过：${error instanceof Error ? error.message : String(error)}`); }
  }
  const output = dedupePuzzles(puzzles);
  await mkdir(path.join(root, 'data'), {recursive:true});
  await writeFile(path.join(root, 'data/puzzles.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
  await writeFile(path.join(root, 'NOTICE-puzzles.md'), renderNotice(output, SOURCES), 'utf8');
  const stats: ImportStats = {sources: counts, merged: puzzles.length - output.length, total: output.length, nsfl: output.filter(p => p.nsfl).length};
  for (const [key,count] of Object.entries(counts)) console.log(`${key}：${count} 条`);
  console.log(`合并数：${stats.merged}；最终题数：${stats.total}；nsfl 题数：${stats.nsfl}`);
  return stats;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importPuzzles().catch(error => { console.error('题库写入失败：', error); process.exitCode = 1; });
}
