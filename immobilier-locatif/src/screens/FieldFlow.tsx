/**
 * Saisie champ par champ (v1.2.0) : un montant par écran, avec progression.
 * Purement présentatif : chaque champ écrit dans le modèle exactement comme les
 * anciens formulaires (mêmes règles : apport déduit, durée en années ou mois,
 * mensualité calculée ou saisie, reprise du payé, etc.).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { monthlyPayment } from '../calc/loan';
import { annualEquivalent, monthlyEquivalent } from '../calc/metrics';
import { expensesInCategory, resolveInputs } from '../calc/resolve';
import { ACQUISITION_LABELS } from '../domain/categories';
import { ACQUISITION_KEYS, type AcquisitionKey, type Amount, type ChargeItem, type Frequency, type Property, type Scenario } from '../domain/types';
import { eur, eur2, eurSigned, formatInput, plain } from '../lib/format';
import { useStore } from '../state/store';
import type { PropertyMetrics } from '../state/useMetrics';
import { useDialogs } from '../ui/Dialogs';
import { Amount as Money } from '../ui/Display';
import { NumberInput, Segmented, TextInput } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import type { ProjectSection } from './nav';

export type Update = (recipe: (d: Property) => void) => void;
export type FlowSection = Exclude<ProjectSection, 'property'>;

interface Ctx {
  p: Property;
  pm: PropertyMetrics;
  update: Update;
  unit: 'years' | 'months';
  setUnit: (u: 'years' | 'months') => void;
}

export interface FieldDef {
  id: string;
  title: string;
  hint?: string;
  render: (ctx: Ctx) => ReactNode;
}

export const FLOW_TITLES: Record<FlowSection, string> = {
  purchase: 'Acquisition',
  financing: 'Financement',
  rental: 'Location',
  charges: 'Charges',
};

const ACQ_HINTS: Record<AcquisitionKey, string> = {
  price: 'Prix net vendeur, hors frais.',
  notary: "Environ 7 à 8 % du prix dans l'ancien, 2 à 3 % dans le neuf.",
  agency: "Seulement s'ils sont à votre charge.",
  loanFees: 'Frais facturés par la banque pour le dossier de prêt.',
  guarantee: 'Caution (type Crédit Logement) ou hypothèque.',
  broker: "Honoraires du courtier, s'il y en a un.",
  works: 'Montant total des travaux avant la mise en location.',
  furniture: 'Meubles et équipement, pour une location meublée.',
  otherFees: 'Diagnostics, frais divers…',
};

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'yearly', label: 'Annuelle' },
  { value: 'once', label: 'Ponctuelle' },
];

/** Rubriques de charges presque toujours présentes : proposées en premier. */
const ESSENTIAL_CHARGES = ['propertyTax', 'pno', 'coproNonRecoverable'];

/* ───────────── Grand champ Prévu / Réel ───────────── */

export function BigDual({
  name,
  planned,
  actual,
  onPlanned,
  onActual,
  showReal,
  unit = '€',
  plannedPlaceholder,
  actualPlaceholder,
  higherIsBetter = false,
  realNote,
}: {
  name: string;
  planned: number | null;
  actual: number | null;
  onPlanned: (v: number | null) => void;
  onActual: (v: number | null) => void;
  showReal: boolean;
  unit?: string;
  plannedPlaceholder?: string;
  actualPlaceholder?: string;
  higherIsBetter?: boolean;
  realNote?: ReactNode;
}) {
  const d = planned !== null && actual !== null ? actual - planned : null;
  const significant = d !== null && Math.abs(d) >= 0.005;
  const tone = !significant ? '' : (d! > 0) === higherIsBetter ? 'tone-pos' : 'tone-neg';
  return (
    <div className="bigdual">
      <div className="bigfield">
        <span className="bigfield-tag">{showReal ? 'Prévu' : 'Montant'}</span>
        <NumberInput field label={`${name} — prévu`} value={planned} onChange={onPlanned} suffix={unit} placeholder={plannedPlaceholder ?? '0'} autoFocus />
      </div>
      {showReal && (
        <div className="bigfield is-real">
          <span className="bigfield-tag real">Réel</span>
          <NumberInput field label={`${name} — réel`} value={actual} onChange={onActual} suffix={unit} placeholder={actualPlaceholder ?? 'à venir'} />
          <span className="bigfield-note">
            {realNote ?? (actual === null ? 'Pas encore connu : le montant prévu est utilisé.' : 'Montant définitif, utilisé par les calculs.')}
          </span>
        </div>
      )}
      {significant && (
        <span className={`delta-pill ${tone}`}>
          Écart {unit === '€' || unit.startsWith('€') ? eurSigned(d!) : `${d! > 0 ? '+' : '−'}${plain(Math.abs(d!))} ${unit}`}
        </span>
      )}
    </div>
  );
}

