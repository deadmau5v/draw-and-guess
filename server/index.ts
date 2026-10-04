import { loadConfig } from './config.js';
import { openDb, seedIfEmpty, loadSeedFile } from './db.js';
import { PuzzleRepo } from './puzzles/repo.js';
import { createJevJudge } from './jev/judge.js';
import { RoomManager } from './rooms/roomManager.js';
import { createApp } from './app.js';
// pnpm start 同时托管已构建的前端；开发代理不受影响。
process.env.NODE_ENV ??= 'production';
const config=loadConfig();
const db=openDb(config.dbPath);
seedIfEmpty(db,loadSeedFile());
const repo=new PuzzleRepo(db);
const rooms=new RoomManager();
const judge=createJevJudge(config,db);
const app=createApp({config,db,repo,rooms,judge});
const sweep=setInterval(()=>{
 const result=rooms.sweep(Date.now());
 if(result.ok) {
  result.value.changed.forEach(app.broadcast);
  for(const code of result.value.destroyed) app.io.in(code).socketsLeave(code);
 }
},15000);
sweep.unref();
app.httpServer.listen(config.port,()=>{
 console.log(`海龟汤已启动：http://localhost:${config.port} · 题库 ${repo.count()} 题 · 模型 ${config.model} · key ${config.judgeConfigured?'已配置':'未配置'}`);
 if(!config.judgeConfigured) console.warn('⚠⚠⚠ 未配置判题 key：游戏可正常开房，AI 判题会返回「出错」。');
});
let stopping=false;
async function stop():Promise<void> {if(stopping) return;stopping=true;clearInterval(sweep);await app.close();}
process.once('SIGINT',()=>{void stop();});
process.once('SIGTERM',()=>{void stop();});
app.httpServer.once('error',error=>{console.error('启动失败：',error.message);process.exitCode=1;void stop();});
