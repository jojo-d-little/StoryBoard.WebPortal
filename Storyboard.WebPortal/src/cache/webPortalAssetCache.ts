export type CachedAssetKind = "image-data-url" | "cue-catalog-json";

export interface CachedAssetEntry {
  cacheKey: string;
  gameId: string;
  gameKey: string;
  relativeLocator: string;
  kind: CachedAssetKind;
  contentType: string;
  value: string;
  byteLength: number;
  createdUtc: string;
  lastAccessUtc: string;
  expiresUtc: string;
}

export interface CachedAssetLookupResult {
  entry: CachedAssetEntry | null;
  source: "memory" | "indexeddb" | "none";
}

interface CachedAssetInput {
  cacheKey: string;
  gameId: string;
  gameKey: string;
  relativeLocator: string;
  kind: CachedAssetKind;
  contentType: string;
  value: string;
  ttlMs?: number;
}

interface CacheBudgetSettings {
  memoryMaxEntries: number;
  memoryMaxBytes: number;
  indexedDbMaxEntries: number;
  indexedDbMaxBytes: number;
  defaultTtlMs: number;
}

export interface WebPortalAssetCacheStats {
  lookupRequests: number;
  memoryHits: number;
  indexedDbHits: number;
  misses: number;
  networkFetches: number;
  writes: number;
  memoryEvictions: number;
  indexedDbEvictions: number;
  ttlExpirations: number;
  indexedDbErrors: number;
  parseFailures: number;
  memoryEntryCount: number;
  memoryBytes: number;
  indexedDbEntryCount: number;
  indexedDbBytes: number;
}

const DEFAULT_BUDGETS: CacheBudgetSettings = {
  memoryMaxEntries: 300,
  memoryMaxBytes: 64 * 1024 * 1024,
  indexedDbMaxEntries: 2000,
  indexedDbMaxBytes: 512 * 1024 * 1024,
  defaultTtlMs: 7 * 24 * 60 * 60 * 1000
};

const DB_NAME = "storyboard-webportal-cache";
const DB_VERSION = 1;
const STORE_NAME = "assetEntries";

export class WebPortalAssetCache {
  private readonly settings: CacheBudgetSettings;
  private readonly memoryByKey = new Map<string, CachedAssetEntry>();
  private memoryTotalBytes = 0;
  private dbOpenPromise: Promise<IDBDatabase | null> | null = null;
  private readonly stats: WebPortalAssetCacheStats = {
    lookupRequests: 0,
    memoryHits: 0,
    indexedDbHits: 0,
    misses: 0,
    networkFetches: 0,
    writes: 0,
    memoryEvictions: 0,
    indexedDbEvictions: 0,
    ttlExpirations: 0,
    indexedDbErrors: 0,
    parseFailures: 0,
    memoryEntryCount: 0,
    memoryBytes: 0,
    indexedDbEntryCount: 0,
    indexedDbBytes: 0
  };

  constructor(settings?: Partial<CacheBudgetSettings>) {
    this.settings = {
      ...DEFAULT_BUDGETS,
      ...(settings ?? {})
    };
  }

  async get(cacheKey: string): Promise<CachedAssetLookupResult> {
    this.stats.lookupRequests += 1;
    const memoryHit = this.memoryByKey.get(cacheKey);
    if (memoryHit) {
      if (new Date(memoryHit.expiresUtc).getTime() <= Date.now()) {
        this.stats.ttlExpirations += 1;
        this.memoryTotalBytes -= memoryHit.byteLength;
        this.memoryByKey.delete(cacheKey);
        this.refreshMemoryUsageStats();

        const database = await this.tryOpenDatabase();
        if (database) {
          await this.deleteIndexedDbEntry(database, cacheKey);
        }

        this.stats.misses += 1;

        return {
          entry: null,
          source: "none"
        };
      }

      const nowIso = new Date().toISOString();
      memoryHit.lastAccessUtc = nowIso;
      this.promoteMemoryEntry(memoryHit);
      this.touchIndexedDb(cacheKey, nowIso);
      this.stats.memoryHits += 1;
      return {
        entry: memoryHit,
        source: "memory"
      };
    }

    const database = await this.tryOpenDatabase();
    if (!database) {
      this.stats.misses += 1;
      return {
        entry: null,
        source: "none"
      };
    }

    const entry = await this.getByKeyFromIndexedDb(database, cacheKey);
    if (!entry) {
      this.stats.misses += 1;
      return {
        entry: null,
        source: "none"
      };
    }

    if (new Date(entry.expiresUtc).getTime() <= Date.now()) {
      this.stats.ttlExpirations += 1;
      await this.deleteIndexedDbEntry(database, cacheKey);
      this.stats.misses += 1;
      return {
        entry: null,
        source: "none"
      };
    }

    const nowIso = new Date().toISOString();
    entry.lastAccessUtc = nowIso;
    this.upsertMemoryEntry(entry);
    this.touchIndexedDb(cacheKey, nowIso);
    this.stats.indexedDbHits += 1;

    return {
      entry,
      source: "indexeddb"
    };
  }

