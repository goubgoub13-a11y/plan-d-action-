import { useState } from 'react';
import { monthlyPayment } from '../calc/loan';
import { annualEquivalent, monthlyEquivalent, type Metrics } from '../calc/metrics';
import { expensesInCategory, resolveInputs } from '../calc/resolve';
import { ACQUISITION_LABELS } from '../domain/categories';
import { ACQUISITION_KEYS, type AcquisitionKey, type Amount, type Frequency, type Property, type Scenario } from '../domain/types';
import { dateFr, durationLabel, eur, eur2, eurOrDash, eurSigned, pctFmt, plain, todayIso } from '../lib/format';
import { newId } from '../lib/id';
import { useProperty, useStore } from '../state/store';
import { usePropertyMetrics, type PropertyMetrics } from '../state/useMetrics';
import { useDialogs } from '../ui/Dialogs';
import { Amount as Money, Legend, Line as Row, Section, StackBar } from '../ui/Display';
import { DualRow, Info, NumberInput, Segmented, TextInput } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { EXPLAIN } from './explain';
import type { ProjectSection } from './nav';

const EDITOR_TITLES: Record<ProjectSection, string> = {
  property: 'Le bien',
  purchase: 'Acquisition',
  financing: 'Financement',
  rental: 'Location',
  charges: 'Charges',
};

type Update = (recipe: (d: Property) => void) => void;

/** Montant de référence d'une ligne : réel s'il est connu, sinon prévu. */
const ref = (a: Amount) => a.actual ?? a.planned;
const FREQ_SHORT: Record<Frequency, string> = { monthly: '/mois', yearly: '/an', once: 'une fois' };

/**
 * Projet — lecture d'abord : chaque rubrique affiche son total et ses lignes.
 * « Modifier » ouvre le formulaire de la rubrique dans un panneau (mêmes champs, mêmes règles).
 */
