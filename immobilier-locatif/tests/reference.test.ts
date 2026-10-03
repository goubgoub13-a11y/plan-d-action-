import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../src/calc/metrics';
import { estimatedInputs, hasActualData, referenceFields } from '../src/calc/resolve';
import { A, makeProperty, mv, referenceProperty, setAcq, setCharge } from './helpers';

describe('Prévu / Réel / Réalisé', () => {
  it('un projet avec un mouvement mais aucune donnée réelle de référence n’est PAS « réel »', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'repairs', 80));
    expect(hasActualData(p)).toBe(false);
    // Les calculs « réel » sont identiques au prévu : le mouvement n’y change rien.
    expect(computeMetrics(p, 'actual')).toEqual({ ...computeMetrics(p, 'planned'), scenario: 'actual' });
  });

  it('un seul montant réel de référence suffit à proposer la vue « Réel »', () => {
    const p = referenceProperty();
    setAcq(p, 'notary', 6400, 6500);
    expect(hasActualData(p)).toBe(true);
  });

  it('liste les montants utilisés et leur statut (confirmé ou encore prévu)', () => {
    const p = referenceProperty();
    setAcq(p, 'price', 80000, 79000);
    p.rental.rent = A(600, 620);
    const fields = referenceFields(p);
    const status = Object.fromEntries(fields.map((f) => [f.label, f.confirmed]));
    expect(status["Prix d'achat"]).toBe(true);
    expect(status['Frais de notaire']).toBe(false);
    expect(status['Loyer']).toBe(true);
    expect(status['Taxe foncière']).toBe(false);
    // Les montants non renseignés n’apparaissent pas (ils ne pèsent pas dans les calculs).
    expect(status['Courtier']).toBeUndefined();
  });

  it('chaque indicateur sait quels montants prévus il utilise encore', () => {
    const p = referenceProperty();
    for (const k of ['price', 'notary', 'agency', 'works', 'furniture'] as const) {
      p.acquisition[k] = A(p.acquisition[k].planned, p.acquisition[k].planned);
    }
    const fields = referenceFields(p);
    expect(estimatedInputs(fields, 'totalCost')).toEqual([]); // achat entièrement confirmé
    expect(estimatedInputs(fields, 'grossYield')).toEqual(['Loyer']);
    expect(estimatedInputs(fields, 'netYield')).toEqual(['Loyer', 'Taxe foncière', 'Copropriété (non récupérable)']);
    expect(estimatedInputs(fields, 'payment')).toContain('Mensualité du crédit');
  });

  it('mensualité confirmée par la banque, ou déduite de capital, taux et durée réels', () => {
    const p = referenceProperty();
    const mensualite = () => referenceFields(p).find((f) => f.label === 'Mensualité du crédit')!.confirmed;
    expect(mensualite()).toBe(false);
    p.loan.monthlyPayment = A(null, 499.14);
    expect(mensualite()).toBe(true);
    p.loan.monthlyPayment = A(null, null);
    p.loan.borrowed = A(90000, 90000);
    p.loan.ratePct = A(3, 3);
    p.loan.durationMonths = A(240, 240);
    expect(mensualite()).toBe(true);
  });

  it('sans crédit, aucune mensualité n’est attendue', () => {
    const p = makeProperty((p) => setAcq(p, 'price', 50000));
    expect(referenceFields(p).some((f) => f.label === 'Mensualité du crédit')).toBe(false);
  });

  it('une charge confirmée en réel n’est plus signalée comme prévue', () => {
    const p = referenceProperty();
    setCharge(p, 'propertyTax', 900, 950);
    expect(estimatedInputs(referenceFields(p), 'charges')).toEqual(['Copropriété (non récupérable)']);
  });
});

describe('mensualité manuelle incohérente dans les indicateurs', () => {
  it('avertissement et coût des intérêts non présenté comme nul', () => {
    const p = makeProperty((p) => {
      setAcq(p, 'price', 55000);
      p.loan.borrowed = A(50000);
      p.loan.durationMonths = A(120);
      p.loan.monthlyPayment = A(100);
    });
    const m = computeMetrics(p, 'planned');
    expect(m.warnings).toContain('loanPaymentInconsistent');
    expect(m.loan.interestCost).toBeNull();
    // La saisie n’est pas bloquée : elle reste utilisée pour le cash-flow.
    expect(m.loan.payment).toBe(100);
  });
});
