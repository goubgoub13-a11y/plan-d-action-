/**
 * Série mensuelle pour l'affichage (v1.2.0) — présentation uniquement.
 * Part des mois calculés par calc/journal.ts (seuls les mois avec mouvements y figurent)
 * et produit une série continue : les mois sans mouvement valent 0, et le cumul est suivi.
 */
import type { MonthFlow } from '../calc/journal';

export interface MonthPoint {
  /** AAAA-MM */
  month: string;
  income: number;
  expenses: number;
  net: number;
  injected: number;
  /** Résultat d'exploitation cumulé depuis le premier mois. */
  cumulative: number;
  /** Mois sans aucun mouvement d'exploitation. */
  empty: boolean;
}

const nextMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

/**
 * @param months mois avec mouvements (ordre chronologique), issus de summarizeJournal
 * @param until  dernier mois à afficher (AAAA-MM), en général le mois courant
 */
export function monthSeries(months: MonthFlow[], until?: string, since?: string): MonthPoint[] {
  const validMonth = (s?: string): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const start = validMonth(since) ? since : undefined;
  if (months.length === 0 && !start) return [];
  const byMonth = new Map(months.map((m) => [m.month, m]));
  // Conserve aussi les mouvements antérieurs à l'achat s'il y en a : aucun total perdu.
  const firstData = months[0]?.month;
  const first = start && (!firstData || start < firstData) ? start : firstData!;
  const lastData = months[months.length - 1]?.month ?? first;
  const end = validMonth(until) && until > lastData ? until : lastData;
  const out: MonthPoint[] = [];
  let cumulative = 0;
  // Garde-fou : au plus 30 ans de mois.
  for (let ym = first, n = 0; ym <= end && n < 360; ym = nextMonth(ym), n++) {
    const m = byMonth.get(ym);
    const net = m?.net ?? 0;
    cumulative = Math.round((cumulative + net) * 100) / 100;
    out.push({
      month: ym,
      income: m?.income ?? 0,
      expenses: m?.expenses ?? 0,
      net,
      injected: m?.injected ?? 0,
      cumulative,
      empty: !m,
    });
  }
  return out;
}