export function Project({ editing, setEditing }: { editing: ProjectSection | null; setEditing: (s: ProjectSection | null) => void }) {
  const p = useProperty();
  const { updateProperty, saveStatus } = useStore();
  const pm = usePropertyMetrics(p);
  const update: Update = (recipe) => updateProperty(p.id, recipe);
  const { planned, actual, showReal } = pm;
  const m = showReal ? actual : planned;

  const showDiff = (a: Amount) => showReal && a.actual !== null && a.planned !== null && Math.abs(a.actual - a.planned) >= 0.5;
  const valueOf = (a: Amount, unit = '') => (ref(a) === null ? '—' : `${eur(ref(a)!)}${unit}`);
  const acqLines = ACQUISITION_KEYS.filter((k) => ref(p.acquisition[k]) !== null);
  const chargeLines = p.charges.filter((c) => ref(c.amount) !== null);
  const l = p.loan;
  const loan = m.loan;

  const edit = (s: ProjectSection) => (
    <button className="btn btn-quiet" onClick={() => setEditing(s)} aria-label={`Modifier : ${EDITOR_TITLES[s]}`}>
      <Icon name="edit" size={16} /> Modifier
    </button>
  );

  return (
    <div className="screen">
      <header className="page-head">
        <p className="eyebrow">Projet</p>
        <h1>{p.name}</h1>
      </header>

      <button className="card card-link property-card" onClick={() => setEditing('property')}>
        <span className="property-icon" aria-hidden="true">
          <Icon name="building" size={22} />
        </span>
        <span className="property-text">
          <strong>{p.address || 'Adresse non renseignée'}</strong>
          <span>{p.phase === 'owned' ? `Acquis${p.purchaseDate ? ` le ${dateFr(p.purchaseDate)}` : ''}` : 'En projet — simulation avant achat'}</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <Section title="Acquisition" icon="layers" headline={<Money value={m.totalCost} size="xl" />} action={edit('purchase')}>
        {acqLines.length === 0 ? (
          <p className="section-empty">Prix, frais de notaire, travaux… Touchez « Modifier » pour commencer.</p>
        ) : (
          <div className="lines">
            {acqLines.map((k) => {
              const a = p.acquisition[k];
              return <Row key={k} label={ACQUISITION_LABELS[k]} value={valueOf(a)} secondary={showDiff(a) ? `prévu ${eur(a.planned!)}` : undefined} />;
            })}
          </div>
        )}
      </Section>

      <Section
        title="Financement"
        icon="bank"
        headline={<Money value={loan.paymentWithInsurance} size="xl" decimals={2} />}
        headlineUnit="par mois"
        action={edit('financing')}
      >
        {m.borrowed > 0 ? (
          <>
            <div className="lines">
              <Row label="Montant emprunté" value={eur(m.borrowed)} secondary={showDiff(l.borrowed) ? `prévu ${eur(l.borrowed.planned!)}` : undefined} />
              <Row label="Apport" value={eur(m.equity)} />
              <Row label="Durée" value={durationLabel(loan.months)} />
              <Row label="Taux" value={ref(l.ratePct) === null ? '—' : pctFmt(ref(l.ratePct), 2)} />
              <Row label="Assurance" value={`${eur2(loan.insuranceMonthly)} /mois`} />
            </div>
            {loan.paymentInconsistent ? (
              <p className="note note-warn">La mensualité saisie ne rembourse pas le capital : coût du crédit incohérent.</p>
            ) : (
              loan.months > 0 && (
                <div className="credit-cost">
                  <div className="credit-cost-head">
                    <span className="mini-label">Coût total remboursé</span>
                    <Money value={loan.totalRepaid ?? 0} size="md" />
                  </div>
                  <StackBar
                    label="Capital, intérêts et assurance"
                    parts={[
                      { label: 'Capital', value: loan.principal, tone: 'a' },
                      { label: 'Intérêts', value: loan.interestCost ?? 0, tone: 'b' },
                      { label: 'Assurance', value: loan.insuranceCost, tone: 'c' },
                    ]}
                  />
                  <Legend
                    items={[
                      { tone: 'a', label: `Capital ${eur(loan.principal)}` },
                      { tone: 'b', label: `Intérêts ${eur(loan.interestCost ?? 0)}` },
                      { tone: 'c', label: `Assurance ${eur(loan.insuranceCost)}` },
                    ]}
                  />
                </div>
              )
            )}
          </>
        ) : (
          <p className="section-empty">Aucun crédit saisi. Montant, taux, durée : la mensualité se calcule toute seule.</p>
        )}
      </Section>

      <Section title="Location" icon="key" headline={<Money value={m.rentAnnualNominal / 12} size="xl" />} headlineUnit="par mois, hors charges" action={edit('rental')}>
        {ref(p.rental.rent) === null ? (
          <p className="section-empty">Indiquez le loyer hors charges et, si besoin, une vacance locative.</p>
        ) : (
          <div className="lines">
            <Row label="Loyer annuel conservé" hint="après vacance et impayés" value={eur(m.rentAnnualEffective)} />
            <Row label="Charges récupérables" hint="payées par le locataire, neutres" value={valueOf(p.rental.recoverableCharges, ' /mois')} />
            <Row label="Vacance locative" value={`${p.rental.vacancyMonthsPerYear.toLocaleString('fr-FR')} mois/an`} />
            {p.rental.unpaidPct > 0 && <Row label="Provision impayés" value={`${p.rental.unpaidPct.toLocaleString('fr-FR')} %`} />}
            {p.rental.startDate && <Row label="Début de location" value={dateFr(p.rental.startDate)} />}
          </div>
        )}
      </Section>

      <Section title="Charges" icon="receipt" headline={<Money value={m.chargesMonthly} size="xl" />} headlineUnit="par mois" action={edit('charges')}>
        {chargeLines.length === 0 ? (
          <p className="section-empty">Taxe foncière, assurance PNO, copropriété… Ajoutez vos charges de propriétaire.</p>
        ) : (
          <div className="lines">
            {chargeLines.map((c) => (
              <Row
                key={c.id}
                label={c.label}
                value={`${eur(ref(c.amount)!)} ${FREQ_SHORT[c.frequency]}`}
                secondary={showDiff(c.amount) ? `prévu ${eur(c.amount.planned!)}` : undefined}
              />
            ))}
          </div>
        )}
      </Section>

      <Sheet
        open={editing !== null}
        title={editing ? EDITOR_TITLES[editing] : ''}
        onClose={() => setEditing(null)}
        footer={
          <div className="editor-foot">
            <span className={`save-state save-${saveStatus}`} aria-live="polite">
              {saveStatus === 'saved' ? (
                <>
                  <Icon name="check" size={16} /> Enregistré sur l'appareil
                </>
              ) : saveStatus === 'error' ? (
                'Enregistrement en attente'
              ) : (
                'Enregistrement…'
              )}
            </span>
            <button className="btn btn-primary" onClick={() => setEditing(null)}>
              Terminé
            </button>
          </div>
        }
      >
        <div className="editor">
          {editing === 'property' && <PropertyEditor p={p} update={update} />}
          {editing === 'purchase' && <Purchase p={p} pm={pm} update={update} />}
          {editing === 'financing' && <Financing p={p} pm={pm} update={update} />}
          {editing === 'rental' && <Rental p={p} pm={pm} update={update} />}
          {editing === 'charges' && <Charges p={p} pm={pm} update={update} />}
        </div>
      </Sheet>
    </div>
  );
}

