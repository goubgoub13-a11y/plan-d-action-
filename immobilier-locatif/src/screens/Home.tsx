import { useState } from 'react';
import { estimatedInputs, type KpiKey } from '../calc/resolve';
import type { Scenario } from '../domain/types';
import { eur, monthFr, pctFmt, todayIso } from '../lib/format';
import { monthSeries } from '../lib/series';
import { Sparkline } from '../ui/MonthlyChart';
import { useProperty, useStore } from '../state/store';
import { usePropertyMetrics } from '../state/useMetrics';
import { Amount, EmptyState, Percent, Stat } from '../ui/Display';
import { Segmented } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { EXPLAIN, type ExplainKey } from './explain';
import type { Go } from './nav';
import { KPI_OF, KpiDetail, WARNING_TEXT, needsBackupHint } from './shared';

/**
 * Accueil — l'information la plus importante : le cash-flow mensuel.
 * Puis quatre indicateurs, puis le réalisé, puis ce qui demande une action.
 */
export function Home({ go, choice, setChoice }: { go: Go; choice: Scenario | null; setChoice: (s: Scenario) => void }) {
  const p = useProperty();
  const { data, setActive } = useStore();
  const { planned, actual, journal, hasActual, fields, discrepancies } = usePropertyMetrics(p);
  // « Réel » seulement si des montants réels de référence existent : un mouvement seul ne suffit pas.
  const scenario: Scenario = hasActual ? (choice ?? 'actual') : 'planned';
  const isReal = scenario === 'actual';
  const m = isReal ? actual : planned;
  const [detail, setDetail] = useState<ExplainKey | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const est = (k: KpiKey) => (isReal ? estimatedInputs(fields, k) : []);
  const pendingFields = fields.filter((f) => !f.confirmed);

  const isEmpty = m.warnings.includes('noPrice') && m.warnings.includes('noRent');
  const cf = m.cashflowMonthly;
  const income = m.rentMonthlyEffective;
  const outgo = m.loan.paymentWithInsurance + m.chargesMonthly;
  const barMax = Math.max(income, outgo, 1);
  const showBackupHint = needsBackupHint(data.settings.lastBackupAt, data.properties.map((x) => x.createdAt));
  const context =
    p.phase === 'owned' ? (p.purchaseDate ? `Acquis en ${monthFr(p.purchaseDate)}` : 'Bien acquis') : 'Projet en cours';
  const yieldDelta = isReal && planned.netYield !== null && actual.netYield !== null ? actual.netYield - planned.netYield : null;

  return (
    <div className="screen screen-home">
      <header className="page-head">
        <p className="eyebrow">{context}</p>
        <h1>{p.name}</h1>
        {p.address && <p className="page-sub">{p.address}</p>}
      </header>

      {data.properties.length > 1 && (
        <div className="chips-scroll" role="tablist" aria-label="Mes biens">
          {data.properties.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === p.id} className={`chip${x.id === p.id ? ' on' : ''}`} onClick={() => setActive(x.id)}>
              {x.name}
            </button>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="card">
          <EmptyState
            icon="layers"
            title="Votre projet commence ici"
            action={
              <button className="btn btn-primary" onClick={() => go('project', 'purchase')}>
                Renseigner le projet
              </button>
            }
          >
            Prix, financement, loyer : quelques chiffres suffisent pour voir votre cash-flow et votre rentabilité.
          </EmptyState>
        </div>
      ) : (
        <>
          {hasActual && (
            <div className="mode-bar">
              <Segmented
                label="Chiffres affichés"
                value={scenario}
                onChange={setChoice}
                options={[
                  { value: 'planned', label: 'Prévu' },
                  { value: 'actual', label: 'Réel' },
                ]}
              />
              {isReal &&
                (pendingFields.length > 0 ? (
                  <button className="mode-hint" onClick={() => setShowCoverage(true)}>
                    <i className="estimated-dot" aria-hidden="true" />
                    {pendingFields.length} montant{pendingFields.length > 1 ? 's' : ''} encore prévu{pendingFields.length > 1 ? 's' : ''}
                    <Icon name="chevron" size={14} />
                  </button>
                ) : (
                  <span className="mode-hint">
                    <Icon name="check" size={14} /> Tous les montants sont réels
                  </span>
                ))}
            </div>
          )}

          <button key={scenario} className={`hero${cf <= -0.5 ? ' is-neg' : ''}`} onClick={() => setDetail('cashflow')}>
            <span className="hero-label">
              Cash-flow {hasActual ? (isReal ? 'réel' : 'prévu') : 'mensuel'}
              {est('cashflow').length > 0 && <i className="estimated-dot" aria-label="en partie prévu" />}
            </span>
            <Amount value={cf} size="display" signed label="Cash-flow" />
            <span className="hero-unit">par mois{!hasActual && p.phase === 'project' ? ' · simulation' : ''}</span>
            {m.savingsEffort > 0.5 && <span className="hero-note">Effort d'épargne : {eur(m.savingsEffort)} à ajouter chaque mois</span>}
            <span className="hero-bars" aria-hidden="true">
              <span className="hero-bar">
                <span className="hero-bar-label">Revenus</span>
                <span className="hero-bar-track">
                  <span className="hero-bar-fill is-in" style={{ width: `${(income / barMax) * 100}%` }} />
                </span>
                <span className="hero-bar-value">{eur(income)}</span>
              </span>
              <span className="hero-bar">
                <span className="hero-bar-label">Dépenses</span>
                <span className="hero-bar-track">
                  <span className="hero-bar-fill is-out" style={{ width: `${(outgo / barMax) * 100}%` }} />
                </span>
                <span className="hero-bar-value">{eur(outgo)}</span>
              </span>
            </span>
          </button>

          <div className="stat-grid">
            <Stat
              label="Rentabilité nette"
              accent
              estimated={est('netYield').length > 0}
              sub={yieldDelta !== null && Math.abs(yieldDelta) >= 0.05 ? `vs ${pctFmt(planned.netYield)} prévu` : 'avant impôts'}
              onClick={() => setDetail('netYield')}
            >
              <Percent value={m.netYield} size="xl" />
            </Stat>
            <Stat label="Loyer" unit="par mois" estimated={est('rent').length > 0} onClick={() => setDetail('rent')}>
              <Amount value={m.rentAnnualNominal / 12} size="xl" />
            </Stat>
            <Stat
              label="Mensualité"
              unit="par mois"
              sub={m.loan.insuranceMonthly > 0 ? `dont assurance ${eur(m.loan.insuranceMonthly)}` : undefined}
              estimated={est('payment').length > 0}
              onClick={() => setDetail('payment')}
            >
              <Amount value={m.loan.paymentWithInsurance} size="xl" />
            </Stat>
            <Stat label="Coût du projet" sub={`dont apport ${eur(m.equity)}`} estimated={est('totalCost').length > 0} onClick={() => setDetail('totalCost')}>
              <Amount value={m.totalCost} size="xl" />
            </Stat>
          </div>

          {journal.count > 0 || p.phase === 'owned' ? (
            <button className="card card-link realized-card" onClick={() => go('analysis')}>
              <span className="card-row">
                <span className="card-kicker">Réalisé depuis l'achat</span>
                <Icon name="chevron" size={18} />
              </span>
              <span className="realized-pair">
                <span>
                  <span className="mini-label">Argent injecté</span>
                  <Amount value={journal.personalInjected} size="lg" />
                  <span className="mini-note">estimation</span>
                </span>
                <span>
                  <span className="mini-label">Solde net</span>
                  <Amount value={journal.netBalance} size="lg" signed tone={journal.netBalance >= 0 ? 'pos' : undefined} />
                  <span className="mini-note">{journal.netBalance >= 0 ? 'rapporté' : 'coûté'} à ce jour</span>
                </span>
              </span>
              <Sparkline series={monthSeries(journal.months, todayIso().slice(0, 7))} label="Évolution du résultat cumulé" />
            </button>
          ) : (
            <div className="card">
              <EmptyState
                icon="swap"
                title="Le suivi réalisé démarre à l'achat"
                action={
                  <button className="btn btn-secondary" onClick={() => go('movements')}>
                    <Icon name="plus" size={18} /> Ajouter un mouvement
                  </button>
                }
              >
                Enregistrez ce que vous payez et encaissez : vous saurez ce que le bien vous coûte vraiment.
              </EmptyState>
            </div>
          )}

          {(m.warnings.length > 0 || discrepancies.length > 0) && (
            <section className="card notice" aria-label="À vérifier">
              <div className="notice-head">
                <Icon name="alert" size={18} />
                <h2>À vérifier</h2>
              </div>
              <ul>
                {m.warnings.map((w) => (
                  <li key={w}>{WARNING_TEXT[w]}</li>
                ))}
                {discrepancies.map((d) => (
                  <li key={d.key}>
                    {d.label} : {eur(d.paid)} payés, les calculs utilisent {eur(d.reference)} ({d.referenceIsActual ? 'réel saisi' : 'prévu'}).
                    Confirmez le montant réel.
                  </li>
                ))}
              </ul>
              <button className="link-btn" onClick={() => go('project', discrepancies.length > 0 ? 'purchase' : undefined)}>
                Ouvrir le projet <Icon name="chevron" size={16} />
              </button>
            </section>
          )}
        </>
      )}

      {showBackupHint && (
        <button className="card card-link backup-hint" onClick={() => go('settings')}>
          <span className="backup-hint-icon" aria-hidden="true">
            <Icon name="shieldCheck" size={20} />
          </span>
          <span className="backup-hint-text">
            <strong>Pensez à sauvegarder</strong>
            <span>Exportez une copie de vos données, au cas où.</span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      )}

      <Sheet open={detail !== null} title={detail ? EXPLAIN[detail].title : ''} onClose={() => setDetail(null)}>
        {detail && <KpiDetail k={detail} m={m} estimated={KPI_OF[detail] ? est(KPI_OF[detail]!) : []} />}
      </Sheet>

      <Sheet open={showCoverage} title="Ce qui reste prévu" onClose={() => setShowCoverage(false)}>
        <div className="prose">
          <p>
            Ces montants n'ont pas encore de valeur réelle : la vue « Réel » utilise le montant prévu à la place. Les
            indicateurs concernés portent un petit rond <i className="estimated-dot" aria-hidden="true" />.
          </p>
          <div className="tag-list">
            {pendingFields.map((f) => (
              <span key={f.label} className="tag">
                {f.label}
              </span>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowCoverage(false);
              go('project');
            }}
          >
            Compléter dans « Projet »
          </button>
          {EXPLAIN.prevuReel.body}
        </div>
      </Sheet>
    </div>
  );
}
