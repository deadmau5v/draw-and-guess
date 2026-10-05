import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/d5v/Desktop/CandyUI/package.json');
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
mkdirSync('artifacts/candy-ui', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') console.log('browser console:', msg.text()); });
page.on('request', request => { if (request.url().includes('_rsc') || request.url().includes('/room/')) console.log('navigation request:', request.url()); });
page.on('requestfailed', request => console.log('failed request:', request.url(), request.failure()));
page.on('response', async response => {
  if (response.status() >= 400) console.log('error response:', response.status(), response.url());
  else if (response.url().includes('/api/rooms') || response.url().includes('_rsc') || response.url().includes('/room/')) console.log('response:', response.status(), response.url(), (await response.text().catch(() => '')).slice(0, 150));
});
try {
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.getByLabel('你的昵称', { exact: true }).fill('Candy测试侦探');
  await page.screenshot({ path: 'artifacts/candy-ui/home-desktop.png', fullPage: true });
  const audit = await page.evaluate(() => ({
    icons: document.querySelectorAll('svg.candy-game-icon').length,
    brokenImages: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src),
    nativeControls: [...document.querySelectorAll('button,input,textarea,select')].filter(el => !el.closest('[class*="candy-"]')).map(el => el.outerHTML),
    oldIconImages: document.querySelectorAll('img[src*="/assets/icons/"]').length,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  if (audit.brokenImages.length || audit.nativeControls.length || audit.oldIconImages || audit.overflow || audit.icons < 8) throw new Error(JSON.stringify(audit));
  await page.getByLabel('随机昵称', { exact: true }).click();
  await page.getByLabel('切换形象', { exact: true }).click();
  await page.getByRole('button', { name: '侦探柯基', exact: true }).click();
  await page.getByLabel('创建房间 →', { exact: true }).click();
  await page.waitForURL(/\/room\/[A-Z0-9]{6}/);
  await page.getByText('房间设置', { exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/candy-ui/room-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '离开房间', exact: true }).click();
  await page.getByRole('button', { name: '题库', exact: true }).click();
  await page.getByRole('heading', { name: '题库大厅' }).waitFor();
  await page.getByLabel('搜索题目').fill('酒');
  await page.getByRole('button', { name: /用这题开房/ }).first().waitFor();
  await page.screenshot({ path: 'artifacts/candy-ui/library-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/candy-ui/home-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error('mobile horizontal overflow');
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ ok: true, audit, errors, screenshots: 'artifacts/candy-ui' }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/candy-ui/failure.png', fullPage: true });
  console.error(JSON.stringify({ url: page.url(), errors, text: await page.locator('body').innerText() }, null, 2));
  throw error;
} finally { await browser.close(); }
