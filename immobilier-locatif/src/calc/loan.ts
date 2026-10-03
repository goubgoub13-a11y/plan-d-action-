/**
 * Calculs de prêt. Fonctions pures, sans dépendance à l'interface ni au stockage.
 * Volontairement simples : pas de tableau d'amortissement, pas de différé.
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Mensualité hors assurance d'un prêt à taux fixe, mensualités constantes :
 *   M = C × t / (1 − (1 + t)^−n)   avec t = taux annuel / 12
 * Taux nul : M = C / n. Résultat arrondi au centime (comme une banque).
 * Données incomplètes (capital ≤ 0 ou durée ≤ 0) : 0.
 */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (!(principal > 0) || !(months > 0)) return 0;
  const n = Math.round(months);
  const t = Math.max(0, annualRatePct) / 100 / 12;
  if (t === 0) return round2(principal / n);
  return round2((principal * t) / (1 - Math.pow(1 + t, -n)));
}

export interface LoanInput {
  principal: number;
  annualRatePct: number;
  months: number;
  /** Mensualité hors assurance saisie à la main (communiquée par la banque). null = calcul automatique. */
  manualPayment: number | null;
  insuranceMonthly: number;
  /** Frais de dossier + garantie + courtier (déjà payés à l'achat, comptés dans le coût du projet). */
  financingFees: number;
}

export interface LoanSummary {
  principal: number;
  months: number;
  /** Mensualité hors assurance. */
  payment: number;
  paymentIsManual: boolean;
  insuranceMonthly: number;
  /** Mensualité avec assurance. */
  paymentWithInsurance: number;
  /** Intérêts estimés sur toute la durée. */
  interestCost: number;
  /** Assurance cumulée sur toute la durée. */
  insuranceCost: number;
  financingFees: number;
  /** Intérêts + assurance + frais de financement. */
  totalFinancingCost: number;
  /** Capital + intérêts + assurance : ce que la banque aura reçu au total. */
  totalRepaid: number;
}

export function summarizeLoan(input: LoanInput): LoanSummary {
  const principal = Math.max(0, input.principal);
  const months = input.months > 0 ? Math.round(input.months) : 0;
  const paymentIsManual = input.manualPayment !== null && input.manualPayment >= 0;
  const payment = paymentIsManual
    ? (input.manualPayment as number)
    : monthlyPayment(principal, input.annualRatePct, months);
  const insuranceMonthly = Math.max(0, input.insuranceMonthly);
  // Sans durée connue, on ne peut pas estimer les coûts cumulés.
  const interestCost = months > 0 && principal > 0 ? Math.max(0, round2(payment * months - principal)) : 0;
  const insuranceCost = months > 0 && principal > 0 ? round2(insuranceMonthly * months) : 0;
  const financingFees = Math.max(0, input.financingFees);
  return {
    principal,
    months,
    payment,
    paymentIsManual,
    insuranceMonthly,
    paymentWithInsurance: round2(payment + insuranceMonthly),
    interestCost,
    insuranceCost,
    financingFees,
    totalFinancingCost: round2(interestCost + insuranceCost + financingFees),
    totalRepaid: months > 0 && principal > 0 ? round2(principal + interestCost + insuranceCost) : 0,
  };
}
