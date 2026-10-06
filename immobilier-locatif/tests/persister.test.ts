import { describe, expect, it } from 'vitest';
import { Persister, type SaveStatus } from '../src/state/persister';
import { MemoryStorage } from '../src/storage/memory';
import { emptyData, newProperty } from '../src/domain/factory';
import type { AppData, Property, Settings } from '../src/domain/types';

/** Stockage mémoire contrôlable : échecs à la demande, écritures retenues (latence). */
class FlakyStorage extends MemoryStorage {
  failNext = 0;
  failAlways = false;
  writes: string[] = [];
  private gate: Promise<void> | null = null;
  private release: (() => void) | null = null;

  hold() {
    this.gate = new Promise((r) => (this.release = r));
  }
  unhold() {
    this.release?.();
    this.gate = null;
  }
  private async maybeFail(op: string) {
    if (this.gate) await this.gate;
    if (this.failAlways || this.failNext > 0) {
      this.failNext = Math.max(0, this.failNext - 1);
      throw new Error(`échec simulé : ${op}`);
    }
    this.writes.push(op);
  }
  override async putProperty(p: Property) {
    await this.maybeFail(`put:${p.name}`);
    return super.putProperty(p);
  }
  override async deleteProperty(id: string) {
    await this.maybeFail(`del:${id}`);
    return super.deleteProperty(id);
  }
  override async putSettings(s: Settings) {
    await this.maybeFail('settings');
    return super.putSettings(s);
  }
}

/** Minuteur manuel : rien ne se déclenche tout seul. */
function manualTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  return {
    setTimer: (fn: () => void, ms: number) => {
      pending.set(++n, { fn, ms });
      return n;
    },
    clearTimer: (h: unknown) => void pending.delete(h as number),
    /** Déclenche tous les minuteurs en attente. */
    fire() {
      const all = [...pending.values()];
      pending.clear();
      all.forEach((t) => t.fn());
    },
    delays: () => [...pending.values()].map((t) => t.ms),
    count: () => pending.size,
  };
}

const withName = (d: AppData, name: string): AppData => {
  const p = { ...d.properties[0], name };
  return { ...d, properties: [p, ...d.properties.slice(1)] };
};

function setup() {
  const storage = new FlakyStorage();
  const timers = manualTimers();
  const statuses: SaveStatus[] = [];
  const base: AppData = { ...emptyData(), properties: [newProperty('v0', new Date('2026-01-01'))] };
  const persister = new Persister(storage, base, {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    retryDelaysMs: [1000, 5000],
    onStatus: (s) => statuses.push(s),
  });
  return { storage, timers, statuses, base, persister };
}

const storedName = async (s: MemoryStorage) => (await s.loadAll()).properties[0]?.name;

