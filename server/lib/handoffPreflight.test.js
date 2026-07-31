import { afterEach, describe, expect, it } from 'vitest';
import { getHandoffPreflight } from './handoffPreflight.js';

const tracked = [
  'AUTH_PROVIDER', 'AUTH_SESSION_SECRET', 'PUBLIC_APP_ORIGIN', 'AI_PROVIDER', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'OPENALEX_API_KEY',
  'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT', 'RADAR_CRON_SECRET', 'CRON_SECRET',
  'ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_ADMIN_GROUP_ID', 'ENTRA_USER_GROUP_ID', 'OPS_ALERT_WEBHOOK_URL',
  'CATALOG_STORE_DRIVER', 'RADAR_STORE_DRIVER', 'RATE_LIMIT_STORE_DRIVER', 'AI_BUDGET_STORE_DRIVER',
];

afterEach(() => tracked.forEach((name) => delete process.env[name]));

describe('handoff preflight', () => {
  it('reports missing corporate configuration without exposing values', () => {
    process.env.AUTH_PROVIDER = 'entra';
    process.env.AUTH_SESSION_SECRET = 'secret-value-that-must-not-appear';
    const result = getHandoffPreflight('corporate');
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('entra_adapter');
    expect(JSON.stringify(result)).not.toContain('secret-value-that-must-not-appear');
  });

  it('passes the MVP profile with safe local configuration', () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.AUTH_SESSION_SECRET = 'local-session-secret-at-least-32-characters';
    process.env.PUBLIC_APP_ORIGIN = 'https://preview.example.test';
    process.env.OPENALEX_API_KEY = 'openalex-key';
    const result = getHandoffPreflight('mvp');
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks the MVP when the selected provider has no credential', () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.AUTH_SESSION_SECRET = 'local-session-secret-at-least-32-characters';
    process.env.PUBLIC_APP_ORIGIN = 'https://preview.example.test';
    // `structuredGeneration` does not fall back to OpenAI when OpenRouter is
    // selected, so the credential of another provider must not pass the gate.
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENAI_API_KEY = 'openai-key';
    const result = getHandoffPreflight('mvp');
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('ai_provider');
  });

  it('blocks a live Radar deployment without the required OpenAlex API key', () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.AUTH_SESSION_SECRET = 'local-session-secret-at-least-32-characters';
    process.env.PUBLIC_APP_ORIGIN = 'https://preview.example.test';

    const result = getHandoffPreflight('mvp');

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('openalex_api_key');
  });

  it('accepts the MVP when the selected provider is configured', () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.AUTH_SESSION_SECRET = 'local-session-secret-at-least-32-characters';
    process.env.PUBLIC_APP_ORIGIN = 'https://preview.example.test';
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    process.env.OPENALEX_API_KEY = 'openalex-key';
    const result = getHandoffPreflight('mvp');
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('openrouter-key');
  });

  it('requires durable and atomic shared stores for corporate readiness', () => {
    process.env.AUTH_PROVIDER = 'entra';
    process.env.AUTH_SESSION_SECRET = 'corporate-session-secret-at-least-32-characters';
    process.env.PUBLIC_APP_ORIGIN = 'https://app.example.test';
    process.env.ENTRA_TENANT_ID = 'tenant';
    process.env.ENTRA_CLIENT_ID = 'client';
    process.env.ENTRA_ADMIN_GROUP_ID = 'admin';
    process.env.ENTRA_USER_GROUP_ID = 'user';
    const result = getHandoffPreflight('corporate');
    expect(result.blockers).toEqual(expect.arrayContaining(['durable_stores', 'atomic_stores', 'alerts', 'radar_cron']));
  });
});
