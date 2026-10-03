import { describe, expect, it } from 'vitest';
import { addOneMonth, dateFr, durationLabel, eur, eurSigned, parseDecimal, pctFmt, todayIso, toInputText } from '../src/lib/format';

const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('formats', () => {
  it('formate les euros à la française', () => {
    expect(norm(eur(72500))).toBe('72 500 €');
    expect(norm(eur(-0.2))).toBe('0 €');
    expect(norm(eurSigned(82))).toBe('+82 €');
    expect(norm(eurSigned(-40))).toBe('−40 €');
    expect(norm(eurSigned(0))).toBe('0 €');
  });

  it('formate les pourcentages, « — » si indéfini', () => {
    expect(norm(pctFmt(7.14))).toBe('7,1 %');
    expect(norm(pctFmt(-12.28))).toBe('−12,3 %');
    expect(norm(pctFmt(-0.01))).toBe('0,0 %');
    expect(pctFmt(null)).toBe('—');
    expect(pctFmt(NaN)).toBe('—');
  });

  it('lit les saisies françaises ou anglaises', () => {
    expect(parseDecimal('1 200,50')).toBe(1200.5);
    expect(parseDecimal('1200.5')).toBe(1200.5);
    expect(parseDecimal(' 12 € ')).toBe(12);
    expect(parseDecimal('3,7 %')).toBe(3.7);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('-5')).toBe(-5);
  });

  it('restitue un nombre dans un champ', () => {
    expect(toInputText(1200.5)).toBe('1200,5');
    expect(toInputText(null)).toBe('');
    expect(toInputText(0)).toBe('0');
  });

  it('formate les dates et durées', () => {
    expect(dateFr('2026-10-18')).toBe('18 oct. 2026');
    expect(dateFr('2026-05-05')).toBe('5 mai 2026');
    expect(todayIso(new Date(2026, 9, 3))).toBe('2026-10-03');
    expect(durationLabel(300)).toBe('25 ans');
    expect(durationLabel(18)).toBe('1 an 6 mois');
    expect(durationLabel(0)).toBe('—');
  });

  it('ajoute un mois en restant dans le mois suivant', () => {
    expect(addOneMonth('2026-10-05')).toBe('2026-11-05');
    expect(addOneMonth('2026-01-31')).toBe('2026-02-28');
    expect(addOneMonth('2028-01-31')).toBe('2028-02-29');
    expect(addOneMonth('2026-12-15')).toBe('2027-01-15');
  });
});
