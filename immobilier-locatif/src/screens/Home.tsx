import { useState, type ReactNode } from 'react';
import type { JournalSummary } from '../calc/journal';
import type { Metrics } from '../calc/metrics';
import { estimatedInputs, type KpiKey } from '../calc/resolve';
import type { Scenario } from '../domain/types';
import { daysSince, durationLabel, eur, eur2, eurOrDash, eurSigned, pctFmt } from '../lib/format';
import { useProperty, useStore } from '../state/store';
import { usePropertyMetrics } from '../state/useMetrics';
import { Info, Segmented } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { EXPLAIN, type ExplainKey } from './explain';
import type { Go } from './nav';

const WARNING_TEXT: Record<string, string> = {
  noPrice: "Le prix d'achat n'est pas encore renseigné.",
  noRent: "Le loyer n'est pas encore renseigné.",
  loanDurationMissing: 'Un emprunt est saisi sans durée ni mensualité.',
  loanExceedsCost: "Le montant emprunté dépasse le coût du projet.",
  loanPaymentInconsistent:
    'La mensualité saisie ne permet pas de rembourser le capital sur la durée indiquée : vérifiez la mensualité, le montant emprunté et la durée.',
};

export function Home({ go }: { go: Go }) {
  const p = useProperty();
  const { data, setActive } = useStore();
  const { planned, actual, journal, hasActual, fields, discrepancies } = usePropertyMetrics(p);
  const [choice, setChoice] = useState<Scenario | null>(null);
  // « Réel » seulement si des montants réels de référence existent : un mouvement seul ne suffit pas.
  const scenario: Scenario = hasActual ? (choice ?? 'actual') : 'planned';
  const m = scenario === 'planned' ? planned : actual;
  const [detail, setDetail] = useState<ExplainKey | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const isReal = scenario === 'actual';
  /** Montants encore prévisionnels derrière un indicateur (mode Réel uniquement). */
  const est = (k: KpiKey) => (isReal ? estimatedInputs(fields, k) : []);
  const pendingFields = fields.filter((f) => !f.confirmed);

  const isEmpty = m.warnings.includes('noPrice') && m.warnings.includes('noRent');
  const cfTone = m.cashflowMonthly >= 0.5 ? 'pos' : m.cashflowMonthly <= -0.5 ? 'neg' : '';
  const showBackupHint = needsBackupHint(data.settings.lastBackupAt, data.properties.map((x) => x.createdAt));

  return (
    <div className="screen">
      {data.properties.length > 1 && (
        <div className="chips-scroll" role="tablist" aria-label="Mes biens">
          {data.properties.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={x.id === p.id}
              className={`chip${x.id === p.id ? ' on' : ''}`}
              onClick={() => setActive(x.id)}
            >
              {x.name}
            </button>
          ))}
        </div>
      )}

      <header className="home-head">
        <div>
          <span className={`phase-badge ${p.phase}`}>{p.phase === 'owned' ? 'Acquis' : 'En projet'}</span>
          <h1>{p.name}</h1>
          {p.address && <p className="muted">{p.address}</p>}
        </div>
      </header>

      {hasActual ? (
        <div className="scenario-bar">
          <Segmented
            label="Chiffres affichés"
            value={scenario}
            onChange={setChoice}
            options={[
              { value: 'planned', label: 'Prévu' },
              { value: 'actual', label: 'Réel' },
            ]}
          />
          <Info title={EXPLAIN.prevuReel.title}>{EXPLAIN.prevuReel.body}</Info>
        </div>
      ) : (
        <p className="scenario-note">{p.phase === 'owned' ? 'Chiffres prévus — saisissez les montants réels dans « Projet »' : 'Simulation avant achat'}</p>
      )}

      {isReal && (
        <button className="coverage" onClick={() => setShowCoverage(true)}>
          {pendingFields.length === 0 ? (
            <>
              <Icon name="check" size={16} /> Tous les montants utilisés sont réels
            </>
          ) : (
            <>
              <i className="estimated-dot" aria-hidden="true" /> {pendingFields.length} montant{pendingFields.length > 1 ? 's' : ''} encore
              prévu{pendingFields.length > 1 ? 's' : ''} sur {fields.length}
              <Icon name="chevron" size={14} />
            </>
          )}
        </button>
      )}

      {showBackupHint && (
        <button className="banner" onClick={() => go('settings')}>
          <Icon name="shield" />
          <span>Pensez à exporter une sauvegarde de vos données.</span>
          <Icon name="chevron" size={18} />
        </button>
      )}

      {isEmpty ? (
        <section className="card empty-card">
          <h2>Commençons par votre projet</h2>
          <p className="muted">Prix, financement, loyer : quelques chiffres suffisent pour voir votre cash-flow et votre rentabilité.</p>
          <button className="btn btn-primary" onClick={() => go('project', 'purchase')}>
            Renseigner le projet
          </button>
        </section>
      ) : (
        <>
          <button className={`card hero ${cfTone}`} onClick={() => setDetail('cashflow')}>
            <span className="hero-label">
              Cash-flow{isReal ? ' réel' : ' prévu'}
              {est('cashflow').length > 0 && <i className="estimated-dot light" aria-label="en partie prévu" />}
            </span>
            <span className="hero-value">
              {eurSigned(m.cashflowMonthly)}
              <small> / mois</small>
            </span>
            <span className="hero-sub">
              {m.savingsEffort > 0.5
                ? `Effort d'épargne : ${eur(m.savingsEffort)} à ajouter chaque mois`
                : 'Ce qui reste après crédit, assurance et charges'}
            </span>
          </button>

          <div className="kpi-grid">
            <Kpi label="Coût du projet" value={eur(m.totalCost)} estimated={est('totalCost')} onClick={() => setDetail('totalCost')} />
            <Kpi label="Investi personnellement" value={eur(m.personalInvested)} estimated={est('personalInvested')} onClick={() => setDetail('personalInvested')} />
            <Kpi label="Loyer" value={eur(m.rentAnnualNominal / 12)} unit="/mois" sub="hors charges" estimated={est('rent')} onClick={() => setDetail('rent')} />
            <Kpi
              estimated={est('payment')}
              label="Mensualité"
              value={eur(m.loan.paymentWithInsurance)}
              unit="/mois"
              sub={m.loan.insuranceMonthly > 0 ? `dont assurance ${eur(m.loan.insuranceMonthly)}` : 'crédit'}
              onClick={() => setDetail('payment')}
            />
            <Kpi label="Rentabilité brute" value={pctFmt(m.grossYield)} estimated={est('grossYield')} onClick={() => setDetail('grossYield')} />
            <Kpi label="Rentabilité nette" value={pctFmt(m.netYield)} sub="avant impôts" accent estimated={est('netYield')} onClick={() => setDetail('netYield')} />
            <Kpi label="Charges" value={eur(m.chargesMonthly)} unit="/mois" sub="propriétaire" estimated={est('charges')} onClick={() => setDetail('charges')} />
            <Kpi label="Rendement de mon apport" value={pctFmt(m.cashOnCash)} sub="par an" estimated={est('cashOnCash')} onClick={() => setDetail('cashOnCash')} />
          </div>

          <MonthlyChart m={m} />

          {(m.warnings.length > 0 || discrepancies.length > 0) && (
            <section className="card warn-card">
              {m.warnings.map((w) => (
                <p key={w}>
                  <Icon name="alert" size={18} /> {WARNING_TEXT[w]}
                </p>
              ))}
              {discrepancies.map((d) => (
                <p key={d.key}>
                  <Icon name="alert" size={18} />
                  <span>
                    {d.label} : {eur(d.paid)} payés, les calculs utilisent {eur(d.reference)} ({d.referenceIsActual ? 'réel saisi' : 'prévu'}).
                    Confirmez le montant réel.
                  </span>
                </p>
              ))}
              {discrepancies.length > 0 && (
                <button className="link-btn" onClick={() => go('project', 'purchase')}>
                  Mettre à jour l'achat <Icon name="chevron" size={16} />
                </button>
              )}
            </section>
          )}

          {hasActual && <Comparison planned={planned} actual={actual} />}

          {journal.count > 0 || p.phase === 'owned' ? (
            <Realized j={journal} apportEstimated={estimatedInputs(fields, 'personalInvested')} go={go} />
          ) : (
            <section className="card cta-card">
              <h2>Suivre le réalisé</h2>
              <p className="muted">Une fois le bien acheté, enregistrez ce que vous payez et encaissez : l'application calcule l'argent que vous injectez et ce que le bien vous rapporte vraiment.</p>
              <button className="btn btn-ghost" onClick={() => go('movements')}>
                <Icon name="plus" size={18} /> Ajouter un mouvement
              </button>
            </section>
          )}

          {m.borrowed > 0 && (
            <details className="card disclosure">
              <summary>
                <span>Le crédit en détail</span>
                <Icon name="down" size={18} />
              </summary>
              <Row label="Montant emprunté" value={eur(m.borrowed)} />
              <Row label="Durée" value={durationLabel(m.loan.months)} />
              <Row label="Mensualité hors assurance" value={eur2(m.loan.payment)} />
              <Row label="Assurance emprunteur" value={`${eur2(m.loan.insuranceMonthly)} /mois`} />
              <Row label="Coût des intérêts" value={eurOrDash(m.loan.interestCost, 'incohérent')} />
              <Row label="Coût de l'assurance" value={eur(m.loan.insuranceCost)} />
              <Row label="Frais de dossier, garantie, courtier" value={eur(m.loan.financingFees)} />
              <Row label="Coût total du financement" value={eurOrDash(m.loan.totalFinancingCost, 'incohérent')} strong />
              <Row label="Total remboursé à la banque" value={eurOrDash(m.loan.totalRepaid, 'incohérent')} />
            </details>
          )}
        </>
      )}

      <Sheet open={detail !== null} title={detail ? EXPLAIN[detail].title : ''} onClose={() => setDetail(null)}>
        {detail && <KpiDetail k={detail} m={m} estimated={isReal && detail in KPI_OF ? est(KPI_OF[detail]!) : []} />}
      </Sheet>

      <Sheet open={showCoverage} title="Réel : ce qui reste prévu" onClose={() => setShowCoverage(false)}>
        <div className="prose">
          {pendingFields.length > 0 ? (
            <>
              <p>
                Ces montants n'ont pas encore de valeur réelle : le mode « Réel » utilise le montant prévu à la place. Les
                indicateurs concernés sont marqués d'un <i className="estimated-dot" aria-hidden="true" />.
              </p>
              <div className="estimated-list">{pendingFields.map((f) => f.label).join(' · ')}</div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowCoverage(false);
                  go('project', 'purchase');
                }}
              >
                Compléter dans « Projet »
              </button>
            </>
          ) : (
            <p>Tous les montants utilisés par les calculs ont une valeur réelle.</p>
          )}
          {EXPLAIN.prevuReel.body}
        </div>
      </Sheet>
    </div>
  );
}

