import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { buildBackup, parseBackup, serializeBackup } from '../src/backup/backup';
import { computeMetrics } from '../src/calc/metrics';
import { summarizeJournal } from '../src/calc/journal';
import { sampleData } from '../src/domain/factory';
import { IndexedDbStorage } from '../src/storage/indexedDb';
import { referenceProperty } from './helpers';

const fixtureText = readFileSync(new URL('./fixtures/backup-v1.0.0.json', import.meta.url), 'utf8');
const NOW = new Date('2026-10-03T10:12:00Z');
const valid = () => JSON.parse(serializeBackup(buildBackup(sampleData(NOW), '1.0.1', NOW)));
const parse = (o: unknown) => parseBackup(JSON.stringify(o));
const errorsOf = (o: unknown) => {
  const r = parse(o);
  return r.ok ? [] : r.errors;
};

describe('compatibilité : sauvegarde produite par la v1.0.0', () => {
  it('s’importe sans erreur ni perte', () => {
    const r = parseBackup(fixtureText);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const raw = JSON.parse(fixtureText);
    expect(r.summary.schemaVersion).toBe(1);
    expect(r.summary.appVersion).toBe('1.0.0');
    expect(r.data.properties).toEqual(raw.data.properties);
    expect(r.data.settings.customCategories).toEqual(raw.data.settings.customCategories);
  });

  it('ses indicateurs se calculent avec les règles v1.0.1 (charges récupérées neutres)', () => {
    const r = parseBackup(fixtureText);
    if (!r.ok) throw new Error('import');
    const p = r.data.properties[0];
    const actual = computeMetrics(p, 'actual');
    const j = summarizeJournal(p, r.data.settings.customCategories, { equity: actual.equity, acquired: p.phase === 'owned' });
    expect(j.recoverableReceived).toBe(40);
    expect(j.received).toBe(560); // loyer seul : les 40 € de charges récupérées ne sont pas une recette
    expect(j.personalInjected).toBeGreaterThan(0);
  });
});

