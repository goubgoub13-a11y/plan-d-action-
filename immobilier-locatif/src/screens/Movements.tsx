import { useMemo, useState } from 'react';
import { allCategories, getCategory, isRecoverableCategory, type Category, type CategoryGroup } from '../domain/categories';
import type { Movement, MovementType, Property } from '../domain/types';
import { addOneMonth, dateFr, eur, eur2, eurSigned, monthFr, todayIso } from '../lib/format';
import { newId } from '../lib/id';
import { useProperty, useStore } from '../state/store';
import { usePropertyMetrics } from '../state/useMetrics';
import { useDialogs } from '../ui/Dialogs';
import { NumberInput, Segmented, TextInput } from '../ui/Fields';
import { Icon, type IconName } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

const GROUP_ICON: Record<CategoryGroup, IconName> = {
  acquisition: 'key',
  operating: 'receipt',
  financing: 'bank',
  income: 'wallet',
  recoverable: 'receipt',
  custom: 'tag',
};

const GROUP_LABEL: Record<CategoryGroup, string> = {
  acquisition: 'Achat',
  operating: 'Charges',
  financing: 'Crédit',
  income: 'Recettes',
  recoverable: 'Charges récupérables (neutres)',
  custom: 'Mes catégories',
};

type Filter = 'all' | MovementType;

export function Movements() {
  const p = useProperty();
  const { data } = useStore();
  const { journal } = usePropertyMetrics(p);
  const custom = data.settings.customCategories;
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Movement | 'new' | null>(null);

  const groups = useMemo(() => {
    const list = p.movements
      .filter((m) => filter === 'all' || m.type === filter)
      .slice()
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    const byMonth = new Map<string, Movement[]>();
    for (const m of list) {
      const k = m.date.slice(0, 7);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(m);
    }
    return [...byMonth.entries()];
  }, [p.movements, filter]);

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>Mouvements</h1>
        <p className="muted">Le réalisé : ce que vous avez réellement payé et encaissé.</p>
      </header>

      <section className="card totals">
        <div>
          <span className="kpi-label">Payé</span>
          <strong>{eur(journal.spent)}</strong>
        </div>
        <div>
          <span className="kpi-label">Encaissé</span>
          <strong>{eur(journal.received)}</strong>
        </div>
        <div>
          <span className="kpi-label">Exploitation</span>
          <strong className={journal.operatingResult >= 0 ? 'pos' : 'neg'}>{eurSigned(journal.operatingResult)}</strong>
        </div>
      </section>

      {p.movements.length > 0 && (
        <Segmented
          label="Filtrer"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tout' },
            { value: 'expense', label: 'Dépenses' },
            { value: 'income', label: 'Recettes' },
          ]}
        />
      )}

      {p.movements.length === 0 ? (
        <section className="card empty-card">
          <Icon name="list" size={30} />
          <h2>Aucun mouvement</h2>
          <p className="muted">
            Notez chaque dépense et chaque loyer encaissé : frais de notaire, travaux, mensualités, taxe foncière, loyers…
            Ils alimentent le « réel » de votre projet.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> Premier mouvement
          </button>
        </section>
      ) : groups.length === 0 ? (
        <p className="muted center">Rien dans ce filtre.</p>
      ) : (
        groups.map(([month, items]) => (
          <section key={month} className="mv-group">
            <h2 className="mv-month">{monthFr(month)}</h2>
            <div className="card list">
              {items.map((m) => {
                const cat = getCategory(m.categoryId, custom);
                return (
                  <button key={m.id} className="mv-row" onClick={() => setEditing(m)}>
                    <span className={`mv-icon ${m.type}`}>
                      <Icon name={GROUP_ICON[cat.group]} size={19} />
                    </span>
                    <span className="mv-text">
                      <strong>{cat.label}</strong>
                      <span className="muted small">
                        {dateFr(m.date)}
                        {m.note && ` · ${m.note}`}
                      </span>
                    </span>
                    <span className={`mv-amount ${m.type === 'income' ? 'pos' : ''}`}>
                      {m.type === 'income' ? '+' : '−'}
                      {eur2(m.amount).replace('-', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      <p className="muted small center fab-spacer">
        « Exploitation » : recettes − dépenses courantes (crédit, charges, taxes…), hors achat. Les charges récupérables
        sont exclues des totaux : elles sont neutres.
      </p>

      <button className="fab" aria-label="Ajouter un mouvement" onClick={() => setEditing('new')}>
        <Icon name="plus" size={26} />
      </button>

      {editing && <MovementSheet key={editing === 'new' ? 'new' : editing.id} property={p} movement={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
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

  /** Montant suggéré pour les mouvements récurrents (loyer, mensualité, assurance). */
  const suggest = (id: string): number | null => {
    if (id === 'rent') return property.rental.rent.actual ?? property.rental.rent.planned;
    if (id === 'loanPayment') return actual.loan.payment || null;
    if (id === 'loanInsurance') return actual.loan.insuranceMonthly || null;
    return null;
  };

  const valid = amount !== null && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && categoryId !== '' && (categoryId !== NEW_CATEGORY || newCat.trim() !== '');

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
    toast(movement ? 'Mouvement modifié' : 'Mouvement ajouté');
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
    if (await confirm({ title: 'Supprimer ce mouvement ?', message: `${getCategory(movement.categoryId, custom).label} · ${eur2(movement.amount)}`, confirmLabel: 'Supprimer', danger: true })) {
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
            Enregistrer
          </button>
          {movement && (
            <div className="sheet-secondary">
              <button className="btn btn-ghost" onClick={duplicateNextMonth}>
                <Icon name="copy" size={18} /> Copier au mois suivant
              </button>
              <button className="btn btn-ghost danger" onClick={remove}>
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
      <div className="field">
        <span>Montant</span>
        <NumberInput big label="Montant" value={amount} onChange={setAmount} autoFocus={!movement} />
      </div>
      <label className="field">
        <span>Catégorie</span>
        <select
          className="text-input"
          value={categoryId}
          onChange={(e) => {
            const id = e.target.value;
            setCategoryId(id);
            const s = suggest(id);
            if (amount === null && s) setAmount(Math.round(s * 100) / 100);
          }}
        >
          <option value="" disabled>
            Choisir…
          </option>
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
      </label>
      {isRecoverableCategory(categoryId) && (
        <p className="field-hint">
          Neutre : les charges récupérables transitent pour le compte du locataire. Elles n'augmentent ni votre résultat ni
          votre rentabilité.
        </p>
      )}
      {categoryId === NEW_CATEGORY && (
        <label className="field">
          <span>Nom de la nouvelle catégorie</span>
          <TextInput label="Nom de la nouvelle catégorie" value={newCat} onChange={setNewCat} maxLength={80} autoFocus />
        </label>
      )}
      <label className="field">
        <span>Date</span>
        <input type="date" className="text-input" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="field">
        <span>Note (facultatif)</span>
        <TextInput label="Note" value={note} onChange={setNote} placeholder="Ex. : Peinture du séjour" maxLength={300} />
      </label>
    </Sheet>
  );
}