function PropertyEditor({ p, update }: { p: Property; update: Update }) {
  return (
    <section className="card">
      <label className="field">
        <span>Nom</span>
        <TextInput label="Nom du bien" value={p.name} onChange={(v) => update((d) => void (d.name = v))} placeholder="Appartement Saint-Étienne" />
      </label>
      <label className="field">
        <span>Adresse ou ville (facultatif)</span>
        <TextInput label="Adresse" value={p.address} onChange={(v) => update((d) => void (d.address = v))} />
      </label>
      <div className="switch-row">
        <div>
          <strong>J'ai acheté ce bien</strong>
          <p className="field-hint">Affiche les colonnes « Réel » pour saisir les montants définitifs.</p>
        </div>
        <button
          role="switch"
          aria-checked={p.phase === 'owned'}
          aria-label="J'ai acheté ce bien"
          className={`switch${p.phase === 'owned' ? ' on' : ''}`}
          onClick={() =>
            update((d) => {
              d.phase = d.phase === 'owned' ? 'project' : 'owned';
              if (d.phase === 'owned' && !d.purchaseDate) d.purchaseDate = todayIso();
            })
          }
        />
      </div>
      {p.phase === 'owned' && (
        <label className="field">
          <span>Date d'achat</span>
          <input type="date" className="text-input" value={p.purchaseDate ?? ''} onChange={(e) => update((d) => void (d.purchaseDate = e.target.value || null))} />
        </label>
      )}
    </section>
  );
}

/** Carte de synthèse en tête de rubrique : prévu, et réel quand il existe. */
function Summary({
  label,
  planned,
  actual,
  showReal,
  fmt = eur,
  unit,
  higherIsBetter = false,
  info,
}: {
  label: string;
  planned: number;
  actual: number;
  showReal: boolean;
  fmt?: (n: number) => string;
  unit?: string;
  higherIsBetter?: boolean;
  info?: keyof typeof EXPLAIN;
}) {
  const d = actual - planned;
  const tone = Math.abs(d) < 0.5 ? '' : (d > 0) === higherIsBetter ? 'pos' : 'neg';
  return (
    <section className="card summary">
      <div className="card-title">
        <span className="kpi-label">{label}</span>
        {info && <Info title={EXPLAIN[info].title}>{EXPLAIN[info].body}</Info>}
      </div>
      {showReal ? (
        <div className="summary-dual">
          <div>
            <span className="mini-label">Prévu</span>
            <strong>
              {fmt(planned)}
              {unit && <small>{unit}</small>}
            </strong>
          </div>
          <div>
            <span className="mini-label real">Réel</span>
            <strong>
              {fmt(actual)}
              {unit && <small>{unit}</small>}
            </strong>
            {tone && <span className={`delta ${tone}`}>{eurSigned(d)}</span>}
          </div>
        </div>
      ) : (
        <strong className="summary-value">
          {fmt(planned)}
          {unit && <small>{unit}</small>}
        </strong>
      )}
    </section>
  );
}

