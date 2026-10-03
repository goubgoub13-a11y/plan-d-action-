import { describe, expect, it } from 'vitest';
import { monthlyPayment, summarizeLoan } from '../src/calc/loan';

describe('mensualité de prêt', () => {
  it('calcule la mensualité d’un prêt classique (100 000 €, 3 %, 20 ans = 554,60 €)', () => {
    expect(monthlyPayment(100000, 3, 240)).toBe(554.6);
  });

  it('gère un taux à 0 % (capital / durée)', () => {
    expect(monthlyPayment(12000, 0, 120)).toBe(100);
  });

  it('renvoie 0 sans crédit ou avec des données incomplètes', () => {
    expect(monthlyPayment(0, 3, 240)).toBe(0);
    expect(monthlyPayment(100000, 3, 0)).toBe(0);
    expect(monthlyPayment(-5, 3, 240)).toBe(0);
  });
});

describe('coût du crédit', () => {
  const base = { principal: 100000, annualRatePct: 3, months: 240, manualPayment: null, insuranceMonthly: 25, financingFees: 1400 };

  it('calcule intérêts, assurance, coût total et montant remboursé', () => {
    const s = summarizeLoan(base);
    expect(s.payment).toBe(554.6);
    expect(s.paymentWithInsurance).toBe(579.6);
    expect(s.interestCost).toBe(33104); // 554,60 × 240 − 100 000
    expect(s.insuranceCost).toBe(6000);
    expect(s.totalFinancingCost).toBe(33104 + 6000 + 1400);
    expect(s.totalRepaid).toBe(100000 + 33104 + 6000);
    expect(s.paymentIsManual).toBe(false);
  });

  it('respecte une mensualité saisie à la main (montant exact de la banque)', () => {
    const s = summarizeLoan({ ...base, manualPayment: 560 });
    expect(s.payment).toBe(560);
    expect(s.paymentIsManual).toBe(true);
    expect(s.interestCost).toBe(560 * 240 - 100000);
  });

  it('sans crédit : tout est à zéro', () => {
    const s = summarizeLoan({ ...base, principal: 0, insuranceMonthly: 0, financingFees: 0 });
    expect(s.payment).toBe(0);
    expect(s.interestCost).toBe(0);
    expect(s.totalRepaid).toBe(0);
    expect(s.totalFinancingCost).toBe(0);
  });

  it('durée inconnue : pas de coûts cumulés inventés, mais la mensualité manuelle reste utilisable', () => {
    const s = summarizeLoan({ ...base, months: 0, manualPayment: 400 });
    expect(s.payment).toBe(400);
    expect(s.interestCost).toBe(0);
    expect(s.insuranceCost).toBe(0);
  });

  it('ne produit jamais d’intérêts négatifs si la mensualité saisie est incohérente', () => {
    const s = summarizeLoan({ ...base, manualPayment: 100 });
    expect(s.interestCost).toBe(0);
  });
});
