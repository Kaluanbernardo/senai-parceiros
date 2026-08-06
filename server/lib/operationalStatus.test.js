import { afterEach, describe, expect, it } from 'vitest';
import { getOperationalStatus } from './operationalStatus.js';

const tracked = ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT', 'AUTH_SESSION_SECRET', 'PUBLIC_APP_ORIGIN', 'RADAR_CRON_SECRET', 'CRON_SECRET', 'RADAR_EXTRA_FEEDS_JSON', 'OPS_ALERT_WEBHOOK_URL', 'OPS_ALERT_COOLDOWN_SECONDS', 'AI_ALERT_THRESHOLD', 'AUTH_PROVIDER'];

afterEach(() => tracked.forEach((name) => delete process.env[name]));

describe('operational status', () => {
  it('reports configuration presence without exposing secret values', () => {
    process.env.OPENAI_API_KEY = 'do-not-return-this';
    process.env.AUTH_SESSION_SECRET = 'secret-session-value';
    const status = getOperationalStatus();
    const serialized = JSON.stringify(status);
    expect(status.ai.openaiConfigured).toBe(true);
    expect(status.security.sessionSecretConfigured).toBe(true);
    expect(status.radar.feeds.ready).toBe(true);
    expect(status.security.alerts.configured).toBe(false);
    expect(status.handoff.corporate.blockers).toContain('operational_alerts_pending');
    expect(status.handoff.corporate.identityAdapter).toBe('local_hmac_until_entra_id_handoff');
    expect(status.handoff.corporate.blockers).toContain('entra_id_adapter_pending');
    expect(serialized).not.toContain('do-not-return-this');
    expect(serialized).not.toContain('secret-session-value');
  });

  it('marks the MVP ready without requiring corporate persistence or cron', () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.AUTH_SESSION_SECRET = 'mvp-session-secret-at-least-32-characters';
    process.env.PUBLIC_APP_ORIGIN = 'https://preview.example.test';
    const status = getOperationalStatus();
    expect(status.handoff.mvp.ready).toBe(true);
    expect(status.handoff.mvp.durableStores).toBe(false);
    expect(status.handoff.mvp.radarCronConfigured).toBe(false);
  });

  it('reporta as variáveis que hoje decidem se a IA e o Radar rodam', () => {
    // Sem elas no status, diagnosticar uma falha de produção vira adivinhação:
    // um modelo fixado sem suporte a schema estrito derruba toda chamada, e as
    // duas variáveis do Radar derrubam toda coleta com fila de reescrita.
    delete process.env.OPENROUTER_MODEL;
    delete process.env.RADAR_EDITORIAL_PROVIDER;
    process.env.RADAR_SUMMARY_PROVIDER = 'openrouter';

    const status = getOperationalStatus();

    expect(status.ai.openrouterModel).toBe('openrouter/auto');
    expect(status.ai.interviewTimeoutMs).toBe(45000);
    expect(status.radar.editorialProviderConfigured).toBe(false);
    expect(status.radar.summaryProviderConfigured).toBe(true);
    delete process.env.RADAR_SUMMARY_PROVIDER;
  });
});
