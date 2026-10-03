import { describe, expect, it } from 'vitest';
import { annualEquivalent, computeMetrics, delta, monthlyEquivalent } from '../src/calc/metrics';
import { expensesInCategory } from '../src/calc/resolve';
import { A, makeProperty, mv, referenceProperty, setAcq, setCharge } from './helpers';

describe('coût total du projet', () => {
  it('additionne prix, frais, travaux, mobilier, frais de financement et autres frais', () => {
    const p = makeProperty((p) => {
      setAcq(p, 'price', 70000);
      setAcq(p, 'notary', 5600);
      setAcq(p, 'agency', 3000);
      setAcq(p, 'loanFees', 500);
      setAcq(p, 'guarantee', 900);
      setAcq(p, 'broker', 600);
      setAcq(p, 'works', 9000);
      setAcq(p, 'furniture', 1500);
      setAcq(p, 'otherFees', 400);
    });
    expect(computeMetrics(p, 'planned').totalCost).toBe(91500);
  });

  it('travaux importants : le coût et la rentabilité en tiennent compte', () => {
    const p = referenceProperty();
    const before = computeMetrics(p, 'planned');
    setAcq(p, 'works', 58000); // 50 000 € de travaux en plus
    const after = computeMetrics(p, 'planned');
    expect(after.totalCost).toBe(before.totalCost + 50000);
    expect(after.grossYield!).toBeLessThan(before.grossYield!);
  });
});

describe('rentabilités', () => {
  it('rentabilité brute = loyer annuel hors charges / coût total × 100', () => {
    const m = computeMetrics(referenceProperty(), 'planned');
    expect(m.totalCost).toBe(100000);
    expect(m.grossYield).toBeCloseTo(7.2, 10); // 7 200 / 100 000
  });

  it('le loyer hors charges est distinct des charges récupérables (pas de biais de rentabilité)', () => {
    const p = referenceProperty();
    const a = computeMetrics(p, 'planned');
    p.rental.recoverableCharges = A(300);
    const b = computeMetrics(p, 'planned');
    expect(b.grossYield).toBe(a.grossYield);
    expect(b.netYield).toBe(a.netYield);
    expect(b.cashflowMonthly).toBe(a.cashflowMonthly);
    expect(b.rentMonthlyWithCharges).toBe(600 + 300);
  });

  it('rentabilité nette = (loyers conservés − charges annuelles) / coût total, sans déduire le capital du prêt', () => {
    const m = computeMetrics(referenceProperty(), 'planned');
    // charges : 900 + 30 × 12 = 1 260 ; (7 200 − 1 260) / 100 000
    expect(m.chargesAnnual).toBe(1260);
    expect(m.netYield).toBeCloseTo(5.94, 10);
  });

  it('vacance locative et impayés réduisent le loyer conservé mais pas la rentabilité brute', () => {
    const p = referenceProperty();
    p.rental.vacancyMonthsPerYear = 1;
    p.rental.unpaidPct = 5;
    const m = computeMetrics(p, 'planned');
    expect(m.rentAnnualNominal).toBe(7200);
    expect(m.rentAnnualEffective).toBeCloseTo(600 * 11 * 0.95, 10);
    expect(m.grossYield).toBeCloseTo(7.2, 10);
    expect(m.netYield!).toBeLessThan(5.94);
  });

  it('loyer nul : rentabilité 0 %, cash-flow négatif, pas de division par zéro', () => {
    const p = referenceProperty();
    p.rental.rent = A(0);
    const m = computeMetrics(p, 'planned');
    expect(m.grossYield).toBe(0);
    expect(m.cashflowMonthly).toBeLessThan(0);
    expect(m.warnings).toContain('noRent');
  });

  it('coût nul : rentabilités indéfinies (null) plutôt que NaN / Infinity', () => {
    const p = makeProperty((p) => {
      p.rental.rent = A(500);
    });
    const m = computeMetrics(p, 'planned');
    expect(m.totalCost).toBe(0);
    expect(m.grossYield).toBeNull();
    expect(m.netYield).toBeNull();
    expect(m.warnings).toContain('noPrice');
  });
});

describe('conversion des charges', () => {
  it('convertit mensuel ↔ annuel et ignore les ponctuelles dans le récurrent', () => {
    expect(monthlyEquivalent(120, 'yearly')).toBe(10);
    expect(monthlyEquivalent(35, 'monthly')).toBe(35);
    expect(monthlyEquivalent(800, 'once')).toBe(0);
    expect(annualEquivalent(35, 'monthly')).toBe(420);
    expect(annualEquivalent(900, 'yearly')).toBe(900);
    expect(annualEquivalent(800, 'once')).toBe(0);
  });

  it('agrège mensuel, annuel et ponctuel', () => {
    const p = referenceProperty();
    p.charges.push({ id: 'x', label: 'Chaudière', frequency: 'once', amount: A(1200), categoryId: undefined });
    const m = computeMetrics(p, 'planned');
    expect(m.chargesMonthly).toBeCloseTo(105, 10); // 900/12 + 30
    expect(m.chargesAnnual).toBe(1260);
    expect(m.oneOffCharges).toBe(1200);
  });
});

