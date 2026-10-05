import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/d5v/Desktop/CandyUI/package.json');
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
mkdirSync('artifacts/playing-room', {recursive:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
 await page.goto('http://localhost:3001',{waitUntil:'networkidle'});
 await page.getByLabel('你的昵称',{exact:true}).fill('游戏布局测试');
 await page.getByLabel('创建房间 →',{exact:true}).click();
 await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
 await page.waitForFunction(()=>document.querySelector('.waiting-actions button') && !document.querySelector('.waiting-actions button').disabled);
 await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 await page.locator('.playing-board').waitFor();
 await page.waitForLoadState('networkidle');
 for(const [width,height] of [[1440,900],[1440,720],[1280,600],[390,844]]) {
  await page.setViewportSize({width,height});
  await page.screenshot({path:`artifacts/playing-room/${width}x${height}.png`,fullPage:true});
  const result=await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth>innerWidth,vertical:document.documentElement.scrollHeight>innerHeight, boardBottom:document.querySelector('.playing-board').getBoundingClientRect().bottom, maxBottom:Math.max(...[...document.querySelectorAll('.playing-left-actions,.playing-composer,.playing-objective')].map(el=>el.getBoundingClientRect().bottom))}));
  console.log(JSON.stringify({width,height,...result}));
  if(result.horizontal || width>1100 && (result.vertical || result.maxBottom>result.boardBottom)) { console.log(await page.evaluate(()=>[...document.querySelectorAll('.playing-center > *, .playing-right > *, .playing-ribbon-slot, .playing-ribbon')].map(el=>({cls:el.className,height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top,css:getComputedStyle(el).height})))); throw new Error('Playing layout overflow'); }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:/已排除/}).click();
 if(await page.getByRole('button',{name:/已排除/}).getAttribute('aria-pressed')!=='true') throw new Error('Clue tab failed');
 await page.getByRole('button',{name:'提交真相',exact:true}).click();
 await page.getByLabel('你的故事还原').waitFor();
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await page.getByRole('button',{name:'提前揭晓',exact:true}).click();
 await page.getByRole('button',{name:'确认揭晓',exact:true}).click();
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'查看汤底与评价',exact:true}).waitFor();
 await page.getByRole('button',{name:'下一题',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.playing-info').textContent.includes('第 2 局'));
 if(errors.length) throw new Error(errors.join(';'));
 console.log('Playing layout, clue tabs, guess modal, reveal and next round passed');
}catch(e){await page.screenshot({path:'artifacts/playing-room/failure.png',fullPage:true});throw e;}
finally{await browser.close();}