function Suggest({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="suggest" onClick={onClick}>
      <Icon name="sparkles" size={15} />
      {children}
    </button>
  );
}

/* ───────────── Définitions des champs ───────────── */

function acquisitionFields(): FieldDef[] {
  return ACQUISITION_KEYS.map((k) => ({
    id: `acq.${k}`,
    title: ACQUISITION_LABELS[k],
    hint: ACQ_HINTS[k],
    render: ({ p, pm, update }) => {
      const a = p.acquisition[k];
      const set = (field: keyof Amount) => (v: number | null) => update((d) => void (d.acquisition[k][field] = v));
      const mv = expensesInCategory(p, k);
      const paidDiffers = pm.showReal && mv.count > 0 && a.actual !== mv.total;
      const exceeds = pm.discrepancies.some((x) => x.key === k);
      const price = p.acquisition.price.planned;
      return (
        <>
          <BigDual
            name={ACQUISITION_LABELS[k]}
            planned={a.planned}
            actual={a.actual}
            onPlanned={set('planned')}
            onActual={set('actual')}
            showReal={pm.showReal}
            realNote={
              paidDiffers ? (
                <span className={exceeds ? 'is-warn' : undefined}>
                  Payé à ce jour : {eur(mv.total)}
                  {exceeds ? `, plus que le montant utilisé (${eur(a.actual ?? a.planned ?? 0)})` : ''}
                </span>
              ) : undefined
            }
          />
          {paidDiffers && <Suggest onClick={() => set('actual')(Math.round(mv.total * 100) / 100)}>Dépense terminée : reprendre {eur(mv.total)} comme réel</Suggest>}
          {k === 'notary' && a.planned === null && price ? (
            <Suggest onClick={() => set('planned')(Math.round(price * 0.075))}>Estimer à 7,5 % du prix : {eur(price * 0.075)}</Suggest>
          ) : null}
        </>
      );
    },
  }));
}

function autoPayment(p: Property, scenario: Scenario): number {
  const i = resolveInputs(p, scenario).loan;
  return monthlyPayment(i.borrowed, i.ratePct, i.months);
}

