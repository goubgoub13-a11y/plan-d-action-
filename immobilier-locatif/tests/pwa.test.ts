import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

describe('PWA : cohérence manifeste / fichiers publics / service worker', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));

  it('chaque icône du manifeste existe dans public/ (dont l’icône maskable)', () => {
    const srcs: string[] = manifest.icons.map((i: { src: string }) => i.src);
    expect(srcs).toContain('icons/icon-maskable-512.png');
    for (const src of srcs) expect(existsSync(new URL(`public/${src}`, root)), src).toBe(true);
  });

  it('le manifeste est relatif (fonctionne dans un sous-dossier) et autonome', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
  });

  it('les ressources référencées par index.html existent', () => {
    const html = read('index.html');
    for (const ref of ['icon.svg', 'icons/apple-touch-icon.png', 'manifest.webmanifest']) {
      expect(html).toContain(`./${ref}`);
      expect(existsSync(new URL(`public/${ref}`, root)), ref).toBe(true);
    }
  });

  it('le service worker précache tout le dossier public/ (liste non codée en dur)', () => {
    const config = read('vite.config.ts');
    expect(config).toContain('files.push(...publicFiles())');
    expect(config).toContain('checkManifestIcons()');
  });
});
