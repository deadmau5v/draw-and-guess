import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/d5v/Desktop/CandyUI/package.json');
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
mkdirSync('artifacts/game-experience', { recursive: true });
try {
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.locator('.game-loading-overlay').waitFor({ state: 'hidden' });
  const behavior = await page.evaluate(() => {
    const title = document.querySelector('main');
    const input = document.querySelector('input');
    const events = target => ['contextmenu', 'dragstart', 'selectstart'].map(type => target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })));
    return { main: events(title), input: events(input), selection: getComputedStyle(title).userSelect, cursor: getComputedStyle(document.body).cursor, drag: getComputedStyle(document.querySelector('img')).webkitUserDrag };
  });
  if (behavior.main.some(Boolean) || behavior.input.some(value => !value) || behavior.selection !== 'none' || behavior.drag !== 'none' || !behavior.cursor.includes('default.png')) throw Error(JSON.stringify(behavior));
  const input = page.getByLabel('你的昵称', { exact: true });
  await input.fill('输入与复制测试');
  await input.press('Control+a');
  const selected = await input.evaluate(el => el.selectionEnd - el.selectionStart);
  if (selected !== '输入与复制测试'.length) throw Error('Input selection blocked');
  const button = page.getByRole('button', { name: '系统通知', exact: true });
  await button.hover();
  if (!(await button.evaluate(el => getComputedStyle(el).cursor)).includes('pointer.png')) throw Error('Hover cursor missing');
  await page.mouse.down();
  if (!(await button.evaluate(el => getComputedStyle(el).cursor)).includes('pressed.png')) throw Error('Pressed cursor missing');
  await page.mouse.up();
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  await page.route('**/api/puzzles?*', async route => { await blocked; await route.continue(); });
  await page.getByRole('button', { name: '题库', exact: true }).click();
  await page.waitForURL('**/library');
  await page.locator('.game-loading-overlay').waitFor();
  if (!(await page.locator('.game-experience').getAttribute('inert') !== null)) throw Error('Underlying UI not blocked');
  await page.screenshot({ path: 'artifacts/game-experience/loading.png' });
  release();
  await page.locator('.game-loading-overlay').waitFor({ state: 'hidden' });
  await page.getByRole('heading', { name: '题库大厅' }).waitFor();
  await page.unroute('**/api/puzzles?*');
  await page.goto('http://localhost:3001/room/V76VDB');
  await page.locator('main [role=alert]').filter({ hasText: '房间不存在' }).waitFor();
  await page.locator('.game-loading-overlay').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.waitForURL('http://localhost:3001/');
  await page.locator('.game-loading-overlay').waitFor({ state: 'hidden' });
  for (const name of ['default', 'pointer', 'pressed']) {
    const response = await page.request.get(`http://localhost:3001/assets/cursors/${name}.png`);
    if (!response.ok()) throw Error(`Missing cursor: ${name}`);
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log('加载遮罩、路由切换、失败收尾、输入编辑、禁用浏览器页面交互和三态指针：通过');
} finally { await browser.close(); }
