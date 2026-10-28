export const CDN_BASE_URL = 'https://rw-img.denox.cc/turtle-soup';

function isTestEnv(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  } catch {
    return false;
  }
}

export function cdnUrl(path: string, forceCdn = false): string {
  if (!path || (!forceCdn && isTestEnv())) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  // Custom Draw & Guess brand assets (banner, mascot, home cards, covers) are served locally from public/assets
  if (
    !forceCdn &&
    (normalized.startsWith('/assets/banner-logo') ||
      normalized.startsWith('/assets/header-banner') ||
      normalized.startsWith('/assets/turtle-think') ||
      normalized.startsWith('/assets/home/') ||
      normalized.startsWith('/assets/puzzle-covers/'))
  ) {
    return normalized;
  }
  return encodeURI(`${CDN_BASE_URL}${normalized}`);
}
