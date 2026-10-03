/**
 * Résolution Prévu / Réel.
 *
 * Transforme un `Property` (montants { planned, actual }) en `ResolvedInputs`
 * (nombres simples) pour un scénario donné. C'est ici — et seulement ici — que
 * s'applique la règle « le réel remplace le prévu ».
 *
 *  - Scénario `planned` : on ne lit que les montants prévus (non renseigné = 0).
 *  - Scénario `actual`  : pour chaque montant, dans l'ordre de priorité :
 *      1. le montant réel saisi (même 0 € : « c'était gratuit ») ;
 *      2. le montant prévu ;
 *      3. 0.
 *
 * Les mouvements (journal) ne remplacent PAS automatiquement un montant prévu : un paiement
 * partiel (un acompte de travaux, par exemple) ferait croire à un coût final plus bas.
 * L'interface affiche « payé à ce jour » et propose de le reprendre comme montant réel.
 */
import {
  ACQUISITION_KEYS,
  type AcquisitionKey,
  type Amount,
  type Frequency,
  type Property,
  type Scenario,
} from '../domain/types';

export type AcquisitionSource = 'planned' | 'actual';

export interface ResolvedCharge {
  id: string;
  label: string;
  frequency: Frequency;
  amount: number;
}

export interface ResolvedInputs {
  scenario: Scenario;
  acquisition: Record<AcquisitionKey, number>;
  acquisitionSources: Record<AcquisitionKey, AcquisitionSource>;
  loan: {
    borrowed: number;
    ratePct: number;
    months: number;
    /** Mensualité hors assurance imposée (banque), ou null = calcul automatique. */
    manualPayment: number | null;
    insuranceMonthly: number;
  };
  rental: {
    rentMonthly: number;
    recoverableMonthly: number;
    vacancyMonths: number;
    unpaidPct: number;
  };
  charges: ResolvedCharge[];
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function pick(a: Amount, scenario: Scenario): number {
  if (scenario === 'actual' && a.actual !== null) return num(a.actual);
  return num(a.planned);
}

/** Somme des dépenses enregistrées dans une catégorie (« payé à ce jour »). */
export function expensesInCategory(property: Property, categoryId: string): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const m of property.movements) {
    if (m.type === 'expense' && m.categoryId === categoryId) {
      total += m.amount;
      count += 1;
    }
  }
  return { total, count };
}

export function resolveInputs(property: Property, scenario: Scenario): ResolvedInputs {
  const acquisition = {} as Record<AcquisitionKey, number>;
  const sources = {} as Record<AcquisitionKey, AcquisitionSource>;
  for (const key of ACQUISITION_KEYS) {
    const a = property.acquisition[key];
    if (scenario === 'actual' && a.actual !== null) {
      acquisition[key] = num(a.actual);
      sources[key] = 'actual';
      continue;
    }
    acquisition[key] = num(a.planned);
    sources[key] = 'planned';
  }

  const l = property.loan;
  const borrowed = pick(l.borrowed, scenario);
  const ratePct = pick(l.ratePct, scenario);
  const months = pick(l.durationMonths, scenario);
  // Mensualité imposée : en réel, la valeur de la banque ; sinon le prévu manuel
  // tant que les paramètres du prêt (capital, taux, durée) n'ont pas été corrigés en réel.
  let manualPayment: number | null;
  if (scenario === 'planned') {
    manualPayment = l.monthlyPayment.planned;
  } else if (l.monthlyPayment.actual !== null) {
    manualPayment = l.monthlyPayment.actual;
  } else {
    const loanParamsChanged =
      l.borrowed.actual !== null || l.ratePct.actual !== null || l.durationMonths.actual !== null;
    manualPayment = loanParamsChanged ? null : l.monthlyPayment.planned;
  }

  const r = property.rental;
  return {
    scenario,
    acquisition,
    acquisitionSources: sources,
    loan: {
      borrowed,
      ratePct,
      months,
      manualPayment,
      insuranceMonthly: pick(l.insuranceMonthly, scenario),
    },
    rental: {
      rentMonthly: pick(r.rent, scenario),
      recoverableMonthly: pick(r.recoverableCharges, scenario),
      vacancyMonths: Math.min(12, Math.max(0, num(r.vacancyMonthsPerYear))),
      unpaidPct: Math.min(100, Math.max(0, num(r.unpaidPct))),
    },
    charges: property.charges.map((c) => ({
      id: c.id,
      label: c.label,
      frequency: c.frequency,
      amount: pick(c.amount, scenario),
    })),
  };
}

/** Vrai si au moins une donnée réelle (montant ou mouvement) existe. */
export function hasActualData(property: Property): boolean {
  if (property.movements.length > 0) return true;
  const amounts: Amount[] = [
    ...Object.values(property.acquisition),
    ...Object.values(property.loan),
    property.rental.rent,
    property.rental.recoverableCharges,
    ...property.charges.map((c) => c.amount),
  ];
  return amounts.some((a) => a.actual !== null);
}
