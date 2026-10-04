import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../../server/config.js';
describe('配置', () => {
 it('无 key 仍提供默认配置', () => { vi.spyOn(console, 'warn').mockImplementation(() => {}); expect(loadConfig({})).toMatchObject({ judgeConfigured:false, model:'typesafe/jev-1.13', judgeThreshold:0.4, solveThreshold:0.55, port:3001, dbPath:'./turtle.db' }); vi.restoreAllMocks(); });
});
