import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, CustomCategory, MovementType, Property } from '../domain/types';
import { emptyData, newProperty, sampleProperty } from '../domain/factory';
import { newId } from '../lib/id';
import { IndexedDbStorage } from '../storage/indexedDb';
import { MemoryStorage } from '../storage/memory';
import type { DataStorage } from '../storage/types';

type Status = 'loading' | 'ready';

export interface Store {
  status: Status;
  /** false si IndexedDB est indisponible : les données seraient perdues à la fermeture. */
  persistent: boolean;
  saveError: string | null;
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

async function openStorage(): Promise<{ storage: DataStorage; persistent: boolean; data: AppData }> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB indisponible');
    const storage = new IndexedDbStorage();
    const data = await storage.loadAll();
    return { storage, persistent: true, data };
  } catch (e) {
    console.warn('Stockage local indisponible, repli en mémoire', e);
    return { storage: new MemoryStorage(), persistent: false, data: emptyData() };
  }
}

export function StoreProvider({ children, storage: injected }: { children: ReactNode; storage?: DataStorage }) {
  const [status, setStatus] = useState<Status>('loading');
  const [persistent, setPersistent] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [data, setDataState] = useState<AppData>(emptyData());

  const storageRef = useRef<DataStorage | null>(null);
  const dataRef = useRef<AppData>(data);
  const savedRef = useRef<AppData>(data);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<number | undefined>(undefined);

  const enqueue = useCallback((job: () => Promise<void>) => {
    chain.current = chain.current
      .then(job)
      .then(() => setSaveError(null))
      .catch((e) => {
        console.error(e);
        setSaveError("L'enregistrement local a échoué. Exportez une sauvegarde dès que possible.");
      });
  }, []);

  /** Écrit uniquement ce qui a changé depuis la dernière écriture. */
  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const storage = storageRef.current;
    const cur = dataRef.current;
    const prev = savedRef.current;
    if (!storage || cur === prev) return;
    savedRef.current = cur;
    const prevById = new Map(prev.properties.map((p) => [p.id, p]));
    const curIds = new Set(cur.properties.map((p) => p.id));
    enqueue(async () => {
      for (const p of cur.properties) if (prevById.get(p.id) !== p) await storage.putProperty(p);
      for (const id of prevById.keys()) if (!curIds.has(id)) await storage.deleteProperty(id);
      if (cur.settings !== prev.settings) await storage.putSettings(cur.settings);
    });
  }, [enqueue]);

  const setData = useCallback(
    (updater: (d: AppData) => AppData) => {
      const next = updater(dataRef.current);
      if (next === dataRef.current) return;
      dataRef.current = next;
      setDataState(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 250);
    },
    [flush],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opened = injected
        ? { storage: injected, persistent: true, data: await injected.loadAll() }
        : await openStorage();
      if (cancelled) return;
      storageRef.current = opened.storage;
      const loaded = opened.data;
      if (!loaded.settings.activePropertyId && loaded.properties.length) {
        loaded.settings = { ...loaded.settings, activePropertyId: loaded.properties[0].id };
      }
      dataRef.current = loaded;
      savedRef.current = loaded;
      setDataState(loaded);
      setPersistent(opened.persistent);
      setStatus('ready');
      // Demande au navigateur de ne pas purger la base en cas de manque d'espace.
      navigator.storage?.persist?.().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [injected]);

  // Écriture immédiate quand l'application passe en arrière-plan ou se ferme.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

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

  const replaceAll = useCallback<Store['replaceAll']>(
    async (next) => {
      const storage = storageRef.current;
      if (!storage) throw new Error('Stockage non initialisé');
      window.clearTimeout(timer.current);
      await chain.current;
      await storage.replaceAll(next); // en cas d'échec : l'exception remonte, l'état reste inchangé
      dataRef.current = next;
      savedRef.current = next;
      setDataState(next);
    },
    [],
  );

  const wipe = useCallback(() => replaceAll(emptyData()), [replaceAll]);

  const property = useMemo(
    () => data.properties.find((p) => p.id === data.settings.activePropertyId) ?? data.properties[0] ?? null,
    [data],
  );

  const value = useMemo<Store>(
    () => ({
      status,
      persistent,
      saveError,
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
    [status, persistent, saveError, data, property, updateProperty, addProperty, addSample, deleteProperty, setActive, addCustomCategory, markBackupDone, replaceAll, wipe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
