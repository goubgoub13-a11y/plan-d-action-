import { describe, expect, it } from 'vitest';
import { monthSeries } from '../src/lib/series';
import type { MonthFlow } from '../src/calc/journal';

const mf = (month: string, net: number, injected = 0): MonthFlow => ({
  month,
  income: Math.max(0, net),
  expenses: Math.max(0, -net),
  net,
  injected,
  cashAfter: 0,
});

describe('série mensuelle pour le graphique (v1.2.0)', () => {
  it('vide sans mouvement', () => {
    expect(monthSeries([])).toEqual([]);
  });

  it('comble les mois sans mouvement avec 0 et cumule le résultat', () => {
    const s = monthSeries([mf('2026-11', -100, 100), mf('2027-02', 150)]);
    expect(s.map((x) => x.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(s.map((x) => x.net)).toEqual([-100, 0, 0, 150]);
    expect(s.map((x) => x.cumulative)).toEqual([-100, -100, -100, 50]);
    expect(s.map((x) => x.empty)).toEqual([false, true, true, false]);
    expect(s[0].injected).toBe(100);
  });

  it('prolonge jusqu’au mois courant, jamais avant le dernier mois de données', () => {
    expect(monthSeries([mf('2026-11', 10)], '2027-01').map((x) => x.month)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(monthSeries([mf('2026-11', 10)], '2026-05').map((x) => x.month)).toEqual(['2026-11']);
  });

  it('le dernier cumul égale la somme des résultats mensuels', () => {
    const months = [mf('2026-01', 12.1), mf('2026-02', -3.4), mf('2026-05', 7.25)];
    const s = monthSeries(months);
    expect(s[s.length - 1].cumulative).toBeCloseTo(12.1 - 3.4 + 7.25, 6);
  });
});
