import { describe, expect, it } from 'vitest';
import { contrast, DEFAULT_APPEARANCE, palette, PALETTES, readAppearance } from '../src/ui/palette';

describe('préférences et contraste des thèmes', () => {
  it('récupère les préférences valides sans étendre le modèle financier', () => {
    expect(readAppearance('{"mode":"dark","accent":"#ABCDEF"}')).toEqual({ mode: 'dark', accent: '#abcdef' });
  });
  it.each([null, 'null', '[]', 'false', '{', '{"mode":"wrong","accent":"url(evil)"}'])('supporte une préférence absente ou corrompue : %s', raw => {
    expect(readAppearance(raw)).toEqual(DEFAULT_APPEARANCE);
  });
  for (const mode of [false, true]) {
    it.each([...PALETTES.map(p => p.color), '#ffffff', '#000000', '#ffff00', '#ff0000', '#00ff00', '#0000ff'])('garantit les contrastes en mode ' + (mode ? 'sombre' : 'clair') + ' : %s', color => {
      const p = palette(color, mode);
      const surface = mode ? '#171e24' : '#ffffff';
      expect(contrast(p['--brand'], surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p['--brand'], p['--brand-soft'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p['--brand'], p['--on-brand'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#f3f7f5', p['--hero-from'])).toBeGreaterThanOrEqual(4.5);
    });
  }
});