describe('persistance locale fiable', () => {
  it('une modification est marquée non enregistrée jusqu’à la fin réussie de l’écriture', async () => {
    const { storage, persister, base } = setup();
    persister.update(withName(base, 'v1'));
    expect(persister.isDirty()).toBe(true);
    expect(persister.getStatus()).toBe('pending');
    await persister.flush();
    expect(persister.isDirty()).toBe(false);
    expect(persister.getStatus()).toBe('saved');
    expect(await storedName(storage)).toBe('v1');
  });

  it('échec IndexedDB : la version reste non enregistrée, l’erreur est signalée', async () => {
    const { storage, persister, base } = setup();
    storage.failAlways = true;
    persister.update(withName(base, 'v1'));
    await persister.flush();
    expect(persister.getStatus()).toBe('error');
    expect(persister.isDirty()).toBe(true);
    expect(await storedName(storage)).toBeUndefined();
  });

  it('nouvelle tentative automatique après échec, puis succès', async () => {
    const { storage, persister, base, timers } = setup();
    storage.failNext = 1;
    persister.update(withName(base, 'v1'));
    await persister.flush();
    expect(persister.getStatus()).toBe('error');
    expect(timers.delays()).toEqual([1000]); // tentative planifiée
    timers.fire();
    await persister.flush();
    expect(persister.getStatus()).toBe('saved');
    expect(await storedName(storage)).toBe('v1');
  });

  it('les délais de nouvelle tentative s’allongent et la tentative manuelle reste possible', async () => {
    const { storage, persister, base, timers } = setup();
    storage.failAlways = true;
    persister.update(withName(base, 'v1'));
    await persister.flush();
    expect(timers.delays()).toEqual([1000]);
    await persister.flush(); // « Réessayer »
    expect(timers.delays()).toEqual([5000]);
    storage.failAlways = false;
    await persister.flush();
    expect(persister.getStatus()).toBe('saved');
    expect(timers.count()).toBe(0);
  });

  it('un échec partiel est intégralement rejoué (aucune modification perdue)', async () => {
    const { storage, persister, base } = setup();
    const second = newProperty('B', new Date('2026-02-01'));
    persister.update({ ...withName(base, 'A1'), properties: [{ ...base.properties[0], name: 'A1' }, second] });
    storage.failNext = 0;
    // Le 1er put réussit, le 2e échoue.
    const original = storage.putProperty.bind(storage);
    let calls = 0;
    storage.putProperty = async (p) => {
      calls += 1;
      if (calls === 2) throw new Error('disque plein');
      return original(p);
    };
    await persister.flush();
    expect(persister.getStatus()).toBe('error');
    storage.putProperty = original;
    await persister.flush();
    const names = (await storage.loadAll()).properties.map((p) => p.name).sort();
    expect(names).toEqual(['A1', 'B']);
    expect(persister.isDirty()).toBe(false);
  });

  it('une ancienne écriture qui se termine après une nouvelle modification ne marque pas la dernière version comme enregistrée', async () => {
    const { storage, persister, base } = setup();
    storage.hold(); // l’écriture de v1 reste en cours
    persister.update(withName(base, 'v1'));
    const first = persister.flush();
    persister.update(withName(base, 'v2')); // modification pendant l’écriture
    storage.unhold();
    await first;
    // v1 est écrite, mais v2 ne l’est pas encore : toujours « non enregistré ».
    expect(await storedName(storage)).toBe('v1');
    expect(persister.isDirty()).toBe(true);
    expect(persister.getStatus()).toBe('pending');
    await persister.flush();
    expect(await storedName(storage)).toBe('v2');
    expect(persister.isDirty()).toBe(false);
  });

  it('une ancienne écriture en échec ne fait pas perdre la modification suivante', async () => {
    const { storage, persister, base } = setup();
    storage.hold();
    storage.failNext = 1;
    persister.update(withName(base, 'v1'));
    const first = persister.flush();
    persister.update(withName(base, 'v2'));
    storage.unhold();
    await first;
    expect(persister.getStatus()).toBe('error');
    await persister.flush();
    expect(await storedName(storage)).toBe('v2');
    expect(persister.getStatus()).toBe('saved');
  });

  it('modifications rapides successives : écritures séquentielles, dernière version gagnante', async () => {
    const { storage, persister, base } = setup();
    for (let i = 1; i <= 20; i++) persister.update(withName(base, `v${i}`));
    const flushes = [persister.flush(), persister.flush(), persister.flush()];
    await Promise.all(flushes);
    expect(await storedName(storage)).toBe('v20');
    expect(persister.isDirty()).toBe(false);
    // Jamais d’écriture concurrente : une seule version écrite pour 20 modifications regroupées.
    expect(storage.writes.filter((w) => w.startsWith('put:'))).toEqual(['put:v20']);
  });

  it('suppression d’un bien : rejouée si elle échoue', async () => {
    const { storage, persister, base } = setup();
    await storage.replaceAll(base);
    persister.update({ ...base, properties: [] });
    storage.failNext = 1;
    await persister.flush();
    expect((await storage.loadAll()).properties).toHaveLength(1);
    await persister.flush();
    expect((await storage.loadAll()).properties).toHaveLength(0);
  });

  it('remplacement complet (import) : attend l’écriture en cours puis remplace', async () => {
    const { storage, persister, base } = setup();
    storage.hold();
    persister.update(withName(base, 'v1'));
    const pending = persister.flush();
    const imported: AppData = { ...emptyData(), properties: [newProperty('importé', new Date('2026-03-01'))] };
    const replacing = persister.replaceAll(imported);
    storage.unhold();
    await Promise.all([pending, replacing]);
    expect(await storedName(storage)).toBe('importé');
    expect(persister.getStatus()).toBe('saved');
  });

  it('remplacement complet en échec : l’exception remonte, rien n’est marqué enregistré', async () => {
    const { storage, persister, base, timers } = setup();
    storage.replaceAll = async () => {
      throw new Error('quota');
    };
    persister.update(withName(base, 'v1'));
    await expect(persister.replaceAll(emptyData())).rejects.toThrow('quota');
    expect(persister.isDirty()).toBe(true);
    // L’écriture de la modification en cours est reprogrammée.
    timers.fire();
    await persister.flush();
    expect(await storedName(storage)).toBe('v1');
  });
});
