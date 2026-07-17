import { getAuthProvider } from './auth.js';
import { getOperationalStatus } from './operationalStatus.js';

function check(id, ok, message, required = true) {
  return { id, ok: Boolean(ok), required, message };
}

function providerConfigured(status) {
  if (status.ai.provider === 'azure') return status.ai.azureConfigured;
  if (status.ai.provider === 'openai') return status.ai.openaiConfigured || status.ai.openrouterConfigured;
  return status.ai.openrouterConfigured || status.ai.openaiConfigured;
}

export function getHandoffPreflight(profile = 'corporate') {
  const normalizedProfile = profile === 'mvp' || profile === 'local' ? profile : 'corporate';
  const status = getOperationalStatus();
  const checks = normalizedProfile === 'corporate'
    ? [
      check('auth_provider', getAuthProvider() === 'entra', 'AUTH_PROVIDER deve ser entra.'),
      check('entra_adapter', status.security.entraAdapter.ready, 'ENTRA_TENANT_ID, ENTRA_CLIENT_ID e grupos admin/user devem estar configurados.'),
      check('public_origin', status.security.publicOriginConfigured, 'PUBLIC_APP_ORIGIN deve ser a origem corporativa.'),
      check('session_secret', status.security.sessionSecretConfigured, 'AUTH_SESSION_SECRET deve existir somente no servidor.'),
      check('durable_stores', status.handoff.mvp.durableStores, 'Catálogo, Radar, rate limit e orçamento devem usar adapters duráveis.'),
      check('atomic_stores', status.handoff.corporate.atomicStores, 'Rate limit e orçamento devem usar adapter atômico.'),
      check('alerts', status.handoff.corporate.alerts, 'OPS_ALERT_WEBHOOK_URL deve ser HTTPS e corporativo.'),
      check('radar_cron', status.radar.cronConfigured, 'RADAR_CRON_SECRET ou CRON_SECRET deve estar configurado.'),
      check('radar_feeds', status.radar.feeds.ready, 'O manifesto de feeds oficiais precisa estar válido.'),
      check('ai_provider', providerConfigured(status), 'O provider de IA escolhido precisa ter credencial server-only.'),
    ]
    : [
      check('auth_provider', getAuthProvider() === 'local', 'O MVP local deve usar AUTH_PROVIDER=local.'),
      check('public_origin', status.security.publicOriginConfigured, 'PUBLIC_APP_ORIGIN deve estar configurado.'),
      check('session_secret', status.security.sessionSecretConfigured, 'AUTH_SESSION_SECRET deve existir somente no servidor.'),
      check('radar_feeds', status.radar.feeds.ready, 'O manifesto de feeds oficiais precisa estar válido.'),
      check('ai_provider', providerConfigured(status), 'O provider de IA escolhido precisa ter credencial server-only.', false),
    ];

  const requiredChecks = checks.filter((item) => item.required);
  return {
    profile: normalizedProfile,
    ok: requiredChecks.every((item) => item.ok),
    checks,
    blockers: checks.filter((item) => item.required && !item.ok).map((item) => item.id),
    status,
  };
}
