import login from '../api/auth/login.js';
import entra from '../api/auth/entra.js';
import session from '../api/auth/session.js';
import logout from '../api/auth/logout.js';
import evaluate from '../api/selection/evaluate.js';
import interviewNext from '../api/selection/interview-next.js';
import radarItems from '../api/radar/items.js';
import radarRefresh from '../api/radar/refresh.js';
import catalogImportPreview from './routes/admin/catalog-import-preview.js';
import catalogImportCommit from './routes/admin/catalog-import-commit.js';
import catalogImportRollback from './routes/admin/catalog-import-rollback.js';
import catalogImportBatches from './routes/admin/catalog-import-batches.js';
import catalogEnrichment from './routes/admin/catalog-enrichment.js';
import catalogResearch from './routes/admin/catalog-research.js';
import adminStatus from './routes/admin/status.js';
import catalog from '../api/catalog.js';
import { loadServerEnv } from './lib/envFile.js';

// As chaves espelham exatamente o roteamento por arquivos da Vercel: um mapa
// mais permissivo aqui faria o desenvolvimento passar com caminhos que só
// existem em memória, e a rota quebraria apenas em produção.
const handlers = {
  '/api/auth/login': login,
  '/api/auth/entra': entra,
  '/api/auth/session': session,
  '/api/auth/logout': logout,
  '/api/selection/evaluate': evaluate,
  '/api/selection/interview-next': interviewNext,
  '/api/radar/items': radarItems,
  '/api/radar/refresh': radarRefresh,
  '/api/admin/catalog-import-preview': catalogImportPreview,
  '/api/admin/catalog-import-commit': catalogImportCommit,
  '/api/admin/catalog-import-rollback': catalogImportRollback,
  '/api/admin/catalog-import-batches': catalogImportBatches,
  '/api/admin/catalog-enrichment': catalogEnrichment,
  '/api/admin/catalog-research': catalogResearch,
  '/api/admin/status': adminStatus,
  '/api/catalog': catalog,
};

function adaptResponse(res) {
  if (!res.status) {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = (body) => {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
  }
  return res;
}

export default function viteApiPlugin() {
  const useApiHandlers = (server) => {
    // Vite exposes `.env.local` through `import.meta.env`, which the Node
    // handlers never read.  Loading it into `process.env` only while serving
    // keeps local development aligned with Vercel and never touches the
    // client bundle.
    loadServerEnv({ cwd: server.config?.root || process.cwd() });
    server.middlewares.use(async (req, res, next) => {
      const path = String(req.url || '').split('?')[0];
      const handler = handlers[path];
      if (!handler) return next();
      try {
        await handler(req, adaptResponse(res));
      } catch {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'internal_server_error' }));
        }
      }
    });
  };

  return {
    name: 'senai-api-handlers',
    configureServer: useApiHandlers,
    configurePreviewServer: useApiHandlers,
  };
}
