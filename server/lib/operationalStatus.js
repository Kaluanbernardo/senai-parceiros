import { getCatalogStoreStatus } from './catalogImport.js';
import { getRadarFeedReadiness, getRadarStoreStatus } from './radar.js';
import { getAuthProvider, getRateLimitStoreStatus } from './auth.js';
import { getUsageBudgetStatus } from './usageBudget.js';
import { getEntraAdapterStatus } from './entra.js';
import { getAlertStatus } from './alerts.js';

function configured(name) {
  return Boolean(String(process.env[name] || '').trim());
}

export function getOperationalStatus() {
  const catalog = getCatalogStoreStatus();
  const radarStore = getRadarStoreStatus();
  const radarFeeds = getRadarFeedReadiness();
  const rateLimit = getRateLimitStoreStatus();
  const budgetStore = getUsageBudgetStatus();
  const entra = getEntraAdapterStatus();
  const alerts = getAlertStatus();
  const sharedStorageReady = [catalog, radarStore, rateLimit, budgetStore].every((store) => store.durable);
  const atomicStoresReady = Boolean(rateLimit.atomic && budgetStore.atomic);
  const radarCronConfigured = configured('RADAR_CRON_SECRET') || configured('CRON_SECRET');
  const mvpReady = Boolean(configured('AUTH_SESSION_SECRET') && configured('PUBLIC_APP_ORIGIN') && radarFeeds.ready);
  const corporateBlockers = [];
  if (!sharedStorageReady) corporateBlockers.push('shared_storage_pending');
  if (!radarCronConfigured) corporateBlockers.push('radar_cron_secret_pending');
  if (!radarFeeds.ready) corporateBlockers.push('definitive_feeds_pending');
  if (!entra.ready) corporateBlockers.push('entra_id_adapter_pending');
  if (!atomicStoresReady) corporateBlockers.push('atomic_rate_limit_pending');
  if (!alerts.valid) corporateBlockers.push('operational_alerts_pending');
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
      dou: {
        enabled: process.env.RADAR_DOU_ENABLED !== 'false',
        sections: String(process.env.RADAR_DOU_SECTIONS || 'DO1,DO3').split(',').map((value) => value.trim()).filter(Boolean),
        directProvider: String(process.env.RADAR_DISCOVERY_PROVIDER || 'direct'),
        extractProvider: String(process.env.RADAR_EXTRACT_PROVIDER || 'tavily'),
        tavilyConfigured: configured('TAVILY_API_KEY'),
      },
      store: radarStore,
      feeds: radarFeeds,
    },
    catalog,
    rateLimit,
    security: {
      publicOriginConfigured: configured('PUBLIC_APP_ORIGIN'),
      sessionSecretConfigured: configured('AUTH_SESSION_SECRET'),
      authProvider: getAuthProvider(),
      entraAdapter: entra,
      alerts,
    },
    handoff: {
      mvp: {
        durableStores: sharedStorageReady,
        radarCronConfigured,
        ready: mvpReady,
      },
      corporate: {
        status: 'pending',
        blockers: corporateBlockers,
        identityAdapter: entra.ready ? 'entra_oidc_jwt' : 'local_hmac_until_entra_id_handoff',
        atomicStores: atomicStoresReady,
        alerts: alerts.valid,
      },
    },
  };
}