function financingFields(): FieldDef[] {
  return [
    {
      id: 'loan.borrowed',
      title: 'Montant emprunté',
      hint: 'Le capital prêté par la banque.',
      render: ({ p, pm, update }) => (
        <BigDual
          name="Montant emprunté"
          planned={p.loan.borrowed.planned}
          actual={p.loan.borrowed.actual}
          onPlanned={(v) => update((d) => void (d.loan.borrowed.planned = v))}
          onActual={(v) => update((d) => void (d.loan.borrowed.actual = v))}
          showReal={pm.showReal}
        />
      ),
    },
    {
      id: 'loan.apport',
      title: 'Apport personnel',
      hint: "Ce que vous payez de votre poche. Il se déduit : coût total − montant emprunté. Le modifier ajuste l'emprunt.",
      render: ({ p, pm, update }) => {
        const { planned, actual } = pm;
        const l = p.loan;
        return (
          <BigDual
            name="Apport personnel"
            planned={l.borrowed.planned === null ? null : Math.max(0, planned.totalCost - l.borrowed.planned)}
            actual={l.borrowed.actual === null ? null : Math.max(0, actual.totalCost - l.borrowed.actual)}
            onPlanned={(v) => update((d) => void (d.loan.borrowed.planned = v === null ? null : Math.max(0, planned.totalCost - v)))}
            onActual={(v) => update((d) => void (d.loan.borrowed.actual = v === null ? null : Math.max(0, actual.totalCost - v)))}
            showReal={pm.showReal}
            plannedPlaceholder={formatInput(planned.totalCost)}
          />
        );
      },
    },
    {
      id: 'loan.rate',
      title: 'Taux du crédit',
      hint: "Taux nominal annuel, hors assurance (indiqué sur l'offre de prêt).",
      render: ({ p, pm, update }) => (
        <BigDual
          name="Taux du crédit"
          unit="%"
          planned={p.loan.ratePct.planned}
          actual={p.loan.ratePct.actual}
          onPlanned={(v) => update((d) => void (d.loan.ratePct.planned = v))}
          onActual={(v) => update((d) => void (d.loan.ratePct.actual = v))}
          showReal={pm.showReal}
        />
      ),
    },
    {
      id: 'loan.duration',
      title: 'Durée du prêt',
      render: ({ p, pm, update, unit, setUnit }) => {
        const toUnit = (m: number | null) => (m === null ? null : unit === 'years' ? m / 12 : m);
        const fromUnit = (v: number | null) => (v === null ? null : Math.round(unit === 'years' ? v * 12 : v));
        return (
          <>
            <Segmented
              small
              label="Unité de durée"
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'years', label: 'En années' },
                { value: 'months', label: 'En mois' },
              ]}
            />
            <BigDual
              name="Durée"
              unit={unit === 'years' ? 'ans' : 'mois'}
              planned={toUnit(p.loan.durationMonths.planned)}
              actual={toUnit(p.loan.durationMonths.actual)}
              onPlanned={(v) => update((d) => void (d.loan.durationMonths.planned = fromUnit(v)))}
              onActual={(v) => update((d) => void (d.loan.durationMonths.actual = fromUnit(v)))}
              showReal={pm.showReal}
            />
            {pm.planned.loan.months > 0 && <p className="flow-aside">Soit {pm.planned.loan.months} mensualités.</p>}
          </>
        );
      },
    },
    {
      id: 'loan.payment',
      title: 'Mensualité hors assurance',
      hint: 'Calculée automatiquement. Si votre banque vous donne le montant exact, saisissez-le : il remplace le calcul.',
      render: ({ p, pm, update }) => {
        const { planned, actual } = pm;
        const l = p.loan;
        const bad = planned.loan.paymentInconsistent ? planned : pm.showReal && actual.loan.paymentInconsistent ? actual : null;
        return (
          <>
            <BigDual
              name="Mensualité hors assurance"
              planned={l.monthlyPayment.planned}
              actual={l.monthlyPayment.actual}
              onPlanned={(v) => update((d) => void (d.loan.monthlyPayment.planned = v))}
              onActual={(v) => update((d) => void (d.loan.monthlyPayment.actual = v))}
              showReal={pm.showReal}
              plannedPlaceholder={formatInput(autoPayment(p, 'planned'))}
              actualPlaceholder={formatInput(actual.loan.payment)}
              realNote={l.monthlyPayment.actual === null ? 'Saisissez le montant exact de votre banque.' : undefined}
            />
            {bad && (
              <p className="flow-warn">
                Incohérent : {eur2(bad.loan.payment)} × {bad.loan.months} mois ne rembourse pas les {eur(bad.loan.principal)} empruntés.
                Vérifiez la mensualité, le montant ou la durée.
              </p>
            )}
            {l.monthlyPayment.planned !== null && (
              <Suggest onClick={() => update((d) => void (d.loan.monthlyPayment.planned = null))}>
                Revenir au calcul automatique ({eur2(autoPayment(p, 'planned'))})
              </Suggest>
            )}
          </>
        );
      },
    },
    {
      id: 'loan.insurance',
      title: 'Assurance emprunteur',
      hint: 'Montant mensuel. Les frais de dossier, de garantie et de courtier se saisissent dans « Acquisition ».',
      render: ({ p, pm, update }) => (
        <BigDual
          name="Assurance emprunteur"
          unit="€/mois"
          planned={p.loan.insuranceMonthly.planned}
          actual={p.loan.insuranceMonthly.actual}
          onPlanned={(v) => update((d) => void (d.loan.insuranceMonthly.planned = v))}
          onActual={(v) => update((d) => void (d.loan.insuranceMonthly.actual = v))}
          showReal={pm.showReal}
        />
      ),
    },
  ];
}

