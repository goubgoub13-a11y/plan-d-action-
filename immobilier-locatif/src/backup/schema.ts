/**
 * Validation stricte des données (sauvegardes importées et données relues en base).
 * Rien n'est supposé : tout fichier peut être corrompu, tronqué ou modifié à la main.
 * Les erreurs sont accumulées avec leur chemin (« biens[0].mouvements[3].montant »)
 * pour pouvoir afficher un message compréhensible.
 */
import {
  ACQUISITION_KEYS,
  FREQUENCIES,
  type Amount,
  type AppData,
  type ChargeItem,
  type CustomCategory,
  type Movement,
  type Property,
  type Settings,
} from '../domain/types';
import { emptyAmount, emptySettings, newProperty } from '../domain/factory';

const MAX_ABS = 1e9;
const MAX_TEXT = 500;

type Errors = string[];
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function str(o: Obj, key: string, path: string, errors: Errors, opts: { required?: boolean; max?: number } = {}): string {
  const v = o[key];
  if (v === undefined || v === null) {
    if (opts.required) errors.push(`${path}.${key} : texte manquant`);
    return '';
  }
  if (typeof v !== 'string') {
    errors.push(`${path}.${key} : texte attendu`);
    return '';
  }
  if (opts.required && v.trim() === '') errors.push(`${path}.${key} : texte vide`);
  if (v.length > (opts.max ?? MAX_TEXT)) errors.push(`${path}.${key} : texte trop long`);
  return v;
}

function numOrNull(v: unknown, path: string, errors: Errors): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${path} : nombre attendu`);
    return null;
  }
  if (Math.abs(v) > MAX_ABS) {
    errors.push(`${path} : valeur hors limites`);
    return null;
  }
  return v;
}

function num(o: Obj, key: string, path: string, errors: Errors, fallback = 0, min = -MAX_ABS, max = MAX_ABS): number {
  const v = o[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${path}.${key} : nombre attendu`);
    return fallback;
  }
  if (v < min || v > max) {
    errors.push(`${path}.${key} : valeur hors limites`);
    return fallback;
  }
  return v;
}

function dateOrNull(o: Obj, key: string, path: string, errors: Errors): string | null {
  const v = o[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || !validDate(v)) {
    errors.push(`${path}.${key} : date invalide (AAAA-MM-JJ attendu)`);
    return null;
  }
  return v;
}

function isoDate(o: Obj, key: string, path: string, errors: Errors, fallback: string): string {
  const v = o[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) {
    errors.push(`${path}.${key} : date invalide`);
    return fallback;
  }
  return v;
}

function amount(v: unknown, path: string, errors: Errors): Amount {
  if (v === undefined || v === null) return emptyAmount();
  if (!isObj(v)) {
    errors.push(`${path} : montant prévu/réel attendu`);
    return emptyAmount();
  }
  return {
    planned: numOrNull(v.planned, `${path}.planned`, errors),
    actual: numOrNull(v.actual, `${path}.actual`, errors),
  };
}

function readMovement(raw: unknown, path: string, errors: Errors): Movement | null {
  if (!isObj(raw)) {
    errors.push(`${path} : mouvement invalide`);
    return null;
  }
  const before = errors.length;
  const id = str(raw, 'id', path, errors, { required: true, max: 100 });
  const date = raw.date;
  if (typeof date !== 'string' || !validDate(date)) errors.push(`${path}.date : date invalide (AAAA-MM-JJ attendu)`);
  const type = raw.type;
  if (type !== 'expense' && type !== 'income') errors.push(`${path}.type : « expense » ou « income » attendu`);
  const amountVal = num(raw, 'amount', path, errors, 0, 0, MAX_ABS);
  if (typeof raw.amount !== 'number') errors.push(`${path}.amount : montant manquant`);
  const categoryId = str(raw, 'categoryId', path, errors, { required: true, max: 100 });
  const note = str(raw, 'note', path, errors);
  if (errors.length > before) return null;
  return { id, date: date as string, type: type as Movement['type'], amount: amountVal, categoryId, note };
}

