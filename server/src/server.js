import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRouter, serveStatic } from './httpRouter.js';
import { JsonFileTaskLedgerStore } from './ledger/TaskLedgerStore.js';
import { TaskLedgerService } from './ledger/TaskLedgerService.js';
import { TriggerListener } from './triggers/TriggerListener.js';
import { registerApiRoutes } from './routes/api.js';
import { registerSmartRoutes } from './routes/smart.js';
import { startPriorAuthAgent } from './agent-interop/priorAuthAgent.js';
import { wireAgentResponsesToLedger } from './agent-interop/priorAuthResponseHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '..', '..', 'web', 'public');
const sharedRoot = join(__dirname, '..', '..', 'shared');
const PORT = process.env.PORT ?? 3000;

const store = new JsonFileTaskLedgerStore();
export const ledgerService = new TaskLedgerService(store);

const triggerListener = new TriggerListener(ledgerService);
triggerListener.start();

startPriorAuthAgent();
wireAgentResponsesToLedger(ledgerService);

const router = createRouter();
registerApiRoutes(router, { ledgerService });
registerSmartRoutes(router);

const server = createServer(async (req, res) => {
  const handled = await router.dispatch(req, res);
  if (handled) return;
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  // Redirect root to landing page
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: '/landing.html' });
    res.end();
    return;
  }

  if (pathname.startsWith('/shared/')) {
    await serveStatic(res, sharedRoot, pathname.replace(/^\/shared/, ''));
  } else {
    await serveStatic(res, webRoot, pathname);
  }
});

server.listen(PORT, () => {
  console.log(`Digital Patient Intake Agent demo server listening on http://localhost:${PORT}`);
});
