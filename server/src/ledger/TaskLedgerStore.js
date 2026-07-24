import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', 'data', 'ledgers.json');

/**
 * Repository interface for TaskLedger persistence. `JsonFileTaskLedgerStore` is the demo impl
 * ("SQLite or in-memory is fine for the demo" per the brief — this is the file-backed flavor of
 * that, so state survives a server restart without a native DB driver). Production should swap
 * this for a real datastore (Postgres, DynamoDB, etc.) behind the same interface.
 */
export class TaskLedgerStore {
  all() {
    throw new Error('not implemented');
  }
  save(_ledger) {
    throw new Error('not implemented');
  }
}

export class JsonFileTaskLedgerStore extends TaskLedgerStore {
  constructor(path = DEFAULT_PATH) {
    super();
    this.path = path;
    this._cache = this._load();
  }

  _load() {
    if (!existsSync(this.path)) return {};
    try {
      return JSON.parse(readFileSync(this.path, 'utf-8'));
    } catch {
      return {};
    }
  }

  _persist() {
    writeFileSync(this.path, JSON.stringify(this._cache, null, 2));
  }

  all() {
    return Object.values(this._cache);
  }

  get(id) {
    return this._cache[id] ?? null;
  }

  save(ledger) {
    this._cache[ledger.id] = ledger;
    this._persist();
    return ledger;
  }
}