function readCharge(raw: unknown, path: string, errors: Errors): ChargeItem | null {
  if (!isObj(raw)) {
    errors.push(`${path} : dépense invalide`);
    return null;
  }
  const before = errors.length;
  const id = str(raw, 'id', path, errors, { required: true, max: 100 });
  const label = str(raw, 'label', path, errors, { required: true });
  const frequency = raw.frequency;
  if (typeof frequency !== 'string' || !(FREQUENCIES as readonly string[]).includes(frequency)) {
    errors.push(`${path}.frequency : « once », « monthly » ou « yearly » attendu`);
  }
  const a = amount(raw.amount, `${path}.amount`, errors);
  const categoryId = typeof raw.categoryId === 'string' ? raw.categoryId : undefined;
  if (errors.length > before) return null;
  const item: ChargeItem = { id, label, frequency: frequency as ChargeItem['frequency'], amount: a };
  if (categoryId) item.categoryId = categoryId;
  return item;
}

export function readProperty(raw: unknown, path: string, errors: Errors): Property | null {
  if (!isObj(raw)) {
    errors.push(`${path} : bien invalide`);
    return null;
  }
  const before = errors.length;
  const base = newProperty('', new Date(0));
  const id = str(raw, 'id', path, errors, { required: true, max: 100 });
  const name = str(raw, 'name', path, errors, { required: true, max: 120 });
  const address = str(raw, 'address', path, errors);
  const phase = raw.phase === 'owned' ? 'owned' : raw.phase === 'project' || raw.phase === undefined ? 'project' : null;
  if (phase === null) errors.push(`${path}.phase : « project » ou « owned » attendu`);
  const purchaseDate = dateOrNull(raw, 'purchaseDate', path, errors);
  const nowIso = new Date().toISOString();
  const createdAt = isoDate(raw, 'createdAt', path, errors, nowIso);
  const updatedAt = isoDate(raw, 'updatedAt', path, errors, createdAt);

  // Rubriques d'achat : les clés absentes (version plus ancienne) sont créées vides.
  const acq = isObj(raw.acquisition) ? raw.acquisition : {};
  if (raw.acquisition !== undefined && !isObj(raw.acquisition)) errors.push(`${path}.acquisition : objet attendu`);
  const acquisition = { ...base.acquisition };
  for (const k of ACQUISITION_KEYS) acquisition[k] = amount(acq[k], `${path}.acquisition.${k}`, errors);

  const l = isObj(raw.loan) ? raw.loan : {};
  if (raw.loan !== undefined && !isObj(raw.loan)) errors.push(`${path}.loan : objet attendu`);
  const loan = {
    borrowed: amount(l.borrowed, `${path}.loan.borrowed`, errors),
    ratePct: amount(l.ratePct, `${path}.loan.ratePct`, errors),
    durationMonths: amount(l.durationMonths, `${path}.loan.durationMonths`, errors),
    monthlyPayment: amount(l.monthlyPayment, `${path}.loan.monthlyPayment`, errors),
    insuranceMonthly: amount(l.insuranceMonthly, `${path}.loan.insuranceMonthly`, errors),
  };

  const r = isObj(raw.rental) ? raw.rental : {};
  if (raw.rental !== undefined && !isObj(raw.rental)) errors.push(`${path}.rental : objet attendu`);
  const rental = {
    rent: amount(r.rent, `${path}.rental.rent`, errors),
    recoverableCharges: amount(r.recoverableCharges, `${path}.rental.recoverableCharges`, errors),
    startDate: dateOrNull(r, 'startDate', `${path}.rental`, errors),
    vacancyMonthsPerYear: num(r, 'vacancyMonthsPerYear', `${path}.rental`, errors, 0, 0, 12),
    unpaidPct: num(r, 'unpaidPct', `${path}.rental`, errors, 0, 0, 100),
  };

  const charges: ChargeItem[] = [];
  if (raw.charges !== undefined && !Array.isArray(raw.charges)) errors.push(`${path}.charges : liste attendue`);
  (Array.isArray(raw.charges) ? raw.charges : []).forEach((c, i) => {
    const item = readCharge(c, `${path}.charges[${i}]`, errors);
    if (item) charges.push(item);
  });

  const movements: Movement[] = [];
  if (raw.movements !== undefined && !Array.isArray(raw.movements)) errors.push(`${path}.movements : liste attendue`);
  (Array.isArray(raw.movements) ? raw.movements : []).forEach((m, i) => {
    const mv = readMovement(m, `${path}.movements[${i}]`, errors);
    if (mv) movements.push(mv);
  });

  if (errors.length > before || phase === null) return null;
  return {
    id,
    name,
    address,
    phase,
    purchaseDate,
    createdAt,
    updatedAt,
    acquisition,
    loan,
    rental,
    charges,
    movements,
  };
}

