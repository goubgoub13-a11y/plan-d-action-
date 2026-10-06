import { newProperty } from '../src/domain/factory';
import type { AcquisitionKey, Amount, Movement, Property } from '../src/domain/types';

export const A = (planned: number | null, actual: number | null = null): Amount => ({ planned, actual });

/** Bien vierge (aucune donnée) avec une date fixe, puis personnalisé par `edit`. */
export function makeProperty(edit?: (p: Property) => void): Property {
  const p = newProperty('Test', new Date('2026-01-01T00:00:00Z'));
  edit?.(p);
  return p;
}

export function setAcq(p: Property, key: AcquisitionKey, planned: number | null, actual: number | null = null) {
  p.acquisition[key] = A(planned, actual);
}

export function setCharge(p: Property, categoryId: string, planned: number | null, actual: number | null = null) {
  const c = p.charges.find((x) => x.categoryId === categoryId);
  if (!c) throw new Error(`rubrique inconnue ${categoryId}`);
  c.amount = A(planned, actual);
}

let n = 0;
export function mv(
  type: Movement['type'],
  categoryId: string,
  amount: number,
  date = '2026-10-01',
  note = '',
): Movement {
  return { id: `m${++n}`, type, categoryId, amount, date, note };
}

/** Projet de référence : 100 000 € de coût, 90 000 € empruntés. */
export function referenceProperty(): Property {
  return makeProperty((p) => {
    setAcq(p, 'price', 80000);
    setAcq(p, 'notary', 6400);
    setAcq(p, 'agency', 3600);
    setAcq(p, 'works', 8000);
    setAcq(p, 'furniture', 2000);
    p.loan.borrowed = A(90000);
    p.loan.ratePct = A(3);
    p.loan.durationMonths = A(240);
    p.loan.insuranceMonthly = A(25);
    p.rental.rent = A(600);
    p.rental.recoverableCharges = A(50);
    setCharge(p, 'propertyTax', 900); // annuelle → 75 €/mois
    setCharge(p, 'coproNonRecoverable', 30); // mensuelle
  });
}
