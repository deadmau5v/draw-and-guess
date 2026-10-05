import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

// Mechanical asset packaging only: preserve generated artwork and alpha,
// remove empty canvas margins, resize for native CSS cursors and locate the tip.
const names = ['default', 'pointer', 'pressed'];
if (process.argv.length !== 5) throw Error('Pass default PNG, pointer PNG, and pressed PNG or --pressed-from-pointer');
mkdirSync('public/assets/cursors', { recursive: true });
const hotspots = {};
for (const [index, name] of names.entries()) {
  let input = process.argv[index + 2];
  if (name === 'pressed' && input === '--pressed-from-pointer') {
    const { data, info } = await sharp(process.argv[3]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (data[i + 3] && Math.min(r, g, b) > 95 && Math.max(r, g, b) - Math.min(r, g, b) < 85) {
        const light = (r + g + b) / 3;
        data[i] = Math.round(Math.min(255, light * 1.06));
        data[i + 1] = Math.round(light * .84); data[i + 2] = Math.round(light * .19);
      }
    }
    input = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  }
  await sharp(input).toFile(`public/assets/cursors/${name}-source.png`);
  const trimmed = await sharp(input).trim({ threshold: 8 }).png().toBuffer();
  const sized = await sharp(trimmed).resize(30, 30, { fit: 'inside' }).extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().png().toBuffer();
  const { data, info } = await sharp(sized).raw().toBuffer({ resolveWithObject: true });
  let tip = null;
  for (let y = 0; y < info.height && !tip; y++) {
    const xs = [];
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 100) xs.push(x);
    if (xs.length) tip = { x: name === 'default' ? xs[0] : Math.round((xs[0] + xs.at(-1)) / 2), y };
  }
  if (!tip) throw Error(`Empty cursor: ${name}`);
  await sharp(sized).toFile(`public/assets/cursors/${name}.png`);
  hotspots[name] = tip;
  console.log(JSON.stringify({ name, width: info.width, height: info.height, ...tip }));
}
writeFileSync('public/assets/cursors/hotspots.json', JSON.stringify(hotspots, null, 2));
