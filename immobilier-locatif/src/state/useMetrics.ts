import { useMemo } from 'react';
import { computeMetrics, type Metrics } from '../calc/metrics';
import { acquisitionDiscrepancies, summarizeJournal, type AcquisitionDiscrepancy, type JournalSummary } from '../calc/journal';
import { hasActualData, referenceFields, type ReferenceField } from '../calc/resolve';
import type { Property } from '../domain/types';
import { useStore } from './store';

export interface PropertyMetrics {
  planned: Metrics;
  actual: Metrics;
  /** Réalisé : synthèse des mouvements. */
  journal: JournalSummary;
  /** Au moins un montant réel de référence saisi (les mouvements n'en sont pas). */
  hasActual: boolean;
  /** Affiche les colonnes « Réel » : bien acheté, ou des montants réels déjà saisis. */
  showReal: boolean;
  /** Montants pris en compte et leur statut (réel confirmé / encore prévu). */
  fields: ReferenceField[];
  /** Rubriques d'achat dont le payé dépasse la référence. */
  discrepancies: AcquisitionDiscrepancy[];
}

export function usePropertyMetrics(p: Property): PropertyMetrics {
  const { data } = useStore();
  const custom = data.settings.customCategories;
  return useMemo(() => {
    const planned = computeMetrics(p, 'planned');
    const actual = computeMetrics(p, 'actual');
    const hasActual = hasActualData(p);
    return {
      planned,
      actual,
      journal: summarizeJournal(p, custom, { equity: actual.equity, acquired: p.phase === 'owned' }),
      hasActual,
      showReal: p.phase === 'owned' || hasActual,
      fields: referenceFields(p),
      discrepancies: acquisitionDiscrepancies(p),
    };
  }, [p, custom]);
}
