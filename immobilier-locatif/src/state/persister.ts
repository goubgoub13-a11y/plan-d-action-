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
 *
 * Remplacement complet (import, effacement) — v1.0.2, opération EXCLUSIVE :
 *  - toutes les opérations de stockage (écritures incrémentales ET remplacements) passent par
 *    une file unique `queue` : elles s'exécutent dans l'ordre, jamais en parallèle ;
 *  - chaque remplacement incrémente `generation`. Une écriture incrémentale engagée avant
 *    (en cours, programmée, nouvelle tentative) porte l'ancienne génération : à sa fin, elle ne
 *    modifie plus ni `saved`, ni le statut, et ne programme plus aucun timer ;
 *  - pendant un remplacement (`replacing > 0`) : aucun timer n'est programmé, `flush()` n'écrit
 *    rien, et `update()` REFUSE les modifications (option A) — elles portent forcément sur les
 *    données sur le point d'être remplacées ;
 *  - au succès, `saved` et `latest` valent exactement la nouvelle version. Plusieurs remplacements
 *    rapprochés s'exécutent dans l'ordre demandé : le dernier est l'état final.
 * Invariant : quand replaceAll(B) réussit, mémoire du persister et stockage valent B, et aucune
 * opération engagée auparavant ne peut écrire après.
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
  /** File unique de toutes les opérations de stockage (ordre strict). */
  private queue: Promise<void> = Promise.resolve();
  /** Incrémentée à chaque remplacement : invalide les écritures incrémentales antérieures. */
  private generation = 0;
  /** Nombre de remplacements demandés et non terminés. */
  private replacing = 0;
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
  update(next: AppData): boolean {
    if (this.replacing > 0) return false; // option A : modification refusée pendant une restauration
    if (next === this.latest) return true;
    this.latest = next;
    if (this.status !== 'error' && this.status !== 'saving') this.setStatus('pending');
    this.schedule(this.status === 'error' ? this.retryDelay() : this.debounceMs);
    return true;
  }

  isReplacing(): boolean {
    return this.replacing > 0;
  }


  /** Écrit immédiatement (mise en arrière-plan, bouton « Réessayer »). Résout quand tout est écrit ou a échoué. */
  flush(): Promise<void> {
    this.cancelTimer();
    // Pendant un remplacement, rien à écrire : la restauration fixera l'état final.
    if (this.replacing > 0) return this.queue;
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
    const gen = this.generation;
    this.setStatus('saving');
    this.running = this.enqueue(() => (gen === this.generation ? this.write(base, target) : Promise.resolve()))
      .then(
        () => {
          if (gen !== this.generation) return; // dépassée par un remplacement : sans effet
          this.failures = 0;
          this.saved = target; // seule la version effectivement écrite est confirmée
          this.lastError = null;
        },
        (e) => {
          if (gen !== this.generation) return;
          this.failures += 1;
          this.lastError = e;
        },
      )
      .finally(() => {
        this.running = null;
        // Un remplacement a eu lieu depuis le début de cette écriture : on ne touche plus à rien
        // (ni statut, ni timer, ni nouvelle tentative).
        if (gen !== this.generation) return;
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
   * Remplacement complet (import, effacement), exclusif — voir l'en-tête du fichier.
   * En cas d'échec, l'exception remonte et la version en mémoire reste à écrire.
   */
  async replaceAll(next: AppData): Promise<void> {
    this.replacing += 1;
    this.generation += 1; // invalide toute écriture incrémentale déjà engagée
    this.cancelTimer();
    try {
      // Mise en file : s'exécute après les opérations déjà engagées, seule.
      await this.enqueue(() => this.storage.replaceAll(next));
      this.cancelTimer(); // ceinture et bretelles : aucun timer ne doit survivre
      this.saved = next;
      this.latest = next;
      this.failures = 0;
      this.lastError = null;
    } finally {
      this.replacing -= 1;
      this.generation += 1; // les écritures mises en file pendant le remplacement sont caduques
      if (this.replacing === 0) {
        if (this.isDirty()) {
          // Échec du remplacement : la version en mémoire reste à écrire.
          this.setStatus('pending');
          this.schedule(this.debounceMs);
        } else {
          this.setStatus('saved');
        }
      }
    }
  }

  /** État interne, pour les tests. */
  debugState() {
    return { saved: this.saved, latest: this.latest, dirty: this.isDirty(), replacing: this.isReplacing() };
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

  /** Ajoute une opération de stockage à la file unique. Une erreur n'interrompt pas la file. */
  private enqueue(op: () => Promise<void>): Promise<void> {
    const run = this.queue.then(op);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private retryDelay(): number {
    return this.retryDelays[Math.min(Math.max(0, this.failures - 1), this.retryDelays.length - 1)];
  }

  private schedule(ms: number): void {
    this.cancelTimer();
    if (this.replacing > 0) return; // aucun timer pendant un remplacement
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