function needsBackupHint(lastBackupAt: string | null, createdAts: string[]): boolean {
  if (createdAts.length === 0) return false;
  if (lastBackupAt) return daysSince(lastBackupAt) > 30;
  const oldest = createdAts.reduce((a, b) => (a < b ? a : b));
  return daysSince(oldest) >= 2;
}

function Kpi({
  label,
  value,
  unit,
  sub,
  accent,
  estimated = [],
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
  /** Montants encore prévus utilisés (mode Réel) : affiche un discret rond creux. */
  estimated?: string[];
  onClick: () => void;
}) {
  return (
    <button className={`card kpi${accent ? ' accent' : ''}`} onClick={onClick}>
      <span className="kpi-label">
        {label}
        {estimated.length > 0 && <i className="estimated-dot" aria-label="en partie prévu" title="Contient des montants encore prévus" />}
      </span>
      <span className="kpi-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </button>
  );
}

export function Row({
  label,
  value,
  tone,
  strong,
  sub,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'pos' | 'neg';
  strong?: boolean;
  sub?: boolean;
}) {
  return (
    <div className={`row${strong ? ' strong' : ''}${sub ? ' sub' : ''}`}>
      <span>{label}</span>
      <span className={tone ?? ''}>{value}</span>
    </div>
  );
}