/* ───────────────────────────── Achat ───────────────────────────── */

const ACQ_GROUPS: { title: string; keys: AcquisitionKey[] }[] = [
  { title: 'Le bien', keys: ['price', 'notary', 'agency'] },
  { title: 'Frais liés au crédit', keys: ['loanFees', 'guarantee', 'broker'] },
  { title: 'Travaux et équipement', keys: ['works', 'furniture', 'otherFees'] },
];

function Purchase({ p, pm, update }: { p: Property; pm: PropertyMetrics; update: Update }) {
  const { showReal } = pm;
  const setAcq = (k: AcquisitionKey, field: keyof Amount) => (v: number | null) =>
    update((d) => {
      d.acquisition[k][field] = v;
    });

  return (
    <>
      <Summary
        label="Coût total d'acquisition"
        planned={pm.planned.totalCost}
        actual={pm.actual.totalCost}
        showReal={showReal}
        info="totalCost"
      />

      {ACQ_GROUPS.map((g) => (
        <section className="card" key={g.title}>
          <h2 className="card-h">{g.title}</h2>
          {g.keys.map((k) => {
            const a = p.acquisition[k];
            const mv = expensesInCategory(p, k);
            const paidDiffers = showReal && mv.count > 0 && a.actual !== mv.total;
            const exceeds = pm.discrepancies.some((d) => d.key === k);
            const price = p.acquisition.price.planned;
            return (
              <DualRow
                key={k}
                label={ACQUISITION_LABELS[k]}
                planned={a.planned}
                actual={a.actual}
                onPlanned={setAcq(k, 'planned')}
                onActual={setAcq(k, 'actual')}
                showReal={showReal}
                actualHint={
                  paidDiffers ? (
                    exceeds ? (
                      <span className="field-hint warn">
                        Payé : {eur(mv.total)}, plus que le montant utilisé ({eur(a.actual ?? a.planned ?? 0)})
                      </span>
                    ) : (
                      `Payé à ce jour : ${eur(mv.total)}`
                    )
                  ) : undefined
                }
                extra={
                  paidDiffers ? (
                    <button className="link-btn" onClick={() => setAcq(k, 'actual')(Math.round(mv.total * 100) / 100)}>
                      Dépense terminée : reprendre {eur(mv.total)} comme réel
                    </button>
                  ) : k === 'notary' && a.planned === null && price ? (
                    <button
                      className="link-btn"
                      onClick={() => setAcq('notary', 'planned')(Math.round(price * 0.075))}
                    >
                      Estimer à 7,5 % du prix (ancien) : {eur(price * 0.075)}
                    </button>
                  ) : undefined
                }
              />
            );
          })}
        </section>
      ))}
    </>
  );
}

/* ───────────────────────────── Financement ───────────────────────────── */

function autoPayment(p: Property, scenario: Scenario): number {
  const i = resolveInputs(p, scenario).loan;
  return monthlyPayment(i.borrowed, i.ratePct, i.months);
}