  async set(input: CachedAssetInput): Promise<void> {
    const nowIso = new Date().toISOString();
    const ttlMs = typeof input.ttlMs === "number" && input.ttlMs > 0
      ? input.ttlMs
      : this.settings.defaultTtlMs;

    const entry: CachedAssetEntry = {
      cacheKey: input.cacheKey,
      gameId: input.gameId,
      gameKey: input.gameKey,
      relativeLocator: input.relativeLocator,
      kind: input.kind,
      contentType: input.contentType,
      value: input.value,
      byteLength: this.computeByteLength(input.value),
      createdUtc: nowIso,
      lastAccessUtc: nowIso,
      expiresUtc: new Date(Date.now() + ttlMs).toISOString()
    };

    this.upsertMemoryEntry(entry);
    this.stats.writes += 1;

    const database = await this.tryOpenDatabase();
    if (!database) {
      return;
    }

    await this.putIndexedDbEntry(database, entry);
    await this.pruneIndexedDb(database);
  }

  clearMemory(): void {
    this.memoryByKey.clear();
    this.memoryTotalBytes = 0;
    this.refreshMemoryUsageStats();
  }

  recordNetworkFetch(): void {
    this.stats.networkFetches += 1;
  }

  recordParseFailure(): void {
    this.stats.parseFailures += 1;
  }

  getStatsSnapshot(): WebPortalAssetCacheStats {
    return {
      ...this.stats
    };
  }

  resetStats(): void {
    this.stats.lookupRequests = 0;
    this.stats.memoryHits = 0;
    this.stats.indexedDbHits = 0;
    this.stats.misses = 0;
    this.stats.networkFetches = 0;
    this.stats.writes = 0;
    this.stats.memoryEvictions = 0;
    this.stats.indexedDbEvictions = 0;
    this.stats.ttlExpirations = 0;
    this.stats.indexedDbErrors = 0;
    this.stats.parseFailures = 0;
    this.refreshMemoryUsageStats();
  }

  async clearPersistent(): Promise<void> {
    const database = await this.tryOpenDatabase();
    if (!database) {
      this.stats.indexedDbEntryCount = 0;
      this.stats.indexedDbBytes = 0;
      return;
    }

    await this.clearIndexedDbStore(database);
    this.stats.indexedDbEntryCount = 0;
    this.stats.indexedDbBytes = 0;
  }

  private promoteMemoryEntry(entry: CachedAssetEntry): void {
    this.memoryByKey.delete(entry.cacheKey);
    this.memoryByKey.set(entry.cacheKey, entry);
  }

  private upsertMemoryEntry(entry: CachedAssetEntry): void {
    const existing = this.memoryByKey.get(entry.cacheKey);
    if (existing) {
      this.memoryTotalBytes -= existing.byteLength;
      this.memoryByKey.delete(entry.cacheKey);
    }

    this.memoryByKey.set(entry.cacheKey, entry);
    this.memoryTotalBytes += entry.byteLength;
    this.pruneMemory();
    this.refreshMemoryUsageStats();
  }

  private pruneMemory(): void {
    while (
      this.memoryByKey.size > this.settings.memoryMaxEntries
      || this.memoryTotalBytes > this.settings.memoryMaxBytes
    ) {
      const oldestKey = this.memoryByKey.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }

      const oldest = this.memoryByKey.get(oldestKey);
      if (oldest) {
        this.memoryTotalBytes -= oldest.byteLength;
      }
      this.memoryByKey.delete(oldestKey);
      this.stats.memoryEvictions += 1;
    }

