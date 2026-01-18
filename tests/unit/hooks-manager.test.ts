import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HookManager } from '../../src/hooks';

describe('HookManager', () => {
  const originalWarn = console.warn;

  beforeEach(() => {
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it('registers and lists hooks', () => {
    const manager = new HookManager();
    manager.register('test', () => 'ok');
    expect(manager.list()).toEqual(['test']);
  });

  it('executes registered hook', async () => {
    const manager = new HookManager();
    manager.register('test', () => 'result');
    const output = await manager.execute('test', {});
    expect(output).toBe('result');
  });

  it('warns when hook is missing', async () => {
    const manager = new HookManager();
    const output = await manager.execute('missing', {});
    expect(output).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith("Hook 'missing' not found");
  });

  it('wraps hook errors', async () => {
    const manager = new HookManager();
    manager.register('fail', () => {
      throw new Error('boom');
    });

    await expect(manager.execute('fail', {})).rejects.toThrow("Hook 'fail' failed: Error: boom");
  });
});
