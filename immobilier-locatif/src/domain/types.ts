/**
 * Modèle de données de l'application.
 *
 * Principe clé : chaque montant du projet est un `Amount` { planned, actual }.
 *  - `planned` : ce que j'imagine avant l'achat (null = non renseigné)
 *  - `actual`  : ce qui s'est réellement passé (null = pas encore connu)
 * Le « réel » remplace progressivement le « prévu » : tant qu'un montant réel
 * n'est pas connu, le calcul « réel » retombe sur le prévu.
 */

/** Version du schéma stocké et exporté. À incrémenter à chaque changement incompatible. */
export const SCHEMA_VERSION = 1;

export type Scenario = 'planned' | 'actual';

export interface Amount {
  planned: number | null;
  actual: number | null;
}

/** Rubriques du coût d'acquisition. Les identifiants servent aussi de catégories de mouvements. */
export const ACQUISITION_KEYS = [
  'price',
  'notary',
  'agency',
  'loanFees',
  'guarantee',
  'broker',
  'works',
  'furniture',
  'otherFees',
] as const;
export type AcquisitionKey = (typeof ACQUISITION_KEYS)[number];

export type Frequency = 'once' | 'monthly' | 'yearly';
export const FREQUENCIES: readonly Frequency[] = ['once', 'monthly', 'yearly'];

export interface ChargeItem {
  id: string;
  label: string;
  frequency: Frequency;
  /** Montant par occurrence (€ par mois, € par an ou € une seule fois selon `frequency`). */
  amount: Amount;
  /** Catégorie de mouvement correspondante (rubriques prédéfinies uniquement). */
  categoryId?: string;
}

export type MovementType = 'expense' | 'income';

export interface Movement {
  id: string;
  /** Date au format AAAA-MM-JJ. */
  date: string;
  type: MovementType;
  /** Toujours positif ; le sens est donné par `type`. */
  amount: number;
  categoryId: string;
  note: string;
}

export interface Loan {
  borrowed: Amount;
  /** Taux nominal annuel, en %. */
  ratePct: Amount;
  durationMonths: Amount;
  /** Mensualité hors assurance. `planned` null = calcul automatique. */
  monthlyPayment: Amount;
  /** Assurance emprunteur, en € par mois. */
  insuranceMonthly: Amount;
}

export interface Rental {
  /** Loyer mensuel hors charges. */
  rent: Amount;
  /** Charges récupérables auprès du locataire, par mois (neutres pour le propriétaire). */
  recoverableCharges: Amount;
  startDate: string | null;
  /** Nombre de mois de vacance locative prévus par an (0 à 12). */
  vacancyMonthsPerYear: number;
  /** Provision pour impayés, en % du loyer. */
  unpaidPct: number;
}

export type Phase = 'project' | 'owned';

export interface Property {
  id: string;
  name: string;
  address: string;
  phase: Phase;
  purchaseDate: string | null;
  createdAt: string;
  updatedAt: string;
  acquisition: Record<AcquisitionKey, Amount>;
  loan: Loan;
  rental: Rental;
  charges: ChargeItem[];
  movements: Movement[];
}

export interface CustomCategory {
  id: string;
  label: string;
  kind: MovementType;
}

export interface Settings {
  activePropertyId: string | null;
  customCategories: CustomCategory[];
  /** Date ISO de la dernière sauvegarde exportée. */
  lastBackupAt: string | null;
}

export interface AppData {
  properties: Property[];
  settings: Settings;
}