function rentalFields(): FieldDef[] {
  return [
    {
      id: 'rent.rent',
      title: 'Loyer hors charges',
      hint: 'Le loyer mensuel du bail, sans les charges.',
      render: ({ p, pm, update }) => (
        <BigDual
          name="Loyer hors charges"
          unit="€/mois"
          higherIsBetter
          planned={p.rental.rent.planned}
          actual={p.rental.rent.actual}
          onPlanned={(v) => update((d) => void (d.rental.rent.planned = v))}
          onActual={(v) => update((d) => void (d.rental.rent.actual = v))}
          showReal={pm.showReal}
        />
      ),
    },
    {
      id: 'rent.recoverable',
      title: 'Charges récupérables',
      hint: "Payées par le locataire puis reversées (eau, copropriété…). Neutres : elles n'entrent pas dans la rentabilité.",
      render: ({ p, pm, update }) => (
        <BigDual
          name="Charges récupérables"
          unit="€/mois"
          higherIsBetter
          planned={p.rental.recoverableCharges.planned}
          actual={p.rental.recoverableCharges.actual}
          onPlanned={(v) => update((d) => void (d.rental.recoverableCharges.planned = v))}
          onActual={(v) => update((d) => void (d.rental.recoverableCharges.actual = v))}
          showReal={pm.showReal}
        />
      ),
    },
    {
      id: 'rent.vacancy',
      title: 'Vacance locative',
      hint: 'Mois sans locataire par an, par prudence. 1 mois ≈ 8 % du loyer.',
      render: ({ p, update }) => (
        <div className="bigfield">
          <span className="bigfield-tag">Mois par an</span>
          <NumberInput
            field
            autoFocus
            label="Vacance locative en mois par an"
            suffix="mois/an"
            value={p.rental.vacancyMonthsPerYear}
            onChange={(v) => update((d) => void (d.rental.vacancyMonthsPerYear = Math.min(12, Math.max(0, v ?? 0))))}
            placeholder="0"
          />
        </div>
      ),
    },
    {
      id: 'rent.unpaid',
      title: 'Provision pour impayés',
      hint: 'Part du loyer mise de côté par prudence. 0 si vous avez une assurance loyers impayés.',
      render: ({ p, update }) => (
        <div className="bigfield">
          <span className="bigfield-tag">Pourcentage du loyer</span>
          <NumberInput
            field
            autoFocus
            label="Provision pour impayés en pourcentage"
            suffix="%"
            value={p.rental.unpaidPct}
            onChange={(v) => update((d) => void (d.rental.unpaidPct = Math.min(100, Math.max(0, v ?? 0))))}
            placeholder="0"
          />
        </div>
      ),
    },
    {
      id: 'rent.start',
      title: 'Début de la location',
      hint: 'Facultatif : la date de prise d’effet du bail.',
      render: ({ p, update }) => (
        <div className="bigfield">
          <span className="bigfield-tag">Date</span>
          <input
            type="date"
            className="text-input big-date"
            aria-label="Début de la location"
            value={p.rental.startDate ?? ''}
            onChange={(e) => update((d) => void (d.rental.startDate = e.target.value || null))}
          />
        </div>
      ),
    },
  ];
}

function orderedCharges(p: Property): ChargeItem[] {
  const first = p.charges.filter((c) => c.amount.planned !== null || c.amount.actual !== null || !c.categoryId || ESSENTIAL_CHARGES.includes(c.categoryId ?? ''));
  return [...first, ...p.charges.filter((c) => !first.includes(c))];
}

function chargeFields(p: Property): FieldDef[] {
  return orderedCharges(p).map((c) => ({
    id: `charge.${c.id}`,
    title: c.label,
    hint: c.categoryId ? undefined : 'Dépense personnalisée.',
    render: (ctx) => <ChargeStep ctx={ctx} id={c.id} />,
  }));
}

function ChargeStep({ ctx, id }: { ctx: Ctx; id: string }) {
  const { p, pm, update } = ctx;
  const { confirm } = useDialogs();
  const c = p.charges.find((x) => x.id === id);
  if (!c) return <p className="flow-aside">Cette dépense a été supprimée.</p>;
  const setCharge = (recipe: (x: ChargeItem) => void) =>
    update((d) => {
      const x = d.charges.find((y) => y.id === id);
      if (x) recipe(x);
    });
  const val = pm.showReal && c.amount.actual !== null ? c.amount.actual : (c.amount.planned ?? 0);
  return (
    <>
      {!c.categoryId && (
        <label className="field">
          <span>Nom</span>
          <TextInput label="Nom de la dépense" value={c.label} onChange={(v) => setCharge((x) => void (x.label = v))} />
        </label>
      )}
      <Segmented small label={`Fréquence de ${c.label}`} value={c.frequency} onChange={(f) => setCharge((x) => void (x.frequency = f))} options={FREQ_OPTIONS} />
      <BigDual
        name={c.label}
        unit={c.frequency === 'monthly' ? '€/mois' : c.frequency === 'yearly' ? '€/an' : '€'}
        planned={c.amount.planned}
        actual={c.amount.actual}
        onPlanned={(v) => setCharge((x) => void (x.amount.planned = v))}
        onActual={(v) => setCharge((x) => void (x.amount.actual = v))}
        showReal={pm.showReal}
      />
      {val > 0 && (
        <p className="flow-aside">
          {c.frequency === 'once'
            ? 'Dépense unique, comptée dans l’argent investi.'
            : `Soit ${eur(monthlyEquivalent(val, c.frequency))} par mois · ${eur(annualEquivalent(val, c.frequency))} par an.`}
        </p>
      )}
      {!c.categoryId && (
        <button
          type="button"
          className="btn btn-quiet is-danger"
          onClick={async () => {
            if (await confirm({ title: `Supprimer « ${c.label} » ?`, confirmLabel: 'Supprimer', danger: true })) {
              update((d) => void (d.charges = d.charges.filter((x) => x.id !== id)));
            }
          }}
        >
          <Icon name="trash" size={16} /> Supprimer cette dépense
        </button>
      )}
    </>
  );
}

