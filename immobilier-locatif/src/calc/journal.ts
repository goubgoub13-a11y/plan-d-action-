/**
 * RÉALISÉ : synthèse des mouvements (ce qui a effectivement été payé et encaissé).
 * Voir docs/FORMULES.md §10 pour la version lisible. Fonctions pures.
 *
 * Classement des mouvements (par catégorie) :
 *  - ACHAT (prix, notaire, travaux…) : coût d'acquisition. Il est financé par l'apport et le prêt ;
 *    il n'entre donc PAS dans le résultat d'exploitation (le prêt est compté via les mensualités,
 *    l'apport via l'apport initial : aucun double comptage).
 *  - RÉCUPÉRABLES (« Charges récupérées », « Charges récupérables payées ») : débours pour le compte
 *    du locataire. NEUTRES : exclus de tous les indicateurs, affichés à part pour information.
 *  - EXPLOITATION (tout le reste) : loyers, autres recettes, mensualités, assurance, charges,
 *    taxes, catégories personnalisées.
 *
 * Argent personnel injecté = apport initial + injections d'exploitation, avec :
 *  - apport initial = coût d'acquisition de référence − emprunt (scénario « Réel »), compté
 *    dès que le bien est marqué acquis ;
 *  - injections d'exploitation : on parcourt les mois dans l'ordre chronologique avec une
 *    trésorerie du bien qui démarre à 0 €. Chaque mois, trésorerie += recettes − dépenses
 *    d'exploitation. Si elle devient négative, le manque est injecté de ma poche et la trésorerie
 *    revient à 0 €. Un excédent reste dans la trésorerie du bien et sert les mois suivants.
 *    → Le montant injecté ne diminue jamais : un mois bénéficiaire n'efface pas une injection passée.
 *
 * Solde net du projet = résultat d'exploitation cumulé − apport initial
 *  (= trésorerie restante du bien − argent personnel injecté).
 *  Positif : le bien m'a rapporté plus que ce que j'y ai mis ; négatif : il m'a coûté.
 */
import { ACQUISITION_LABELS, getCategory } from '../domain/categories';
import { ACQUISITION_KEYS, type AcquisitionKey, type CustomCategory, type Property } from '../domain/types';
import { round2 } from './loan';
import { expensesInCategory } from './resolve';

export type MovementClass = 'acquisition' | 'recoverable' | 'operating';

export function classifyMovement(categoryId: string, custom: CustomCategory[]): MovementClass {
  const g = getCategory(categoryId, custom).group;
  if (g === 'acquisition') return 'acquisition';
  if (g === 'recoverable') return 'recoverable';
  return 'operating';
}

export interface MonthFlow {
  /** AAAA-MM */
  month: string;
  income: number;
  expenses: number;
  /** Recettes − dépenses d'exploitation du mois. */
  net: number;
  /** Argent personnel injecté ce mois-ci pour couvrir un déficit. */
  injected: number;
  /** Trésorerie du bien en fin de mois (jamais négative). */
  cashAfter: number;
}

export interface JournalSummary {
  count: number;
  /** Recettes d'exploitation encaissées (hors charges récupérées). */
  received: number;
  rentReceived: number;
  /** Toutes les dépenses payées, achat compris, hors charges récupérables. */
  spent: number;
  acquisitionPaid: number;
  operatingExpenses: number;
  /** Résultat d'exploitation cumulé = recettes − dépenses d'exploitation. */
  operatingResult: number;
  /** Charges récupérables : neutres, pour information. */
  recoverableReceived: number;
  recoverablePaid: number;
  /** Apport initial (0 tant que le bien n'est pas marqué acquis). */
  initialContribution: number;
  /** Somme des déficits mensuels couverts de ma poche. */
  operatingInjections: number;
  /** Argent personnel injecté depuis le début. */
  personalInjected: number;
  /** Trésorerie restante du bien (excédents non encore consommés). */
  projectCash: number;
  /** Solde net du projet : ce que le bien m'a rapporté (+) ou coûté (−) depuis le début. */
  netBalance: number;
  months: MonthFlow[];
}

