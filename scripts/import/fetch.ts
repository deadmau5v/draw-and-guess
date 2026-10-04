import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PuzzleSource } from '../../shared/protocol.js';
export type ImportSource = PuzzleSource & { ext: string };
export async function fetchSource(source: ImportSource, directory: string): Promise<string | null> {
  const filename = path.join(directory, `${source.key}.${source.ext}`);
  try {
    const response = await fetch(source.url, {signal: AbortSignal.timeout(15_000)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = source.ext === 'db' ? Buffer.from(await response.arrayBuffer()) : await response.text();
    await mkdir(directory, {recursive:true});
    await writeFile(filename, body);
    return filename;
  } catch (error) {
    console.warn(`[${source.key}] 下载失败：${error instanceof Error ? error.message : String(error)}`);
    try { await access(filename); console.warn(`[${source.key}] 使用已有快照`); return filename; }
    catch { console.warn(`[${source.key}] 无快照，跳过`); return null; }
  }
}
