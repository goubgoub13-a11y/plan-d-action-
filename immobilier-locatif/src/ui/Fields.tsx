import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { formatInput, parseDecimal, eurSigned, plain } from '../lib/format';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

/**
 * Champ numérique adapté au mobile : clavier décimal, virgule acceptée,
 * champ vide = « non renseigné » (null). Une saisie illisible n'efface jamais la valeur enregistrée.
 */
export function NumberInput({
  value,
  onChange,
  suffix = '€',
  placeholder,
  label,
  allowNegative = false,
  autoFocus,
  big,
  id,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
  label: string;
  allowNegative?: boolean;
  autoFocus?: boolean;
  big?: boolean;
  id?: string;
}) {
  // Hors saisie : « 60 000 » (séparateurs) ; relisible par parseDecimal.
  const [text, setText] = useState(() => formatInput(value));
  const [invalid, setInvalid] = useState(false);

  // Resynchronise si la valeur change ailleurs (import, calcul, autre champ lié).
  useEffect(() => {
    if (parseDecimal(text) !== value) {
      setText(formatInput(value));
      setInvalid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={`num-input${invalid ? ' is-invalid' : ''}${big ? ' is-big' : ''}`}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          const t = allowNegative ? e.target.value : e.target.value.replace('-', '');
          setText(t);
          if (t.trim() === '') {
            setInvalid(false);
            onChange(null);
            return;
          }
          const n = parseDecimal(t);
          setInvalid(n === null);
          if (n !== null) onChange(n);
        }}
        onBlur={() => {
          if (!invalid) setText(formatInput(value));
        }}
        onFocus={(e) => e.currentTarget.select()}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </div>
  );
}

export interface DualRowProps {
  label: string;
  hint?: ReactNode;
  planned: number | null;
  actual: number | null;
  onPlanned: (v: number | null) => void;
  onActual: (v: number | null) => void;
  showReal: boolean;
  suffix?: string;
  plannedPlaceholder?: string;
  actualPlaceholder?: string;
  actualHint?: ReactNode;
  /** Pour colorer l'écart : un coût plus élevé que prévu est défavorable. */
  higherIsBetter?: boolean;
  extra?: ReactNode;
}

/** Une ligne « Prévu / Réel » : la brique de base de tous les formulaires du projet. */
export function DualRow(p: DualRowProps) {
  const id = useId();
  const suffix = p.suffix ?? '€';
  const d = p.planned !== null && p.actual !== null ? p.actual - p.planned : null;
  const tone = d === null || Math.abs(d) < 0.005 ? '' : (d > 0) === !!p.higherIsBetter ? 'pos' : 'neg';
  return (
    <div className="dual-row">
      <div className="dual-label">
        <label htmlFor={`${id}-p`}>{p.label}</label>
        {p.hint && <span className="dual-hint">{p.hint}</span>}
      </div>
      <div className={`dual-inputs${p.showReal ? '' : ' single'}`}>
        <div>
          {p.showReal && <span className="mini-label">Prévu</span>}
          <NumberInput
            id={`${id}-p`}
            label={`${p.label} — prévu`}
            value={p.planned}
            onChange={p.onPlanned}
            suffix={suffix}
            placeholder={p.plannedPlaceholder ?? '—'}
          />
        </div>
        {p.showReal && (
          <div>
            <span className="mini-label real">Réel</span>
            <NumberInput
              label={`${p.label} — réel`}
              value={p.actual}
              onChange={p.onActual}
              suffix={suffix}
              placeholder={p.actualPlaceholder ?? 'à venir'}
            />
          </div>
        )}
      </div>
      {p.showReal && (p.actualHint || d !== null) && (
        <div className="dual-foot">
          {p.actualHint && <span className="muted">{p.actualHint}</span>}
          {d !== null && Math.abs(d) >= 0.005 && (
            <span className={`delta ${tone}`}>
              Écart {suffix === '€' ? eurSigned(d) : `${d > 0 ? '+' : ''}${plain(d)} ${suffix}`}
            </span>
          )}
        </div>
      )}
      {p.extra}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  small,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  small?: boolean;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      className={`segmented${small ? ' small' : ''}`}
      role="radiogroup"
      aria-label={label}
      style={{ '--seg-count': options.length, '--seg-index': idx } as CSSProperties}
    >
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bouton « i » qui ouvre une explication (formules, définitions). Pas d'infobulle : inutilisable au doigt. */
export function Info({ title, children, label }: { title: string; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={label ? 'link-btn' : 'info-btn'}
        aria-label={label ?? `Comment est calculé : ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {label ?? <Icon name="info" size={17} />}
      </button>
      <Sheet open={open} title={title} onClose={() => setOpen(false)}>
        <div className="prose">{children}</div>
      </Sheet>
    </>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <div className="formula">{children}</div>;
}

export function TextInput({
  value,
  onChange,
  label,
  placeholder,
  autoFocus,
  maxLength = 120,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  return (
    <input
      className="text-input"
      type="text"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
