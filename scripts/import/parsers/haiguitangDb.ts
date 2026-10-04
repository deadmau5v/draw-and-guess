import type { DatabaseSync } from 'node:sqlite';
import type { RawPuzzle } from '../normalize.js';
function quote(name: string): string { return `"${name.replace(/"/g, '""')}"`; }
export function parseHaiguitangDb(db: DatabaseSync): RawPuzzle[] {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const result: RawPuzzle[] = [];
  const structures: string[] = [];
  for (const table of tables) {
    const name = String(table.name);
    const columns = db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(row => String(row.name));
    structures.push(`${name}: ${columns.join(', ')}`);
    const pick = (candidates: string[]) => candidates.map(candidate => columns.find(column => column.toLowerCase() === candidate)).find(Boolean);
    const surface = pick(['content','surface','question','story','description']);
    const bottom = pick(['answer','bottom','truth','solution']);
    if (!surface || !bottom) continue;
    const title = pick(['title','name']);
    const id = pick(['id']);
    for (const row of db.prepare(`SELECT * FROM ${quote(name)}`).all()) result.push({id: id ? row[id] : undefined, title: title ? row[title] : undefined, surface: row[surface], bottom: row[bottom]});
  }
  if (!result.length) throw new Error(`haiguitang 未探测到题目列；表结构：\n${structures.join('\n')}`);
  return result;
}
