export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body });

/** Opens an SSE connection to a ledger and calls `onUpdate` with the fresh ledger on every change. */
export function subscribeToLedger(ledgerId, onUpdate) {
  const source = new EventSource(`/api/ledgers/${ledgerId}/stream`);
  source.onmessage = (event) => onUpdate(JSON.parse(event.data));
  return () => source.close();
}
