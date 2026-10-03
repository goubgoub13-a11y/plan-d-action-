import type { AcquisitionKey, CustomCategory, MovementType } from './types';

/**
 * Groupes de catégories :
 *  - acquisition : coût d'achat (financé par l'apport et le prêt, cf. calc/journal.ts) ;
 *  - operating / financing / income / custom : exploitation du bien ;
 *  - recoverable : charges récupérables (débours) — NEUTRES dans tous les indicateurs.
 */
export type CategoryGroup = 'acquisition' | 'operating' | 'financing' | 'income' | 'recoverable' | 'custom';

export interface Category {
  id: string;
  label: string;
  kind: MovementType;
  group: CategoryGroup;
}

export const ACQUISITION_LABELS: Record<AcquisitionKey, string> = {
  price: "Prix d'achat",
  notary: 'Frais de notaire',
  agency: "Frais d'agence (acquéreur)",
  loanFees: 'Frais de dossier',
  guarantee: 'Garantie / caution',
  broker: 'Courtier',
  works: 'Travaux',
  furniture: 'Mobilier / équipement',
  otherFees: "Autres frais d'achat",
};

/** Rubriques de charges prédéfinies (id = id de catégorie de mouvement). */
export const DEFAULT_CHARGE_CATEGORIES: { id: string; label: string; frequency: 'monthly' | 'yearly' }[] = [
  { id: 'propertyTax', label: 'Taxe foncière', frequency: 'yearly' },
  { id: 'pno', label: 'Assurance PNO', frequency: 'yearly' },
  { id: 'coproNonRecoverable', label: 'Copropriété (non récupérable)', frequency: 'monthly' },
  { id: 'maintenance', label: 'Entretien', frequency: 'yearly' },
  { id: 'repairs', label: 'Réparations', frequency: 'yearly' },
  { id: 'management', label: 'Gestion locative', frequency: 'monthly' },
  { id: 'bankFees', label: 'Frais bancaires du projet', frequency: 'yearly' },
  { id: 'accounting', label: 'Comptabilité', frequency: 'yearly' },
  { id: 'otherTaxes', label: 'Autres taxes', frequency: 'yearly' },
  { id: 'otherExpenses', label: 'Autres dépenses', frequency: 'yearly' },
];

export const BUILTIN_CATEGORIES: Category[] = [
  ...(Object.keys(ACQUISITION_LABELS) as AcquisitionKey[]).map((id) => ({
    id,
    label: ACQUISITION_LABELS[id],
    kind: 'expense' as const,
    group: 'acquisition' as const,
  })),
  ...DEFAULT_CHARGE_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    kind: 'expense' as const,
    group: 'operating' as const,
  })),
  { id: 'loanPayment', label: 'Mensualité de crédit', kind: 'expense', group: 'financing' },
  { id: 'loanInsurance', label: 'Assurance emprunteur', kind: 'expense', group: 'financing' },
  { id: 'recoverableChargesPaid', label: 'Charges récupérables payées', kind: 'expense', group: 'recoverable' },
  { id: 'rent', label: 'Loyer (hors charges)', kind: 'income', group: 'income' },
  { id: 'recoveredCharges', label: 'Charges récupérées (locataire)', kind: 'income', group: 'recoverable' },
  { id: 'otherIncome', label: 'Autre recette', kind: 'income', group: 'income' },
];

const BY_ID = new Map(BUILTIN_CATEGORIES.map((c) => [c.id, c]));

export function allCategories(custom: CustomCategory[]): Category[] {
  return [
    ...BUILTIN_CATEGORIES,
    ...custom.map((c) => ({ id: c.id, label: c.label, kind: c.kind, group: 'custom' as const })),
  ];
}

/** Catégorie par identifiant ; une catégorie supprimée retombe sur « Autre ». */
export function getCategory(id: string, custom: CustomCategory[]): Category {
  const builtin = BY_ID.get(id);
  if (builtin) return builtin;
  const c = custom.find((x) => x.id === id);
  if (c) return { id: c.id, label: c.label, kind: c.kind, group: 'custom' };
  return { id, label: 'Autre', kind: 'expense', group: 'custom' };
}

/** Charges récupérables (versées par le locataire ou payées pour son compte) : neutres. */
export function isRecoverableCategory(id: string): boolean {
  return BY_ID.get(id)?.group === 'recoverable';
}

export function isAcquisitionCategory(id: string): id is AcquisitionKey {
  return BY_ID.get(id)?.group === 'acquisition';
}
