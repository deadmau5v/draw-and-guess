import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
test('实际入口加载种子，缺 key 仍可启动并响应健康检查',async()=>{
 const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const address=probe.address();if(!address||typeof address==='string') throw Error('端口不存在');await new Promise<void>(r=>probe.close(()=>r()));
 const dir=mkdtempSync(join(tmpdir(),'turtle-e2e-'));
 const child=spawn(process.execPath,['--import','./scripts/register-ts.mjs','server/index.ts'],{cwd:process.cwd(),env:{...process.env,PORT:String(address.port),DB_PATH:join(dir,'test.db'),OPENROUTER_API_KEY:'',NODE_ENV:'production'},stdio:'ignore'});
 let exit:number|null|undefined;child.once('exit',code=>{exit=code;});
 try {
  let health:Record<string,unknown>|undefined;
  const end=Date.now()+4000;
  while(Date.now()<end&&!health&&exit===undefined) {
   try {const response=await fetch(`http://127.0.0.1:${address.port}/api/health`,{signal:AbortSignal.timeout(300)});if(response.ok) health=await response.json();} catch { /* 等待监听。 */ }
   if(!health) await new Promise(r=>setTimeout(r,50));
  }
  expect(exit).toBeUndefined();expect(health).toMatchObject({ok:true,judgeConfigured:false});expect(Number(health?.puzzles)).toBeGreaterThan(0);
  if(existsSync('dist/web/index.html')) {const page=await fetch(`http://127.0.0.1:${address.port}/room/ABCDEF`);expect(page.status).toBe(200);expect(await page.text()).toContain('<div id="root">');}
 } finally {
  if(exit===undefined) {child.kill();await new Promise<void>(r=>child.once('exit',()=>r()));}
  rmSync(dir,{recursive:true,force:true});
 }
},8000);
