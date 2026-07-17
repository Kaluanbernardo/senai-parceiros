import { afterEach, describe, expect, it } from 'vitest';
import { getOperationalStatus } from './operationalStatus.js';

const tracked = ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT', 'AUTH_SESSION_SECRET'];

afterEach(() => tracked.forEach((name) => delete process.env[name]));

describe('operational status', () => {
  it('reports configuration presence without exposing secret values', () => {
    process.env.OPENAI_API_KEY = 'do-not-return-this';
    process.env.AUTH_SESSION_SECRET = 'secret-session-value';
    const status = getOperationalStatus();
    const serialized = JSON.stringify(status);
    expect(status.ai.openaiConfigured).toBe(true);
    expect(status.security.sessionSecretConfigured).toBe(true);
    expect(serialized).not.toContain('do-not-return-this');
    expect(serialized).not.toContain('secret-session-value');
  });
});
