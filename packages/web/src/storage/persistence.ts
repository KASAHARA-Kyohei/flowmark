const DB_NAME = 'flowmark';
const DB_VERSION = 1;
const STORE = 'kv';
const MARKDOWN_KEY = 'markdown';

type StorageBackend = {
  load: () => Promise<string | null>;
  save: (markdown: string) => Promise<void>;
};

function localStorageBackend(): StorageBackend {
  const key = 'flowmark:markdown';
  return {
    async load() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async save(markdown) {
      try {
        localStorage.setItem(key, markdown);
      } catch {
        // ignore
      }
    }
  };
}

function indexedDbBackend(): StorageBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  async function get(key: string): Promise<string | null> {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function set(key: string, value: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async load() {
      return await get(MARKDOWN_KEY);
    },
    async save(markdown) {
      await set(MARKDOWN_KEY, markdown);
    }
  };
}

function pickBackend(): StorageBackend {
  try {
    if (typeof indexedDB !== 'undefined') {
      return indexedDbBackend();
    }
  } catch {
    // ignore
  }
  return localStorageBackend();
}

const backend = pickBackend();

export async function loadMarkdown(): Promise<string | null> {
  try {
    return await backend.load();
  } catch {
    // fallback
    return await localStorageBackend().load();
  }
}

export async function saveMarkdown(markdown: string): Promise<void> {
  try {
    await backend.save(markdown);
  } catch {
    await localStorageBackend().save(markdown);
  }
}
