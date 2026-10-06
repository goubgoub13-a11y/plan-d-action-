/**
 * Export / import de sauvegarde (fichier JSON versionné).
 *
 * Format :
 * {
 *   "app": "immobilier-locatif",
 *   "schemaVersion": 1,
 *   "appVersion": "1.0.0",
 *   "exportedAt": "2026-10-03T10:12:00.000Z",
 *   "data": { "properties": [...], "settings": {...} }
 * }
 *
 * Aucune donnée n'est envoyée nulle part : le fichier est produit et relu localement.
 */
import { SCHEMA_VERSION, type AppData } from '../domain/types';
import { readAppData } from './schema';

export const BACKUP_APP_ID = 'immobilier-locatif';
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: AppData;
}

/** Migrations successives : la clé N transforme des données du schéma N en schéma N+1. */
export type Migrations = Record<number, (data: unknown) => unknown>;
export const MIGRATIONS: Migrations = {
  // Exemple pour plus tard : 1: (d) => ({ ...d, nouveauChamp: ... })
};

export function buildBackup(data: AppData, appVersion: string, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    data,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** immobilier-backup-2026-10-03.json (date locale de l'appareil). */
export function backupFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `immobilier-backup-${y}-${m}-${d}.json`;
}

export function migrateData(
  raw: unknown,
  from: number,
  to: number = SCHEMA_VERSION,
  migrations: Migrations = MIGRATIONS,
): unknown {
  let data = raw;
  for (let v = from; v < to; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`Aucune migration disponible de la version ${v} à ${v + 1}`);
    data = step(data);
  }
  return data;
}

export interface BackupSummary {
  schemaVersion: number;
  appVersion: string | null;
  exportedAt: string | null;
  propertyCount: number;
  movementCount: number;
  propertyNames: string[];
}

export type ParseResult =
  | { ok: true; data: AppData; summary: BackupSummary }
  | { ok: false; errors: string[] };

const fail = (...errors: string[]): ParseResult => ({ ok: false, errors });

/** Contrôle complet d'un fichier de sauvegarde. Ne modifie rien : renvoie soit les données validées, soit des erreurs lisibles. */
export function parseBackup(text: string, migrations: Migrations = MIGRATIONS): ParseResult {
  if (typeof text !== 'string' || text.trim() === '') return fail('Le fichier est vide.');
  if (text.length > MAX_BACKUP_BYTES) return fail('Le fichier est trop volumineux pour être une sauvegarde.');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("Ce fichier n'est pas un JSON valide (fichier tronqué ou endommagé ?).");
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail("Ce fichier n'a pas le format d'une sauvegarde de l'application.");
  }
  const file = raw as Record<string, unknown>;
  if (file.app !== BACKUP_APP_ID) {
    return fail("Ce fichier n'est pas une sauvegarde de cette application.");
  }
  const version = file.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail('Version de sauvegarde absente ou invalide.');
  }
  if (version > SCHEMA_VERSION) {
    return fail(
      `Cette sauvegarde (version ${version}) vient d'une version plus récente de l'application. Mettez l'application à jour avant de l'importer.`,
    );
  }

  let data: unknown;
  try {
    data = migrateData(file.data, version, SCHEMA_VERSION, migrations);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Migration de la sauvegarde impossible.');
  }

  const errors: string[] = [];
  const parsed = readAppData(data, errors);
  if (!parsed) {
    const shown = errors.slice(0, 5);
    if (errors.length > 5) shown.push(`… et ${errors.length - 5} autre(s) problème(s).`);
    return { ok: false, errors: shown };
  }
  return {
    ok: true,
    data: parsed,
    summary: {
      schemaVersion: version,
      appVersion: typeof file.appVersion === 'string' ? file.appVersion : null,
      exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : null,
      propertyCount: parsed.properties.length,
      movementCount: parsed.properties.reduce((n, p) => n + p.movements.length, 0),
      propertyNames: parsed.properties.map((p) => p.name),
    },
  };
}
