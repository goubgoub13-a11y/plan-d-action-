import { useState } from 'react';
import { ACQUISITION_LABELS } from '../domain/categories';
import { ACQUISITION_KEYS, type Amount, type Frequency, type Property } from '../domain/types';
import { dateFr, durationLabel, eur, eur2, pctFmt, todayIso } from '../lib/format';
import { newId } from '../lib/id';
import { useProperty, useStore } from '../state/store';
import { usePropertyMetrics } from '../state/useMetrics';
import { Amount as Money, Legend, Line, Section, StackBar } from '../ui/Display';
import { NumberInput, Segmented, TextInput } from '../ui/Fields';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { FieldFlow, type FlowSection, type Update } from './FieldFlow';
import type { ProjectSection } from './nav';

/** Montant de référence d'une ligne : réel s'il est connu, sinon prévu. */
const ref = (a: Amount) => a.actual ?? a.planned;
const FREQ_SHORT: Record<Frequency, string> = { monthly: '/mois', yearly: '/an', once: 'une fois' };
const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'yearly', label: 'Annuelle' },
  { value: 'once', label: 'Ponctuelle' },
];

/**
 * Projet — lecture d'abord : chaque rubrique affiche son total et ses lignes.
 * Toucher une ligne ouvre la saisie de ce champ ; « Modifier » parcourt la rubrique
 * champ par champ (FieldFlow). Mêmes règles de calcul qu'avant : seule la présentation change.
 */
