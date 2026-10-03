import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, CustomCategory, MovementType, Property } from '../domain/types';
import { emptyData, newProperty, sampleProperty } from '../domain/factory';
import { newId } from '../lib/id';
import { IndexedDbStorage } from '../storage/indexedDb';
import { MemoryStorage } from '../storage/memory';
import type { DataStorage, QuarantineEntry } from '../storage/types';
import { Persister, type SaveStatus } from './persister';

type Status = 'loading' | 'ready';

export interface Store {
  status: Status;
  /** false si IndexedDB est indisponible : les données seraient perdues à la fermeture. */
  persistent: boolean;
  /** État de l'enregistrement local de la version affichée. */
  saveStatus: SaveStatus;
  /** Relance immédiatement l'enregistrement (après un échec). */
  retrySave: () => Promise<void>;
  /** Anomalies détectées dans les données locales au démarrage. */
  storageIssues: string[];
  /** Copies brutes des données locales endommagées (pour récupération manuelle). */
  getQuarantine: () => Promise<QuarantineEntry[]>;
  /** Supprime les copies en quarantaine (action explicite de l'utilisateur). */
  clearQuarantine: () => Promise<void>;
  data: AppData;
  property: Property | null;
  /** Modifie un bien : `recipe` reçoit une copie qu'il peut muter. */
  updateProperty: (id: string, recipe: (draft: Property) => void) => void;
  addProperty: (name: string) => string;
  addSample: () => void;
  deleteProperty: (id: string) => void;
  setActive: (id: string) => void;
  addCustomCategory: (label: string, kind: MovementType) => CustomCategory;
  markBackupDone: (when?: Date) => void;
  replaceAll: (data: AppData) => Promise<void>;
  wipe: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return s;
}

/** Bien actif, garanti présent (à utiliser dans les écrans affichés seulement quand un bien existe). */
export function useProperty(): Property {
  const { property } = useStore();
  if (!property) throw new Error('Aucun bien actif');
  return property;
}

async function openStorage(): Promise<{ storage: DataStorage; persistent: boolean; data: AppData; issues: string[] }> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB indisponible');
    const storage = new IndexedDbStorage();
    const { data, issues } = await storage.loadReport();
    return { storage, persistent: true, data, issues };
  } catch (e) {
    console.warn('Stockage local indisponible, repli en mémoire', e);
    return { storage: new MemoryStorage(), persistent: false, data: emptyData(), issues: [] };
  }
}

