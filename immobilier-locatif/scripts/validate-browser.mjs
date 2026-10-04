/** Validation sur la version compilée. Voir docs/VALIDATION-V1.3.md pour lancer ce script. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const require = createRequire(process.env.QA_MODULES ? join(resolve(process.env.QA_MODULES), 'qa.cjs') : import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const url = process.env.QA_URL ?? 'http://127.0.0.1:4173';
const screenshots = resolve('docs/screenshots');
mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.QA_CHANNEL ? { channel: process.env.QA_CHANNEL } : {}) });
const report = { browser: browser.version(), url, checks: [], screenshots: [], accessibility: [], errors: [], externalRequests: [] };
function check(name, value) { assert.ok(value, name); report.checks.push(name); }
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', timezoneId: 'Europe/Paris' });
const page = await context.newPage();
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', r => { if (r.url().startsWith('http') && new URL(r.url()).origin !== new URL(url).origin) report.externalRequests.push(r.url()); });
const nav = async (tab, pg = page) => { await pg.getByRole('button', { name: tab, exact: true }).click(); await pg.waitForTimeout(400); await pg.mouse.move(0, 0); };
async function shot(name, fullPage = false, pg = page) {
  await pg.locator('.toast').waitFor({ state: 'hidden', timeout: 6000 });
  await pg.mouse.move(0, 0); await pg.waitForTimeout(400);
  await pg.screenshot({ path: join(screenshots, name + '.png'), fullPage }); report.screenshots.push(name + '.png');
}
async function sample(pg) { await pg.goto(url); await pg.getByRole('button', { name: 'Découvrir avec un exemple', exact: true }).click(); await pg.getByRole('button', { name: 'Accueil', exact: true }).waitFor(); }
const overflow = pg => pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function focusTrapped(role, pg = page) {
  for (let i = 0; i < 22; i++) { await pg.keyboard.press(i < 11 ? 'Tab' : 'Shift+Tab'); assert.ok(await pg.locator(':focus').evaluate((e, r) => !!e.closest(`[role="${r}"]`), role), 'focus contenu'); }
}
try {
  await sample(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  check('Service worker actif et page contrôlée', true);
  const initialHero = await page.locator('.hero .fig').getAttribute('aria-label');
  check('Cash-flow de référence conservé', initialHero === 'Cash-flow : +59 €');
  await shot('accueil-clair'); await shot('accueil-clair-complet', true);
  for (const [tab, name] of [['Projet','projet'],['Mouvements','mouvements'],['Analyse','analyse'],['Réglages','reglages']]) { await nav(tab); await shot(name); }
  await shot('reglages-complet', true);
  // Palettes et préférence sombre persistante.
  await page.getByRole('radio', { name: 'Sombre', exact: true }).click();
  await page.getByRole('button', { name: 'Cobalt', exact: true }).click();
  await nav('Accueil'); await shot('accueil-sombre'); await shot('accueil-sombre-complet', true);
  await page.reload(); await page.getByRole('button', { name: 'Accueil', exact: true }).waitFor();
  check('Mode sombre conservé après rechargement', await page.locator('html').getAttribute('data-theme') === 'dark');
  check('Cobalt conservé après rechargement', await page.evaluate(() => JSON.parse(localStorage.getItem('immo-appearance-v1')).accent === '#4268b0'));
  check('Personnalisation sans changement du cash-flow', await page.locator('.hero .fig').getAttribute('aria-label') === initialHero);
  await nav('Réglages'); await shot('reglages-sombre');
  await page.getByLabel('Code couleur hexadécimal').fill('#eeaa33');
  check('Couleur libre appliquée', await page.evaluate(() => JSON.parse(localStorage.getItem('immo-appearance-v1')).accent === '#eeaa33'));
  await page.getByLabel('Code couleur hexadécimal').fill('#z');
  check('Code incomplet signalé sans perdre le thème', await page.getByLabel('Code couleur hexadécimal').getAttribute('aria-invalid') === 'true');
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  check('Auto suit une modification du thème système', true);
  await page.getByRole('radio', { name: 'Clair', exact: true }).click();
  check('Clair explicite prioritaire sur système sombre', await page.locator('html').getAttribute('data-theme') === 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await nav('Projet');
  const notary = page.getByRole('button', { name: /Frais de notaire.*4/ });
  await notary.click();
  check('Focus Réel sur une valeur réelle existante', await page.locator(':focus').getAttribute('aria-label') === 'Frais de notaire — réel');
  await shot('edition-donnee');
  await focusTrapped('dialog'); check('Tab et Shift+Tab contenus dans le panneau', true);
  await page.getByLabel('Frais de notaire — réel').fill('4790');
  check('Modifier le réel ne modifie pas le prévu', (await page.getByLabel('Frais de notaire — prévu').inputValue()).replace(/\s/g, '') === '4600');
  await page.getByLabel('Frais de notaire — réel').fill('4780');
  await page.locator('.flow-dot').nth(2).click();
  check('Bien acquis : focus réel même encore vide', (await page.locator(':focus').getAttribute('aria-label')).endsWith('— réel'));
  await page.keyboard.press('Escape');
  check('Escape ferme le panneau', await page.getByRole('dialog').count() === 0);
  check('Focus rendu à la ligne d’origine', /Frais de notaire/.test(await page.locator(':focus').innerText()));
  await page.getByRole('button', { name: /Charges récupérables.*40/ }).click();
  await page.getByLabel('Charges récupérables — réel').fill('60');
  check('Écart récupérable neutre', !(await page.locator('.delta-pill').getAttribute('class')).match(/tone-pos|tone-neg/));
  await page.getByLabel('Charges récupérables — réel').fill('40'); await page.keyboard.press('Escape');
  await nav('Mouvements');
  await page.getByRole('button', { name: 'Ajouter un mouvement', exact: true }).click();
  await page.getByLabel('Montant', { exact: true }).fill('125,50');
  await page.getByRole('radio', { name: 'Taxe foncière', exact: true }).click();
  await page.getByLabel('Note', { exact: true }).fill('Vérification locale');
  await shot('ajout-mouvement');
  await page.getByRole('button', { name: /^Ajouter 126/ }).click();
  const added = page.getByRole('button', { name: /Taxe foncière.*Vérification locale/ });
  await added.waitFor(); check('Ajout de mouvement fonctionnel', true);
  await page.reload(); await nav('Mouvements'); await added.click();
  check('Mouvement conservé après rechargement', (await page.getByLabel('Montant', { exact: true }).inputValue()) === '125,5');
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('alertdialog').waitFor(); await focusTrapped('alertdialog');
  await page.keyboard.press('Escape');
  check('Escape ne ferme que la confirmation imbriquée', await page.getByRole('alertdialog').count() === 0 && await page.getByRole('dialog').count() === 1);
  check('Focus revient dans le panneau sous-jacent', await page.locator(':focus').evaluate(e => !!e.closest('[role=dialog]')));
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  check('Suppression confirmée fonctionnelle', await added.count() === 0);
  await nav('Analyse');
  check('Graphique commence à l’acquisition', (await page.locator('.mchart-col').first().getAttribute('aria-label')).startsWith('septembre 2026'));
  await page.getByRole('radio', { name: 'Cumulé', exact: true }).click();
  await page.locator('.mchart-col').first().click();
  check('Mois sans mouvement affiché à zéro', (await page.locator('.mchart-detail').innerText()).includes('Aucun mouvement'));
  await shot('analyse-cumul');
  await page.locator('.analysis-details summary').click(); check('Décomposition du solde accessible', await page.locator('.analysis-details').getAttribute('open') !== null);
  // Largeurs demandées, sur les cinq écrans.
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    for (const tab of ['Accueil', 'Projet', 'Mouvements', 'Analyse', 'Réglages']) {
      await nav(tab); check(`Aucun débordement horizontal : ${tab} à ${width}px`, await overflow(page));
      if (width === 320 || width === 1280) await shot(`${width}-${({'Accueil':'accueil','Projet':'projet','Mouvements':'mouvements','Analyse':'analyse','Réglages':'reglages'})[tab]}`);
    }
  }
  await page.setViewportSize({ width: 320, height: 568 }); await nav('Mouvements');
  await page.getByRole('button', { name: 'Ajouter un mouvement', exact: true }).click();
  await shot('320-ajout-mouvement'); check('Saisie 320px sans débordement', await overflow(page));
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await nav('Accueil');
  check('Animations désactivées avec reduced-motion', await page.locator('.hero').evaluate(e => getComputedStyle(e).animationName === 'none'));
  // Export puis réimport local de la même sauvegarde.
  await nav('Réglages');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const download = await downloadPromise; const backup = readFileSync(await download.path());
  check('Export JSON version 1.3.0', backup.toString().includes('1.3.0'));
  await page.locator('input[type=file]').setInputFiles({ name: 'verification.json', mimeType: 'application/json', buffer: backup });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remplacer', exact: true }).click();
  await nav('Accueil'); check('Import/export conserve les indicateurs', await page.locator('.hero .fig').getAttribute('aria-label') === initialHero);
  // Hors ligne réel, contexte sans contournement de CSP.
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Accueil', exact: true }).waitFor();
  check('Rechargement complet hors ligne', await page.locator('.hero .fig').getAttribute('aria-label') === initialHero);
  await nav('Réglages'); await page.getByRole('button', { name: 'Iris', exact: true }).click();
  await page.reload(); await nav('Réglages');
  check('Personnalisation conservée hors ligne', await page.getByRole('button', { name: 'Iris', exact: true }).getAttribute('aria-pressed') === 'true');
  await context.setOffline(false);
  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  check('Manifeste PWA et icônes présents', manifest.display === 'standalone' && manifest.icons.length === 3);
  for (const icon of manifest.icons) check('Icône disponible : ' + icon.src, (await page.request.get(new URL(icon.src, url + '/').href)).ok());
  // Premier lancement, projet vide, prévu par défaut.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const blank = await fresh.newPage(); await blank.goto(url); await blank.getByRole('button', { name: 'Commencer', exact: true }).waitFor();
  await shot('premier-lancement', false, blank);
  await blank.getByLabel('Nom de votre projet').fill('Mon prochain appartement'); await blank.getByRole('button', { name: 'Commencer', exact: true }).click();
  await blank.getByRole('dialog').waitFor();
  check('Projet neuf : focus prévu', (await blank.locator(':focus').getAttribute('aria-label')).endsWith('— prévu'));
  await blank.keyboard.press('Escape');
  for (const [tab, name] of [['Accueil','accueil-vide'],['Mouvements','mouvements-vides'],['Analyse','analyse-vide']]) { await nav(tab, blank); await shot(name, false, blank); }
  await fresh.close();
  // Uniquement axe utilise bypassCSP afin de charger le moteur de test, jamais le contexte fonctionnel/PWA ci-dessus.
  const a11y = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', bypassCSP: true });
  const ap = await a11y.newPage(); await sample(ap);
  async function audit(label) {
    await ap.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'));
    await ap.addScriptTag({ content: axeSource });
    const result = await ap.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } }));
    report.accessibility.push({ label, violations: result.violations.map(v => ({ id:v.id, impact:v.impact, nodes:v.nodes.map(n => ({target:n.target,summary:n.failureSummary})) })) });
  }
  for (const theme of ['Clair','Sombre']) {
    await nav('Réglages', ap); await ap.getByRole('radio', { name: theme, exact: true }).click();
    for (const tab of ['Accueil','Projet','Mouvements','Analyse','Réglages']) { await nav(tab, ap); await audit(`${tab} ${theme}`); }
    for (const palette of ['Jade','Cobalt','Iris','Cuivre','Rose','Graphite']) { await ap.getByRole('button', { name: palette, exact: true }).click(); await audit(`Palette ${palette} ${theme}`); }
    await nav('Projet', ap); await ap.getByRole('button', { name: /Frais de notaire.*4/ }).click(); await audit(`Édition ${theme}`); await ap.keyboard.press('Escape');
    await nav('Mouvements', ap); await ap.getByRole('button', { name: 'Ajouter un mouvement', exact: true }).click(); await audit(`Ajout ${theme}`); await ap.keyboard.press('Escape');
  }
  await a11y.close();
  check('Aucune erreur JavaScript pendant les parcours', report.errors.length === 0);
  check('Aucun appel réseau externe de l’application', report.externalRequests.length === 0);
  check('Aucun échec axe WCAG A/AA sur les vues contrôlées', report.accessibility.every(a => a.violations.length === 0));
} finally {
  writeFileSync('docs/validation-browser.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, screenshots: report.screenshots.length, accessibility: report.accessibility.map(a => ({label:a.label, violations:a.violations.length})), errors: report.errors }, null, 2));
  await browser.close();
}
