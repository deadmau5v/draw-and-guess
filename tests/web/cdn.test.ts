import { describe, expect, it } from 'vitest';
import { CDN_BASE_URL, cdnUrl } from '../../web/src/cdn';

describe('cdnUrl', () => {
  it('returns canonical path unchanged in test environment by default', () => {
    expect(cdnUrl('/assets/avatars/player-panda.png')).toBe('/assets/avatars/player-panda.png');
  });

  it('maps local asset paths to EdgeOne CDN and encodes non-ASCII paths when forceCdn is true', () => {
    expect(cdnUrl('/assets/avatars/player-panda.png', true)).toBe(
      `${CDN_BASE_URL}/assets/avatars/player-panda.png`,
    );
    expect(cdnUrl('/assets/all/06_玩家头像_职业幻想篇_20款/01_萌妹歌手_偶像麦克风.png', true)).toBe(
      `${CDN_BASE_URL}/assets/all/06_%E7%8E%A9%E5%AE%B6%E5%A4%B4%E5%83%8F_%E8%81%8C%E4%B8%9A%E5%B9%BB%E6%83%B3%E7%AF%87_20%E6%AC%BE/01_%E8%90%8C%E5%A6%B9%E6%AD%8C%E6%89%8B_%E5%81%B6%E5%83%8F%E9%BA%A6%E5%85%8B%E9%A3%8E.png`,
    );
  });

  it('preserves already absolute URLs and empty strings', () => {
    expect(cdnUrl('', true)).toBe('');
    expect(cdnUrl('https://rw-img.denox.cc/turtle-soup/doodle-pattern.png', true)).toBe(
      'https://rw-img.denox.cc/turtle-soup/doodle-pattern.png',
    );
  });
});
