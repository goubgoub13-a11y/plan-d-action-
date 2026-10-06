/**
 * v1.0.2 — Concurrence entre enregistrement incrémental et remplacement complet (import / effacement).
 *
 * Invariant vérifié : quand replaceAll(B) se termine avec succès, la mémoire du persister ET le
 * stockage contiennent B, et aucune écriture engagée avant (timer, nouvelle tentative, écriture en
 * cours) ne peut ensuite réécrire une ancienne version.
 */
import { describe, expect, it } from 'vitest';
import { Persister } from '../src/state/persister';
import { MemoryStorage } from '../src/storage/memory';
import { emptyData, newProperty } from '../src/domain/factory';
import type { AppData, Property, Settings } from '../src/domain/types';

/**
 * Stockage qui reproduit l'ordonnancement d'IndexedDB : les opérations s'exécutent strictement
 * dans l'ordre où elles ont été demandées (transactions « readwrite » sur les mêmes tables).
 * `hold()` bloque la file : les opérations demandées ensuite attendent derrière.
 */
class SerialStorage extends MemoryStorage {
  log: string[] = [];
  failNext: Partial<Record<'put' | 'replace', number>> = {};
  private chain: Promise<unknown> = Promise.resolve();
  private gate: Promise<void> | null = null;
  private release: (() => void) | null = null;

  hold() {
    this.gate = new Promise((r) => (this.release = r));
  }
  unhold() {
    this.release?.();
    this.gate = null;
  }
  private run<T>(kind: 'put' | 'replace' | 'other', label: string, op: () => Promise<T>): Promise<T> {
    const gate = this.gate;
    const next = this.chain.then(async () => {
      if (gate) await gate;
      if (kind !== 'other' && (this.failNext[kind] ?? 0) > 0) {
        this.failNext[kind]! -= 1;
        throw new Error(`échec simulé : ${label}`);
      }
      this.log.push(label);
      return op();
    });
    this.chain = next.catch(() => undefined);
    return next;
  }
  override putProperty(p: Property) {
    return this.run('put', `put:${p.name}`, () => super.putProperty(p));
  }
  override deleteProperty(id: string) {
    return this.run('other', `del:${id}`, () => super.deleteProperty(id));
  }
  override putSettings(s: Settings) {
    return this.run('other', 'settings', () => super.putSettings(s));
  }
  override replaceAll(d: AppData) {
    return this.run('replace', `replace:${d.properties.map((p) => p.name).join(',')}`, () => super.replaceAll(d));
  }
}

function manualTimers() {
  const pending = new Map<number, () => void>();
  let n = 0;
  return {
    setTimer: (fn: () => void) => {
      pending.set(++n, fn);
      return n;
    },
    clearTimer: (h: unknown) => void pending.delete(h as number),
    fire() {
      const all = [...pending.values()];
      pending.clear();
      all.forEach((fn) => fn());
    },
    count: () => pending.size,
  };
}

/** Laisse s'exécuter toutes les promesses en attente. */
const settle = () => new Promise((r) => setTimeout(r, 0));

const doc = (name: string, id = 'bien-1'): AppData => ({
  ...emptyData(),
  properties: [{ ...newProperty(name, new Date('2026-01-01')), id }],
});

async function setup() {
  const storage = new SerialStorage();
  const A = doc('A');
  await storage.replaceAll(A);
  storage.log = [];
  const timers = manualTimers();
  const persister = new Persister(storage, A, { setTimer: timers.setTimer, clearTimer: timers.clearTimer, retryDelaysMs: [1000] });
  const stored = async () => (await storage.loadAll()).properties.map((p) => p.name);
  /** Déclenche tous les timers et attend, plusieurs fois : laisse toute chance à un timer parasite. */
  const drain = async () => {
    for (let i = 0; i < 5; i++) {
      timers.fire();
      await settle();
    }
  };
  return { storage, timers, persister, stored, drain };
}

