const storageKey = 'turtle:playerKey';

function createPlayerKey(): string {
  if (typeof crypto.randomUUID === 'function') return `p-${crypto.randomUUID()}`;

  // randomUUID requires a secure context; getRandomValues also works over HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `p-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreatePlayerKey(): string {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return saved;
  } catch { /* The compatibility SPA also allows storage to be unavailable. */ }
  const key = createPlayerKey();
  try { localStorage.setItem(storageKey, key); } catch {}
  return key;
}