export function readSettings(raw: unknown, path: string, errors: Errors): Settings {
  if (raw === undefined || raw === null) return emptySettings();
  if (!isObj(raw)) {
    errors.push(`${path} : réglages invalides`);
    return emptySettings();
  }
  const customCategories: CustomCategory[] = [];
  if (raw.customCategories !== undefined && !Array.isArray(raw.customCategories)) {
    errors.push(`${path}.customCategories : liste attendue`);
  }
  (Array.isArray(raw.customCategories) ? raw.customCategories : []).forEach((c, i) => {
    const p = `${path}.customCategories[${i}]`;
    if (!isObj(c)) {
      errors.push(`${p} : catégorie invalide`);
      return;
    }
    const before = errors.length;
    const id = str(c, 'id', p, errors, { required: true, max: 100 });
    const label = str(c, 'label', p, errors, { required: true, max: 80 });
    if (c.kind !== 'expense' && c.kind !== 'income') errors.push(`${p}.kind : « expense » ou « income » attendu`);
    if (errors.length === before) customCategories.push({ id, label, kind: c.kind as CustomCategory['kind'] });
  });
  const active = typeof raw.activePropertyId === 'string' ? raw.activePropertyId : null;
  let lastBackupAt: string | null = null;
  if (typeof raw.lastBackupAt === 'string' && !Number.isNaN(Date.parse(raw.lastBackupAt))) {
    lastBackupAt = raw.lastBackupAt;
  }
  return { activePropertyId: active, customCategories, lastBackupAt };
}

/** Lecture tolérante pour les données déjà en base : `null` si le bien est inutilisable. */
export function normalizeProperty(raw: unknown): Property | null {
  const errors: Errors = [];
  const p = readProperty(raw, 'bien', errors);
  if (!p && typeof console !== 'undefined') console.warn('Bien ignoré (données invalides)', errors);
  return p;
}

export function normalizeSettings(raw: unknown): Settings {
  return readSettings(raw, 'réglages', []);
}

export function readAppData(raw: unknown, errors: Errors): AppData | null {
  if (!isObj(raw)) {
    errors.push('data : objet attendu');
    return null;
  }
  if (!Array.isArray(raw.properties)) {
    errors.push('data.properties : liste de biens attendue');
    return null;
  }
  const properties: Property[] = [];
  const seen = new Set<string>();
  raw.properties.forEach((p, i) => {
    const prop = readProperty(p, `biens[${i}]`, errors);
    if (!prop) return;
    if (seen.has(prop.id)) errors.push(`biens[${i}].id : identifiant en double`);
    seen.add(prop.id);
    properties.push(prop);
  });
  properties.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const settings = readSettings(raw.settings, 'réglages', errors);
  if (settings.activePropertyId && !seen.has(settings.activePropertyId)) {
    settings.activePropertyId = properties[0]?.id ?? null;
  }
  if (!settings.activePropertyId) settings.activePropertyId = properties[0]?.id ?? null;
  return errors.length ? null : { properties, settings };
}
