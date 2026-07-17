import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { authenticate, getAuthProvider, isLoginRateLimited, recordLoginAttempt, resetRateLimitsForTests } from './auth.js';
import { rateLimitStore } from './rateLimitStore.js';

function request(ip = '203.0.113.10') {
  return { headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip } };
}

afterEach(() => {
  delete process.env.AUTH_PROVIDER;
  resetRateLimitsForTests();
  rateLimitStore.configure({ driver: 'memory' });
});

describe('rate limit store', () => {
  it('fails closed when a non-local provider is selected before its adapter is wired', () => {
    process.env.AUTH_PROVIDER = 'entra';
    expect(getAuthProvider()).toBe('entra');
    expect(authenticate('admin', 'anything')).toBeNull();
  });

  it('limits repeated login attempts using the shared store contract', () => {
    const req = request();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(isLoginRateLimited(req)).toBe(false);
      recordLoginAttempt(req);
    }
    expect(isLoginRateLimited(req)).toBe(true);
  });

  it('supports a durable file adapter without storing the raw client address', () => {
    const filePath = `${process.cwd()}/tmp-rate-limit-${Date.now()}.json`;
    const req = request('198.51.100.44');
    rateLimitStore.configure({ driver: 'file', filePath });
    recordLoginAttempt(req);
    expect(fs.readFileSync(filePath, 'utf8')).not.toContain('198.51.100.44');
    expect(rateLimitStore.status()).toMatchObject({ driver: 'file', durable: true });
    resetRateLimitsForTests();
    rateLimitStore.configure({ driver: 'memory' });
  });
});