describe('cash-flow et effort d’épargne', () => {
  it('cash-flow = loyer conservé − mensualité − assurance − charges ramenées au mois', () => {
    const m = computeMetrics(referenceProperty(), 'planned');
    // 600 − 499,14 (mensualité) − 25 − 105
    const payment = m.loan.payment;
    expect(m.cashflowMonthly).toBeCloseTo(600 - payment - 25 - 105, 10);
    expect(m.cashflowAnnual).toBeCloseTo(m.cashflowMonthly * 12, 10);
  });

  it('cash-flow négatif ⇒ effort d’épargne égal à son opposé', () => {
    const p = referenceProperty();
    p.rental.rent = A(400);
    const m = computeMetrics(p, 'planned');
    expect(m.cashflowMonthly).toBeLessThan(0);
    expect(m.savingsEffort).toBeCloseTo(-m.cashflowMonthly, 10);
  });

  it('cash-flow positif ⇒ aucun effort d’épargne', () => {
    const p = referenceProperty();
    p.rental.rent = A(900);
    const m = computeMetrics(p, 'planned');
    expect(m.cashflowMonthly).toBeGreaterThan(0);
    expect(m.savingsEffort).toBe(0);
  });

  it('aucun crédit : le cash-flow est le loyer moins les charges', () => {
    const p = referenceProperty();
    p.loan = makeProperty().loan;
    const m = computeMetrics(p, 'planned');
    expect(m.borrowed).toBe(0);
    expect(m.loan.payment).toBe(0);
    expect(m.cashflowMonthly).toBeCloseTo(600 - 105, 10);
    expect(m.equity).toBe(100000);
  });

  it('mensualité saisie manuellement : elle remplace le calcul automatique', () => {
    const p = referenceProperty();
    const auto = computeMetrics(p, 'planned');
    p.loan.monthlyPayment = A(520);
    const manual = computeMetrics(p, 'planned');
    expect(manual.loan.payment).toBe(520);
    expect(manual.loan.paymentIsManual).toBe(true);
    expect(manual.cashflowMonthly).toBeCloseTo(auto.cashflowMonthly - (520 - auto.loan.payment), 10);
  });
});

describe('argent investi et rendement sur apport', () => {
  it('apport = coût total − emprunt', () => {
    const m = computeMetrics(referenceProperty(), 'planned');
    expect(m.equity).toBe(10000);
    expect(m.personalInvested).toBe(10000);
  });

  it('aucun apport : tout est emprunté (frais compris)', () => {
    const p = referenceProperty();
    p.loan.borrowed = A(100000);
    const m = computeMetrics(p, 'planned');
    expect(m.equity).toBe(0);
    expect(m.personalInvested).toBe(0);
    expect(m.cashOnCash).toBeNull(); // pas de division par zéro
  });

  it('emprunt supérieur au coût : apport à 0 et avertissement', () => {
    const p = referenceProperty();
    p.loan.borrowed = A(120000);
    const m = computeMetrics(p, 'planned');
    expect(m.equity).toBe(0);
    expect(m.warnings).toContain('loanExceedsCost');
  });

  it('rendement sur apport = cash-flow annuel / argent personnel investi', () => {
    const p = referenceProperty();
    p.rental.rent = A(900);
    const m = computeMetrics(p, 'planned');
    expect(m.cashOnCash).toBeCloseTo((m.cashflowAnnual / 10000) * 100, 10);
  });

  it('les dépenses ponctuelles s’ajoutent à l’argent personnel investi', () => {
    const p = referenceProperty();
    p.charges.push({ id: 'y', label: 'Diagnostic', frequency: 'once', amount: A(500) });
    expect(computeMetrics(p, 'planned').personalInvested).toBe(10500);
  });
});

