import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/d5v/Desktop/CandyUI/package.json');
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
mkdirSync('artifacts/home-layout', { recursive: true });
const page = await browser.newPage();
await page.emulateMedia({ reducedMotion: 'reduce' });
try {
  for (const [width, height] of [[1440, 900], [1440, 720], [1366, 768], [1280, 600], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.locator('.home-entry-image').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
    console.log(JSON.stringify(size));
    await page.screenshot({ path: `artifacts/home-layout/${width}-${height}.png`, fullPage: true });
    if (width > 1100) {
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('.game-board-card').getBoundingClientRect();
        const guide = document.querySelector('.home-guide').getBoundingClientRect();
        const actions = document.querySelector('.game-action-buttons').getBoundingClientRect();
        const cards = [...document.querySelectorAll('.home-entry')].map(el => el.getBoundingClientRect());
        const navBackgrounds = [...document.querySelectorAll('.game-top-header button')].map(el => getComputedStyle(el).backgroundColor);
        return { bottomGap: innerHeight - panel.bottom, guideBottom: guide.bottom, actionBottom: actions.bottom, panelBottom: panel.bottom, cardsBottom: Math.max(...cards.map(r => r.bottom)), guideTop: guide.top, navBackgrounds };
      });
      if (layout.bottomGap > 24 || layout.guideBottom > layout.panelBottom || layout.actionBottom > layout.panelBottom || layout.cardsBottom > layout.guideTop) throw new Error(`Layout spacing regression: ${JSON.stringify(layout)}`);
      if (layout.navBackgrounds.some(color => color !== 'rgba(0, 0, 0, 0)')) throw new Error(`Header background regression: ${JSON.stringify(layout.navBackgrounds)}`);
    }
    if (size.scrollWidth > width || (width > 1100 && size.scrollHeight > height)) {
      console.log(await page.evaluate(() => ['.game-top-header', '.home-main', '.game-board-card', '.board-col-left', '.board-col-right', '.home-guide', '.game-action-buttons'].map(selector => { const el = document.querySelector(selector); const r = el.getBoundingClientRect(); return { selector, top: r.top, height: r.height, bottom: r.bottom, scrollHeight: el.scrollHeight }; })));
      throw new Error('Homepage overflow');
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const headerButtons = page.locator('.game-top-header button');
  for (let index = 0; index < await headerButtons.count(); index++) {
    await headerButtons.nth(index).hover();
    const style = await headerButtons.nth(index).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    if (style.background !== 'rgba(0, 0, 0, 0)' || style.color !== 'rgb(255, 255, 255)') throw new Error(`Header hover contrast regression: ${JSON.stringify(style)}`);
  }
  await page.locator('.header-profile').hover();
  await page.screenshot({ path: 'artifacts/home-layout/header-hover.png', fullPage: true });
  await page.getByLabel('切换形象', { exact: true }).click();
  await page.getByRole('button', { name: '职业幻想', exact: true }).click();
  await page.locator('.avatar-option img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  if (await page.locator('.avatar-option').count() !== 6) throw new Error('Fantasy avatar pagination failed');
  await page.getByRole('button', { name: '萌妹歌手', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.locator('.header-profile img').getAttribute('src')).includes('01_萌妹歌手')) throw new Error('Extra avatar persistence failed');
  await page.getByLabel('切换形象', { exact: true }).click();
  await page.getByRole('button', { name: '萌趣潮玩', exact: true }).click();
  await page.locator('.avatar-option img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  if (await page.locator('.avatar-option').count() !== 6) throw new Error('Playful avatar pagination failed');
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
  await page.getByRole('button', { name: '幽火骷髅', exact: true }).click();
  await page.locator('.mascot-avatar-wrap img').evaluate(img => img.decode());
  const clipped = await page.locator('.mascot-avatar-wrap img').evaluate(img => getComputedStyle(img).clipPath);
  if (clipped !== 'inset(3% 3% 0px)') throw new Error('Avatar edge clipping regression');
  await page.screenshot({ path: 'artifacts/home-layout/skull-cleaned.png', fullPage: true });
  await page.getByLabel('切换形象', { exact: true }).click();
  await page.getByRole('button', { name: '常用形象', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: 'artifacts/home-layout/avatar-dialog.png', fullPage: true });
  const options = await page.locator('.avatar-option').evaluateAll(elements => elements.map(el => ({ height: el.clientHeight, contentHeight: el.scrollHeight })));
  if (options.some(el => el.contentHeight > el.height)) throw new Error('Avatar option overflow');
  await page.getByRole('button', { name: '呆萌熊猫', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.locator('.header-profile img').getAttribute('src')).includes('player-panda')) throw new Error('Avatar persistence failed');
} finally { await browser.close(); }