export function Project({ editing, setEditing }: { editing: ProjectSection | null; setEditing: (s: ProjectSection | null) => void }) {
  const p = useProperty();
  const { updateProperty } = useStore();
  const pm = usePropertyMetrics(p);
  const update: Update = (recipe) => updateProperty(p.id, recipe);
  const { planned, actual, showReal } = pm;
  const m = showReal ? actual : planned;
  const [startId, setStartId] = useState<string | undefined>(undefined);
  const [addingCharge, setAddingCharge] = useState(false);

  const open = (s: FlowSection, id?: string) => {
    setStartId(id);
    setEditing(s);
  };
  const close = () => {
    setEditing(null);
    setStartId(undefined);
  };

  const prevu = (a: Amount) => (showReal && a.actual !== null && a.planned !== null && Math.abs(a.actual - a.planned) >= 0.5 ? `prévu ${eur(a.planned)}` : undefined);
  const valueOf = (a: Amount, unit = '') => (ref(a) === null ? '—' : `${eur(ref(a)!)}${unit}`);
  const acqLines = ACQUISITION_KEYS.filter((k) => ref(p.acquisition[k]) !== null);
  const chargeLines = p.charges.filter((c) => ref(c.amount) !== null);
  const l = p.loan;
  const loan = m.loan;

  const edit = (s: FlowSection, label: string) => (
    <button className="btn btn-quiet" onClick={() => open(s)} aria-label={`Modifier : ${label}`}>
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

      <Section title="Acquisition" icon="layers" headline={<Money value={m.totalCost} size="xl" />} headlineUnit="coût total" action={edit('purchase', 'Acquisition')}>
        {acqLines.length === 0 ? (
          <EmptyPrompt onClick={() => open('purchase')}>Commencez par le prix d'achat</EmptyPrompt>
        ) : (
          <div className="lines">
            {acqLines.map((k) => (
              <Line key={k} label={ACQUISITION_LABELS[k]} value={valueOf(p.acquisition[k])} secondary={prevu(p.acquisition[k])} onClick={() => open('purchase', `acq.${k}`)} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Financement"
        icon="bank"
        headline={<Money value={loan.paymentWithInsurance} size="xl" decimals={2} />}
        headlineUnit="par mois"
        action={edit('financing', 'Financement')}
      >
        {m.borrowed > 0 ? (
          <>
            <div className="lines">
              <Line label="Montant emprunté" value={eur(m.borrowed)} secondary={prevu(l.borrowed)} onClick={() => open('financing', 'loan.borrowed')} />
              <Line label="Apport" value={eur(m.equity)} onClick={() => open('financing', 'loan.apport')} />
              <Line label="Taux" value={ref(l.ratePct) === null ? '—' : pctFmt(ref(l.ratePct), 2)} onClick={() => open('financing', 'loan.rate')} />
              <Line label="Durée" value={durationLabel(loan.months)} onClick={() => open('financing', 'loan.duration')} />
              <Line label="Mensualité hors assurance" value={eur2(loan.payment)} secondary={loan.paymentIsManual ? 'saisie' : 'calculée'} onClick={() => open('financing', 'loan.payment')} />
              <Line label="Assurance" value={`${eur2(loan.insuranceMonthly)} /mois`} onClick={() => open('financing', 'loan.insurance')} />
            </div>
            {loan.paymentInconsistent ? (
              <p className="note note-warn">La mensualité saisie ne rembourse pas le capital : coût du crédit incohérent.</p>
            ) : (
              loan.months > 0 && (
                <div className="credit-cost">
                  <div className="credit-cost-head">
                    <span className="mini-label">Total remboursé à la banque</span>
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
          <EmptyPrompt onClick={() => open('financing')}>Montant, taux, durée : la mensualité se calcule toute seule</EmptyPrompt>
        )}
      </Section>

      <Section title="Location" icon="key" headline={<Money value={m.rentAnnualNominal / 12} size="xl" />} headlineUnit="par mois, hors charges" action={edit('rental', 'Location')}>
        {ref(p.rental.rent) === null ? (
          <EmptyPrompt onClick={() => open('rental')}>Indiquez le loyer hors charges</EmptyPrompt>
        ) : (
          <div className="lines">
            <Line label="Loyer hors charges" value={valueOf(p.rental.rent, ' /mois')} secondary={prevu(p.rental.rent)} onClick={() => open('rental', 'rent.rent')} />
            <Line label="Charges récupérables" hint="payées par le locataire, neutres" value={valueOf(p.rental.recoverableCharges, ' /mois')} onClick={() => open('rental', 'rent.recoverable')} />
            <Line label="Vacance locative" value={`${p.rental.vacancyMonthsPerYear.toLocaleString('fr-FR')} mois/an`} onClick={() => open('rental', 'rent.vacancy')} />
            <Line label="Provision impayés" value={`${p.rental.unpaidPct.toLocaleString('fr-FR')} %`} onClick={() => open('rental', 'rent.unpaid')} />
            <Line label="Loyer annuel conservé" hint="après vacance et impayés" value={eur(m.rentAnnualEffective)} strong />
          </div>
        )}
      </Section>

      <Section title="Charges" icon="receipt" headline={<Money value={m.chargesMonthly} size="xl" />} headlineUnit="par mois" action={edit('charges', 'Charges')}>
        {chargeLines.length === 0 ? (
          <EmptyPrompt onClick={() => open('charges')}>Taxe foncière, assurance PNO, copropriété…</EmptyPrompt>
        ) : (
          <div className="lines">
            {chargeLines.map((c) => (
              <Line key={c.id} label={c.label} value={`${eur(ref(c.amount)!)} ${FREQ_SHORT[c.frequency]}`} secondary={prevu(c.amount)} onClick={() => open('charges', `charge.${c.id}`)} />
            ))}
          </div>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => setAddingCharge(true)}>
          <Icon name="plus" size={16} /> Ajouter une dépense
        </button>
      </Section>

      {editing && editing !== 'property' && <FieldFlow key={editing + (startId ?? '')} section={editing} startId={startId} p={p} pm={pm} update={update} onClose={close} />}

      <Sheet
        open={editing === 'property'}
        title="Le bien"
        onClose={close}
        footer={
          <button className="btn btn-primary wide" onClick={close}>
            Terminé
          </button>
        }
      >
        <PropertyEditor p={p} update={update} />
      </Sheet>

      <AddChargeSheet
        open={addingCharge}
        onClose={() => setAddingCharge(false)}
        onAdd={(label, frequency, amount) =>
          update((d) => {
            d.charges.push({ id: newId('ch'), label, frequency, amount: { planned: amount, actual: null } });
          })
        }
      />
    </div>
  );
}

function EmptyPrompt({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button className="empty-prompt" onClick={onClick}>
      <span className="empty-prompt-icon" aria-hidden="true">
        <Icon name="plus" size={18} />
      </span>
      {children}
    </button>
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
