import { getCatalogStoreStatus } from './catalogImport.js';
import { getRadarStoreStatus } from './radar.js';
import { getAuthProvider, getRateLimitStoreStatus } from './auth.js';
import { getUsageBudgetStatus } from './usageBudget.js';
import { getEntraAdapterStatus } from './entra.js';

function configured(name) {
  return Boolean(String(process.env[name] || '').trim());
}

export function getOperationalStatus() {
  const catalog = getCatalogStoreStatus();
  const radarStore = getRadarStoreStatus();
  const rateLimit = getRateLimitStoreStatus();
  const budgetStore = getUsageBudgetStatus();
  const entra = getEntraAdapterStatus();
  const sharedStorageReady = [catalog, radarStore, rateLimit, budgetStore].every((store) => store.durable);
  const radarCronConfigured = configured('RADAR_CRON_SECRET') || configured('CRON_SECRET');
  const corporateBlockers = [];
  if (!sharedStorageReady) corporateBlockers.push('shared_storage_pending');
  if (!radarCronConfigured) corporateBlockers.push('radar_cron_secret_pending');
  if (!configured('RADAR_EXTRA_FEEDS_JSON')) corporateBlockers.push('definitive_feeds_pending');
  if (!entra.ready) corporateBlockers.push('entra_id_adapter_pending');
  corporateBlockers.push('atomic_rate_limit_and_alerts_pending');
  return {
    generatedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    ai: {
      provider: process.env.AI_PROVIDER || 'openrouter',
      openaiConfigured: configured('OPENAI_API_KEY'),
      openrouterConfigured: configured('OPENROUTER_API_KEY'),
      azureConfigured: configured('AZURE_OPENAI_ENDPOINT') && configured('AZURE_OPENAI_API_KEY') && configured('AZURE_OPENAI_DEPLOYMENT'),
      budgetStore,
    },
    radar: {
      liveSources: process.env.RADAR_LIVE_SOURCES !== 'false',
      cronConfigured: radarCronConfigured,
      store: radarStore,
    },
    catalog,
    rateLimit,
    security: {
      publicOriginConfigured: configured('PUBLIC_APP_ORIGIN'),
      sessionSecretConfigured: configured('AUTH_SESSION_SECRET'),
      authProvider: getAuthProvider(),
      entraAdapter: entra,
    },
    handoff: {
      mvp: {
        durableStores: sharedStorageReady,
        radarCronConfigured,
        ready: Boolean(configured('AUTH_SESSION_SECRET') && configured('PUBLIC_APP_ORIGIN') && sharedStorageReady && radarCronConfigured),
      },
      corporate: {
        status: 'pending',
        blockers: corporateBlockers,
        identityAdapter: entra.ready ? 'entra_oidc_jwt' : 'local_hmac_until_entra_id_handoff',
        atomicStores: false,
        alerts: false,
      },
    },
  };
}
