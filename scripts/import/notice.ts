import type { PuzzleSource, SeedPuzzle } from '../../shared/protocol.js';
function cell(value: string): string { return value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
export function renderNotice(puzzles: readonly SeedPuzzle[], sources: readonly PuzzleSource[]): string {
  const lines = ['# 题库来源与许可证', '', '题目版权归原作者；程序许可证不等于故事授权；仅供学习与私用', '', '合并版本同时列入原来源分组；id 为保留版本的最终 id。', ''];
  for (const source of sources) {
    lines.push(`## ${source.key}`, '', '标题｜id｜仓库 URL｜许可证', '', '| 标题 | id | 仓库 URL | 许可证 |', '| --- | --- | --- | --- |');
    for (const puzzle of puzzles) if (puzzle.source.key === source.key || puzzle.alsoIn.includes(source.key)) lines.push(`| ${cell(puzzle.title)} | ${cell(puzzle.id)} | ${source.repo} | ${source.license} |`);
    lines.push('');
  }
  return lines.join('\n');
}
