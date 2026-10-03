import type { AppData, Property, Settings } from '../domain/types';
import { emptySettings } from '../domain/factory';
import { recoverProperty, recoverSettings, repairDuplicateIds } from '../backup/schema';
import { newId } from '../lib/id';
import type { DataStorage, LoadReport, QuarantineEntry } from './types';

const DB_NAME = 'immobilier-locatif';
/** v2 (app 1.0.1) : ajout de la table « quarantine ». Les tables existantes sont conservées telles quelles. */
const DB_VERSION = 2;
const PROPERTIES = 'properties';
const SETTINGS = 'settings';
const QUARANTINE = 'quarantine';
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
          if (!db.objectStoreNames.contains(QUARANTINE)) db.createObjectStore(QUARANTINE, { keyPath: 'key' });
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error ?? new Error("Impossible d'ouvrir la base locale"));
        open.onblocked = () => reject(new Error('Base locale bloquée par un autre onglet'));
      });
    }
    return this.dbPromise;
  }

  /**
   * Lit toutes les données. Un enregistrement endommagé n'est jamais ignoré en silence :
   *  - ce qui est sain est conservé (bien partiellement récupéré si possible) ;
   *  - une copie brute de l'enregistrement d'origine est placée en quarantaine (jamais effacée
   *    automatiquement), téléchargeable depuis l'application ;
   *  - l'anomalie est renvoyée dans `issues` pour être affichée.
   * Rien n'est réécrit dans la table des biens à cette étape.
   */
  async loadReport(): Promise<LoadReport> {
    const db = await this.db();
    const tx = db.transaction([PROPERTIES, SETTINGS], 'readonly');
    const [rawProps, rawSettings] = await Promise.all([
      req(tx.objectStore(PROPERTIES).getAll()),
      req(tx.objectStore(SETTINGS).get(SETTINGS_KEY)),
    ]);
    const issues: string[] = [];
    const toQuarantine: QuarantineEntry[] = [];
    const now = new Date().toISOString();

    const properties: Property[] = [];
    (rawProps as unknown[]).forEach((raw, i) => {
      const { property, errors } = recoverProperty(raw);
      if (errors.length === 0 && property) {
        properties.push(property);
        return;
      }
      const rawId = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : `illisible-${i}`;
      toQuarantine.push({ key: `property:${rawId}`, detectedAt: now, source: 'property', raw, errors });
      if (property) {
        properties.push(property);
        issues.push(`« ${property.name} » : données partiellement endommagées, récupérées (${errors.length} anomalie${errors.length > 1 ? 's' : ''}).`);
      } else {
        issues.push('Un bien enregistré est illisible : il a été mis de côté sans être effacé.');
      }
    });
    properties.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let settings = emptySettings();
    if (rawSettings) {
      const rawValue = (rawSettings as { value: unknown }).value;
      const r = recoverSettings(rawValue);
      settings = r.settings;
      if (r.errors.length) {
        toQuarantine.push({ key: 'settings', detectedAt: now, source: 'settings', raw: rawValue, errors: r.errors });
        issues.push('Réglages partiellement endommagés : valeurs par défaut utilisées pour les éléments illisibles.');
      }
    }

    const fixes = repairDuplicateIds(properties, settings, newId);
    if (fixes.length) issues.push(...fixes);

    if (toQuarantine.length) await this.quarantine(toQuarantine);
    return { data: { properties, settings }, issues };
  }

  async loadAll(): Promise<AppData> {
    return (await this.loadReport()).data;
  }

  /** Ajoute des copies en quarantaine sans écraser une copie déjà présente (on garde la plus ancienne). */
  private async quarantine(entries: QuarantineEntry[]): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(QUARANTINE, 'readwrite');
    const finished = done(tx);
    const store = tx.objectStore(QUARANTINE);
    for (const e of entries) {
      const existing = await req(store.get(e.key));
      if (!existing) store.put(e);
    }
    await finished;
  }

  async getQuarantine(): Promise<QuarantineEntry[]> {
    const db = await this.db();
    const tx = db.transaction(QUARANTINE, 'readonly');
    return (await req(tx.objectStore(QUARANTINE).getAll())) as QuarantineEntry[];
  }

  async clearQuarantine(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(QUARANTINE, 'readwrite');
    tx.objectStore(QUARANTINE).clear();
    await done(tx);
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
