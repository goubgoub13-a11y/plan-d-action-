import { useState, type ReactNode } from 'react';
import type { Metrics } from '../calc/metrics';
import type { Scenario } from '../domain/types';
import { daysSince, durationLabel, eur, eur2, eurSigned, pctFmt } from '../lib/format';
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
};

export function Home({ go }: { go: Go }) {
  const p = useProperty();
  const { data, setActive } = useStore();
  const { planned, actual, journal, hasActual } = usePropertyMetrics(p);
  const [choice, setChoice] = useState<Scenario | null>(null);
  const scenario: Scenario = choice ?? (p.phase === 'owned' || hasActual ? 'actual' : 'planned');
  const m = scenario === 'planned' ? planned : actual;
  const [detail, setDetail] = useState<ExplainKey | null>(null);

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
        <p className="scenario-note">Simulation avant achat</p>
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
            <span className="hero-label">Cash-flow</span>
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
            <Kpi label="Coût du projet" value={eur(m.totalCost)} onClick={() => setDetail('totalCost')} />
            <Kpi label="Investi personnellement" value={eur(m.personalInvested)} onClick={() => setDetail('personalInvested')} />
            <Kpi label="Loyer" value={eur(m.rentAnnualNominal / 12)} unit="/mois" sub="hors charges" onClick={() => setDetail('rent')} />
            <Kpi
              label="Mensualité"
              value={eur(m.loan.paymentWithInsurance)}
              unit="/mois"
              sub={m.loan.insuranceMonthly > 0 ? `dont assurance ${eur(m.loan.insuranceMonthly)}` : 'crédit'}
              onClick={() => setDetail('payment')}
            />
            <Kpi label="Rentabilité brute" value={pctFmt(m.grossYield)} onClick={() => setDetail('grossYield')} />
            <Kpi label="Rentabilité nette" value={pctFmt(m.netYield)} sub="avant impôts" accent onClick={() => setDetail('netYield')} />
            <Kpi label="Charges" value={eur(m.chargesMonthly)} unit="/mois" sub="propriétaire" onClick={() => setDetail('charges')} />
            <Kpi label="Rendement de mon apport" value={pctFmt(m.cashOnCash)} sub="par an" onClick={() => setDetail('cashOnCash')} />
          </div>

          <MonthlyChart m={m} />

          {m.warnings.length > 0 && (
            <section className="card warn-card">
              {m.warnings.map((w) => (
                <p key={w}>
                  <Icon name="alert" size={18} /> {WARNING_TEXT[w]}
                </p>
              ))}
            </section>
          )}

          {hasActual && <Comparison planned={planned} actual={actual} />}

          {journal.count > 0 ? (
            <section className="card">
              <div className="card-title">
                <h2>Depuis le début</h2>
                <Info title={EXPLAIN.personalOut.title}>{EXPLAIN.personalOut.body}</Info>
              </div>
              <p className="muted small">D'après vos {journal.count} mouvement{journal.count > 1 ? 's' : ''} enregistré{journal.count > 1 ? 's' : ''}.</p>
              <div className="stat-big">
                <span>Sorti de ma poche</span>
                <strong>{eur(journal.personalOut)}</strong>
              </div>
              <Row label="Total payé" value={eur(journal.spent)} />
              <Row label="Total encaissé" value={eur(journal.received)} />
              <Row label="dont loyers" value={eur(journal.rentReceived)} sub />
              <Row
                label="Résultat hors achat"
                value={eurSigned(journal.operatingBalance)}
                tone={journal.operatingBalance >= 0 ? 'pos' : 'neg'}
              />
              <button className="link-btn" onClick={() => go('movements')}>
                Voir les mouvements <Icon name="chevron" size={16} />
              </button>
            </section>
          ) : (
            <section className="card cta-card">
              <h2>Suivre le réel</h2>
              <p className="muted">Une fois le bien acheté, enregistrez ce que vous payez et encaissez : l'application calcule ce que l'appartement vous coûte vraiment.</p>
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
              <Row label="Coût des intérêts" value={eur(m.loan.interestCost)} />
              <Row label="Coût de l'assurance" value={eur(m.loan.insuranceCost)} />
              <Row label="Frais de dossier, garantie, courtier" value={eur(m.loan.financingFees)} />
              <Row label="Coût total du financement" value={eur(m.loan.totalFinancingCost)} strong />
              <Row label="Total remboursé à la banque" value={eur(m.loan.totalRepaid)} />
            </details>
          )}
        </>
      )}

      <Sheet open={detail !== null} title={detail ? EXPLAIN[detail].title : ''} onClose={() => setDetail(null)}>
        {detail && <KpiDetail k={detail} m={m} />}
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
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`card kpi${accent ? ' accent' : ''}`} onClick={onClick}>
      <span className="kpi-label">{label}</span>
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

function KpiDetail({ k, m }: { k: ExplainKey; m: Metrics }) {
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
      ['Hors assurance', eur2(m.loan.payment) + (m.loan.paymentIsManual ? ' (saisie)' : ' (calculée)')],
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
      {EXPLAIN[k].body}
    </div>
  );
}
