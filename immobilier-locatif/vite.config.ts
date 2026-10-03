import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import pkg from './package.json' with { type: 'json' };

const PUBLIC_DIR = join(import.meta.dirname, 'public');

function publicFiles(dir = PUBLIC_DIR): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? publicFiles(full) : [relative(PUBLIC_DIR, full).split(sep).join('/')];
  });
}

/** Échoue le build si une icône déclarée dans le manifeste n'existe pas dans public/. */
function checkManifestIcons(): void {
  const manifest = JSON.parse(readFileSync(join(PUBLIC_DIR, 'manifest.webmanifest'), 'utf8')) as { icons: { src: string }[] };
  for (const icon of manifest.icons) {
    if (!existsSync(join(PUBLIC_DIR, icon.src))) throw new Error(`Icône du manifeste introuvable : ${icon.src}`);
  }
}

/**
 * Service worker minimal et sans dépendance : précache tous les fichiers
 * produits par le build pour que l'application fonctionne hors connexion.
 * Aucun appel réseau n'est effectué hors fichiers de l'application elle-même.
 */
function offlineServiceWorker(): Plugin {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => f !== 'sw.js');
      // Tous les fichiers de public/ (manifeste, icônes…) : la liste ne peut plus se désynchroniser.
      files.push(...publicFiles());
      checkManifestIcons();
      const hash = createHash('sha256').update(files.join('|') + pkg.version)
        .update(Object.values(bundle).map((b) => ('code' in b ? b.code : String(b.source))).join(''))
        .digest('hex').slice(0, 10);
      const source = `/* Généré au build — ne pas modifier */
const CACHE = 'immo-${pkg.version}-${hash}';
const FILES = ${JSON.stringify(['./', ...files])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (e.request.mode === 'navigate') return caches.match('./');
      return fetch(e.request);
    })
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/**
 * Politique de sécurité du contenu : l'application ne peut charger que ses propres fichiers
 * et ne peut contacter aucun serveur externe. Ajoutée au build seulement (le serveur de
 * développement de Vite a besoin de scripts inline).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

export default defineConfig({
  base: './',
  // JSX compilé nativement par Vite (runtime automatique, cf. tsconfig) : pas de plugin React nécessaire.
  plugins: [offlineServiceWorker(), contentSecurityPolicy()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
