/**
 * NSC Offline Outbox (Wave 11)
 * FIFO queue of server mutations that failed due to network loss.
 * Persisted in IndexedDB (localStorage fallback, memory fallback for tests).
 *
 * IMPORTANT: this module must never import backendApi (cycle).
 * The replay sender is injected by the caller.
 */

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: string;
  body?: string;
  createdAt: number;
  attempts: number;
}

export interface OutboxAdapter {
  load(): Promise<QueuedMutation[]>;
  save(items: QueuedMutation[]): Promise<void>;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------------- adapters ---------------- */

export function createMemoryAdapter(initial: QueuedMutation[] = []): OutboxAdapter {
  let items = [...initial];
  return {
    async load() { return [...items]; },
    async save(next) { items = [...next]; },
  };
}

export function createLocalStorageAdapter(key = 'nsc_offline_outbox'): OutboxAdapter {
  return {
    async load() {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(arr) ? arr : [];
        return list
          .filter((m): m is QueuedMutation => !!m && typeof m.endpoint === 'string')
          .sort((a, b) => a.createdAt - b.createdAt);
      } catch {
        return [];
      }
    },
    async save(items) {
      // Propagate quota/private-mode failures so the caller can report honestly.
      localStorage.setItem(key, JSON.stringify(items));
    },
  };
}

export function createIndexedDbAdapter(dbName = 'nsc_offline', storeName = 'outbox'): OutboxAdapter {
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no-idb'));
      return;
    }
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb-open-failed'));
  });

  return {
    async load() {
      const db = await open();
      try {
        const rows: QueuedMutation[] = await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const req = tx.objectStore(storeName).getAll();
          req.onsuccess = () => resolve((req.result || []) as QueuedMutation[]);
          req.onerror = () => reject(req.error || new Error('idb-read-failed'));
        });
        return rows.sort((a, b) => a.createdAt - b.createdAt);
      } finally {
        db.close();
      }
    },
    async save(items) {
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          store.clear();
          for (const it of items) store.put(it);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('idb-write-failed'));
        });
      } finally {
        db.close();
      }
    },
  };
}

/* ---------------- outbox ---------------- */

export interface Outbox {
  enqueue(input: { endpoint: string; method: string; body?: string }): Promise<QueuedMutation>;
  list(): Promise<QueuedMutation[]>;
  remove(id: string): Promise<void>;
  markAttempt(id: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
  subscribe(listener: (count: number) => void): () => void;
}

export function createOutbox(adapter: OutboxAdapter): Outbox {
  const listeners = new Set<(count: number) => void>();
  const emit = async () => {
    try {
      const n = (await adapter.load()).length;
      listeners.forEach(l => {
        try { l(n); } catch { /* listener bugs must not break the queue */ }
      });
    } catch { /* storage failure — listeners stay on last known count */ }
  };

  return {
    async enqueue(input) {
      const endpoint = (input.endpoint || '').trim();
      const method = (input.method || '').toUpperCase();
      if (!endpoint) throw new Error('endpoint-required');
      if (!method || method === 'GET' || method === 'HEAD') throw new Error('method-not-queueable');
      const item: QueuedMutation = {
        id: uid(),
        endpoint,
        method,
        body: input.body,
        createdAt: Date.now(),
        attempts: 0,
      };
      const items = await adapter.load();
      items.push(item);
      await adapter.save(items);
      void emit();
      return item;
    },

    async list() {
      return adapter.load();
    },

    async remove(id) {
      const items = await adapter.load();
      await adapter.save(items.filter(m => m.id !== id));
      void emit();
    },

    async markAttempt(id) {
      const items = await adapter.load();
      const m = items.find(x => x.id === id);
      if (m) {
        m.attempts += 1;
        await adapter.save(items);
      }
    },

    async clear() {
      await adapter.save([]);
      void emit();
    },

    async count() {
      return (await adapter.load()).length;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/* ---------------- replay ---------------- */

export interface SyncResult {
  sent: number;
  failed: number;
  remaining: number;
}

/** Replay the queue FIFO. Failed items stay queued with attempts+1. */
export async function syncOutbox(
  outbox: Outbox,
  sender: (m: QueuedMutation) => Promise<boolean>,
): Promise<SyncResult> {
  const items = await outbox.list();
  let sent = 0;
  let failed = 0;
  for (const m of items) {
    let ok = false;
    try {
      ok = await sender(m);
    } catch {
      ok = false;
    }
    if (ok) {
      await outbox.remove(m.id);
      sent += 1;
    } else {
      await outbox.markAttempt(m.id);
      failed += 1;
    }
  }
  return { sent, failed, remaining: await outbox.count() };
}
