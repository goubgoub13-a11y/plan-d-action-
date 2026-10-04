import { useState } from 'react';
import { estimatedInputs, resolveInputs, type KpiKey } from '../calc/resolve';
import type { Scenario } from '../domain/types';
import { eur, eurSigned, pctFmt, todayIso } from '../lib/format';
import { monthSeries } from '../lib/series';
import { MonthlyChart } from '../ui/MonthlyChart';
import { useProperty } from '../state/store';
import { usePropertyMetrics } from '../state/useMetrics';
import { Amount, EmptyState, Legend, Line, Section, StackBar } from '../ui/Display';
import { Info, Segmented } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { EXPLAIN, type ExplainKey } from './explain';
import type { Go } from './nav';
import { Comparison, KPI_OF, KpiDetail } from './shared';

/**
 * Analyse — l'information la plus importante : ce que le bien a réellement rapporté ou coûté.
 * Puis la comparaison prévu / réel, la rentabilité et la composition du coût.
 */
export function Analysis({ go, choice, setChoice }: { go: Go; choice: Scenario | null; setChoice: (s: Scenario) => void }) {
  const p = useProperty();
  const { planned, actual, journal: j, hasActual, fields } = usePropertyMetrics(p);
  const scenario: Scenario = hasActual ? (choice ?? 'actual') : 'planned';
  const isReal = scenario === 'actual';
  const m = isReal ? actual : planned;
  const [detail, setDetail] = useState<ExplainKey | null>(null);
  const est = (k: KpiKey) => (isReal ? estimatedInputs(fields, k) : []);

  const acq = resolveInputs(p, scenario).acquisition;
  const costParts = [
    { label: 'Prix', value: acq.price, tone: 'a' as const },
    { label: 'Frais d’achat', value: acq.notary + acq.agency + acq.otherFees, tone: 'b' as const },
    { label: 'Frais de crédit', value: acq.loanFees + acq.guarantee + acq.broker, tone: 'c' as const },
    { label: 'Travaux, mobilier', value: acq.works + acq.furniture, tone: 'd' as const },
  ];

  const series = monthSeries(j.months, todayIso().slice(0, 7), p.purchaseDate?.slice(0, 7));

  return (
    <div className="screen">
      <header className="page-head">
        <p className="eyebrow">{p.name}</p>
        <h1>Analyse</h1>
      </header>

      <Section
        title="Depuis l'achat"
        icon="swap"
        action={
          <Info title={EXPLAIN.netBalance.title}>
            {EXPLAIN.netBalance.body}
            <h3>{EXPLAIN.personalInjected.title}</h3>
            {EXPLAIN.personalInjected.body}
          </Info>
        }
      >
        {j.count === 0 && p.phase !== 'owned' ? (
          <EmptyState
            icon="swap"
            title="Pas encore de réalisé"
            action={
              <button className="btn btn-secondary" onClick={() => go('movements')}>
                <Icon name="plus" size={18} /> Ajouter un mouvement
              </button>
            }
          >
            Une fois le bien acheté, vos loyers et dépenses enregistrés apparaîtront ici.
          </EmptyState>
        ) : (
          <>
            <div className="big-figure">
              <span className="mini-label">Solde net du projet</span>
              <Amount value={j.netBalance} size="display" signed tone={j.netBalance >= 0 ? 'pos' : undefined} />
              <span className="mini-note">{j.netBalance >= 0 ? 'Le bien vous a rapporté' : 'Le bien vous a coûté'} ce montant à ce jour, apport compris.</span>
            </div>
            {series.length > 0 && <MonthlyChart series={series} />}
            <details className="analysis-details">
              <summary>Comprendre ce solde <Icon name="chevron" size={16} /></summary>
            <div className="lines">
              <Line label="Recettes encaissées" value={eur(j.received)} />
              <Line label="Dépenses courantes" hint="crédit, charges, taxes…" value={eur(j.operatingExpenses)} />
              <Line label="Résultat d'exploitation" value={eurSigned(j.operatingResult)} tone={j.operatingResult >= 0 ? 'pos' : undefined} strong />
              <Line label="Apport initial" value={eur(j.initialContribution)} />
              <Line label="Argent personnel injecté" hint="estimation fondée sur les déficits mensuels cumulés" value={eur(j.personalInjected)} strong />
              {(j.recoverableReceived > 0 || j.recoverablePaid > 0) && (
                <Line label="Charges récupérables" hint="reçues / payées · neutres" value={`${eur(j.recoverableReceived)} / ${eur(j.recoverablePaid)}`} />
              )}
            </div>
            </details>

          </>
        )}
      </Section>

      {hasActual && (
        <Section title="Prévu et réel" icon="layers" action={<Info title={EXPLAIN.prevuReel.title}>{EXPLAIN.prevuReel.body}</Info>}>
          <Comparison planned={planned} actual={actual} />
        </Section>
      )}

      <Section
        title="Rentabilité"
        icon="percent"
        action={
          hasActual ? (
            <Segmented
              small
              label="Chiffres affichés"
              value={scenario}
              onChange={setChoice}
              options={[
                { value: 'planned', label: 'Prévu' },
                { value: 'actual', label: 'Réel' },
              ]}
            />
          ) : undefined
        }
      >
        <div className="lines">
          <TapLine label="Rentabilité nette" value={pctFmt(m.netYield)} sub="avant impôts" estimated={est('netYield').length > 0} onClick={() => setDetail('netYield')} />
          <TapLine label="Rentabilité brute" value={pctFmt(m.grossYield)} estimated={est('grossYield').length > 0} onClick={() => setDetail('grossYield')} />
          <TapLine label="Rendement de l'apport" value={pctFmt(m.cashOnCash)} sub="par an" estimated={est('cashOnCash').length > 0} onClick={() => setDetail('cashOnCash')} />
          <TapLine label="Charges propriétaire" value={`${eur(m.chargesMonthly)} /mois`} estimated={est('charges').length > 0} onClick={() => setDetail('charges')} />
          <TapLine label="Investi personnellement" value={eur(m.personalInvested)} estimated={est('personalInvested').length > 0} onClick={() => setDetail('personalInvested')} />
        </div>
      </Section>

      {m.totalCost > 0 && (
        <Section title="Coût du projet" icon="building" headline={<Amount value={m.totalCost} size="xl" />}>
          <StackBar label="Répartition du coût du projet" parts={costParts} />
          <Legend items={costParts.filter((c) => c.value > 0).map((c) => ({ tone: c.tone, label: `${c.label} ${eur(c.value)}` }))} />
        </Section>
      )}

      <Sheet open={detail !== null} title={detail ? EXPLAIN[detail].title : ''} onClose={() => setDetail(null)}>
        {detail && <KpiDetail k={detail} m={m} estimated={KPI_OF[detail] ? est(KPI_OF[detail]!) : []} />}
      </Sheet>
    </div>
  );
}

function TapLine({ label, value, sub, estimated, onClick }: { label: string; value: string; sub?: string; estimated?: boolean; onClick: () => void }) {
  return (
    <button className="line line-tap" onClick={onClick}>
      <span className="line-label">
        {label}
        {estimated && <i className="estimated-dot" aria-label="en partie prévu" />}
        {sub && <span className="line-hint">{sub}</span>}
      </span>
      <span className="line-values">
        <span className="line-value">{value}</span>
      </span>
      <Icon name="chevron" size={16} className="line-chevron" />
    </button>
  );
}