function Financing({ p, pm, update }: { p: Property; pm: PropertyMetrics; update: Update }) {
  const { showReal, planned, actual } = pm;
  const [unit, setUnit] = useState<'years' | 'months'>('years');
  const l = p.loan;
  const set = (k: keyof Property['loan'], field: keyof Amount) => (v: number | null) =>
    update((d) => {
      d.loan[k][field] = v;
    });

  // L'apport n'est pas stocké : il se déduit du coût et de l'emprunt (une seule source de vérité).
  const apportPlanned = l.borrowed.planned === null ? null : Math.max(0, planned.totalCost - l.borrowed.planned);
  const apportActual = l.borrowed.actual === null ? null : Math.max(0, actual.totalCost - l.borrowed.actual);

  const toUnit = (months: number | null) => (months === null ? null : unit === 'years' ? months / 12 : months);
  const fromUnit = (v: number | null) => (v === null ? null : Math.round(unit === 'years' ? v * 12 : v));

  return (
    <>
      <Summary
        label="Mensualité avec assurance"
        planned={planned.loan.paymentWithInsurance}
        actual={actual.loan.paymentWithInsurance}
        showReal={showReal}
        fmt={eur2}
        unit=" /mois"
        info="payment"
      />

      <section className="card">
        <h2 className="card-h">Le prêt</h2>
        <DualRow
          label="Apport personnel"
          hint="= coût total − montant emprunté"
          planned={apportPlanned}
          actual={apportActual}
          onPlanned={(v) => update((d) => void (d.loan.borrowed.planned = v === null ? null : Math.max(0, planned.totalCost - v)))}
          onActual={(v) => update((d) => void (d.loan.borrowed.actual = v === null ? null : Math.max(0, actual.totalCost - v)))}
          showReal={showReal}
          plannedPlaceholder={plain(planned.totalCost)}
          higherIsBetter={false}
        />
        <DualRow
          label="Montant emprunté"
          planned={l.borrowed.planned}
          actual={l.borrowed.actual}
          onPlanned={set('borrowed', 'planned')}
          onActual={set('borrowed', 'actual')}
          showReal={showReal}
          plannedPlaceholder="0"
        />
        <DualRow
          label="Taux du crédit"
          hint="taux nominal annuel"
          suffix="%"
          planned={l.ratePct.planned}
          actual={l.ratePct.actual}
          onPlanned={set('ratePct', 'planned')}
          onActual={set('ratePct', 'actual')}
          showReal={showReal}
        />
        <DualRow
          label="Durée"
          hint={planned.loan.months > 0 ? `${planned.loan.months} mensualités` : undefined}
          suffix={unit === 'years' ? 'ans' : 'mois'}
          planned={toUnit(l.durationMonths.planned)}
          actual={toUnit(l.durationMonths.actual)}
          onPlanned={(v) => update((d) => void (d.loan.durationMonths.planned = fromUnit(v)))}
          onActual={(v) => update((d) => void (d.loan.durationMonths.actual = fromUnit(v)))}
          showReal={showReal}
          extra={
            <Segmented
              small
              label="Unité de durée"
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'years', label: 'Années' },
                { value: 'months', label: 'Mois' },
              ]}
            />
          }
        />
        <DualRow
          label="Mensualité hors assurance"
          hint={l.monthlyPayment.planned === null ? 'calculée automatiquement' : 'saisie manuellement'}
          planned={l.monthlyPayment.planned}
          actual={l.monthlyPayment.actual}
          onPlanned={set('monthlyPayment', 'planned')}
          onActual={set('monthlyPayment', 'actual')}
          showReal={showReal}
          plannedPlaceholder={plain(autoPayment(p, 'planned'))}
          actualPlaceholder={plain(actual.loan.payment)}
          actualHint={showReal && l.monthlyPayment.actual === null ? 'Saisissez le montant exact de votre banque' : undefined}
          extra={
            <>
              {(planned.loan.paymentInconsistent || (showReal && actual.loan.paymentInconsistent)) && (
                <p className="field-hint warn">
                  Incohérent : {eur2((planned.loan.paymentInconsistent ? planned : actual).loan.payment)} ×{' '}
                  {(planned.loan.paymentInconsistent ? planned : actual).loan.months} mois ne rembourse pas les{' '}
                  {eur((planned.loan.paymentInconsistent ? planned : actual).loan.principal)} empruntés. Vérifiez la mensualité,
                  le montant ou la durée.
                </p>
              )}
              {l.monthlyPayment.planned !== null && (
                <button className="link-btn" onClick={() => set('monthlyPayment', 'planned')(null)}>
                  Revenir au calcul automatique ({eur2(autoPayment(p, 'planned'))})
                </button>
              )}
            </>
          }
        />
        <DualRow
          label="Assurance emprunteur"
          suffix="€/mois"
          planned={l.insuranceMonthly.planned}
          actual={l.insuranceMonthly.actual}
          onPlanned={set('insuranceMonthly', 'planned')}
          onActual={set('insuranceMonthly', 'actual')}
          showReal={showReal}
        />
        <p className="muted small">Frais de dossier, garantie et courtier : à saisir dans « Achat » (ils font partie du coût du projet).</p>
      </section>

      <LoanCost planned={planned} actual={actual} showReal={showReal} />
    </>
  );
}

