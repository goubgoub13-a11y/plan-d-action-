/**
 * Éléments partagés entre Accueil et Analyse (v1.1.0). Présentation uniquement :
 * toutes les valeurs viennent de src/calc via usePropertyMetrics.
 */
import type { ReactNode } from 'react';
import type { Metrics } from '../calc/metrics';
import type { KpiKey } from '../calc/resolve';
import { daysSince, eur, eur2, eurSigned, pctFmt } from '../lib/format';
import { Amount, DeltaPill, Line, Percent, type Tone } from '../ui/Display';
import { EXPLAIN, type ExplainKey } from './explain';

export const WARNING_TEXT: Record<string, string> = {
  noPrice: "Le prix d'achat n'est pas encore renseigné.",
  noRent: "Le loyer n'est pas encore renseigné.",
  loanDurationMissing: 'Un emprunt est saisi sans durée ni mensualité.',
  loanExceedsCost: 'Le montant emprunté dépasse le coût du projet.',
  loanPaymentInconsistent:
    'La mensualité saisie ne permet pas de rembourser le capital sur la durée indiquée. Vérifiez la mensualité, le montant emprunté et la durée.',
};

export function needsBackupHint(lastBackupAt: string | null, createdAts: string[]): boolean {
  if (createdAts.length === 0) return false;
  if (lastBackupAt) return daysSince(lastBackupAt) > 30;
  const oldest = createdAts.reduce((a, b) => (a < b ? a : b));
  return daysSince(oldest) >= 2;
}

/** Indicateur de projet correspondant à chaque fiche d'explication. */
export const KPI_OF: Partial<Record<ExplainKey, KpiKey>> = {
  totalCost: 'totalCost',
  personalInvested: 'personalInvested',
  rent: 'rent',
  payment: 'payment',
  charges: 'charges',
  cashflow: 'cashflow',
  savingsEffort: 'savingsEffort',
  grossYield: 'grossYield',
  netYield: 'netYield',
  cashOnCash: 'cashOnCash',
};

/** Contenu de la fiche détail d'un indicateur : calcul pas à pas puis formule. */
export function KpiDetail({ k, m, estimated }: { k: ExplainKey; m: Metrics; estimated: string[] }) {
  const lines: Partial<Record<ExplainKey, [string, string][]>> = {
    totalCost: [
      ['Financé par le crédit', eur(Math.min(m.borrowed, m.totalCost))],
      ['Apport personnel', eur(m.equity)],
      ['Coût total', eur(m.totalCost)],
    ],
    personalInvested: [
      ['Apport (coût − emprunt)', eur(m.equity)],
      ['Dépenses ponctuelles', eur(m.oneOffCharges)],
      ['Total', eur(m.personalInvested)],
    ],
    rent: [
      ['Loyer charges comprises', `${eur(m.rentMonthlyWithCharges)} /mois`],
      ['Loyer annuel théorique', eur(m.rentAnnualNominal)],
      ['Loyer annuel conservé', eur(m.rentAnnualEffective)],
      ['Loyer hors charges', `${eur(m.rentAnnualNominal / 12)} /mois`],
    ],
    payment: [
      [
        'Hors assurance',
        eur2(m.loan.payment) + (m.loan.paymentIsManual ? (m.loan.paymentInconsistent ? ' (saisie, incohérente)' : ' (saisie)') : ' (calculée)'),
      ],
      ['Assurance', eur2(m.loan.insuranceMonthly)],
      ['Total', eur2(m.loan.paymentWithInsurance)],
    ],
    charges: [
      ['Par an', eur(m.chargesAnnual)],
      ['Dépenses ponctuelles', eur(m.oneOffCharges)],
      ['Par mois', eur(m.chargesMonthly)],
    ],
    cashflow: [
      ['Loyer conservé', `+${eur(m.rentMonthlyEffective)}`],
      ['Mensualité de crédit', `−${eur(m.loan.payment)}`],
      ['Assurance emprunteur', `−${eur(m.loan.insuranceMonthly)}`],
      ['Charges propriétaire', `−${eur(m.chargesMonthly)}`],
      ['Cash-flow annuel', eurSigned(m.cashflowAnnual)],
      ["Effort d'épargne", `${eur(m.savingsEffort)} /mois`],
      ['Cash-flow mensuel', eurSigned(m.cashflowMonthly)],
    ],
    grossYield: [
      ['Loyer annuel hors charges', eur(m.rentAnnualNominal)],
      ['Coût total du projet', eur(m.totalCost)],
      ['Rentabilité brute', pctFmt(m.grossYield, 2)],
    ],
    netYield: [
      ['Loyers annuels conservés', eur(m.rentAnnualEffective)],
      ['Charges annuelles', `−${eur(m.chargesAnnual)}`],
      ['Coût total du projet', eur(m.totalCost)],
      ['Rentabilité nette', pctFmt(m.netYield, 2)],
    ],
    cashOnCash: [
      ['Cash-flow annuel', eurSigned(m.cashflowAnnual)],
      ['Investi personnellement', eur(m.personalInvested)],
      ['Rendement', pctFmt(m.cashOnCash, 2)],
    ],
  };
  const l = lines[k];
  return (
    <div className="prose">
      {l && (
        <div className="detail-box">
          {l.map(([a, b], i) => (
            <Line key={a} label={a} value={b} strong={i === l.length - 1} />
          ))}
        </div>
      )}
      {estimated.length > 0 && (
        <div className="note note-warn">
          <i className="estimated-dot" aria-hidden="true" /> Encore calculé avec des montants prévus : {estimated.join(', ')}.
        </div>
      )}
      {EXPLAIN[k].body}
    </div>
  );
}

