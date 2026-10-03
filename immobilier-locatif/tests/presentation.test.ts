import { describe, expect, it } from 'vitest';
import { dayLabel, formatInput, moneyParts, parseDecimal, pctParts } from '../src/lib/format';

const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('présentation des montants (v1.1.0)', () => {
  it('formatInput affiche les milliers et reste relisible par parseDecimal (aller-retour exact)', () => {
    for (const n of [0, 60000, 72500.5, 3.7, 1234567.89, 0.1]) {
      expect(parseDecimal(formatInput(n))).toBe(n);
    }
    expect(norm(formatInput(60000))).toBe('60 000');
    expect(formatInput(3.7)).toBe('3,7');
    expect(formatInput(null)).toBe('');
  });

  it('moneyParts sépare signe, nombre et devise', () => {
    expect(moneyParts(82, { signed: true })).toEqual({ sign: '+', number: '82', unit: '€' });
    expect(moneyParts(-153.48, { signed: true }).sign).toBe('−');
    expect(moneyParts(-153.48, { signed: true }).number).toBe('153');
    expect(norm(moneyParts(72500).number)).toBe('72 500');
    expect(moneyParts(346.1, { decimals: 2 }).number).toBe('346,10');
    expect(moneyParts(0, { signed: true }).sign).toBe('');
    expect(moneyParts(-0.2, { signed: true })).toEqual({ sign: '', number: '0', unit: '€' });
  });

  it('pctParts : « — » si non calculable, signe typographique', () => {
    expect(pctParts(7.14)).toEqual({ sign: '', number: '7,1', unit: '%' });
    expect(pctParts(-12.28)).toEqual({ sign: '−', number: '12,3', unit: '%' });
    expect(pctParts(null).number).toBe('—');
  });

  it('dayLabel : jour en toutes lettres, année seulement si différente', () => {
    const now = new Date(2026, 9, 3);
    expect(dayLabel('2026-11-05', now)).toBe('5 novembre');
    expect(dayLabel('2025-02-01', now)).toBe('1 février 2025');
  });
});
