import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitOperationalAlert, getAlertStatus, resetAlertStateForTests } from './alerts.js';

afterEach(() => {
  delete process.env.OPS_ALERT_WEBHOOK_URL;
  delete process.env.OPS_ALERT_COOLDOWN_SECONDS;
  resetAlertStateForTests();
  vi.unstubAllGlobals();
});

describe('operational alerts', () => {
  it('sends only allowlisted operational details to an HTTPS webhook', async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = 'https://alerts.example.test/hook';
    const fetchMock = vi.fn(async (_url, options) => {
      expect(options.body).not.toContain('raw-client-ip');
      expect(options.body).not.toContain('private-prompt');
      expect(options.body).not.toContain('secret-token');
      return { ok: true, status: 202 };
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await emitOperationalAlert('ai_budget_threshold', { details: { kind: 'selection', requests: 80, prompt: 'private-prompt', token: 'secret-token', ip: 'raw-client-ip' } });
    expect(result).toMatchObject({ sent: true, configured: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAlertStatus()).toMatchObject({ configured: true, valid: true, transport: 'https_webhook' });
  });

  it('deduplicates repeated alerts and rejects non-HTTPS endpoints', async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = 'http://alerts.example.test/hook';
    expect(getAlertStatus()).toMatchObject({ configured: true, valid: false, transport: 'none' });
    expect((await emitOperationalAlert('radar_failed')).sent).toBe(false);
    process.env.OPS_ALERT_WEBHOOK_URL = 'https://alerts.example.test/hook';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    expect((await emitOperationalAlert('radar_failed', { details: { source: 'MEC' } })).sent).toBe(true);
    expect((await emitOperationalAlert('radar_failed', { details: { source: 'MEC' } })).deduplicated).toBe(true);
  });
});
