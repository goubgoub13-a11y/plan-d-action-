/**
 * Synthèse du journal des mouvements : ce qui a réellement été payé et encaissé.
 *
 * - `spent` / `received` / `netResult` : tout ce que le bien a coûté / rapporté depuis le début.
 * - `operatingBalance` : recettes − dépenses d'exploitation (tout sauf les rubriques d'achat).
 *   Les mensualités de crédit doivent être saisies comme mouvements pour être comptées.
 * - `personalOut` : argent réellement sorti de ma poche =
 *     achat non financé par le crédit (coût réel − emprunt réel)
 *     + déficit d'exploitation cumulé (si le solde d'exploitation est négatif).
 *   Un excédent d'exploitation ne vient pas diminuer l'apport initial ; il apparaît à part.
 */
import { getCategory } from '../domain/categories';
import type { CustomCategory, Property } from '../domain/types';
import { round2 } from './loan';
import type { Metrics } from './metrics';

export interface JournalSummary {
  count: number;
  spent: number;
  received: number;
  /** Recettes − dépenses (positif = le bien a rapporté plus qu'il n'a coûté). */
  netResult: number;
  rentReceived: number;
  acquisitionPaid: number;
  operatingExpenses: number;
  operatingBalance: number;
  /** Achat non financé par le crédit (scénario réel). */
  initialOut: number;
  /** Déficit d'exploitation cumulé : max(0, −solde d'exploitation). */
  cumulativeNegativeCashflow: number;
  /** Argent réellement sorti de ma poche. */
  personalOut: number;
}

export function summarizeJournal(
  property: Property,
  custom: CustomCategory[],
  actualMetrics: Pick<Metrics, 'equity'>,
): JournalSummary {
  let spent = 0;
  let received = 0;
  let rentReceived = 0;
  let acquisitionPaid = 0;
  for (const m of property.movements) {
    if (m.type === 'income') {
      received += m.amount;
      if (m.categoryId === 'rent') rentReceived += m.amount;
    } else {
      spent += m.amount;
      if (getCategory(m.categoryId, custom).group === 'acquisition') acquisitionPaid += m.amount;
    }
  }
  const operatingExpenses = spent - acquisitionPaid;
  const operatingBalance = received - operatingExpenses;
  const cumulativeNegativeCashflow = Math.max(0, -operatingBalance);
  const initialOut = actualMetrics.equity;
  return {
    count: property.movements.length,
    spent: round2(spent),
    received: round2(received),
    netResult: round2(received - spent),
    rentReceived: round2(rentReceived),
    acquisitionPaid: round2(acquisitionPaid),
    operatingExpenses: round2(operatingExpenses),
    operatingBalance: round2(operatingBalance),
    initialOut: round2(initialOut),
    cumulativeNegativeCashflow: round2(cumulativeNegativeCashflow),
    personalOut: round2(initialOut + cumulativeNegativeCashflow),
  };
}
