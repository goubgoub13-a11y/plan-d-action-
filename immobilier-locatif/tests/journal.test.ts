import { describe, expect, it } from 'vitest';
import { acquisitionDiscrepancies, summarizeJournal, type JournalContext } from '../src/calc/journal';
import { computeMetrics } from '../src/calc/metrics';
import type { Property } from '../src/domain/types';
import { A, makeProperty, mv, referenceProperty, setAcq } from './helpers';

const ctx = (p: Property, acquired = true): JournalContext => ({ equity: computeMetrics(p, 'actual').equity, acquired });
const sum = (p: Property, acquired = true) => summarizeJournal(p, [], ctx(p, acquired));

/** Bien avec un apport de 5 000 € exactement (60 000 € de coût, 55 000 € empruntés). */
function apport5000(): Property {
  return makeProperty((p) => {
    p.phase = 'owned';
    setAcq(p, 'price', 60000);
    p.loan.borrowed = A(55000);
  });
}

describe('journal des mouvements (v1.0.0, adaptés au modèle v1.0.1)', () => {
  it('sans mouvement : tout est nul, mais l’apport initial reste connu', () => {
    const j = sum(referenceProperty());
    expect(j.count).toBe(0);
    expect(j.spent).toBe(0);
    expect(j.received).toBe(0);
    expect(j.personalInjected).toBe(10000);
  });

  it('calcule payé, encaissé et résultat d’exploitation', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'notary', 5400), mv('expense', 'works', 620), mv('income', 'rent', 550));
    const j = sum(p);
    expect(j.spent).toBe(6020);
    expect(j.received).toBe(550);
    expect(j.rentReceived).toBe(550);
    expect(j.acquisitionPaid).toBe(6020);
    expect(j.operatingResult).toBe(550);
  });

  it('un solde d’exploitation négatif s’ajoute à l’argent injecté', () => {
    const p = referenceProperty();
    p.movements.push(
      mv('expense', 'loanPayment', 500),
      mv('expense', 'loanInsurance', 25),
      mv('income', 'rent', 450),
      mv('expense', 'repairs', 100),
    );
    const j = sum(p);
    expect(j.operatingResult).toBe(450 - 625);
    expect(j.operatingInjections).toBe(175);
    expect(j.personalInjected).toBe(10000 + 175);
  });

  it('un excédent d’exploitation ne réduit pas l’apport initial', () => {
    const p = referenceProperty();
    p.movements.push(mv('income', 'rent', 600));
    const j = sum(p);
    expect(j.operatingInjections).toBe(0);
    expect(j.personalInjected).toBe(10000);
  });

  it('les catégories personnalisées comptent comme exploitation', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'custom-x', 80));
    const j = summarizeJournal(p, [{ id: 'custom-x', label: 'Serrurier', kind: 'expense' }], ctx(p));
    expect(j.operatingExpenses).toBe(80);
    expect(j.acquisitionPaid).toBe(0);
  });

  it('évite les erreurs d’arrondi flottant', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'repairs', 0.1), mv('expense', 'repairs', 0.2));
    expect(sum(p).spent).toBe(0.3);
  });
});

