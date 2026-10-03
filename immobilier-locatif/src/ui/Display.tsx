/**
 * Composants d'affichage du design system (v1.1.0). Purement présentatifs :
 * ils reçoivent des nombres déjà calculés par src/calc et ne calculent rien.
 */
import type { ReactNode } from 'react';
import { moneyParts, pctParts, type Parts } from '../lib/format';
import { Icon, type IconName } from './Icon';

type Size = 'display' | 'xl' | 'lg' | 'md';

function Figure({ parts, size, tone, label }: { parts: Parts; size: Size; tone?: Tone; label?: string }) {
  const text = `${parts.sign}${parts.number}${parts.unit ? ` ${parts.unit}` : ''}`;
  return (
    <span className={`fig fig-${size}${tone ? ` tone-${tone}` : ''}`} aria-label={label ? `${label} : ${text}` : undefined}>
      <span className="fig-num" aria-hidden={label ? true : undefined}>
        {parts.sign && <span className="fig-sign">{parts.sign}</span>}
        {parts.number}
      </span>
      {parts.unit && (
        <span className="fig-unit" aria-hidden={label ? true : undefined}>
          {parts.unit}
        </span>
      )}
    </span>
  );
}

export type Tone = 'pos' | 'neg' | 'muted';

/** Montant : grand nombre, petit « € ». */
export function Amount({
  value,
  size = 'lg',
  signed,
  decimals,
  tone,
  label,
}: {
  value: number;
  size?: Size;
  signed?: boolean;
  decimals?: 0 | 2;
  tone?: Tone;
  label?: string;
}) {
  return <Figure parts={moneyParts(value, { signed, decimals })} size={size} tone={tone} label={label} />;
}

export function Percent({ value, size = 'lg', tone }: { value: number | null; size?: Size; tone?: Tone }) {
  return <Figure parts={pctParts(value)} size={size} tone={tone} />;
}

/** Carte indicateur : libellé, valeur, unité, ligne secondaire. */
export function Stat({
  label,
  children,
  unit,
  sub,
  estimated,
  onClick,
  accent,
}: {
  label: string;
  children: ReactNode;
  unit?: string;
  sub?: ReactNode;
  estimated?: boolean;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <button type="button" className={`stat${accent ? ' stat-accent' : ''}`} onClick={onClick}>
      <span className="stat-label">
        {label}
        {estimated && <i className="estimated-dot" title="Contient des montants encore prévus" aria-label="en partie prévu" />}
      </span>
      <span className="stat-value">{children}</span>
      {unit && <span className="stat-unit">{unit}</span>}
      {sub && <span className="stat-sub">{sub}</span>}
    </button>
  );
}

/** Section de contenu : titre, valeur principale éventuelle, action. */
export function Section({
  title,
  icon,
  headline,
  headlineUnit,
  action,
  children,
  className,
  id,
}: {
  title: string;
  icon?: IconName;
  headline?: ReactNode;
  headlineUnit?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`section${className ? ` ${className}` : ''}`} id={id} aria-label={title}>
      <header className="section-head">
        <div className="section-title">
          {icon && (
            <span className="section-icon" aria-hidden="true">
              <Icon name={icon} size={18} />
            </span>
          )}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {headline !== undefined && (
        <div className="section-headline">
          {headline}
          {headlineUnit && <span className="headline-unit">{headlineUnit}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Ligne libellé / valeur, avec aide sous le libellé et précision sous la valeur. Touchable si `onClick`. */
export function Line({
  label,
  hint,
  value,
  secondary,
  tone,
  strong,
  indent,
  onClick,
}: {
  label: ReactNode;
  /** Précision sous le libellé (texte long). */
  hint?: ReactNode;
  value: ReactNode;
  /** Précision courte sous la valeur (ex. « prévu 4 600 € »). */
  secondary?: ReactNode;
  tone?: Tone;
  strong?: boolean;
  indent?: boolean;
  /** Rend la ligne touchable (ouvre la saisie du champ). */
  onClick?: () => void;
}) {
  const cls = `line${strong ? ' line-strong' : ''}${indent ? ' line-indent' : ''}${onClick ? ' line-tap' : ''}`;
  const content = (
    <>
      <span className="line-label">
        {label}
        {hint && <span className="line-hint">{hint}</span>}
      </span>
      <span className="line-values">
        <span className={`line-value${tone ? ` tone-${tone}` : ''}`}>{value}</span>
        {secondary && <span className="line-secondary">{secondary}</span>}
      </span>
      {onClick && <Icon name="chevron" size={16} className="line-chevron" />}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

/** Écart signé, sur fond doux ; le sens (+/−) reste lisible sans la couleur. */
export function DeltaPill({ children, tone }: { children: ReactNode; tone?: Tone }) {
  return <span className={`delta-pill${tone ? ` tone-${tone}` : ''}`}>{children}</span>;
}

/** Barre horizontale empilée (proportions simples), avec légende lisible. */
export function StackBar({ parts, label }: { parts: { value: number; label: string; tone: 'a' | 'b' | 'c' | 'd' }[]; label: string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div className="stackbar">
      <div className="stackbar-track" role="img" aria-label={label}>
        {total > 0 &&
          parts.map((p) =>
            p.value > 0 ? <span key={p.label} className={`stackbar-seg seg-${p.tone}`} style={{ width: `${(p.value / total) * 100}%` }} /> : null,
          )}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: ReactNode; tone: 'a' | 'b' | 'c' | 'd' }[] }) {
  return (
    <div className="legend">
      {items.map((it, i) => (
        <span key={i}>
          <i className={`legend-dot seg-${it.tone}`} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
