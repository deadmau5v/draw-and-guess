import type { ImportSource } from './fetch.js';
export const SOURCES: ImportSource[] = [
  {key:'anchor',repo:'https://github.com/anchorAnc/astrbot_plugin_TurtleSoup',url:'https://cdn.jsdelivr.net/gh/anchorAnc/astrbot_plugin_TurtleSoup@master/questions_database.txt',license:'AGPL-3.0',ext:'txt'},
  {key:'zerotang',repo:'https://github.com/ZeroTang05/Situation-Puzzle',url:'https://cdn.jsdelivr.net/gh/ZeroTang05/Situation-Puzzle@main/data/library.json',license:'GPL-3.0',ext:'json'},
  {key:'haiguitang',repo:'https://github.com/nbdhhzh/haiguitang',url:'https://cdn.jsdelivr.net/gh/nbdhhzh/haiguitang@master/haiguitang.db',license:'MIT',ext:'db'},
  {key:'deepturtle',repo:'https://huggingface.co/datasets/YuiMax/DeepTurtle',url:'data/sources/deepturtle.jsonl',license:'MIT',ext:'jsonl'},
];
