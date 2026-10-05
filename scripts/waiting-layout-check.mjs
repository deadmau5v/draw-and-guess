import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/d5v/Desktop/CandyUI/package.json');
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
mkdirSync('artifacts/waiting-room', { recursive: true });
const host = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
host.on('pageerror', e => errors.push(e.message));
try {
 await host.goto('http://localhost:3001', { waitUntil: 'networkidle' });
 await host.getByLabel('你的昵称', { exact: true }).fill('布局测试房主');
 await host.getByLabel('创建房间 →', { exact: true }).click();
 await host.waitForURL(/\/room\/[A-Z0-9]{6}/);
 await host.getByRole('button', { name: '开始游戏', exact: true }).waitFor();
 await host.waitForLoadState('networkidle');
 await host.waitForFunction(() => !document.querySelector('.waiting-actions button').disabled);
 const roomUrl = host.url();
 for (const [width, height] of [[1440,900],[1440,720],[1280,600],[390,844]]) {
  await host.setViewportSize({width,height});
  await host.screenshot({path:`artifacts/waiting-room/${width}x${height}.png`,fullPage:true});
  const result = await host.evaluate(() => {
   const actions = document.querySelector('.waiting-actions').getBoundingClientRect();
   const board = document.querySelector('.waiting-board').getBoundingClientRect();
   return { horizontal: document.documentElement.scrollWidth > innerWidth, vertical: document.documentElement.scrollHeight > innerHeight, actionsBottom: actions.bottom, boardBottom: board.bottom, height: innerHeight };
  });
  console.log(JSON.stringify({width,height,...result}));
  if(result.horizontal || width > 800 && (result.vertical || result.actionsBottom > result.boardBottom)) throw new Error('Waiting layout overflow');
 }
 await host.setViewportSize({width:1440,height:900});
 const guest = await browser.newPage();
 await guest.goto('http://localhost:3001', {waitUntil:'networkidle'});
 await guest.getByLabel('你的昵称', {exact:true}).fill('布局测试客人');
 await guest.getByRole('button', {name:/房间大厅/}).click();
 await guest.getByRole('button', {name:`加入房间 ${roomUrl.split('/').pop()}`,exact:true}).click();
 await guest.waitForURL(roomUrl);
 await guest.getByText('等待房主选题',{exact:true}).waitFor();
 if(!await guest.locator('#waiting-quota').isDisabled()) throw new Error('Guest settings enabled');
 await host.locator('#waiting-quota').fill('9');
 await host.locator('#waiting-quota').blur();
 await guest.waitForFunction(()=>document.querySelector('#waiting-quota').value==='9');
 await host.getByRole('button', {name:/暖心反转/}).click();
 await host.waitForFunction(()=>!document.querySelector('.waiting-actions button').disabled);
 await host.getByRole('button',{name:'开始游戏',exact:true}).click();
 await host.waitForFunction(()=>!document.querySelector('.waiting-board'));
 await guest.waitForFunction(()=>!document.querySelector('.waiting-board'));
 if(errors.length) throw new Error(errors.join(';'));
 console.log('Waiting layout, lobby join, host/guest settings and theme start passed');
 await guest.close();
} catch(e) { await host.screenshot({path:'artifacts/waiting-room/failure.png',fullPage:true}); throw e; }
finally {await browser.close();}
