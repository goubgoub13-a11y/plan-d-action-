const eurFmt0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurFmt2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Évite « -0 € ». */
const clean = (n: number) => (Object.is(n, -0) || Math.abs(n) < 0.005 ? 0 : n);

/** 72 500 € — arrondi à l'euro (affichage). */
export function eur(n: number): string {
  return eurFmt0.format(clean(Math.round(n)));
}

/** Montant arrondi, ou un texte de remplacement quand il n'est pas calculable (null). */
export function eurOrDash(n: number | null, dash = '—'): string {
  return n === null ? dash : eur(n);
}

/** 346,10 € — avec les centimes (mensualités). */
export function eur2(n: number): string {
  return eurFmt2.format(clean(n));
}

/** +82 € / −40 € : toujours signé. */
export function eurSigned(n: number): string {
  const v = clean(Math.round(n));
  return (v > 0 ? '+' : '') + eurFmt0.format(v).replace('-', '−');
}

export function eurSigned2(n: number): string {
  const v = clean(n);
  return (v > 0 ? '+' : '') + eurFmt2.format(v).replace('-', '−');
}

/** 7,1 % ; « — » quand l'indicateur n'est pas calculable. */
export function pctFmt(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const v = clean(Number(n.toFixed(digits)));
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`.replace('-', '−');
}

export function pctSigned(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const s = pctFmt(n, digits);
  return n > 0 && !s.startsWith('0,0') ? `+${s}` : s;
}

export function plain(n: number): string {
  return numFmt.format(n);
}

/**
 * Lit une saisie à la française : « 1 200,50 », « 1200.5 », « 12 € ».
 * Renvoie null pour une saisie vide ou illisible.
 */
export function parseDecimal(text: string): number | null {
  const cleaned = text
    .replace(/[\s  ]/g, '')
    .replace(/[€%]/g, '')
    .replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Texte à afficher dans un champ pour une valeur numérique (sans séparateur de milliers). */
export function toInputText(n: number | null): string {
  if (n === null) return '';
  return String(Math.round(n * 1e6) / 1e6).replace('.', ',');
}

const SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** 2026-10-18 → « 18 oct. 2026 » */
export function dateFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${SHORT[m - 1]} ${y}`;
}

/** 2026-10 → « octobre 2026 » */
export function monthFr(isoDateOrMonth: string): string {
  const [y, m] = isoDateOrMonth.split('-').map(Number);
  if (!y || !m) return isoDateOrMonth;
  return `${MONTHS[m - 1]} ${y}`;
}

/** Date locale du jour au format AAAA-MM-JJ. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysSince(iso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
}

export function durationLabel(months: number): string {
  if (months <= 0) return '—';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mois`;
  return m === 0 ? `${y} an${y > 1 ? 's' : ''}` : `${y} an${y > 1 ? 's' : ''} ${m} mois`;
}

/** Même jour le mois suivant, ramené au dernier jour du mois si besoin (31 janv. → 28/29 févr.). */
export function addOneMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const daysInNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, daysInNext))).toISOString().slice(0, 10);
}

/* ───────── v1.1.0 : présentation (aucun impact sur les calculs) ───────── */

const groupFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

/** Valeur affichée dans un champ hors saisie : « 60 000 », « 3,7 ». Relisible par parseDecimal. */
export function formatInput(n: number | null): string {
  if (n === null) return '';
  return groupFmt.format(Math.round(n * 100) / 100);
}

export interface Parts {
  /** « + », « − » ou vide. */
  sign: string;
  /** Nombre formaté sans signe ni unité : « 72 500 », « 346,10 », « 7,1 ». */
  number: string;
  unit: string;
}

/** Montant découpé pour une typographie soignée : grand nombre, petit « € ». */
export function moneyParts(n: number, opts: { signed?: boolean; decimals?: 0 | 2 } = {}): Parts {
  const decimals = opts.decimals ?? 0;
  const v = clean(decimals === 0 ? Math.round(n) : Math.round(n * 100) / 100);
  const number = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(v));
  const sign = v < 0 ? '−' : opts.signed && v > 0 ? '+' : '';
  return { sign, number, unit: '€' };
}

/** Pourcentage découpé ; « — » si non calculable. */
export function pctParts(n: number | null, digits = 1): Parts {
  if (n === null || !Number.isFinite(n)) return { sign: '', number: '—', unit: '' };
  const v = clean(Number(n.toFixed(digits)));
  return {
    sign: v < 0 ? '−' : '',
    number: Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    unit: '%',
  };
}

/** En-tête de jour dans une liste : « 5 novembre », ou « 5 novembre 2025 » hors année courante. */
export function dayLabel(iso: string, now = new Date()): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return y === now.getFullYear() ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}
