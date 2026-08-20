/**
 * Vitest loads `.env.local` into `process.env`, so a developer who configured
 * the project correctly would run the suite with real credentials in scope.
 * Tests asserting "no provider configured" then reached the live API: they
 * consumed free-tier quota, became dependent on each machine's disk and failed
 * intermittently on network timing.
 *
 * Every test that needs a provider sets its own placeholder credential, so
 * clearing these before each test costs nothing and keeps the suite hermetic.
 */

import { beforeEach } from 'vitest';
import { resetAiCacheForTests } from '../../server/lib/aiCache.js';

const EXTERNAL_CREDENTIALS = [
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_DEPLOYMENT',
  'TAVILY_API_KEY',
  'OPENALEX_API_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
  'OPS_ALERT_WEBHOOK_URL',
];

// Not credentials, but ambient values that silently change which provider or
// model a test exercises.
const PROVIDER_SELECTION = ['AI_PROVIDER', 'OPENROUTER_MODEL', 'OPENAI_MODEL', 'AI_MODEL_INTERVIEW', 'AI_MODEL_SELECTION', 'AI_MODEL_CATALOG_RESEARCH', 'AI_MODEL_CATALOG_ENRICHMENT', 'AI_MODEL_RADAR_EDITORIAL', 'AI_MODEL_RADAR_SUMMARY', 'AI_ENFORCE_BUDGET', 'RADAR_SUMMARY_PROVIDER', 'RADAR_EDITORIAL_PROVIDER', 'RADAR_EDITORIAL_MAX_ITEMS', 'RADAR_EDITORIAL_DEADLINE_MS'];
const EXTERNAL_STORES = [
  'CATALOG_STORE_DRIVER',
  'CATALOG_STORE_FILE',
  'RADAR_STORE_DRIVER',
  'RADAR_STORE_FILE',
  'RATE_LIMIT_STORE_DRIVER',
  'RATE_LIMIT_STORE_FILE',
  'AI_BUDGET_STORE_DRIVER',
  'AI_BUDGET_STORE_FILE',
  'STORAGE_MIGRATION_ENABLED',
];
const AMBIENT_EXTERNAL_STATE = [...EXTERNAL_CREDENTIALS, ...PROVIDER_SELECTION, ...EXTERNAL_STORES];

function isolateExternalState() {
  for (const name of AMBIENT_EXTERNAL_STATE) delete process.env[name];
  resetAiCacheForTests();
}

// Setup files run before test modules are imported. Clear ambient values now
// so module-level stores and provider singletons cannot capture real config.
isolateExternalState();
beforeEach(isolateExternalState);
