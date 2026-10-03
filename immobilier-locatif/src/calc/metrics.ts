/**
 * Indicateurs financiers — SOURCE UNIQUE des formules de l'application.
 * Voir docs/FORMULES.md pour la version lisible. Toutes les fonctions sont pures.
 */
import { ACQUISITION_KEYS, type Frequency, type Property, type Scenario } from '../domain/types';
import { round2, summarizeLoan, type LoanSummary } from './loan';
import { resolveInputs, type ResolvedCharge, type ResolvedInputs } from './resolve';

export type Warning =
  | 'noPrice' //            pas de prix d'achat renseigné
  | 'noRent' //             pas de loyer renseigné
  | 'loanDurationMissing' // un emprunt est saisi sans durée ni mensualité
  | 'loanExceedsCost'; //    l'emprunt dépasse le coût du projet

export interface Metrics {
  scenario: Scenario;
  /** Coût total du projet (prix + frais + travaux + mobilier + frais de financement + autres). */
  totalCost: number;
  borrowed: number;
  /** Argent personnel nécessaire à l'achat : coût total − emprunt (jamais négatif). */
  equity: number;
  loan: LoanSummary;

  /** Loyer annuel théorique hors charges (12 mois pleins). */
  rentAnnualNominal: number;
  /** Loyer annuel conservé : après vacance locative et provision pour impayés. */
  rentAnnualEffective: number;
  rentMonthlyEffective: number;
  /** Loyer charges comprises (information : les charges récupérables sont neutres). */
  rentMonthlyWithCharges: number;

  /** Charges propriétaire récurrentes. Les dépenses ponctuelles sont exclues. */
  chargesMonthly: number;
  chargesAnnual: number;
  oneOffCharges: number;

  /** Rentabilité brute en %, null si le coût du projet est nul. */
  grossYield: number | null;
  /** Rentabilité nette avant fiscalité en %, null si le coût du projet est nul. */
  netYield: number | null;

  /** Revenus − mensualité − assurance − charges, par mois. */
  cashflowMonthly: number;
  cashflowAnnual: number;
  /** Somme à ajouter chaque mois quand le cash-flow est négatif (sinon 0). */
  savingsEffort: number;

  /** Argent personnel investi : équity + dépenses ponctuelles. */
  personalInvested: number;
  /** Cash-flow annuel / argent personnel investi, en %. null si rien investi. */
  cashOnCash: number | null;

  warnings: Warning[];
}

/** Équivalent mensuel d'une charge récurrente ; les ponctuelles ne sont pas récurrentes (0). */
export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  if (frequency === 'monthly') return amount;
  if (frequency === 'yearly') return amount / 12;
  return 0;
}

/** Équivalent annuel d'une charge récurrente ; les ponctuelles ne sont pas récurrentes (0). */
export function annualEquivalent(amount: number, frequency: Frequency): number {
  if (frequency === 'monthly') return amount * 12;
  if (frequency === 'yearly') return amount;
  return 0;
}

export function summarizeCharges(charges: ResolvedCharge[]): {
  monthly: number;
  annual: number;
  oneOff: number;
} {
  let annual = 0;
  let oneOff = 0;
  for (const c of charges) {
    annual += annualEquivalent(c.amount, c.frequency);
    if (c.frequency === 'once') oneOff += c.amount;
  }
  return { monthly: annual / 12, annual, oneOff };
}

/** Coût total du projet à partir des montants résolus. */
export function totalProjectCost(acq: ResolvedInputs['acquisition']): number {
  return ACQUISITION_KEYS.reduce((sum, k) => sum + acq[k], 0);
}

/** Pourcentage protégé contre la division par zéro. */
export function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

export function computeMetricsFromInputs(i: ResolvedInputs): Metrics {
  const totalCost = totalProjectCost(i.acquisition);
  const borrowed = i.loan.borrowed;
  const equity = Math.max(0, totalCost - borrowed);

  const loan = summarizeLoan({
    principal: borrowed,
    annualRatePct: i.loan.ratePct,
    months: i.loan.months,
    manualPayment: i.loan.manualPayment,
    insuranceMonthly: i.loan.insuranceMonthly,
    financingFees: i.acquisition.loanFees + i.acquisition.guarantee + i.acquisition.broker,
  });

  const rentAnnualNominal = i.rental.rentMonthly * 12;
  const rentAnnualEffective =
    i.rental.rentMonthly * (12 - i.rental.vacancyMonths) * (1 - i.rental.unpaidPct / 100);
  const rentMonthlyEffective = rentAnnualEffective / 12;

  const charges = summarizeCharges(i.charges);

  const cashflowMonthly = rentMonthlyEffective - loan.payment - loan.insuranceMonthly - charges.monthly;
  const cashflowAnnual = cashflowMonthly * 12;
  const personalInvested = equity + charges.oneOff;

  const warnings: Warning[] = [];
  if (i.acquisition.price <= 0) warnings.push('noPrice');
  if (i.rental.rentMonthly <= 0) warnings.push('noRent');
  if (borrowed > 0 && loan.months === 0 && !loan.paymentIsManual) warnings.push('loanDurationMissing');
  if (borrowed > totalCost && totalCost > 0) warnings.push('loanExceedsCost');

  return {
    scenario: i.scenario,
    totalCost,
    borrowed,
    equity,
    loan,
    rentAnnualNominal,
    rentAnnualEffective,
    rentMonthlyEffective,
    rentMonthlyWithCharges: i.rental.rentMonthly + i.rental.recoverableMonthly,
    chargesMonthly: charges.monthly,
    chargesAnnual: charges.annual,
    oneOffCharges: charges.oneOff,
    grossYield: pct(rentAnnualNominal, totalCost),
    netYield: pct(rentAnnualEffective - charges.annual, totalCost),
    cashflowMonthly,
    cashflowAnnual,
    savingsEffort: Math.max(0, -cashflowMonthly),
    personalInvested,
    cashOnCash: pct(cashflowAnnual, personalInvested),
    warnings,
  };
}

export function computeMetrics(property: Property, scenario: Scenario): Metrics {
  return computeMetricsFromInputs(resolveInputs(property, scenario));
}

/** Écart Réel − Prévu (null si l'un des deux est inconnu). */
export function delta(planned: number | null, actual: number | null): number | null {
  if (planned === null || actual === null) return null;
  return round2(actual - planned);
}
