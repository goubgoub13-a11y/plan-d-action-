import { newId } from '../lib/id';
import { ACQUISITION_KEYS, type AcquisitionKey, type Amount, type AppData, type Movement, type Property, type Settings } from './types';
import { DEFAULT_CHARGE_CATEGORIES } from './categories';

export const emptyAmount = (): Amount => ({ planned: null, actual: null });
const amt = (planned: number | null, actual: number | null = null): Amount => ({ planned, actual });

export function emptySettings(): Settings {
  return { activePropertyId: null, customCategories: [], lastBackupAt: null };
}

export function emptyData(): AppData {
  return { properties: [], settings: emptySettings() };
}

export function newProperty(name = 'Mon appartement', now = new Date()): Property {
  const iso = now.toISOString();
  const acquisition = {} as Record<AcquisitionKey, Amount>;
  for (const k of ACQUISITION_KEYS) acquisition[k] = emptyAmount();
  return {
    id: newId('bien'),
    name,
    address: '',
    phase: 'project',
    purchaseDate: null,
    createdAt: iso,
    updatedAt: iso,
    acquisition,
    loan: {
      borrowed: emptyAmount(),
      ratePct: emptyAmount(),
      durationMonths: emptyAmount(),
      monthlyPayment: emptyAmount(),
      insuranceMonthly: emptyAmount(),
    },
    rental: {
      rent: emptyAmount(),
      recoverableCharges: emptyAmount(),
      startDate: null,
      vacancyMonthsPerYear: 0,
      unpaidPct: 0,
    },
    charges: DEFAULT_CHARGE_CATEGORIES.map((c) => ({
      id: newId('ch'),
      label: c.label,
      frequency: c.frequency,
      amount: emptyAmount(),
      categoryId: c.id,
    })),
    movements: [],
  };
}

/** Bien d'exemple (Saint-Étienne) : projet déjà en partie réalisé, pour découvrir l'application. */
export function sampleProperty(now = new Date()): Property {
  const p = newProperty('Appartement Saint-Étienne', now);
  p.address = 'Saint-Étienne (42)';
  p.phase = 'owned';
  p.purchaseDate = '2026-09-15';
  p.acquisition.price = amt(60000, 60000);
  p.acquisition.notary = amt(4600, 4780);
  p.acquisition.loanFees = amt(600, 600);
  p.acquisition.guarantee = amt(800, 810);
  p.acquisition.broker = amt(600, 600);
  p.acquisition.works = amt(5000, null);
  p.acquisition.furniture = amt(900, null);
  p.loan = {
    borrowed: amt(67650, 67650),
    ratePct: amt(3.7, 3.7),
    durationMonths: amt(300, 300),
    monthlyPayment: amt(null, 346.1),
    insuranceMonthly: amt(19, 19.5),
  };
  p.rental = {
    rent: amt(580, 560),
    recoverableCharges: amt(40, 40),
    startDate: '2026-11-01',
    vacancyMonthsPerYear: 1,
    unpaidPct: 0,
  };
  const set = (categoryId: string, planned: number, actual: number | null = null) => {
    const c = p.charges.find((x) => x.categoryId === categoryId);
    if (c) c.amount = amt(planned, actual);
  };
  set('propertyTax', 600, 640);
  set('pno', 130);
  set('maintenance', 300);
  const mv = (date: string, type: Movement['type'], categoryId: string, amount: number, note = ''): Movement => ({
    id: newId('mv'),
    date,
    type,
    categoryId,
    amount,
    note,
  });
  p.movements = [
    mv('2026-09-15', 'expense', 'price', 60000, 'Acte de vente'),
    mv('2026-09-15', 'expense', 'notary', 4780),
    mv('2026-10-18', 'expense', 'works', 620, 'Peinture'),
    mv('2026-11-05', 'income', 'rent', 560, 'Premier loyer'),
    mv('2026-11-05', 'expense', 'loanPayment', 346.1),
    mv('2026-11-05', 'expense', 'loanInsurance', 19.5),
  ];
  return p;
}

export function sampleData(now = new Date()): AppData {
  const p = sampleProperty(now);
  return { properties: [p], settings: { ...emptySettings(), activePropertyId: p.id } };
}
