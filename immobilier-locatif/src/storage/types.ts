import type { AppData, Property, Settings } from '../domain/types';

/** Contrat de persistance : l'interface ne connaît que celui-ci, jamais IndexedDB directement. */
export interface DataStorage {
  loadAll(): Promise<AppData>;
  putProperty(p: Property): Promise<void>;
  deleteProperty(id: string): Promise<void>;
  putSettings(s: Settings): Promise<void>;
  /** Remplace atomiquement tout le contenu (import d'une sauvegarde, effacement). */
  replaceAll(data: AppData): Promise<void>;
}
