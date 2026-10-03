import { useMemo } from 'react';
import { computeMetrics, type Metrics } from '../calc/metrics';
import { summarizeJournal, type JournalSummary } from '../calc/journal';
import { hasActualData } from '../calc/resolve';
import type { Property } from '../domain/types';
import { useStore } from './store';

export interface PropertyMetrics {
  planned: Metrics;
  actual: Metrics;
  journal: JournalSummary;
  hasActual: boolean;
  /** Affiche les colonnes « Réel » : bien acheté, ou des montants réels déjà saisis. */
  showReal: boolean;
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
      journal: summarizeJournal(p, custom, actual),
      hasActual,
      showReal: p.phase === 'owned' || hasActual,
    };
  }, [p, custom]);
}
