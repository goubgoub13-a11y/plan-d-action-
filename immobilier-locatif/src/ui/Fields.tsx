import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { formatInput, parseDecimal } from '../lib/format';
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
  field,
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
  /** Grand champ d'une saisie champ par champ. */
  field?: boolean;
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
    <div className={`num-input${invalid ? ' is-invalid' : ''}${big ? ' is-big' : ''}${field ? ' is-field' : ''}`}>
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
