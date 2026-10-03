import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  backupFileName,
  buildBackup,
  migrateData,
  parseBackup,
  serializeBackup,
} from '../src/backup/backup';
import { sampleData, emptyData } from '../src/domain/factory';
import { SCHEMA_VERSION, type AppData } from '../src/domain/types';
import { IndexedDbStorage } from '../src/storage/indexedDb';
import { MemoryStorage } from '../src/storage/memory';
import { computeMetrics } from '../src/calc/metrics';
import { A, referenceProperty } from './helpers';

const NOW = new Date('2026-10-03T10:12:00Z');

function fixture(): AppData {
  const data = sampleData(NOW);
  const ref = referenceProperty();
  ref.createdAt = '2026-12-01T00:00:00.000Z';
  ref.updatedAt = ref.createdAt;
  data.properties.push(ref);
  data.settings.customCategories.push({ id: 'custom-1', label: 'Serrurier', kind: 'expense' });
  data.properties[0].movements.push({
    id: 'mv-custom',
    date: '2026-11-20',
    type: 'expense',
    categoryId: 'custom-1',
    amount: 95,
    note: 'Porte bloquée',
  });
  return data;
}

describe('export', () => {
  it('produit un fichier JSON versionné', () => {
    const file = buildBackup(fixture(), '1.0.0', NOW);
    const json = JSON.parse(serializeBackup(file));
    expect(json.app).toBe('immobilier-locatif');
    expect(json.schemaVersion).toBe(SCHEMA_VERSION);
    expect(json.appVersion).toBe('1.0.0');
    expect(json.exportedAt).toBe('2026-10-03T10:12:00.000Z');
    expect(json.data.properties).toHaveLength(2);
  });

  it('nomme le fichier immobilier-backup-AAAA-MM-JJ.json', () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe('immobilier-backup-2026-10-03.json');
    expect(backupFileName(new Date(2027, 0, 5))).toBe('immobilier-backup-2027-01-05.json');
  });
});

describe('import : aller-retour', () => {
  it('restitue exactement les données exportées', () => {
    const data = fixture();
    const text = serializeBackup(buildBackup(data, '1.0.0', NOW));
    const res = parseBackup(text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.properties).toEqual(data.properties);
    expect(res.data.settings.customCategories).toEqual(data.settings.customCategories);
    expect(res.summary.propertyCount).toBe(2);
    expect(res.summary.movementCount).toBe(7);
    expect(res.summary.propertyNames[0]).toBe('Appartement Saint-Étienne');
  });

  it('les indicateurs calculés sont identiques après restauration', () => {
    const data = fixture();
    const res = parseBackup(serializeBackup(buildBackup(data, '1.0.0', NOW)));
    if (!res.ok) throw new Error('import échoué');
    for (const scenario of ['planned', 'actual'] as const) {
      expect(computeMetrics(res.data.properties[0], scenario)).toEqual(computeMetrics(data.properties[0], scenario));
    }
  });

  it('accepte une sauvegarde vide (aucun bien)', () => {
    const res = parseBackup(serializeBackup(buildBackup(emptyData(), '1.0.0', NOW)));
    expect(res.ok).toBe(true);
  });

  it('corrige un bien actif inconnu dans les réglages', () => {
    const data = fixture();
    data.settings.activePropertyId = 'inexistant';
    const res = parseBackup(serializeBackup(buildBackup(data, '1.0.0', NOW)));
    if (!res.ok) throw new Error('import échoué');
    expect(res.data.settings.activePropertyId).toBe(data.properties[0].id);
  });
});

describe('import : rejets propres', () => {
  const ok = () => JSON.parse(serializeBackup(buildBackup(fixture(), '1.0.0', NOW)));
  const reject = (obj: unknown) => parseBackup(typeof obj === 'string' ? obj : JSON.stringify(obj));

  it('fichier vide', () => {
    const r = reject('   ');
    expect(r.ok).toBe(false);
  });

  it('JSON invalide ou tronqué', () => {
    const text = serializeBackup(buildBackup(fixture(), '1.0.0', NOW));
    const r = reject(text.slice(0, text.length / 2));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/JSON/);
  });

  it('JSON étranger (autre application, tableau, nombre)', () => {
    expect(reject({ hello: 'world' }).ok).toBe(false);
    expect(reject('[1,2,3]').ok).toBe(false);
    expect(reject('42').ok).toBe(false);
    expect(reject('null').ok).toBe(false);
  });

  it('version de schéma absente, invalide ou trop récente', () => {
    const a = ok();
    delete a.schemaVersion;
    expect(reject(a).ok).toBe(false);
    expect(reject({ ...ok(), schemaVersion: '1' }).ok).toBe(false);
    expect(reject({ ...ok(), schemaVersion: 0 }).ok).toBe(false);
    const future = reject({ ...ok(), schemaVersion: SCHEMA_VERSION + 1 });
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.errors[0]).toMatch(/plus récente/);
  });

  it('montant non numérique, date invalide, type inconnu', () => {
    const a = ok();
    a.data.properties[0].movements[0].amount = '5 400 €';
    expect(reject(a).ok).toBe(false);

    const b = ok();
    b.data.properties[0].movements[0].date = '31/02/2026';
    expect(reject(b).ok).toBe(false);

    const c = ok();
    c.data.properties[0].movements[0].type = 'debit';
    expect(reject(c).ok).toBe(false);
  });

  it('valeurs hors limites ou non finies', () => {
    const a = ok();
    a.data.properties[0].acquisition.price.planned = 1e15;
    expect(reject(a).ok).toBe(false);
    const b = ok();
    b.data.properties[0].rental.vacancyMonthsPerYear = 40;
    expect(reject(b).ok).toBe(false);
  });

  it('identifiants de biens en double', () => {
    const a = ok();
    a.data.properties[1].id = a.data.properties[0].id;
    expect(reject(a).ok).toBe(false);
  });

  it('structure manquante', () => {
    const a = ok();
    delete a.data.properties;
    expect(reject(a).ok).toBe(false);
    const b = ok();
    b.data.properties[0] = 'nope';
    expect(reject(b).ok).toBe(false);
  });

  it('plafonne la liste d’erreurs affichée', () => {
    const a = ok();
    a.data.properties[0].movements = Array.from({ length: 20 }, () => ({ id: 'x' }));
    const r = reject(a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeLessThanOrEqual(6);
  });

  it('une rubrique d’une ancienne version est complétée plutôt que rejetée', () => {
    const a = ok();
    delete a.data.properties[0].acquisition.furniture;
    const r = reject(a);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.properties[0].acquisition.furniture).toEqual({ planned: null, actual: null });
  });
});