describe('replaceAll : opération exclusive (v1.0.2)', () => {
  it('COURSE DE L’AUDIT : une sauvegarde de A′ en cours ne peut pas réécrire A′ après la restauration de B', async () => {
    const { storage, timers, persister, stored, drain } = await setup();
    const A1 = doc('A′');
    const B = doc('B');

    // 1-3. Modification A → A′, sauvegarde lente (bloquée) qui échouera.
    persister.update(A1);
    storage.hold();
    storage.failNext.put = 1;
    const saving = persister.flush();

    // 4. Restauration de B pendant que la sauvegarde de A′ est encore active.
    const restoring = persister.replaceAll(B);
    await settle();

    // 5. L’ancienne sauvegarde se termine (en échec : une nouvelle tentative serait programmée).
    storage.unhold();
    await saving;
    // Un éventuel timer parasite se déclenche pendant la restauration…
    timers.fire();
    // 6. …puis la restauration s’exécute.
    await restoring;
    // 7. On laisse à tout timer / retry / écriture différée le temps de s’exécuter.
    await drain();

    expect(await stored()).toEqual(['B']);
    expect(persister.debugState()).toEqual({ saved: B, latest: B, dirty: false, replacing: false });
    // A′ n’a jamais été écrit APRÈS la restauration.
    const iReplace = storage.log.indexOf('replace:B');
    expect(iReplace).toBeGreaterThanOrEqual(0);
    expect(storage.log.slice(iReplace + 1)).toEqual([]);
    expect(timers.count()).toBe(0);
  });

  it('même course, sauvegarde de A′ réussie mais A″ modifié pendant l’écriture', async () => {
    const { storage, timers, persister, stored, drain } = await setup();
    const B = doc('B');
    persister.update(doc('A′'));
    storage.hold();
    const saving = persister.flush();
    persister.update(doc('A″')); // modification pendant l’écriture → une écriture de suivi serait programmée
    const restoring = persister.replaceAll(B);
    await settle();
    storage.unhold();
    await saving;
    timers.fire();
    await restoring;
    await drain();
    expect(await stored()).toEqual(['B']);
    expect(persister.debugState().latest).toBe(B);
    expect(persister.isDirty()).toBe(false);
    const iReplace = storage.log.indexOf('replace:B');
    expect(storage.log.slice(iReplace + 1)).toEqual([]);
  });

  it('cas 1 : échec d’une sauvegarde puis replaceAll → aucun retry de l’ancien état', async () => {
    const { storage, timers, persister, stored, drain } = await setup();
    storage.failNext.put = 1;
    persister.update(doc('A′'));
    await persister.flush();
    expect(persister.getStatus()).toBe('error');
    expect(timers.count()).toBe(1); // retry programmé

    await persister.replaceAll(doc('B'));
    expect(timers.count()).toBe(0); // retry neutralisé
    await drain();
    expect(await stored()).toEqual(['B']);
    expect(storage.log).toEqual(['replace:B']);
    expect(persister.getStatus()).toBe('saved');
  });

  it('cas 2 : timer en attente puis replaceAll → timer annulé, ancienne donnée jamais écrite', async () => {
    const { storage, timers, persister, stored, drain } = await setup();
    persister.update(doc('A′'));
    expect(timers.count()).toBe(1);
    await persister.replaceAll(doc('B'));
    expect(timers.count()).toBe(0);
    await drain();
    expect(await stored()).toEqual(['B']);
    expect(storage.log).toEqual(['replace:B']);
  });

  it('cas 3 : deux replaceAll rapprochés → le dernier demandé est l’état final', async () => {
    const { storage, persister, stored, drain } = await setup();
    const B = doc('B');
    const C = doc('C');
    storage.hold();
    const first = persister.replaceAll(B);
    const second = persister.replaceAll(C);
    storage.unhold();
    await Promise.all([first, second]);
    await drain();
    expect(await stored()).toEqual(['C']);
    expect(storage.log).toEqual(['replace:B', 'replace:C']);
    expect(persister.debugState()).toEqual({ saved: C, latest: C, dirty: false, replacing: false });
  });

  it('cas 4 : après un replaceAll réussi, une modification normale est enregistrée normalement', async () => {
    const { persister, stored, timers } = await setup();
    const B = doc('B');
    await persister.replaceAll(B);
    expect(persister.isReplacing()).toBe(false);
    const B1 = doc('B′');
    expect(persister.update(B1)).toBe(true);
    expect(persister.getStatus()).toBe('pending');
    timers.fire();
    await persister.flush();
    expect(await stored()).toEqual(['B′']);
    expect(persister.isDirty()).toBe(false);
  });

  it('modification pendant une restauration : refusée (option A), jamais réécrite ensuite', async () => {
    const { storage, persister, stored, drain } = await setup();
    const B = doc('B');
    storage.hold();
    const restoring = persister.replaceAll(B);
    expect(persister.isReplacing()).toBe(true);
    // Une modification arrivant pendant la restauration porte sur les anciennes données : refusée.
    expect(persister.update(doc('A-ancien'))).toBe(false);
    // « Réessayer » pendant la restauration : n'écrit rien, se termine avec la restauration.
    const retry = persister.flush();
    storage.unhold();
    await Promise.all([retry, restoring]);
    await drain();
    expect(await stored()).toEqual(['B']);
    expect(persister.debugState().latest).toBe(B);
  });

  it('restauration en échec : l’exception remonte, rien n’est marqué enregistré, le persister reste utilisable', async () => {
    const { storage, persister, stored, timers } = await setup();
    persister.update(doc('A′'));
    storage.failNext.replace = 1;
    await expect(persister.replaceAll(doc('B'))).rejects.toThrow('échec simulé');
    expect(persister.isReplacing()).toBe(false);
    expect(persister.isDirty()).toBe(true); // A′ en mémoire, toujours à écrire
    timers.fire();
    await persister.flush();
    expect(await stored()).toEqual(['A′']);
  });

  it('effacement complet (replaceAll vide) pendant une écriture : rien ne réapparaît', async () => {
    const { storage, timers, persister, stored, drain } = await setup();
    persister.update(doc('A′'));
    storage.hold();
    const saving = persister.flush();
    persister.update(doc('A″'));
    const wiping = persister.replaceAll(emptyData());
    storage.unhold();
    await saving;
    timers.fire();
    await wiping;
    await drain();
    expect(await stored()).toEqual([]);
    expect(persister.isDirty()).toBe(false);
  });
});
