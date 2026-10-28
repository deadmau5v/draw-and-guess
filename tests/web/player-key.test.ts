// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { getOrCreatePlayerKey } from '../../web/src/playerKey';

const uuidPattern = /^p-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

it('uses native randomUUID when available and persists the key', () => {
  const randomUUID = vi.fn(() => '12345678-1234-4abc-8abc-123456789abc');
  const getRandomValues = vi.fn();
  vi.stubGlobal('crypto', { randomUUID, getRandomValues });
  expect(getOrCreatePlayerKey()).toBe('p-12345678-1234-4abc-8abc-123456789abc');
  expect(localStorage.getItem('turtle:playerKey')).toBe('p-12345678-1234-4abc-8abc-123456789abc');
  expect(randomUUID).toHaveBeenCalledOnce();
  expect(getRandomValues).not.toHaveBeenCalled();
});

it('preserves existing player identity without requiring crypto', () => {
  localStorage.setItem('turtle:playerKey', 'p-existing-player');
  vi.stubGlobal('crypto', undefined);
  expect(getOrCreatePlayerKey()).toBe('p-existing-player');
});

it('uses 16 cryptographic bytes with UUID v4 version and variant over HTTP', () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(255));
  const weakRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Weak randomness must not be used'); });
  vi.stubGlobal('crypto', { getRandomValues });
  expect(getOrCreatePlayerKey()).toBe('p-ffffffff-ffff-4fff-bfff-ffffffffffff');
  expect(getRandomValues).toHaveBeenCalledOnce();
  expect(getRandomValues.mock.calls[0]![0]).toHaveLength(16);
  expect(weakRandom).not.toHaveBeenCalled();
});

it('generates distinct valid keys for new players without randomUUID', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const keys = new Set<string>();
  for (let i = 0; i < 100; i++) {
    localStorage.clear();
    const key = getOrCreatePlayerKey();
    expect(key).toMatch(uuidPattern);
    expect(getOrCreatePlayerKey()).toBe(key);
    keys.add(key);
  }
  expect(keys.size).toBe(100);
});

it('still returns a player key when storage is blocked in the compatibility SPA', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  expect(getOrCreatePlayerKey()).toMatch(uuidPattern);
});