function LoanCost({ planned, actual, showReal }: { planned: Metrics; actual: Metrics; showReal: boolean }) {
  const rows: [string, (m: Metrics) => string][] = [
    ['Durée', (m) => durationLabel(m.loan.months)],
    ['Mensualité hors assurance', (m) => eur2(m.loan.payment)],
    ['Mensualité avec assurance', (m) => eur2(m.loan.paymentWithInsurance)],
    ['Coût des intérêts', (m) => eurOrDash(m.loan.interestCost, 'incohérent')],
    ["Coût de l'assurance", (m) => eur(m.loan.insuranceCost)],
    ['Frais de dossier, garantie, courtier', (m) => eur(m.loan.financingFees)],
    ['Coût total du financement', (m) => eurOrDash(m.loan.totalFinancingCost, 'incohérent')],
    ['Total remboursé à la banque', (m) => eurOrDash(m.loan.totalRepaid, 'incohérent')],
  ];
  return (
    <section className="card">
      <div className="card-title">
        <h2>Ce que coûte le crédit</h2>
        <Info title="Coût du crédit">
          <p>Intérêts = mensualité hors assurance × nombre de mensualités − capital emprunté.</p>
          <p>Coût de l'assurance = assurance mensuelle × nombre de mensualités.</p>
          <p>Coût total du financement = intérêts + assurance + frais de dossier, garantie et courtier.</p>
          <p>Total remboursé à la banque = capital + intérêts + assurance.</p>
          <p>Estimation pour un prêt à taux fixe et mensualités constantes, sans remboursement anticipé.</p>
        </Info>
      </div>
      {showReal && (
        <div className="cmp-head two">
          <span />
          <span>Prévu</span>
          <span>Réel</span>
        </div>
      )}
      {rows.map(([label, f]) => (
        <div className={`cmp-row${showReal ? ' two' : ' one'}${label.startsWith('Coût total') ? ' strong' : ''}`} key={label}>
          <span className="cmp-label">{label}</span>
          <span className={showReal ? 'muted' : ''}>{f(planned)}</span>
          {showReal && <span>{f(actual)}</span>}
        </div>
      ))}
    </section>
  );
}

/* ───────────────────────────── Location ───────────────────────────── */

