import { describe, expect, it } from 'vitest';
import { summarizeJournal } from '../src/calc/journal';
import { computeMetrics } from '../src/calc/metrics';
import { mv, referenceProperty } from './helpers';

describe('journal des mouvements', () => {
  it('sans mouvement : tout est nul, mais l’apport initial reste connu', () => {
    const p = referenceProperty();
    const j = summarizeJournal(p, [], computeMetrics(p, 'actual'));
    expect(j.count).toBe(0);
    expect(j.spent).toBe(0);
    expect(j.received).toBe(0);
    expect(j.personalOut).toBe(10000);
  });

  it('calcule dépensé, encaissé et résultat', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'notary', 5400), mv('expense', 'works', 620), mv('income', 'rent', 550));
    const j = summarizeJournal(p, [], computeMetrics(p, 'actual'));
    expect(j.spent).toBe(6020);
    expect(j.received).toBe(550);
    expect(j.netResult).toBe(-5470);
    expect(j.rentReceived).toBe(550);
    expect(j.acquisitionPaid).toBe(6020);
    expect(j.operatingBalance).toBe(550);
  });

  it('un solde d’exploitation négatif s’ajoute à l’argent sorti de la poche', () => {
    const p = referenceProperty();
    p.movements.push(
      mv('expense', 'loanPayment', 500),
      mv('expense', 'loanInsurance', 25),
      mv('income', 'rent', 450),
      mv('expense', 'repairs', 100),
    );
    const j = summarizeJournal(p, [], computeMetrics(p, 'actual'));
    expect(j.operatingBalance).toBe(450 - 625);
    expect(j.cumulativeNegativeCashflow).toBe(175);
    expect(j.personalOut).toBe(10000 + 175);
  });

  it('un excédent d’exploitation ne réduit pas l’apport initial', () => {
    const p = referenceProperty();
    p.movements.push(mv('income', 'rent', 600));
    const j = summarizeJournal(p, [], computeMetrics(p, 'actual'));
    expect(j.cumulativeNegativeCashflow).toBe(0);
    expect(j.personalOut).toBe(10000);
  });

  it('les catégories personnalisées comptent comme exploitation', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'custom-x', 80));
    const j = summarizeJournal(p, [{ id: 'custom-x', label: 'Serrurier', kind: 'expense' }], computeMetrics(p, 'actual'));
    expect(j.operatingExpenses).toBe(80);
    expect(j.acquisitionPaid).toBe(0);
  });

  it('évite les erreurs d’arrondi flottant', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'repairs', 0.1), mv('expense', 'repairs', 0.2));
    expect(summarizeJournal(p, [], computeMetrics(p, 'actual')).spent).toBe(0.3);
  });
});
