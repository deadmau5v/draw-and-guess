// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard } from '../../web/src/clipboard';

describe('copyTextToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('优先使用 navigator.clipboard.writeText（安全上下文/HTTPS）', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const success = await copyTextToClipboard('http://example.com/room/123456');
    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('http://example.com/room/123456');
  });

  it('当 clipboard.writeText 抛出异常时自动降级到 execCommand fallback', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const success = await copyTextToClipboard('http://example.com/fallback');
    expect(success).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('在无 navigator.clipboard 时（如普通 HTTP 环境），直接使用 textarea fallback', async () => {
    Object.assign(navigator, {
      clipboard: undefined,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const success = await copyTextToClipboard('http://turtle.d5v.cc/room/654321');
    expect(success).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });
});