function Rental({ p, pm, update }: { p: Property; pm: PropertyMetrics; update: Update }) {
  const { showReal, planned, actual } = pm;
  const r = p.rental;
  const m = showReal ? actual : planned;
  return (
    <>
      <Summary
        label="Loyer annuel conservé"
        planned={planned.rentAnnualEffective}
        actual={actual.rentAnnualEffective}
        showReal={showReal}
        higherIsBetter
        info="rent"
      />
      <section className="card">
        <h2 className="card-h">Le loyer</h2>
        <DualRow
          label="Loyer hors charges"
          suffix="€/mois"
          planned={r.rent.planned}
          actual={r.rent.actual}
          onPlanned={(v) => update((d) => void (d.rental.rent.planned = v))}
          onActual={(v) => update((d) => void (d.rental.rent.actual = v))}
          showReal={showReal}
          higherIsBetter
        />
        <DualRow
          label="Charges récupérables"
          hint="payées par le locataire, reversées : neutres pour vous"
          suffix="€/mois"
          planned={r.recoverableCharges.planned}
          actual={r.recoverableCharges.actual}
          onPlanned={(v) => update((d) => void (d.rental.recoverableCharges.planned = v))}
          onActual={(v) => update((d) => void (d.rental.recoverableCharges.actual = v))}
          showReal={showReal}
          higherIsBetter
        />
        <label className="field">
          <span>Début de la location</span>
          <input
            type="date"
            className="text-input"
            value={r.startDate ?? ''}
            onChange={(e) => update((d) => void (d.rental.startDate = e.target.value || null))}
          />
        </label>
      </section>

      <section className="card">
        <h2 className="card-h">Prudence</h2>
        <div className="field">
          <span>Vacance locative</span>
          <p className="muted small">Mois sans locataire par an (1 mois ≈ 8 % du loyer).</p>
          <NumberInput
            label="Vacance locative en mois par an"
            suffix="mois/an"
            value={r.vacancyMonthsPerYear}
            onChange={(v) => update((d) => void (d.rental.vacancyMonthsPerYear = Math.min(12, Math.max(0, v ?? 0))))}
            placeholder="0"
          />
        </div>
        <div className="field">
          <span>Provision pour impayés</span>
          <p className="muted small">Part du loyer mise de côté par prudence (0 si vous avez une assurance loyers impayés).</p>
          <NumberInput
            label="Provision pour impayés en pourcentage"
            suffix="%"
            value={r.unpaidPct}
            onChange={(v) => update((d) => void (d.rental.unpaidPct = Math.min(100, Math.max(0, v ?? 0))))}
            placeholder="0"
          />
        </div>
      </section>

      <section className="card">
        <Row label="Loyer charges comprises" value={`${eur(m.rentMonthlyWithCharges)} /mois`} />
        <Row label="Loyer annuel théorique (12 mois)" value={eur(m.rentAnnualNominal)} />
        <Row label="Loyer annuel conservé" value={eur(m.rentAnnualEffective)} strong />
        <Row label="Rentabilité brute" value={pctFmt(m.grossYield)} />
      </section>
    </>
  );
}

/* ───────────────────────────── Charges ───────────────────────────── */

/** Rubriques presque toujours présentes : visibles même vides. Les autres restent repliées. */
const ESSENTIAL_CHARGES = ['propertyTax', 'pno', 'coproNonRecoverable'];

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'yearly', label: 'Annuelle' },
  { value: 'once', label: 'Ponctuelle' },
];

