/** Préférences visuelles locales, indépendantes du modèle financier et des sauvegardes. */
export type Mode = 'system' | 'light' | 'dark';
export interface Appearance { mode: Mode; accent: string; }
export const APPEARANCE_KEY = 'immo-appearance-v1';
export const DEFAULT_APPEARANCE: Appearance = { mode: 'system', accent: '#287564' };
export const PALETTES = [
  { name: 'Jade', color: '#287564' },
  { name: 'Cobalt', color: '#4268b0' },
  { name: 'Iris', color: '#7b61a3' },
  { name: 'Cuivre', color: '#986244' },
  { name: 'Rose', color: '#a44e6a' },
  { name: 'Graphite', color: '#586572' },
];
export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
export function readAppearance(raw: string | null): Appearance {
  try {
    const a = JSON.parse(raw ?? '{}');
    return { mode: ['system', 'light', 'dark'].includes(a?.mode) ? a.mode : 'system',
      accent: isHex(a?.accent) ? a.accent.toLowerCase() : DEFAULT_APPEARANCE.accent };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}
const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
export function mix(a: string, b: string, weight: number): string {
  const x = rgb(a), y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v * (1 - weight) + y[i] * weight).toString(16).padStart(2, '0')).join('');
}
function luminance(c: string): number {
  const v = rgb(c).map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return v[0] * .2126 + v[1] * .7152 + v[2] * .0722;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
/** Ajuste les couleurs trop pâles/sombres pour maintenir le contraste du texte. */
export function palette(accent: string, dark: boolean): Record<string, string> {
  const base = isHex(accent) ? accent : DEFAULT_APPEARANCE.accent;
  const surface = dark ? '#171e24' : '#ffffff';
  const soft = mix(base, surface, dark ? .84 : .91);
  const on = dark ? '#0e151b' : '#ffffff';
  let brand = base;
  for (let i = 0; i < 100 && Math.min(contrast(brand, surface), contrast(brand, soft), contrast(brand, on)) < 4.8; i++) {
    brand = mix(brand, dark ? '#ffffff' : '#000000', .06);
  }
  const hero = mix(base, '#0c171f', .82);
  return { '--brand': brand, '--brand-strong': mix(brand, dark ? '#ffffff' : '#000000', .12),
    '--brand-soft': soft, '--on-brand': on, '--halo': mix(base, surface, .82),
    '--hero-from': mix(base, '#192730', .73), '--hero-to': hero,
    '--hero-in': mix(base, '#ffffff', .68), '--data-a': brand,
    '--data-b': mix(brand, surface, .25), '--data-c': mix(brand, surface, .55),
    '--data-d': dark ? '#b9a685' : '#b4a38a' };
}