export function StoreProvider({ children, storage: injected }: { children: ReactNode; storage?: DataStorage }) {
  const [status, setStatus] = useState<Status>('loading');
  const [persistent, setPersistent] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [storageIssues, setStorageIssues] = useState<string[]>([]);
  const [data, setDataState] = useState<AppData>(emptyData());

  const storageRef = useRef<DataStorage | null>(null);
  const persisterRef = useRef<Persister | null>(null);
  const dataRef = useRef<AppData>(data);

  /** Toute modification passe par ici : mémoire d'abord, puis écriture fiable (cf. persister.ts). */
  const setData = useCallback((updater: (d: AppData) => AppData) => {
    const next = updater(dataRef.current);
    if (next === dataRef.current) return;
    dataRef.current = next;
    setDataState(next);
    persisterRef.current?.update(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opened = injected
        ? { storage: injected, persistent: true, ...(await injected.loadReport()) }
        : await openStorage();
      if (cancelled) return;
      storageRef.current = opened.storage;
      const loaded = opened.data;
      if (!loaded.settings.activePropertyId && loaded.properties.length) {
        loaded.settings = { ...loaded.settings, activePropertyId: loaded.properties[0].id };
      }
      dataRef.current = loaded;
      persisterRef.current?.dispose();
      persisterRef.current = new Persister(opened.storage, loaded, {
        onStatus: (st, err) => {
          if (err && st === 'error') console.error('Enregistrement local en échec', err);
          setSaveStatus(st);
        },
      });
      setDataState(loaded);
      setStorageIssues(opened.issues);
      setPersistent(opened.persistent);
      setStatus('ready');
      // Demande au navigateur de ne pas purger la base en cas de manque d'espace.
      navigator.storage?.persist?.().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      persisterRef.current?.dispose();
    };
  }, [injected]);

  // Écriture immédiate en arrière-plan / fermeture, et alerte si des modifications ne sont pas écrites.
  useEffect(() => {
    const flush = () => void persisterRef.current?.flush();
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (persisterRef.current?.isDirty()) {
        flush();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const retrySave = useCallback(async () => {
    await persisterRef.current?.flush();
  }, []);

  const getQuarantine = useCallback(async () => (storageRef.current ? storageRef.current.getQuarantine() : []), []);

  const clearQuarantine = useCallback(async () => {
    await storageRef.current?.clearQuarantine();
    setStorageIssues([]);
  }, []);

  const updateProperty = useCallback<Store['updateProperty']>(
    (id, recipe) =>
      setData((d) => {
        const idx = d.properties.findIndex((p) => p.id === id);
        if (idx < 0) return d;
        const draft = structuredClone(d.properties[idx]);
        recipe(draft);
        draft.updatedAt = new Date().toISOString();
        const properties = d.properties.slice();
        properties[idx] = draft;
        return { ...d, properties };
      }),
    [setData],
  );

  const addProperty = useCallback<Store['addProperty']>(
    (name) => {
      const p = newProperty(name.trim() || 'Mon appartement');
      setData((d) => ({
        properties: [...d.properties, p],
        settings: { ...d.settings, activePropertyId: p.id },
      }));
      return p.id;
    },
    [setData],
  );

  const addSample = useCallback(() => {
    const p = sampleProperty();
    setData((d) => ({
      properties: [...d.properties, p],
      settings: { ...d.settings, activePropertyId: p.id },
    }));
  }, [setData]);

  const deleteProperty = useCallback<Store['deleteProperty']>(
    (id) =>
      setData((d) => {
        const properties = d.properties.filter((p) => p.id !== id);
        const active =
          d.settings.activePropertyId === id ? (properties[0]?.id ?? null) : d.settings.activePropertyId;
        return { properties, settings: { ...d.settings, activePropertyId: active } };
      }),
    [setData],
  );

  const setActive = useCallback<Store['setActive']>(
    (id) => setData((d) => ({ ...d, settings: { ...d.settings, activePropertyId: id } })),
    [setData],
  );

  const addCustomCategory = useCallback<Store['addCustomCategory']>(
    (label, kind) => {
      const cat: CustomCategory = { id: newId('cat'), label: label.trim().slice(0, 80), kind };
      setData((d) => ({
        ...d,
        settings: { ...d.settings, customCategories: [...d.settings.customCategories, cat] },
      }));
      return cat;
    },
    [setData],
  );

  const markBackupDone = useCallback<Store['markBackupDone']>(
    (when = new Date()) =>
      setData((d) => ({ ...d, settings: { ...d.settings, lastBackupAt: when.toISOString() } })),
    [setData],
  );

  const replaceAll = useCallback<Store['replaceAll']>(async (next) => {
    const persister = persisterRef.current;
    if (!persister) throw new Error('Stockage non initialisé');
    await persister.replaceAll(next); // en cas d'échec : l'exception remonte, l'état reste inchangé
    dataRef.current = next;
    setDataState(next);
  }, []);

  const wipe = useCallback(() => replaceAll(emptyData()), [replaceAll]);

  const property = useMemo(
    () => data.properties.find((p) => p.id === data.settings.activePropertyId) ?? data.properties[0] ?? null,
    [data],
  );

  const value = useMemo<Store>(
    () => ({
      status,
      persistent,
      saveStatus,
      retrySave,
      storageIssues,
      getQuarantine,
      clearQuarantine,
      data,
      property,
      updateProperty,
      addProperty,
      addSample,
      deleteProperty,
      setActive,
      addCustomCategory,
      markBackupDone,
      replaceAll,
      wipe,
    }),
    [status, persistent, saveStatus, retrySave, storageIssues, getQuarantine, clearQuarantine, data, property, updateProperty, addProperty, addSample, deleteProperty, setActive, addCustomCategory, markBackupDone, replaceAll, wipe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