describe('argent personnel injecté et solde net (v1.0.1)', () => {
  it('cas 1 : apport 5 000 €, aucun autre mouvement → injecté 5 000 €, solde net −5 000 €', () => {
    const j = sum(apport5000());
    expect(j.personalInjected).toBe(5000);
    expect(j.netBalance).toBe(-5000);
  });

  it('cas 2 : apport 5 000 € + déficit d’exploitation de 100 € → injecté 5 100 €', () => {
    const p = apport5000();
    p.movements.push(mv('income', 'rent', 400, '2026-11-05'), mv('expense', 'loanPayment', 500, '2026-11-05'));
    const j = sum(p);
    expect(j.personalInjected).toBe(5100);
    expect(j.netBalance).toBe(-5100);
  });

  it('cas 3 : déficit 100 € puis bénéfice 150 € → injecté reste 5 100 €, le solde net évolue', () => {
    const p = apport5000();
    p.movements.push(
      mv('income', 'rent', 400, '2026-11-05'),
      mv('expense', 'loanPayment', 500, '2026-11-06'), // mois 1 : −100
      mv('income', 'rent', 650, '2026-12-05'),
      mv('expense', 'loanPayment', 500, '2026-12-06'), // mois 2 : +150
    );
    const j = sum(p);
    expect(j.personalInjected).toBe(5100); // l’injection passée ne disparaît pas
    expect(j.operatingResult).toBe(50);
    expect(j.netBalance).toBe(50 - 5000); // −4 950 €
    expect(j.projectCash).toBe(150); // l’excédent reste dans la trésorerie du bien
    expect(j.months.map((m) => [m.month, m.net, m.injected, m.cashAfter])).toEqual([
      ['2026-11', -100, 100, 0],
      ['2026-12', 150, 0, 150],
    ]);
  });

  it('un excédent antérieur couvre un déficit ultérieur (pas d’injection)', () => {
    const p = apport5000();
    p.movements.push(
      mv('income', 'rent', 600, '2026-11-05'), // +600
      mv('expense', 'propertyTax', 450, '2026-12-15'), // −450, couvert par la trésorerie
    );
    const j = sum(p);
    expect(j.operatingInjections).toBe(0);
    expect(j.projectCash).toBe(150);
    expect(j.personalInjected).toBe(5000);
  });

  it('alternance de mois déficitaires et bénéficiaires', () => {
    const p = apport5000();
    // Nets mensuels : −100, +150, −200, +30, −50
    const nets: [string, number][] = [['2027-01', -100], ['2027-02', 150], ['2027-03', -200], ['2027-04', 30], ['2027-05', -50]];
    for (const [month, net] of nets) {
      p.movements.push(net >= 0 ? mv('income', 'rent', net, `${month}-05`) : mv('expense', 'repairs', -net, `${month}-05`));
    }
    const j = sum(p);
    // Trésorerie : −100→inj 100, 0 ; +150 → 150 ; −200 → −50 → inj 50, 0 ; +30 → 30 ; −50 → −20 → inj 20, 0
    expect(j.months.map((m) => m.injected)).toEqual([100, 0, 50, 0, 20]);
    expect(j.operatingInjections).toBe(170);
    expect(j.personalInjected).toBe(5170);
    expect(j.operatingResult).toBe(-170);
    expect(j.netBalance).toBe(-5170);
  });

  it('identité comptable : solde net = trésorerie restante − argent injecté', () => {
    const p = apport5000();
    p.movements.push(
      mv('income', 'rent', 580, '2026-11-03'),
      mv('expense', 'loanPayment', 346.1, '2026-11-05'),
      mv('expense', 'propertyTax', 640, '2026-11-15'),
      mv('income', 'rent', 580, '2026-12-03'),
      mv('expense', 'loanPayment', 346.1, '2026-12-05'),
    );
    const j = sum(p);
    expect(j.netBalance).toBeCloseTo(j.projectCash - j.personalInjected, 6);
  });

  it('l’ordre de saisie n’a pas d’effet : les mois sont traités chronologiquement', () => {
    const a = apport5000();
    const b = apport5000();
    const list = [mv('expense', 'repairs', 100, '2026-11-05'), mv('income', 'rent', 150, '2026-12-05')];
    a.movements.push(...list);
    b.movements.push(...list.slice().reverse());
    expect(sum(a)).toEqual(sum(b));
  });

  it('dans un même mois, l’ordre des recettes et dépenses ne crée pas d’injection artificielle', () => {
    const p = apport5000();
    p.movements.push(mv('expense', 'loanPayment', 500, '2026-11-01'), mv('income', 'rent', 600, '2026-11-28'));
    expect(sum(p).operatingInjections).toBe(0);
  });

  it('pas de double comptage : les paiements d’achat ne s’ajoutent pas à l’apport', () => {
    const p = apport5000();
    p.movements.push(mv('expense', 'price', 60000, '2026-09-15'), mv('expense', 'works', 620, '2026-10-18'));
    const j = sum(p);
    expect(j.personalInjected).toBe(5000);
    expect(j.netBalance).toBe(-5000);
    expect(j.acquisitionPaid).toBe(60620);
  });

  it('projet non encore acquis : aucun apport compté comme injecté', () => {
    const j = sum(apport5000(), false);
    expect(j.initialContribution).toBe(0);
    expect(j.personalInjected).toBe(0);
  });

  it('aucun apport (financement à 100 %) : seules les injections d’exploitation comptent', () => {
    const p = apport5000();
    p.loan.borrowed = A(60000);
    p.movements.push(mv('expense', 'loanPayment', 300, '2026-11-05'));
    expect(sum(p).personalInjected).toBe(300);
  });
});

