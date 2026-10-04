import { pathToFileURL } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { loadConfig, type Config } from '../server/config.js';
import { openDb, seedIfEmpty, loadSeedFile } from '../server/db.js';
import { PuzzleRepo } from '../server/puzzles/repo.js';
import { createJevJudge } from '../server/jev/judge.js';
import type { PuzzleSecret } from '../shared/protocol.js';
const fallback:PuzzleSecret={id:'zerotang-smoke-bar',title:'酒保的枪',surface:'一个人走进酒吧，要了一杯水。酒保突然拿枪对准他，他却道谢离开了。',bottom:'这个人正在打嗝，要水是为了止嗝。酒保用枪吓他，惊吓让他停止打嗝，所以他道谢离开。',hints:['他需要止住打嗝。'],difficulty:null,tags:[],nsfl:false,hintCount:1,goodRate:null,tier:'none',funny:0,ratings:0,plays:0,solves:0,sourceKey:'zerotang',source:{key:'zerotang',repo:'ZeroTang05/Situation-Puzzle',url:'',license:'GPL-3.0'}};
export async function runSmoke(config:Config,db:DatabaseSync,fetchImpl?:typeof fetch,print:(...args:unknown[])=>void=console.log):Promise<void> {
 if(!config.judgeConfigured||!config.apiKey) {print('未配置 OPENROUTER_API_KEY，跳过 Jev 冒烟测试。');return;}
 const repo=new PuzzleRepo(db);const match=repo.list({q:'酒保的枪',limit:200}).find(p=>p.sourceKey==='zerotang');
 const puzzle=match?repo.getSecret(match.id)!:fallback;const judge=createJevJudge(config,db,fetchImpl);
 for(const q of ['他正在打嗝吗？','酒保想杀死他吗？','他是为了止嗝才要水吗？']) print(q,await judge.judgeQuestion(puzzle,q));
 print('还原真相',await judge.judgeSolution(puzzle,'他正在打嗝，要水是为了止嗝。酒保用枪吓他，让他停止打嗝，因此他道谢离开。'));
 print('本次成本',judge.totalCost());
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) {
 const config=loadConfig();
 if(!config.judgeConfigured) console.log('未配置 OPENROUTER_API_KEY，跳过 Jev 冒烟测试。');
 else {const db=openDb(config.dbPath);try {seedIfEmpty(db,loadSeedFile());await runSmoke(config,db);}finally{db.close();}}
}
