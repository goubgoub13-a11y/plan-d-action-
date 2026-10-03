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
import { ACQUISITION_LABELS } from '../domain/categories';
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

/**
 * Vrai si au moins un montant RÉEL de référence (champ `actual`) est saisi.
 * Les mouvements (le « réalisé ») n'entrent volontairement pas en compte : une simple dépense
 * enregistrée ne fait pas d'un projet simulé un projet « réel ».
 */
export function hasActualData(property: Property): boolean {
  const amounts: Amount[] = [
    ...Object.values(property.acquisition),
    ...Object.values(property.loan),
    property.rental.rent,
    property.rental.recoverableCharges,
    ...property.charges.map((c) => c.amount),
  ];
  return amounts.some((a) => a.actual !== null);
}

/* ───────── Couverture du réel : quels montants sont confirmés, lesquels sont encore prévus ───────── */

export type ReferenceGroup = 'acquisition' | 'loan' | 'rental' | 'charges';

export interface ReferenceField {
  group: ReferenceGroup;
  label: string;
  /** true : montant réel saisi ; false : le scénario « Réel » utilise encore le montant prévu. */
  confirmed: boolean;
}

const isSet = (a: Amount) => a.actual !== null || (a.planned !== null && a.planned > 0);

/**
 * Liste des montants qui comptent dans les calculs (renseignés en prévu ou en réel),
 * avec leur statut. Sert à signaler, en mode « Réel », ce qui repose encore sur le prévu.
 */
export function referenceFields(p: Property): ReferenceField[] {
  const out: ReferenceField[] = [];
  const add = (group: ReferenceGroup, label: string, a: Amount) => {
    if (isSet(a)) out.push({ group, label, confirmed: a.actual !== null });
  };
  for (const k of ACQUISITION_KEYS) add('acquisition', ACQUISITION_LABELS[k], p.acquisition[k]);
  const l = p.loan;
  add('loan', 'Montant emprunté', l.borrowed);
  const hasLoan = isSet(l.borrowed);
  if (hasLoan) {
    // La mensualité est confirmée si la banque l'a donnée, ou si capital, taux et durée réels sont saisis.
    const derived = l.borrowed.actual !== null && l.ratePct.actual !== null && l.durationMonths.actual !== null;
    out.push({ group: 'loan', label: 'Mensualité du crédit', confirmed: l.monthlyPayment.actual !== null || derived });
  }
  add('loan', 'Assurance emprunteur', l.insuranceMonthly);
  add('rental', 'Loyer', p.rental.rent);
  for (const c of p.charges) add('charges', c.label, c.amount);
  return out;
}

/** Groupes de données utilisés par chaque indicateur du tableau de bord. */
export const KPI_INPUTS = {
  totalCost: ['acquisition'],
  personalInvested: ['acquisition', 'loan', 'charges'],
  rent: ['rental'],
  payment: ['loan'],
  charges: ['charges'],
  grossYield: ['acquisition', 'rental'],
  netYield: ['acquisition', 'rental', 'charges'],
  cashflow: ['rental', 'loan', 'charges'],
  savingsEffort: ['rental', 'loan', 'charges'],
  cashOnCash: ['acquisition', 'rental', 'loan', 'charges'],
} as const satisfies Record<string, readonly ReferenceGroup[]>;

export type KpiKey = keyof typeof KPI_INPUTS;

/** Libellés des montants encore prévisionnels utilisés par un indicateur en mode « Réel ». */
export function estimatedInputs(fields: ReferenceField[], kpi: KpiKey): string[] {
  const groups: readonly ReferenceGroup[] = KPI_INPUTS[kpi];
  return fields.filter((f) => !f.confirmed && groups.includes(f.group)).map((f) => f.label);
}