describe('données incomplètes', () => {
  it('un bien vierge ne produit ni NaN ni Infinity', () => {
    const m = computeMetrics(makeProperty(), 'planned');
    for (const v of Object.values(m)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
    expect(m.totalCost).toBe(0);
    expect(m.cashflowMonthly).toBe(0);
    expect(m.grossYield).toBeNull();
  });

  it('un emprunt sans durée ni mensualité est signalé', () => {
    const p = referenceProperty();
    p.loan.durationMonths = A(null);
    const m = computeMetrics(p, 'planned');
    expect(m.warnings).toContain('loanDurationMissing');
    expect(m.loan.payment).toBe(0);
  });
});

describe('distinction prévisionnel / réel', () => {
  it('le réel remplace le prévu rubrique par rubrique, le reste retombe sur le prévu', () => {
    const p = referenceProperty();
    setAcq(p, 'notary', 6400, 6900); // réel connu
    setAcq(p, 'works', 8000, 0); // 0 € réel : « finalement gratuit », ne doit pas retomber sur le prévu
    const planned = computeMetrics(p, 'planned');
    const actual = computeMetrics(p, 'actual');
    expect(planned.totalCost).toBe(100000);
    expect(actual.totalCost).toBe(100000 + 500 - 8000);
  });

  it('sans aucune donnée réelle, réel = prévu', () => {
    const p = referenceProperty();
    expect(computeMetrics(p, 'actual')).toEqual({ ...computeMetrics(p, 'planned'), scenario: 'actual' });
  });

  it('le scénario prévu ignore totalement le réel', () => {
    const p = referenceProperty();
    const before = computeMetrics(p, 'planned');
    setAcq(p, 'price', 80000, 85000);
    p.rental.rent = A(600, 450);
    expect(computeMetrics(p, 'planned')).toEqual(before);
  });

  it('loyer et charges réels modifient le cash-flow réel mais pas le prévu', () => {
    const p = referenceProperty();
    p.rental.rent = A(600, 550);
    setCharge(p, 'propertyTax', 900, 1000);
    const planned = computeMetrics(p, 'planned');
    const actual = computeMetrics(p, 'actual');
    expect(actual.cashflowMonthly).toBeLessThan(planned.cashflowMonthly);
    expect(actual.rentMonthlyEffective).toBe(550);
    expect(actual.chargesAnnual).toBe(1000 + 360);
  });

  it('la mensualité réelle de la banque prime ; sinon le prévu manuel reste valable', () => {
    const p = referenceProperty();
    p.loan.monthlyPayment = A(500);
    expect(computeMetrics(p, 'actual').loan.payment).toBe(500);
    p.loan.monthlyPayment = A(500, 505.5);
    expect(computeMetrics(p, 'actual').loan.payment).toBe(505.5);
    expect(computeMetrics(p, 'planned').loan.payment).toBe(500);
  });

  it('si le capital réel change, la mensualité prévue manuelle n’est plus reprise (recalcul)', () => {
    const p = referenceProperty();
    p.loan.monthlyPayment = A(500);
    p.loan.borrowed = A(90000, 80000);
    const actual = computeMetrics(p, 'actual');
    expect(actual.loan.paymentIsManual).toBe(false);
    expect(actual.loan.payment).toBeLessThan(500);
  });

  it('écart = réel − prévu, indéfini si l’un des deux manque', () => {
    expect(delta(100, 130)).toBe(30);
    expect(delta(100, 80)).toBe(-20);
    expect(delta(null, 80)).toBeNull();
    expect(delta(100, null)).toBeNull();
  });
});

describe('mouvements et rubriques d’achat', () => {
  it('un paiement partiel enregistré ne remplace pas le montant prévu (pas de coût faussement bas)', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'works', 620, '2026-10-18', 'Peinture'));
    expect(computeMetrics(p, 'actual').totalCost).toBe(100000);
    expect(expensesInCategory(p, 'works')).toEqual({ total: 620, count: 1 });
  });

  it('seul le montant réel saisi remplace le prévu, sans double comptage avec les mouvements', () => {
    const p = referenceProperty();
    setAcq(p, 'notary', 6400, 6000);
    p.movements.push(mv('expense', 'notary', 6000));
    expect(computeMetrics(p, 'actual').totalCost).toBe(100000 - 400);
  });

  it('le scénario prévu ne tient pas compte des mouvements', () => {
    const p = referenceProperty();
    p.movements.push(mv('expense', 'notary', 1));
    expect(computeMetrics(p, 'planned').totalCost).toBe(100000);
  });

  it('les recettes ne comptent pas dans « payé à ce jour »', () => {
    const p = referenceProperty();
    p.movements.push(mv('income', 'works', 100), mv('expense', 'works', 50));
    expect(expensesInCategory(p, 'works')).toEqual({ total: 50, count: 1 });
  });
});

describe('charges : cas particuliers', () => {
  it('une charge sans montant est ignorée', () => {
    const p = referenceProperty();
    setCharge(p, 'pno', null);
    expect(computeMetrics(p, 'planned').chargesAnnual).toBe(1260);
  });
});