/** Un seul graphique : ce qui entre et ce qui sort chaque mois. */
function MonthlyChart({ m }: { m: Metrics }) {
  const income = m.rentMonthlyEffective;
  const credit = m.loan.paymentWithInsurance;
  const charges = m.chargesMonthly;
  const out = credit + charges;
  const max = Math.max(income, out, 1);
  const w = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <section className="card chart">
      <div className="card-title">
        <h2>Chaque mois</h2>
      </div>
      <div className="bar-line">
        <div className="bar-head">
          <span>Revenus</span>
          <strong>{eur(income)}</strong>
        </div>
        <div className="bar-track">
          <div className="bar income" style={{ width: w(income) }} />
        </div>
      </div>
      <div className="bar-line">
        <div className="bar-head">
          <span>Dépenses</span>
          <strong>{eur(out)}</strong>
        </div>
        <div className="bar-track">
          <div className="bar credit" style={{ width: w(credit) }} />
          <div className="bar charges" style={{ width: w(charges) }} />
        </div>
      </div>
      <div className="legend">
        <span>
          <i className="dot income" /> Loyer conservé
        </span>
        <span>
          <i className="dot credit" /> Crédit {eur(credit)}
        </span>
        <span>
          <i className="dot charges" /> Charges {eur(charges)}
        </span>
      </div>
    </section>
  );
}

