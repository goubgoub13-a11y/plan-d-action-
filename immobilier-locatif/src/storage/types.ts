import type { AppData, Property, Settings } from '../domain/types';

/** Copie d'un enregistrement local endommagé, conservée telle quelle pour récupération manuelle. */
export interface QuarantineEntry {
  key: string;
  detectedAt: string;
  /** « property » ou « settings ». */
  source: string;
  /** Contenu brut d'origine, non modifié. */
  raw: unknown;
  errors: string[];
}

export interface LoadReport {
  /** Données utilisables (saines ou partiellement récupérées). */
  data: AppData;
  /** Anomalies détectées pendant cette lecture (vide = tout est sain). */
  issues: string[];
}

/** Contrat de persistance : l'interface ne connaît que celui-ci, jamais IndexedDB directement. */
export interface DataStorage {
  /** Lit tout en signalant (sans les effacer) les données endommagées. */
  loadReport(): Promise<LoadReport>;
  loadAll(): Promise<AppData>;
  putProperty(p: Property): Promise<void>;
  deleteProperty(id: string): Promise<void>;
  putSettings(s: Settings): Promise<void>;
  /** Remplace atomiquement tout le contenu (import d'une sauvegarde, effacement). La quarantaine est conservée. */
  replaceAll(data: AppData): Promise<void>;
  /** Copies des enregistrements endommagés détectés. */
  getQuarantine(): Promise<QuarantineEntry[]>;
  clearQuarantine(): Promise<void>;
}
