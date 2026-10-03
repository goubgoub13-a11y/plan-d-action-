/**
 * Écriture fiable des données dans le stockage local (sans React, testable seul).
 *
 * Règle : une version des données n'est considérée comme enregistrée QUE lorsque
 * l'écriture correspondante a réussi.
 *
 *  - `saved`  : dernière version dont l'écriture est CONFIRMÉE ;
 *  - `latest` : version courante en mémoire (ce que voit l'utilisateur).
 *
 * Une écriture compare `latest` à `saved` et écrit la différence. En cas d'échec, `saved`
 * ne bouge pas : la différence sera intégralement réécrite à la tentative suivante (les
 * écritures sont idempotentes). Une écriture qui se termine après une nouvelle modification
 * ne marque comme enregistrée que la version qu'elle a réellement écrite.
 * Les écritures sont strictement séquentielles (jamais deux en parallèle).
 */
import type { AppData } from '../domain/types';
import type { DataStorage } from '../storage/types';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export interface PersisterOptions {
  /** Délai avant écriture après une modification (regroupe les frappes rapides). */
  debounceMs?: number;
  /** Délais des nouvelles tentatives automatiques après un échec. */
  retryDelaysMs?: number[];
  onStatus?: (status: SaveStatus, error: unknown) => void;
  /** Injectable pour les tests. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class Persister {
  private saved: AppData;
  private latest: AppData;
  private running: Promise<void> | null = null;
  private timer: unknown = null;
  private failures = 0;
  private status: SaveStatus = 'saved';
  private lastError: unknown = null;
  private readonly debounceMs: number;
  private readonly retryDelays: number[];
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (h: unknown) => void;

  constructor(
    private readonly storage: DataStorage,
    initial: AppData,
    private readonly opts: PersisterOptions = {},
  ) {
    this.saved = initial;
    this.latest = initial;
    this.debounceMs = opts.debounceMs ?? 250;
    this.retryDelays = opts.retryDelaysMs ?? [1000, 3000, 10000, 30000];
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  getStatus(): SaveStatus {
    return this.status;
  }

  /** Vrai si la version courante n'est pas encore confirmée sur le disque. */
  isDirty(): boolean {
    return this.latest !== this.saved;
  }

  /** Nouvelle version en mémoire : marquée « non enregistrée », écriture planifiée. */
  update(next: AppData): void {
    if (next === this.latest) return;
    this.latest = next;
    if (this.status !== 'error' && this.status !== 'saving') this.setStatus('pending');
    this.schedule(this.status === 'error' ? this.retryDelay() : this.debounceMs);
  }

  /** Écrit immédiatement (mise en arrière-plan, bouton « Réessayer »). Résout quand tout est écrit ou a échoué. */
  flush(): Promise<void> {
    this.cancelTimer();
    if (this.running) {
      // Une écriture est en cours : on relance après elle, sur la version la plus récente.
      return this.running.then(() => this.flush());
    }
    if (!this.isDirty()) {
      if (this.status !== 'saved') this.setStatus('saved');
      return Promise.resolve();
    }
    const target = this.latest;
    const base = this.saved;
    this.setStatus('saving');
    this.running = this.write(base, target)
      .then(
        () => {
          this.failures = 0;
          this.saved = target; // seule la version effectivement écrite est confirmée
          this.lastError = null;
        },
        (e) => {
          this.failures += 1;
          this.lastError = e;
        },
      )
      .finally(() => {
        this.running = null;
        if (this.lastError) {
          this.setStatus('error');
          this.schedule(this.retryDelay());
        } else if (this.isDirty()) {
          // Modifié pendant l'écriture : la nouvelle version reste à écrire.
          this.setStatus('pending');
          this.schedule(this.debounceMs);
        } else {
          this.setStatus('saved');
        }
      });
    return this.running;
  }

  /**
   * Remplacement complet (import, effacement). Attend l'écriture en cours.
   * En cas d'échec, l'exception remonte et rien n'est modifié en mémoire.
   */
  async replaceAll(next: AppData): Promise<void> {
    this.cancelTimer();
    if (this.running) await this.running;
    try {
      await this.storage.replaceAll(next);
    } catch (e) {
      // Les modifications en mémoire restent à écrire : on reprogramme leur écriture.
      if (this.isDirty()) this.schedule(this.debounceMs);
      throw e;
    }
    this.saved = next;
    this.latest = next;
    this.failures = 0;
    this.lastError = null;
    this.setStatus('saved');
  }

  dispose(): void {
    this.cancelTimer();
  }

  private async write(base: AppData, target: AppData): Promise<void> {
    const baseById = new Map(base.properties.map((p) => [p.id, p]));
    const targetIds = new Set(target.properties.map((p) => p.id));
    for (const p of target.properties) if (baseById.get(p.id) !== p) await this.storage.putProperty(p);
    for (const id of baseById.keys()) if (!targetIds.has(id)) await this.storage.deleteProperty(id);
    if (target.settings !== base.settings) await this.storage.putSettings(target.settings);
  }

  private retryDelay(): number {
    return this.retryDelays[Math.min(Math.max(0, this.failures - 1), this.retryDelays.length - 1)];
  }

  private schedule(ms: number): void {
    this.cancelTimer();
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private cancelTimer(): void {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  private setStatus(s: SaveStatus): void {
    this.status = s;
    this.opts.onStatus?.(s, this.lastError);
  }
}