function Comparison({ planned, actual }: { planned: Metrics; actual: Metrics }) {
  const rows: { label: string; p: number | null; a: number | null; fmt: (n: number | null) => string; higherIsBetter: boolean; pts?: boolean }[] = [
    { label: 'Coût du projet', p: planned.totalCost, a: actual.totalCost, fmt: (n) => eur(n ?? 0), higherIsBetter: false },
    { label: 'Investi personnellement', p: planned.personalInvested, a: actual.personalInvested, fmt: (n) => eur(n ?? 0), higherIsBetter: false },
    { label: 'Mensualité', p: planned.loan.paymentWithInsurance, a: actual.loan.paymentWithInsurance, fmt: (n) => eur(n ?? 0), higherIsBetter: false },
    { label: 'Loyer', p: planned.rentAnnualNominal / 12, a: actual.rentAnnualNominal / 12, fmt: (n) => eur(n ?? 0), higherIsBetter: true },
    { label: 'Cash-flow', p: planned.cashflowMonthly, a: actual.cashflowMonthly, fmt: (n) => eurSigned(n ?? 0), higherIsBetter: true },
    { label: 'Rentabilité nette', p: planned.netYield, a: actual.netYield, fmt: (n) => pctFmt(n), higherIsBetter: true, pts: true },
  ];
  return (
    <section className="card">
      <div className="card-title">
        <h2>Prévu / Réel</h2>
        <Info title={EXPLAIN.prevuReel.title}>{EXPLAIN.prevuReel.body}</Info>
      </div>
      <div className="cmp-head">
        <span />
        <span>Prévu</span>
        <span>Réel</span>
        <span>Écart</span>
      </div>
      {rows.map((r) => {
        const d = r.p !== null && r.a !== null ? r.a - r.p : null;
        const significant = d !== null && Math.abs(d) >= (r.pts ? 0.05 : 0.5);
        const tone = !significant ? '' : (d! > 0) === r.higherIsBetter ? 'pos' : 'neg';
        return (
          <div className="cmp-row" key={r.label}>
            <span className="cmp-label">{r.label}</span>
            <span className="muted">{r.fmt(r.p)}</span>
            <span>{r.fmt(r.a)}</span>
            <span className={`delta ${tone}`}>
              {!significant ? '=' : r.pts ? `${d! > 0 ? '+' : '−'}${Math.abs(d!).toFixed(1).replace('.', ',')} pt` : eurSigned(d!)}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Indicateur de projet correspondant à chaque fiche d'explication. */
const KPI_OF: Partial<Record<ExplainKey, KpiKey>> = {
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

function KpiDetail({ k, m, estimated }: { k: ExplainKey; m: Metrics; estimated: string[] }) {
  const lines: Record<string, [string, string][]> = {
    totalCost: [
      ['Coût total', eur(m.totalCost)],
      ['dont financé par le crédit', eur(Math.min(m.borrowed, m.totalCost))],
      ['dont apport personnel', eur(m.equity)],
    ],
    personalInvested: [
      ['Apport (coût − emprunt)', eur(m.equity)],
      ['Dépenses ponctuelles', eur(m.oneOffCharges)],
      ['Total', eur(m.personalInvested)],
    ],
    rent: [
      ['Loyer hors charges', `${eur(m.rentAnnualNominal / 12)} /mois`],
      ['Loyer charges comprises', `${eur(m.rentMonthlyWithCharges)} /mois`],
      ['Loyer annuel théorique', eur(m.rentAnnualNominal)],
      ['Loyer annuel conservé', eur(m.rentAnnualEffective)],
    ],
    payment: [
      ['Hors assurance', eur2(m.loan.payment) + (m.loan.paymentIsManual ? (m.loan.paymentInconsistent ? ' (saisie, incohérente)' : ' (saisie)') : ' (calculée)')],
      ['Assurance', eur2(m.loan.insuranceMonthly)],
      ['Total', eur2(m.loan.paymentWithInsurance)],
    ],
    charges: [
      ['Par mois', eur(m.chargesMonthly)],
      ['Par an', eur(m.chargesAnnual)],
      ['Dépenses ponctuelles', eur(m.oneOffCharges)],
    ],
    cashflow: [
      ['Loyer conservé', `+${eur(m.rentMonthlyEffective)}`],
      ['Mensualité de crédit', `−${eur(m.loan.payment)}`],
      ['Assurance emprunteur', `−${eur(m.loan.insuranceMonthly)}`],
      ['Charges propriétaire', `−${eur(m.chargesMonthly)}`],
      ['Cash-flow mensuel', eurSigned(m.cashflowMonthly)],
      ['Cash-flow annuel', eurSigned(m.cashflowAnnual)],
      ["Effort d'épargne", `${eur(m.savingsEffort)} /mois`],
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
        <div className="detail-lines">
          {l.map(([a, b], i) => (
            <Row key={a} label={a} value={b} strong={i === l.length - 1} />
          ))}
        </div>
      )}
      {estimated.length > 0 && (
        <div className="estimated-list">
          <i className="estimated-dot" aria-hidden="true" /> Encore calculé avec des montants prévus : {estimated.join(', ')}.
        </div>
      )}
      {EXPLAIN[k].body}
    </div>
  );
}

/**
 * RÉALISÉ : ce qui a vraiment été payé et encaissé (mouvements).
 * Deux chiffres de confiance : l'argent personnel injecté et le solde net du projet.
 */
function Realized({ j, apportEstimated, go }: { j: JournalSummary; apportEstimated: string[]; go: Go }) {
  const hasRecoverable = j.recoverableReceived > 0 || j.recoverablePaid > 0;
  return (
    <section className="card">
      <div className="card-title">
        <h2>Réalisé</h2>
        <Info title={EXPLAIN.personalInjected.title}>
          {EXPLAIN.personalInjected.body}
          <h3>Solde net du projet</h3>
          {EXPLAIN.netBalance.body}
        </Info>
      </div>
      <p className="muted small">
        Ce qui a réellement été payé et encaissé{j.count > 0 ? ` (${j.count} mouvement${j.count > 1 ? 's' : ''})` : ''}.
      </p>
      <div className="realized-figs">
        <div className="main">
          <span>Argent personnel injecté</span>
          <strong>{eur(j.personalInjected)}</strong>
          <small>depuis le début</small>
        </div>
        <div>
          <span>Solde net du projet</span>
          <strong className={j.netBalance >= 0 ? 'pos' : 'neg'}>{eurSigned(j.netBalance)}</strong>
          <small>{j.netBalance >= 0 ? 'rapporté' : 'coûté'} à ce jour</small>
        </div>
      </div>
      <Row label="Apport initial" value={eur(j.initialContribution)} />
      <Row label="Déficits couverts de ma poche" value={eur(j.operatingInjections)} />
      <Row label="Résultat d'exploitation cumulé" value={eurSigned(j.operatingResult)} tone={j.operatingResult >= 0 ? 'pos' : 'neg'} />
      <Row label="dont loyers encaissés" value={eur(j.rentReceived)} sub />
      {hasRecoverable && (
        <Row label="Charges récupérables (neutres)" value={`${eur(j.recoverableReceived)} reçus · ${eur(j.recoverablePaid)} payés`} sub />
      )}
      {j.initialContribution > 0 && apportEstimated.length > 0 && (
        <p className="field-hint">
          <i className="estimated-dot" aria-hidden="true" /> Apport calculé en partie avec des montants prévus ({apportEstimated.join(', ')}).
        </p>
      )}
      <button className="link-btn" onClick={() => go('movements')}>
        Voir les mouvements <Icon name="chevron" size={16} />
      </button>
    </section>
  );
}