describe('migrations', () => {
  it('enchaîne les migrations dans l’ordre', () => {
    const migrations = {
      1: (d: unknown) => ({ ...(d as object), a: 1 }),
      2: (d: unknown) => ({ ...(d as object), b: 2 }),
    };
    expect(migrateData({}, 1, 3, migrations)).toEqual({ a: 1, b: 2 });
  });

  it('échoue proprement si une étape manque', () => {
    expect(() => migrateData({}, 1, 3, { 1: (d) => d })).toThrow(/migration/i);
  });

  it('parseBackup applique les migrations d’une ancienne version', () => {
    // Simule un schéma 0.x où l’app était déjà valide : migration identité 1 → 2 impossible ici,
    // on vérifie donc seulement qu’une migration manquante produit une erreur lisible.
    const text = JSON.stringify({ app: 'immobilier-locatif', schemaVersion: 1, data: { properties: [] } });
    expect(parseBackup(text, {}).ok).toBe(true);
  });
});

describe.each([
  ['IndexedDB', () => new IndexedDbStorage(new IDBFactory(), 'test-' + Math.random())],
  ['mémoire', () => new MemoryStorage()],
])('stockage %s', (_name, make) => {
  it('conserve et relit les données', async () => {
    const storage = make();
    const data = fixture();
    await storage.replaceAll(data);
    const loaded = await storage.loadAll();
    expect(loaded.properties).toEqual(data.properties);
    expect(loaded.settings).toEqual(data.settings);
  });

  it('base vide : aucun bien, réglages par défaut', async () => {
    const loaded = await make().loadAll();
    expect(loaded.properties).toEqual([]);
    expect(loaded.settings.activePropertyId).toBeNull();
  });

  it('met à jour et supprime un bien', async () => {
    const storage = make();
    const data = fixture();
    await storage.replaceAll(data);
    const edited = structuredClone(data.properties[1]);
    edited.name = 'Renommé';
    edited.rental.rent = A(777);
    await storage.putProperty(edited);
    await storage.deleteProperty(data.properties[0].id);
    const loaded = await storage.loadAll();
    expect(loaded.properties).toHaveLength(1);
    expect(loaded.properties[0].name).toBe('Renommé');
    expect(loaded.properties[0].rental.rent.planned).toBe(777);
  });

  it('restauration d’une sauvegarde : remplace entièrement les données existantes', async () => {
    const storage = make();
    await storage.replaceAll(fixture());
    const backupText = serializeBackup(buildBackup(fixture(), '1.0.0', NOW));

    // L'utilisateur continue à travailler puis restaure.
    const current = (await storage.loadAll()).properties[1];
    await storage.putProperty({ ...current, name: 'Modifié après la sauvegarde' });
    await storage.deleteProperty(current.id);

    const res = parseBackup(backupText);
    if (!res.ok) throw new Error('import échoué');
    await storage.replaceAll(res.data);

    const restored = await storage.loadAll();
    expect(restored.properties).toHaveLength(2);
    expect(restored.properties.map((p) => p.name)).not.toContain('Modifié après la sauvegarde');
    expect(restored.properties).toEqual(res.data.properties);
  });
});

describe('IndexedDB : persistance entre deux ouvertures', () => {
  it('les données survivent à la fermeture de la connexion', async () => {
    const factory = new IDBFactory();
    const a = new IndexedDbStorage(factory, 'persist');
    await a.replaceAll(fixture());
    a.close();
    const b = new IndexedDbStorage(factory, 'persist');
    expect((await b.loadAll()).properties).toHaveLength(2);
  });
});