/** Liste des champs d'une rubrique, dans l'ordre de saisie. */
export function fieldsFor(section: FlowSection, p: Property): FieldDef[] {
  if (section === 'purchase') return acquisitionFields();
  if (section === 'financing') return financingFields();
  if (section === 'rental') return rentalFields();
  return chargeFields(p);
}

/* ───────────── Panneau de saisie ───────────── */

export function FieldFlow({
  section,
  startId,
  p,
  pm,
  update,
  onClose,
}: {
  section: FlowSection;
  startId?: string;
  p: Property;
  pm: PropertyMetrics;
  update: Update;
  onClose: () => void;
}) {
  const { saveStatus } = useStore();
  const [unit, setUnit] = useState<'years' | 'months'>('years');
  // Liste figée à l'ouverture : l'ordre ne bouge pas pendant la saisie.
  const fields = useMemo(() => fieldsFor(section, p), [section]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(() => Math.max(0, fields.findIndex((f) => f.id === startId)));
  const i = Math.min(index, fields.length - 1);
  const field = fields[i];
  const last = i === fields.length - 1;
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    body.current?.scrollTo?.({ top: 0 });
  }, [i]);

  const m = pm.showReal ? pm.actual : pm.planned;
  const headline: Record<FlowSection, { label: string; value: ReactNode }> = {
    purchase: { label: 'Coût total', value: <Money value={m.totalCost} size="md" /> },
    financing: { label: 'Mensualité', value: <Money value={m.loan.paymentWithInsurance} size="md" decimals={2} /> },
    rental: { label: 'Loyer conservé / an', value: <Money value={m.rentAnnualEffective} size="md" /> },
    charges: { label: 'Charges / mois', value: <Money value={m.chargesMonthly} size="md" /> },
  };

  const next = () => (last ? onClose() : setIndex(i + 1));

  return (
    <Sheet
      open
      title={FLOW_TITLES[section]}
      onClose={onClose}
      footer={
        <div className="flow-foot">
          <button className="btn btn-secondary" onClick={() => setIndex(i - 1)} disabled={i === 0} aria-label="Champ précédent">
            <Icon name="back" size={18} />
          </button>
          <button className="btn btn-primary flow-next" onClick={next}>
            {last ? 'Terminé' : 'Suivant'}
            {!last && <Icon name="chevron" size={18} />}
          </button>
        </div>
      }
    >
      <div className="flow-top">
        <div className="flow-progress" role="progressbar" aria-valuemin={1} aria-valuemax={fields.length} aria-valuenow={i + 1} aria-label="Progression">
          {fields.map((f, n) => (
            <button
              key={f.id}
              type="button"
              className={`flow-dot${n === i ? ' is-current' : n < i ? ' is-done' : ''}`}
              aria-label={`Aller à : ${f.title}`}
              onClick={() => setIndex(n)}
            />
          ))}
        </div>
        <div className="flow-meta">
          <span>
            {i + 1} / {fields.length}
          </span>
          <span className={`save-state save-${saveStatus}`} aria-live="polite">
            {saveStatus === 'saved' ? (
              <>
                <Icon name="check" size={14} /> Enregistré
              </>
            ) : saveStatus === 'error' ? (
              'En attente'
            ) : (
              'Enregistrement…'
            )}
          </span>
        </div>
      </div>

      <div
        key={field.id}
        className="flow-step"
        ref={body}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            next();
          }
        }}
      >
        <h3 className="flow-title">{field.title}</h3>
        {field.hint && <p className="flow-hint">{field.hint}</p>}
        {field.render({ p, pm, update, unit, setUnit })}
      </div>

      <div className="flow-total">
        <span>{headline[section].label}</span>
        {headline[section].value}
      </div>
    </Sheet>
  );
}
