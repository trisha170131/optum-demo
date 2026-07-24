import { eventBus } from '../eventbus/EventBus.js';

/**
 * Server-Sent Events stream for a single Task Ledger. Every channel's UI (chat, web form,
 * dashboard) opens one of these per ledger it cares about, so a task completed on one channel
 * appears immediately on every other open surface — no polling.
 */
export function handleLedgerStream(req, res, ledgerService, ledgerId) {
  const ledger = ledgerService.getLedger(ledgerId);
  if (!ledger) {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify(ledger)}\n\n`);

  const unsubscribe = eventBus.subscribe('ledger.updated', (updated) => {
    if (updated.id !== ledgerId) return;
    res.write(`data: ${JSON.stringify(updated)}\n\n`);
  });

  req.on('close', unsubscribe);
}
