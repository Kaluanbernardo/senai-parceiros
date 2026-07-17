import { describe, expect, it, vi } from 'vitest';
import { requireSameOrigin } from './http.js';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

describe('request origin guard', () => {
  it('allows same-origin browser mutations', () => {
    const res = response();
    expect(requireSameOrigin({ headers: { origin: 'https://senai.example', host: 'senai.example', 'x-forwarded-proto': 'https' } }, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects cross-origin browser mutations', () => {
    const res = response();
    expect(requireSameOrigin({ headers: { origin: 'https://evil.example', host: 'senai.example', 'x-forwarded-proto': 'https' } }, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'origin_not_allowed' });
  });

  it('permits authenticated server-to-server calls without browser headers', () => {
    const res = response();
    expect(requireSameOrigin({ headers: { host: 'senai.example' } }, res)).toBe(true);
  });
});