function Charges({ p, pm, update }: { p: Property; pm: PropertyMetrics; update: Update }) {
  const { showReal, planned, actual } = pm;
  const { confirm } = useDialogs();
  const [showEmpty, setShowEmpty] = useState(false);
  const [adding, setAdding] = useState(false);

  const filled = p.charges.filter(
    (c) =>
      c.amount.planned !== null ||
      c.amount.actual !== null ||
      !c.categoryId ||
      ESSENTIAL_CHARGES.includes(c.categoryId),
  );
  const empty = p.charges.filter((c) => !filled.includes(c));
  const visible = showEmpty ? p.charges : filled;

  const setCharge = (id: string, recipe: (c: Property['charges'][number]) => void) =>
    update((d) => {
      const c = d.charges.find((x) => x.id === id);
      if (c) recipe(c);
    });

  return (
    <>
      <Summary
        label="Charges récurrentes"
        planned={planned.chargesMonthly}
        actual={actual.chargesMonthly}
        showReal={showReal}
        unit=" /mois"
        info="charges"
      />
      <p className="muted small center">
        soit {eur((showReal ? actual : planned).chargesAnnual)} par an
        {(showReal ? actual : planned).oneOffCharges > 0 &&
          ` · ${eur((showReal ? actual : planned).oneOffCharges)} de dépenses ponctuelles`}
      </p>

      {visible.length === 0 && (
        <section className="card empty-card">
          <p className="muted">Aucune charge saisie pour l'instant.</p>
        </section>
      )}

      {visible.map((c) => {
        const val = showReal && c.amount.actual !== null ? c.amount.actual : (c.amount.planned ?? 0);
        return (
          <section className="card charge" key={c.id}>
            <div className="charge-head">
              {c.categoryId ? (
                <h2 className="card-h">{c.label}</h2>
              ) : (
                <TextInput label="Nom de la dépense" value={c.label} onChange={(v) => setCharge(c.id, (x) => void (x.label = v))} />
              )}
              {!c.categoryId && (
                <button
                  className="icon-btn"
                  aria-label={`Supprimer ${c.label}`}
                  onClick={async () => {
                    if (await confirm({ title: `Supprimer « ${c.label} » ?`, confirmLabel: 'Supprimer', danger: true })) {
                      update((d) => void (d.charges = d.charges.filter((x) => x.id !== c.id)));
                    }
                  }}
                >
                  <Icon name="trash" size={19} />
                </button>
              )}
            </div>
            <Segmented
              small
              label={`Fréquence de ${c.label}`}
              value={c.frequency}
              onChange={(f) => setCharge(c.id, (x) => void (x.frequency = f))}
              options={FREQ_OPTIONS}
            />
            <DualRow
              label={c.frequency === 'monthly' ? 'Montant par mois' : c.frequency === 'yearly' ? 'Montant par an' : 'Montant'}
              planned={c.amount.planned}
              actual={c.amount.actual}
              onPlanned={(v) => setCharge(c.id, (x) => void (x.amount.planned = v))}
              onActual={(v) => setCharge(c.id, (x) => void (x.amount.actual = v))}
              showReal={showReal}
            />
            {val > 0 && (
              <p className="equiv">
                {c.frequency === 'once'
                  ? 'Dépense unique, comptée dans l’argent investi'
                  : `≈ ${eur(monthlyEquivalent(val, c.frequency))} /mois · ${eur(annualEquivalent(val, c.frequency))} /an`}
              </p>
            )}
          </section>
        );
      })}

      <div className="stack">
        {empty.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setShowEmpty((s) => !s)}>
            {showEmpty ? 'Masquer les rubriques vides' : `Afficher les autres rubriques (${empty.length})`}
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Ajouter une dépense
        </button>
      </div>

      <AddChargeSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(label, frequency, amount) =>
          update((d) => {
            d.charges.push({ id: newId('ch'), label, frequency, amount: { planned: amount, actual: null } });
          })
        }
      />
    </>
  );
}

function AddChargeSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string, f: Frequency, amount: number | null) => void;
}) {
  const [label, setLabel] = useState('');
  const [freq, setFreq] = useState<Frequency>('yearly');
  const [amount, setAmount] = useState<number | null>(null);
  const reset = () => {
    setLabel('');
    setFreq('yearly');
    setAmount(null);
    onClose();
  };
  return (
    <Sheet
      open={open}
      title="Nouvelle dépense"
      onClose={reset}
      footer={
        <button
          className="btn btn-primary wide"
          disabled={!label.trim()}
          onClick={() => {
            onAdd(label.trim(), freq, amount);
            reset();
          }}
        >
          Ajouter
        </button>
      }
    >
      <label className="field">
        <span>Nom</span>
        <TextInput label="Nom de la dépense" value={label} onChange={setLabel} placeholder="Ex. : Ramonage" autoFocus />
      </label>
      <div className="field">
        <span>Fréquence</span>
        <Segmented label="Fréquence" value={freq} onChange={setFreq} options={FREQ_OPTIONS} />
      </div>
      <div className="field">
        <span>Montant prévu</span>
        <NumberInput label="Montant prévu" value={amount} onChange={setAmount} />
      </div>
    </Sheet>
  );
}