interface CompareRow {
  label: string;
  planned: number | null;
  actual: number | null;
  render: (v: number | null) => ReactNode;
  delta: (d: number) => string;
  higherIsBetter: boolean;
  threshold: number;
}

/** Prévu / Réel : valeur réelle en avant, prévu en secondaire, écart en pastille. Pas de tableau. */
export function Comparison({ planned, actual }: { planned: Metrics; actual: Metrics }) {
  const money = (v: number | null) => <Amount value={v ?? 0} size="md" />;
  const pts = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1).replace('.', ',')} pt`;
  const rows: CompareRow[] = [
    { label: 'Rentabilité nette', planned: planned.netYield, actual: actual.netYield, render: (v) => <Percent value={v} size="md" />, delta: pts, higherIsBetter: true, threshold: 0.05 },
    { label: 'Cash-flow mensuel', planned: planned.cashflowMonthly, actual: actual.cashflowMonthly, render: (v) => <Amount value={v ?? 0} size="md" signed />, delta: eurSigned, higherIsBetter: true, threshold: 0.5 },
    { label: 'Coût du projet', planned: planned.totalCost, actual: actual.totalCost, render: money, delta: eurSigned, higherIsBetter: false, threshold: 0.5 },
    { label: 'Loyer mensuel', planned: planned.rentAnnualNominal / 12, actual: actual.rentAnnualNominal / 12, render: money, delta: eurSigned, higherIsBetter: true, threshold: 0.5 },
    { label: 'Mensualité', planned: planned.loan.paymentWithInsurance, actual: actual.loan.paymentWithInsurance, render: money, delta: eurSigned, higherIsBetter: false, threshold: 0.5 },
  ];
  return (
    <div className="compare">
      {rows.map((r) => {
        const d = r.planned !== null && r.actual !== null ? r.actual - r.planned : null;
        const significant = d !== null && Math.abs(d) >= r.threshold;
        const tone: Tone | undefined = !significant ? undefined : (d! > 0) === r.higherIsBetter ? 'pos' : 'neg';
        const plannedText =
          r.label === 'Rentabilité nette' ? pctFmt(r.planned) : r.label === 'Cash-flow mensuel' ? eurSigned(r.planned ?? 0) : eur(r.planned ?? 0);
        return (
          <div className="compare-row" key={r.label}>
            <div className="compare-main">
              <span className="compare-label">{r.label}</span>
              <span className="compare-sub">prévu {plannedText}</span>
            </div>
            <div className="compare-side">
              {r.render(r.actual)}
              {significant ? <DeltaPill tone={tone}>{r.delta(d!)}</DeltaPill> : <DeltaPill tone="muted">conforme</DeltaPill>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