    this.refreshMemoryUsageStats();
  }

  private computeByteLength(value: string): number {
    return new TextEncoder().encode(value).length;
  }

  private async tryOpenDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === "undefined") {
      return null;
    }

    if (!this.dbOpenPromise) {
      this.dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const database = request.result;
          let store: IDBObjectStore;
          if (database.objectStoreNames.contains(STORE_NAME)) {
            store = request.transaction!.objectStore(STORE_NAME);
          } else {
            store = database.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
          }

          if (!store.indexNames.contains("lastAccessUtc")) {
            store.createIndex("lastAccessUtc", "lastAccessUtc", { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
      }).catch(() => {
        this.stats.indexedDbErrors += 1;
        return null;
      });
    }

    const database = await this.dbOpenPromise;
    return database ?? null;
  }

  private async getByKeyFromIndexedDb(database: IDBDatabase, cacheKey: string): Promise<CachedAssetEntry | null> {
    return new Promise<CachedAssetEntry | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        const result = request.result as CachedAssetEntry | undefined;
        resolve(result ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB get failed."));
    }).catch(() => {
      this.stats.indexedDbErrors += 1;
      return null;
    });
  }

  private async putIndexedDbEntry(database: IDBDatabase, entry: CachedAssetEntry): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put(entry);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB put failed."));
    }).catch(() => {
      this.stats.indexedDbErrors += 1;
      return undefined;
    });
  }

  private async deleteIndexedDbEntry(database: IDBDatabase, cacheKey: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.delete(cacheKey);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB delete failed."));
    }).catch(() => {
      this.stats.indexedDbErrors += 1;
      return undefined;
    });
  }

  private async clearIndexedDbStore(database: IDBDatabase): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB clear failed."));
    }).catch(() => {
      this.stats.indexedDbErrors += 1;
      return undefined;
    });
  }

  private touchIndexedDb(cacheKey: string, lastAccessUtc: string): void {
    void (async () => {
      const database = await this.tryOpenDatabase();
      if (!database) {
        return;
      }

      const entry = await this.getByKeyFromIndexedDb(database, cacheKey);
      if (!entry) {
        return;
      }

      entry.lastAccessUtc = lastAccessUtc;
      await this.putIndexedDbEntry(database, entry);
    })();
  }

  private async pruneIndexedDb(database: IDBDatabase): Promise<void> {
    const allEntries = await this.getAllIndexedDbEntries(database);
    if (allEntries.length === 0) {
      return;
    }

    const nowMs = Date.now();
    const expiredEntries = allEntries.filter((entry) => new Date(entry.expiresUtc).getTime() <= nowMs);
    for (const expired of expiredEntries) {
      await this.deleteIndexedDbEntry(database, expired.cacheKey);
      this.stats.ttlExpirations += 1;
      this.stats.indexedDbEvictions += 1;
    }

    const remaining = (await this.getAllIndexedDbEntries(database))
      .sort((left, right) => {
        return new Date(left.lastAccessUtc).getTime() - new Date(right.lastAccessUtc).getTime();
      });

    let totalBytes = remaining.reduce((sum, entry) => sum + entry.byteLength, 0);
    let totalEntries = remaining.length;

    for (const entry of remaining) {
      if (totalEntries <= this.settings.indexedDbMaxEntries && totalBytes <= this.settings.indexedDbMaxBytes) {
        break;
      }

      await this.deleteIndexedDbEntry(database, entry.cacheKey);
      totalEntries -= 1;
      totalBytes -= entry.byteLength;
      this.stats.indexedDbEvictions += 1;
    }

    this.stats.indexedDbEntryCount = Math.max(0, totalEntries);
    this.stats.indexedDbBytes = Math.max(0, totalBytes);
  }

  private async getAllIndexedDbEntries(database: IDBDatabase): Promise<CachedAssetEntry[]> {
    return new Promise<CachedAssetEntry[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = Array.isArray(request.result)
          ? (request.result as CachedAssetEntry[])
          : [];
        resolve(result);
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB getAll failed."));
    }).catch(() => {
      this.stats.indexedDbErrors += 1;
      return [];
    });
  }

  private refreshMemoryUsageStats(): void {
    this.stats.memoryEntryCount = this.memoryByKey.size;
    this.stats.memoryBytes = Math.max(0, this.memoryTotalBytes);
  }
}

export interface BuildAssetCacheKeyInput {
  gameId: string;
  gameKey: string;
  relativeLocator: string;
  kind: CachedAssetKind;
}

export function buildAssetCacheKey(input: BuildAssetCacheKeyInput): string {
  return [
    "v1",
    input.kind,
    input.gameId.trim(),
    input.gameKey.trim(),
    input.relativeLocator.trim().toLowerCase()
  ].join("|");
}

export const webPortalAssetCache = new WebPortalAssetCache();
