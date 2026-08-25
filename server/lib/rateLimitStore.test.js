import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitStore } from './rateLimitStore.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  rateLimitStore.configure({ driver: 'memory' });
});

describe('Supabase rate limit adapter', () => {
  it('uses one atomic RPC instead of the whole JSON snapshot', async () => {
    process.env.SUPABASE_URL = 'https://supabase.example';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
    rateLimitStore.configure({ driver: 'supabase' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('true', { status: 200 }));

    await expect(rateLimitStore.consume('radar:client:user', 30, 10 * 60 * 1000)).resolves.toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://supabase.example/rest/v1/rpc/consume_operation_limit');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      p_key: 'radar:client:user',
      p_limit: 30,
      p_window_seconds: 600,
    });
  });
});