export interface JournalContext {
  /** Apport de référence = max(0, coût d'acquisition − emprunt), scénario « Réel ». */
  equity: number;
  /** Bien marqué acquis : l'apport a été versé. */
  acquired: boolean;
}

export function summarizeJournal(property: Property, custom: CustomCategory[], ctx: JournalContext): JournalSummary {
  let received = 0;
  let rentReceived = 0;
  let acquisitionPaid = 0;
  let operatingExpenses = 0;
  let recoverableReceived = 0;
  let recoverablePaid = 0;
  const byMonth = new Map<string, { income: number; expenses: number }>();

  for (const m of property.movements) {
    const cls = classifyMovement(m.categoryId, custom);
    if (cls === 'recoverable') {
      if (m.type === 'income') recoverableReceived += m.amount;
      else recoverablePaid += m.amount;
      continue;
    }
    if (cls === 'acquisition') {
      // Une « recette » dans une rubrique d'achat (remboursement, avoir) diminue le coût payé.
      acquisitionPaid += m.type === 'expense' ? m.amount : -m.amount;
      continue;
    }
    const month = m.date.slice(0, 7);
    const bucket = byMonth.get(month) ?? { income: 0, expenses: 0 };
    if (m.type === 'income') {
      received += m.amount;
      if (m.categoryId === 'rent') rentReceived += m.amount;
      bucket.income += m.amount;
    } else {
      operatingExpenses += m.amount;
      bucket.expenses += m.amount;
    }
    byMonth.set(month, bucket);
  }

  // Trésorerie du bien, mois par mois, dans l'ordre chronologique.
  let cash = 0;
  let operatingInjections = 0;
  const months: MonthFlow[] = [...byMonth.keys()].sort().map((month) => {
    const { income, expenses } = byMonth.get(month)!;
    const net = round2(income - expenses);
    cash = round2(cash + net);
    let injected = 0;
    if (cash < 0) {
      injected = -cash;
      operatingInjections = round2(operatingInjections + injected);
      cash = 0;
    }
    return { month, income: round2(income), expenses: round2(expenses), net, injected, cashAfter: cash };
  });

  const initialContribution = ctx.acquired ? round2(Math.max(0, ctx.equity)) : 0;
  const operatingResult = round2(received - operatingExpenses);
  return {
    count: property.movements.length,
    received: round2(received),
    rentReceived: round2(rentReceived),
    spent: round2(acquisitionPaid + operatingExpenses),
    acquisitionPaid: round2(acquisitionPaid),
    operatingExpenses: round2(operatingExpenses),
    operatingResult,
    recoverableReceived: round2(recoverableReceived),
    recoverablePaid: round2(recoverablePaid),
    initialContribution,
    operatingInjections,
    personalInjected: round2(initialContribution + operatingInjections),
    projectCash: cash,
    netBalance: round2(operatingResult - initialContribution),
    months,
  };
}

export interface AcquisitionDiscrepancy {
  key: AcquisitionKey;
  label: string;
  /** Total déjà payé selon les mouvements. */
  paid: number;
  /** Montant de référence utilisé par les calculs (réel, sinon prévu). */
  reference: number;
  referenceIsActual: boolean;
}

/**
 * Rubriques d'achat dont le RÉALISÉ (mouvements) dépasse le montant de RÉFÉRENCE.
 * Exemple : notaire prévu 5 000 €, 5 400 € payés, réel non saisi → les calculs utilisent
 * encore 5 000 € : on le signale pour que l'utilisateur confirme le montant réel.
 * Rien n'est modifié automatiquement (un mouvement peut être un acompte, une erreur…).
 */
export function acquisitionDiscrepancies(property: Property): AcquisitionDiscrepancy[] {
  const out: AcquisitionDiscrepancy[] = [];
  for (const key of ACQUISITION_KEYS) {
    const { total, count } = expensesInCategory(property, key);
    if (count === 0) continue;
    const a = property.acquisition[key];
    const reference = a.actual ?? a.planned ?? 0;
    if (total > reference + 0.5) {
      out.push({ key, label: ACQUISITION_LABELS[key], paid: round2(total), reference, referenceIsActual: a.actual !== null });
    }
  }
  return out;
}
