import { useMemo, useState } from 'react';
import { allCategories, getCategory, isRecoverableCategory, type Category, type CategoryGroup } from '../domain/categories';
import type { Movement, MovementType, Property } from '../domain/types';
import { addOneMonth, dateFr, dayLabel, eur, eur2, todayIso } from '../lib/format';
import { newId } from '../lib/id';
import { useProperty, useStore } from '../state/store';
import { usePropertyMetrics } from '../state/useMetrics';
import { useDialogs } from '../ui/Dialogs';
import { Amount, EmptyState } from '../ui/Display';
import { NumberInput, Segmented, TextInput } from '../ui/Fields';
import { Icon, categoryIcon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

const GROUP_LABEL: Record<CategoryGroup, string> = {
  acquisition: 'Achat',
  operating: 'Charges',
  financing: 'Crédit',
  income: 'Recettes',
  recoverable: 'Charges récupérables (neutres)',
  custom: 'Mes catégories',
};

/** Catégories proposées en un geste ; les autres restent dans « Autre catégorie ». */
const QUICK: Record<MovementType, string[]> = {
  expense: ['loanPayment', 'loanInsurance', 'propertyTax', 'coproNonRecoverable', 'works', 'repairs'],
  income: ['rent', 'recoveredCharges', 'otherIncome'],
};

type Filter = 'all' | MovementType;

/** Mouvements — l'information la plus importante : la liste de ce qui a été payé et encaissé. */
export function Movements() {
  const p = useProperty();
  const { data } = useStore();
  const { journal } = usePropertyMetrics(p);
  const custom = data.settings.customCategories;
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Movement | 'new' | null>(null);

  const days = useMemo(() => {
    const list = p.movements
      .filter((m) => filter === 'all' || m.type === filter)
      .slice()
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    const byDay = new Map<string, Movement[]>();
    for (const m of list) {
      if (!byDay.has(m.date)) byDay.set(m.date, []);
      byDay.get(m.date)!.push(m);
    }
    return [...byDay.entries()];
  }, [p.movements, filter]);

  return (
    <div className="screen">
      <header className="page-head">
        <p className="eyebrow">Réalisé</p>
        <h1>Mouvements</h1>
      </header>

      {p.movements.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="swap"
            title="Aucun mouvement pour le moment"
            action={
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                <Icon name="plus" size={18} /> Ajouter un mouvement
              </button>
            }
          >
            Ajoutez votre premier loyer ou votre première dépense pour commencer le suivi réalisé. Les montants de
            référence (prix signé, mensualité de la banque…) se saisissent, eux, dans « Projet ».
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="flow-summary" aria-label="Totaux hors charges récupérables">
            <div>
              <span className="mini-label">Encaissé</span>
              <Amount value={journal.received} size="lg" />
            </div>
            <div>
              <span className="mini-label">Payé</span>
              <Amount value={journal.spent} size="lg" />
            </div>
            <div>
              <span className="mini-label">Exploitation</span>
              <Amount value={journal.operatingResult} size="lg" signed tone={journal.operatingResult >= 0 ? 'pos' : undefined} />
            </div>
          </div>

          <Segmented
            small
            label="Filtrer"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'expense', label: 'Dépenses' },
              { value: 'income', label: 'Recettes' },
            ]}
          />

          {days.length === 0 ? (
            <p className="section-empty center">Rien dans ce filtre.</p>
          ) : (
            <div className="day-list">
              {days.map(([day, items]) => (
                <section key={day} className="day-group" aria-label={dayLabel(day)}>
                  <h2 className="day-head">{dayLabel(day)}</h2>
                  <div className="list-card">
                    {items.map((m) => {
                      const cat = getCategory(m.categoryId, custom);
                      const neutral = cat.group === 'recoverable';
                      return (
                        <button key={m.id} className="mv-row" onClick={() => setEditing(m)}>
                          <span className={`mv-icon ${m.type}${neutral ? ' neutral' : ''}`} aria-hidden="true">
                            <Icon name={categoryIcon(cat.id, cat.group)} size={19} />
                          </span>
                          <span className="mv-text">
                            <span className="mv-label">{cat.label}</span>
                            {(m.note || neutral) && <span className="mv-note">{m.note || 'neutre'}</span>}
                          </span>
                          <span className={`mv-amount ${m.type === 'income' && !neutral ? 'is-in' : 'is-out'}`}>
                            {m.type === 'income' ? '+' : '−'}
                            {eur2(m.amount).replace('-', '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          <p className="footnote">
            Totaux hors charges récupérables (neutres). « Exploitation » = recettes − dépenses courantes, hors achat.
          </p>
        </>
      )}

      <button className="fab" aria-label="Ajouter un mouvement" onClick={() => setEditing('new')}>
        <Icon name="plus" size={26} />
      </button>

      {editing && (
        <MovementSheet key={editing === 'new' ? 'new' : editing.id} property={p} movement={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

const NEW_CATEGORY = '__new__';

function MovementSheet({ property, movement, onClose }: { property: Property; movement: Movement | null; onClose: () => void }) {
  const { data, updateProperty, addCustomCategory } = useStore();
  const { actual } = usePropertyMetrics(property);
  const { confirm, toast } = useDialogs();
  const custom = data.settings.customCategories;

  const [type, setType] = useState<MovementType>(movement?.type ?? 'expense');
  const [amount, setAmount] = useState<number | null>(movement?.amount ?? null);
  const [categoryId, setCategoryId] = useState<string>(movement?.categoryId ?? '');
  const [date, setDate] = useState(movement?.date ?? todayIso());
  const [note, setNote] = useState(movement?.note ?? '');
  const [newCat, setNewCat] = useState('');

  const cats = allCategories(custom).filter((c) => c.kind === type);
  const grouped = cats.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  const quick = QUICK[type].map((id) => getCategory(id, custom));
  const inQuick = QUICK[type].includes(categoryId);

  /** Montant suggéré pour les mouvements récurrents (loyer, mensualité, assurance). */
  const suggest = (id: string): number | null => {
    if (id === 'rent') return property.rental.rent.actual ?? property.rental.rent.planned;
    if (id === 'loanPayment') return actual.loan.payment || null;
    if (id === 'loanInsurance') return actual.loan.insuranceMonthly || null;
    return null;
  };

  const choose = (id: string) => {
    setCategoryId(id);
    const s = suggest(id);
    if (amount === null && s) setAmount(Math.round(s * 100) / 100);
  };

  const valid =
    amount !== null && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && categoryId !== '' && (categoryId !== NEW_CATEGORY || newCat.trim() !== '');

  const save = () => {
    if (!valid) return;
    let cat = categoryId;
    if (cat === NEW_CATEGORY) cat = addCustomCategory(newCat, type).id;
    const mv: Movement = { id: movement?.id ?? newId('mv'), type, amount: amount!, categoryId: cat, date, note: note.trim() };
    updateProperty(property.id, (d) => {
      const i = d.movements.findIndex((x) => x.id === mv.id);
      if (i >= 0) d.movements[i] = mv;
      else d.movements.push(mv);
    });
    toast(movement ? 'Mouvement modifié' : `${type === 'income' ? 'Recette' : 'Dépense'} de ${eur2(mv.amount)} ajoutée`);
    onClose();
  };

  const duplicateNextMonth = () => {
    if (!movement) return;
    const copy: Movement = { ...movement, id: newId('mv'), date: addOneMonth(movement.date) };
    updateProperty(property.id, (dr) => void dr.movements.push(copy));
    toast(`Copié au ${dateFr(copy.date)}`);
    onClose();
  };

  const remove = async () => {
    if (!movement) return;
    if (
      await confirm({
        title: 'Supprimer ce mouvement ?',
        message: `${getCategory(movement.categoryId, custom).label} · ${eur2(movement.amount)}`,
        confirmLabel: 'Supprimer',
        danger: true,
      })
    ) {
      updateProperty(property.id, (d) => void (d.movements = d.movements.filter((x) => x.id !== movement.id)));
      toast('Mouvement supprimé');
      onClose();
    }
  };

  return (
    <Sheet
      open
      title={movement ? 'Modifier le mouvement' : 'Nouveau mouvement'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-primary wide" disabled={!valid} onClick={save}>
            {movement ? 'Enregistrer' : `Ajouter${amount ? ` ${eur(amount)}` : ''}`}
          </button>
          {movement && (
            <div className="sheet-secondary">
              <button className="btn btn-secondary" onClick={duplicateNextMonth}>
                <Icon name="copy" size={18} /> Copier au mois suivant
              </button>
              <button className="btn btn-secondary is-danger" onClick={remove}>
                <Icon name="trash" size={18} /> Supprimer
              </button>
            </div>
          )}
        </>
      }
    >
      <Segmented
        label="Type"
        value={type}
        onChange={(t) => {
          setType(t);
          setCategoryId('');
        }}
        options={[
          { value: 'expense', label: 'Dépense' },
          { value: 'income', label: 'Recette' },
        ]}
      />

      <div className={`amount-entry ${type === 'income' ? 'is-in' : 'is-out'}`}>
        <span className="amount-entry-sign" aria-hidden="true">
          {type === 'income' ? '+' : '−'}
        </span>
        <NumberInput big label="Montant" value={amount} onChange={setAmount} autoFocus={!movement} placeholder="0" />
      </div>

      <div className="field">
        <span>Catégorie</span>
        <div className="chip-grid" role="radiogroup" aria-label="Catégorie">
          {quick.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={categoryId === c.id}
              className={`cat-chip${categoryId === c.id ? ' on' : ''}`}
              onClick={() => choose(c.id)}
            >
              <Icon name={categoryIcon(c.id, c.group)} size={16} />
              {c.label}
            </button>
          ))}
        </div>
        <select
          className={`text-input select${!inQuick && categoryId ? ' has-value' : ''}`}
          aria-label="Autre catégorie"
          value={inQuick ? '' : categoryId}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Autre catégorie…</option>
          {(Object.keys(grouped) as CategoryGroup[]).map((g) => (
            <optgroup key={g} label={GROUP_LABEL[g]}>
              {grouped[g].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={NEW_CATEGORY}>+ Nouvelle catégorie…</option>
        </select>
      </div>
      {isRecoverableCategory(categoryId) && (
        <p className="note">Neutre : les charges récupérables transitent pour le compte du locataire. Elles n'augmentent ni votre résultat ni votre rentabilité.</p>
      )}
      {categoryId === NEW_CATEGORY && (
        <label className="field">
          <span>Nom de la nouvelle catégorie</span>
          <TextInput label="Nom de la nouvelle catégorie" value={newCat} onChange={setNewCat} maxLength={80} autoFocus />
        </label>
      )}
      <div className="field-row">
        <label className="field">
          <span>Date</span>
          <input type="date" className="text-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Note (facultatif)</span>
        <TextInput label="Note" value={note} onChange={setNote} placeholder="Ex. : Peinture du séjour" maxLength={300} />
      </label>
    </Sheet>
  );
}
