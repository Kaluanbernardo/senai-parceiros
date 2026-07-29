const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const recentAlerts = new Map();
let lastError = null;

function configured(name) {
  return String(process.env[name] || '').trim();
}

function alertUrl() {
  return configured('OPS_ALERT_WEBHOOK_URL') || configured('ALERT_WEBHOOK_URL');
}

export function getAlertStatus() {
  const url = alertUrl();
  let valid = false;
  try { valid = Boolean(url) && new URL(url).protocol === 'https:'; } catch { valid = false; }
  return { configured: Boolean(url), valid, transport: valid ? 'https_webhook' : 'none', lastError };
}

function safeDetails(details = {}) {
  const allowlist = ['kind', 'section', 'source', 'driver', 'status', 'threshold', 'requests', 'tokens', 'costUsd', 'remainingRequests', 'remainingTokens', 'remainingCostUsd'];
  return Object.fromEntries(allowlist.filter((key) => details[key] !== undefined).map((key) => [key, typeof details[key] === 'number' ? details[key] : String(details[key]).slice(0, 120)]));
}

export async function emitOperationalAlert(event, { severity = 'warning', details = {}, force = false } = {}) {
  const url = alertUrl();
  if (!url) return { sent: false, configured: false };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('alert_webhook_must_be_https');
    const fingerprint = `${event}:${JSON.stringify(safeDetails(details))}`;
    const now = Date.now();
    const cooldownMs = Math.max(30_000, Number(process.env.OPS_ALERT_COOLDOWN_SECONDS || 300) * 1000);
    if (!force && recentAlerts.get(fingerprint) > now - cooldownMs) return { sent: false, configured: true, deduplicated: true };
    const response = await fetch(parsed, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        source: 'senai-parceiros',
        event: String(event).slice(0, 80),
        severity: String(severity).slice(0, 20),
        occurredAt: new Date(now).toISOString(),
        details: safeDetails(details),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response?.ok) throw new Error(`alert_webhook_${response?.status || 'failed'}`);
    recentAlerts.set(fingerprint, now);
    lastError = null;
    return { sent: true, configured: true };
  } catch (error) {
    lastError = 'alert_delivery_failed';
    return { sent: false, configured: true, error: lastError };
  }
}

export function resetAlertStateForTests() {
  recentAlerts.clear();
  lastError = null;
}
