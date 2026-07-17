import { getCatalogStoreStatus } from './catalogImport.js';
import { getRadarStoreStatus } from './radar.js';
import { getRateLimitStoreStatus } from './auth.js';
import { getUsageBudgetStatus } from './usageBudget.js';

function configured(name) {
  return Boolean(String(process.env[name] || '').trim());
}

export function getOperationalStatus() {
  return {
    generatedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    ai: {
      provider: process.env.AI_PROVIDER || 'openrouter',
      openaiConfigured: configured('OPENAI_API_KEY'),
      openrouterConfigured: configured('OPENROUTER_API_KEY'),
      azureConfigured: configured('AZURE_OPENAI_ENDPOINT') && configured('AZURE_OPENAI_API_KEY') && configured('AZURE_OPENAI_DEPLOYMENT'),
      budgetStore: getUsageBudgetStatus(),
    },
    radar: {
      liveSources: process.env.RADAR_LIVE_SOURCES !== 'false',
      cronConfigured: configured('RADAR_CRON_SECRET') || configured('CRON_SECRET'),
      store: getRadarStoreStatus(),
    },
    catalog: getCatalogStoreStatus(),
    rateLimit: getRateLimitStoreStatus(),
    security: {
      publicOriginConfigured: configured('PUBLIC_APP_ORIGIN'),
      sessionSecretConfigured: configured('AUTH_SESSION_SECRET'),
    },
  };
}
