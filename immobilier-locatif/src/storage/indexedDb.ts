import type { AppData, Property, Settings } from '../domain/types';
import { emptySettings } from '../domain/factory';
import { normalizeProperty, normalizeSettings } from '../backup/schema';
import type { DataStorage } from './types';

const DB_NAME = 'immobilier-locatif';
const DB_VERSION = 1;
const PROPERTIES = 'properties';
const SETTINGS = 'settings';
const SETTINGS_KEY = 'app';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('Erreur IndexedDB'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Erreur IndexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
  });
}

export class IndexedDbStorage implements DataStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory = indexedDB, private readonly name = DB_NAME) {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const open = this.factory.open(this.name, DB_VERSION);
        open.onupgradeneeded = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(PROPERTIES)) db.createObjectStore(PROPERTIES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: 'key' });
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error ?? new Error("Impossible d'ouvrir la base locale"));
        open.onblocked = () => reject(new Error('Base locale bloquée par un autre onglet'));
      });
    }
    return this.dbPromise;
  }

  async loadAll(): Promise<AppData> {
    const db = await this.db();
    const tx = db.transaction([PROPERTIES, SETTINGS], 'readonly');
    const [rawProps, rawSettings] = await Promise.all([
      req(tx.objectStore(PROPERTIES).getAll()),
      req(tx.objectStore(SETTINGS).get(SETTINGS_KEY)),
    ]);
    const properties = (rawProps as unknown[])
      .map((p) => normalizeProperty(p))
      .filter((p): p is Property => p !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const settings = rawSettings
      ? normalizeSettings((rawSettings as { value: unknown }).value)
      : emptySettings();
    return { properties, settings };
  }

  async putProperty(p: Property): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(PROPERTIES, 'readwrite');
    tx.objectStore(PROPERTIES).put(p);
    await done(tx);
  }

  async deleteProperty(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(PROPERTIES, 'readwrite');
    tx.objectStore(PROPERTIES).delete(id);
    await done(tx);
  }

  async putSettings(s: Settings): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(SETTINGS, 'readwrite');
    tx.objectStore(SETTINGS).put({ key: SETTINGS_KEY, value: s });
    await done(tx);
  }

  async replaceAll(data: AppData): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([PROPERTIES, SETTINGS], 'readwrite');
    const props = tx.objectStore(PROPERTIES);
    props.clear();
    for (const p of data.properties) props.put(p);
    const settings = tx.objectStore(SETTINGS);
    settings.clear();
    settings.put({ key: SETTINGS_KEY, value: data.settings });
    await done(tx);
  }

  close(): void {
    this.dbPromise?.then((db) => db.close()).catch(() => undefined);
    this.dbPromise = null;
  }
}