describe('charges récupérables : neutres', () => {
  it('« Charges récupérées » n’augmente ni les recettes, ni le résultat, ni le solde net', () => {
    const p = apport5000();
    p.movements.push(mv('income', 'rent', 550, '2026-11-05'));
    const before = sum(p);
    p.movements.push(mv('income', 'recoveredCharges', 50, '2026-11-05'));
    const after = sum(p);
    expect(after.received).toBe(before.received);
    expect(after.operatingResult).toBe(before.operatingResult);
    expect(after.netBalance).toBe(before.netBalance);
    expect(after.personalInjected).toBe(before.personalInjected);
    expect(after.recoverableReceived).toBe(50);
  });

  it('les charges récupérables payées ne créent ni dépense ni injection', () => {
    const p = apport5000();
    p.movements.push(mv('expense', 'recoverableChargesPaid', 120, '2026-11-05'));
    const j = sum(p);
    expect(j.operatingExpenses).toBe(0);
    expect(j.spent).toBe(0);
    expect(j.operatingInjections).toBe(0);
    expect(j.recoverablePaid).toBe(120);
  });

  it('exemple de l’audit : loyer 550 € + charges 50 € → le résultat ne compte que 550 €', () => {
    const p = apport5000();
    p.movements.push(mv('income', 'rent', 550, '2026-11-05'), mv('income', 'recoveredCharges', 50, '2026-11-05'));
    const j = sum(p);
    expect(j.received).toBe(550);
    expect(j.operatingResult).toBe(550);
  });

  it('les charges récupérables n’influencent pas la rentabilité (côté projet)', () => {
    const p = referenceProperty();
    const a = computeMetrics(p, 'actual');
    p.rental.recoverableCharges = A(50, 60);
    const b = computeMetrics(p, 'actual');
    expect(b.netYield).toBe(a.netYield);
    expect(b.grossYield).toBe(a.grossYield);
    expect(b.cashflowMonthly).toBe(a.cashflowMonthly);
  });
});

describe('réel de référence vs réalisé (mouvements)', () => {
  it('exemple de l’audit : notaire prévu 5 000 €, 5 400 € payés → écart signalé, calculs inchangés', () => {
    const p = makeProperty((p) => {
      setAcq(p, 'price', 60000);
      setAcq(p, 'notary', 5000);
    });
    p.movements.push(mv('expense', 'notary', 5400));
    expect(computeMetrics(p, 'actual').totalCost).toBe(65000); // pas de remplacement automatique
    expect(acquisitionDiscrepancies(p)).toEqual([
      { key: 'notary', label: 'Frais de notaire', paid: 5400, reference: 5000, referenceIsActual: false },
    ]);
    // Une fois le réel confirmé, l’écart disparaît et le calcul l’utilise.
    setAcq(p, 'notary', 5000, 5400);
    expect(acquisitionDiscrepancies(p)).toEqual([]);
    expect(computeMetrics(p, 'actual').totalCost).toBe(65400);
  });

  it('un paiement partiel (inférieur à la référence) n’est pas signalé', () => {
    const p = makeProperty((p) => setAcq(p, 'works', 5000));
    p.movements.push(mv('expense', 'works', 620));
    expect(acquisitionDiscrepancies(p)).toEqual([]);
  });
});
