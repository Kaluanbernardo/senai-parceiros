import { describe, expect, it, vi } from 'vitest';
import handler from '../../../api/admin/[action].js';

describe('admin API gateway', () => {
  it('rejects unknown admin actions without exposing another handler', async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await handler({ url: '/api/admin/unknown' }, { status });

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'not_found' });
  });
});