describe('import : montants négatifs refusés', () => {
  const cases: [string, (d: ReturnType<typeof valid>) => void][] = [
    ['prix du bien', (d) => (d.data.properties[0].acquisition.price.planned = -60000)],
    ['frais de notaire (réel)', (d) => (d.data.properties[0].acquisition.notary.actual = -1)],
    ['travaux', (d) => (d.data.properties[0].acquisition.works.planned = -5000)],
    ['mobilier', (d) => (d.data.properties[0].acquisition.furniture.planned = -900)],
    ['montant du prêt', (d) => (d.data.properties[0].loan.borrowed.planned = -67650)],
    ['assurance emprunteur', (d) => (d.data.properties[0].loan.insuranceMonthly.actual = -19)],
    ['mensualité', (d) => (d.data.properties[0].loan.monthlyPayment.actual = -346)],
    ['taux', (d) => (d.data.properties[0].loan.ratePct.planned = -3.7)],
    ['durée', (d) => (d.data.properties[0].loan.durationMonths.planned = -300)],
    ['loyer', (d) => (d.data.properties[0].rental.rent.planned = -580)],
    ['charges récupérables', (d) => (d.data.properties[0].rental.recoverableCharges.planned = -40)],
    ['charge', (d) => (d.data.properties[0].charges[0].amount.planned = -600)],
    ['vacance', (d) => (d.data.properties[0].rental.vacancyMonthsPerYear = -1)],
    ['impayés', (d) => (d.data.properties[0].rental.unpaidPct = -5)],
    ['mouvement', (d) => (d.data.properties[0].movements[0].amount = -60000)],
  ];
  it.each(cases)('%s négatif → refusé', (_label, mutate) => {
    const d = valid();
    mutate(d);
    const errs = errorsOf(d);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('message explicite pour un prix négatif', () => {
    const d = valid();
    d.data.properties[0].acquisition.price.planned = -60000;
    expect(errorsOf(d)[0]).toMatch(/négative refusée/);
  });

  it('mouvement à 0 € refusé ; taux et durée hors bornes refusés', () => {
    const a = valid();
    a.data.properties[0].movements[0].amount = 0;
    expect(errorsOf(a)[0]).toMatch(/nul/);
    const b = valid();
    b.data.properties[0].loan.ratePct.planned = 250;
    expect(errorsOf(b).length).toBe(1);
    const c = valid();
    c.data.properties[0].loan.durationMonths.planned = 5000;
    expect(errorsOf(c).length).toBe(1);
  });

  it('les valeurs nulles (0 €) restent acceptées là où elles ont un sens', () => {
    const d = valid();
    d.data.properties[0].acquisition.agency = { planned: 0, actual: 0 };
    d.data.properties[0].loan.ratePct = { planned: 0, actual: 0 };
    expect(parse(d).ok).toBe(true);
  });
});

describe('import : identifiants dupliqués refusés', () => {
  it('deux mouvements avec le même identifiant', () => {
    const d = valid();
    const mvs = d.data.properties[0].movements;
    mvs[1].id = mvs[0].id;
    expect(errorsOf(d).join()).toMatch(/identifiant en double/);
  });

  it('même identifiant de mouvement dans deux biens différents', () => {
    const d = valid();
    const other = structuredClone(d.data.properties[0]);
    other.id = 'autre-bien';
    other.charges.forEach((c: { id: string }, i: number) => (c.id = `ch-autre-${i}`));
    d.data.properties.push(other); // mouvements identiques à ceux du 1er bien
    expect(errorsOf(d).join()).toMatch(/movements\[0\]\.id : identifiant en double/);
  });

  it('deux charges avec le même identifiant', () => {
    const d = valid();
    d.data.properties[0].charges[1].id = d.data.properties[0].charges[0].id;
    expect(errorsOf(d).join()).toMatch(/charges\[1\]\.id : identifiant en double/);
  });

  it('deux biens avec le même identifiant', () => {
    const d = valid();
    const twin = structuredClone(d.data.properties[0]);
    twin.movements = [];
    twin.charges = [];
    d.data.properties.push(twin);
    expect(errorsOf(d).join()).toMatch(/biens\[1\]\.id : identifiant en double/);
  });

  it('catégories personnalisées en double, ou reprenant un identifiant réservé', () => {
    const a = valid();
    a.data.settings.customCategories = [
      { id: 'cat-1', label: 'A', kind: 'expense' },
      { id: 'cat-1', label: 'B', kind: 'income' },
    ];
    expect(errorsOf(a).join()).toMatch(/identifiant en double/);
    const b = valid();
    b.data.settings.customCategories = [{ id: 'rent', label: 'Faux loyer', kind: 'income' }];
    expect(errorsOf(b).join()).toMatch(/réservé/);
  });
});

/** Écrit des enregistrements bruts (éventuellement corrompus) directement dans la base. */
async function seedRaw(factory: IDBFactory, name: string, properties: unknown[], settings?: unknown) {
  const storage = new IndexedDbStorage(factory, name);
  await storage.loadAll(); // crée la base
  storage.close();
  await new Promise<void>((resolve, reject) => {
    const open = factory.open(name);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['properties', 'settings'], 'readwrite');
      for (const p of properties) tx.objectStore('properties').put(p);
      if (settings !== undefined) tx.objectStore('settings').put({ key: 'app', value: settings });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
  return new IndexedDbStorage(factory, name);
}

describe('données locales endommagées', () => {
  it('un bien partiellement corrompu est récupéré, signalé et copié en quarantaine', async () => {
    const factory = new IDBFactory();
    const good = referenceProperty();
    const bad = structuredClone(referenceProperty()) as unknown as Record<string, any>;
    bad.id = 'bien-abime';
    bad.name = 'Studio abîmé';
    bad.acquisition.price = { planned: 'quatre-vingt mille', actual: null };
    bad.movements = [{ id: 'm-ok', date: '2026-10-01', type: 'income', amount: 500, categoryId: 'rent', note: '' }, { id: 'm-ko', date: 'hier' }];
    const storage = await seedRaw(factory, 'corrupt-1', [good, bad]);

    const { data, issues } = await storage.loadReport();
    expect(data.properties.map((p) => p.name).sort()).toEqual(['Studio abîmé', 'Test']); // rien n’a disparu
    const recovered = data.properties.find((p) => p.id === 'bien-abime')!;
    expect(recovered.acquisition.price.planned).toBeNull(); // champ illisible vidé
    expect(recovered.movements.map((m) => m.id)).toEqual(['m-ok']); // le sain est gardé
    expect(issues.join()).toMatch(/Studio abîmé.*partiellement/);

    const q = await storage.getQuarantine();
    expect(q).toHaveLength(1);
    expect((q[0].raw as { movements: unknown[] }).movements).toHaveLength(2); // copie brute intacte
  });

  it('un bien illisible n’est ni affiché ni effacé : il est mis de côté', async () => {
    const factory = new IDBFactory();
    const storage = await seedRaw(factory, 'corrupt-2', [referenceProperty(), { id: 'zzz', name: 42, acquisition: 'oups' }]);
    const { data, issues } = await storage.loadReport();
    // L’identifiant est lisible : récupération avec un nom par défaut.
    expect(data.properties.map((p) => p.name).sort()).toEqual(['Bien récupéré', 'Test']);
    expect(issues.length).toBe(1);
    expect(await storage.getQuarantine()).toHaveLength(1);
  });

  it('un enregistrement sans identifiant lisible est signalé, jamais effacé en silence', async () => {
    const factory = new IDBFactory();
    // keyPath « id » : on simule une valeur d’identifiant non textuelle.
    const storage = await seedRaw(factory, 'corrupt-3', [referenceProperty(), { id: 12345 }]);
    const { data, issues } = await storage.loadReport();
    expect(data.properties).toHaveLength(1);
    expect(issues.join()).toMatch(/illisible.*sans être effacé/);
    // Toujours présent en base (lecture suivante) et en quarantaine.
    const again = await storage.loadReport();
    expect(again.issues.length).toBe(1);
    expect(await storage.getQuarantine()).toHaveLength(1);
  });

  it('la quarantaine survit à un import (remplacement complet) et ne s’efface que sur demande', async () => {
    const factory = new IDBFactory();
    const storage = await seedRaw(factory, 'corrupt-4', [{ id: 'x', name: 'Cassé', acquisition: 1 }]);
    await storage.loadReport();
    await storage.replaceAll(sampleData(NOW));
    expect(await storage.getQuarantine()).toHaveLength(1);
    await storage.clearQuarantine();
    expect(await storage.getQuarantine()).toHaveLength(0);
  });

  it('réglages corrompus : valeurs par défaut, anomalie signalée', async () => {
    const factory = new IDBFactory();
    const storage = await seedRaw(factory, 'corrupt-5', [referenceProperty()], { customCategories: 'nope', activePropertyId: 7 });
    const { data, issues } = await storage.loadReport();
    expect(data.settings.customCategories).toEqual([]);
    expect(issues.join()).toMatch(/Réglages/);
  });

  it('identifiants de mouvements en double en base : renumérotés, aucun mouvement perdu', async () => {
    const factory = new IDBFactory();
    const a = referenceProperty();
    a.movements = [
      { id: 'dup', date: '2026-10-01', type: 'income', amount: 500, categoryId: 'rent', note: '' },
      { id: 'dup', date: '2026-11-01', type: 'income', amount: 510, categoryId: 'rent', note: '' },
    ];
    const storage = await seedRaw(factory, 'corrupt-6', [a]);
    const { data, issues } = await storage.loadReport();
    const ids = data.properties[0].movements.map((m) => m.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(issues.join()).toMatch(/en double/);
  });

  it('des données saines ne déclenchent aucune alerte', async () => {
    const factory = new IDBFactory();
    const storage = new IndexedDbStorage(factory, 'sain');
    await storage.replaceAll(sampleData(NOW));
    const { issues } = await storage.loadReport();
    expect(issues).toEqual([]);
    expect(await storage.getQuarantine()).toEqual([]);
  });

  it('migration de base : une base v1 (sans quarantaine) s’ouvre et conserve ses données', async () => {
    const factory = new IDBFactory();
    // Crée une base au format de la v1.0.0 (version IndexedDB 1, deux tables).
    await new Promise<void>((resolve, reject) => {
      const open = factory.open('ancienne', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('properties', { keyPath: 'id' });
        open.result.createObjectStore('settings', { keyPath: 'key' });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('properties', 'readwrite');
        tx.objectStore('properties').put(referenceProperty());
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
      open.onerror = () => reject(open.error);
    });
    const storage = new IndexedDbStorage(factory, 'ancienne');
    const { data, issues } = await storage.loadReport();
    expect(data.properties).toHaveLength(1);
    expect(issues).toEqual([]);
    expect(await storage.getQuarantine()).toEqual([]);
  });
});
