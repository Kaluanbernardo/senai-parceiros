import login from '../api/auth/login.js';
import session from '../api/auth/session.js';
import logout from '../api/auth/logout.js';
import evaluate from '../api/selection/evaluate.js';
import interviewNext from '../api/selection/interview-next.js';
import radarItems from '../api/radar/items.js';
import radarRefresh from '../api/radar/refresh.js';
import catalogImportPreview from '../api/admin/catalog-import-preview.js';
import catalogImportCommit from '../api/admin/catalog-import-commit.js';
import catalogImportRollback from '../api/admin/catalog-import-rollback.js';
import catalogImportBatches from '../api/admin/catalog-import-batches.js';
import adminStatus from '../api/admin/status.js';

const handlers = {
  '/api/auth/login': login,
  '/api/auth/session': session,
  '/api/auth/logout': logout,
  '/api/selection/evaluate': evaluate,
  '/api/selection/interview/next': interviewNext,
  '/api/radar/items': radarItems,
  '/api/radar/refresh': radarRefresh,
  '/api/admin/catalog/import-preview': catalogImportPreview,
  '/api/admin/catalog/import-commit': catalogImportCommit,
  '/api/admin/catalog/import-rollback': catalogImportRollback,
  '/api/admin/catalog/import-batches': catalogImportBatches,
  '/api/admin/status': adminStatus,
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
  return {
    name: 'senai-api-handlers',
    configureServer(server) {
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
    },
  };
}
