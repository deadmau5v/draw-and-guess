import type { RawPuzzle } from '../normalize.js';
const fields: Record<string, keyof RawPuzzle> = { ID: 'id', 标题: 'title', 汤面: 'surface', 汤底: 'bottom', 难度: 'difficulty', 标签: 'tags' };
export function parseAnchorTxt(text: string): RawPuzzle[] {
  return text.replace(/\r\n/g, '\n').split(/\n---\n/).map(block => {
    const raw: RawPuzzle = {};
    let previous: keyof RawPuzzle | undefined;
    for (const line of block.split('\n')) {
      if (line.trimStart().startsWith('#')) continue;
      const match = /^(ID|标题|汤面|汤底|难度|标签):\s*(.*)$/.exec(line);
      if (match) { previous = fields[match[1]]; raw[previous] = match[2]; }
      else if (previous && line.trim()) raw[previous] = `${raw[previous]}\n${line}`;
    }
    return raw;
  }).filter(raw => raw.surface && raw.bottom);
}
