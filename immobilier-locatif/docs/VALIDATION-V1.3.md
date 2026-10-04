# Validation reproductible — v1.3.0

## Tests du projet

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Résultat de la version livrée : **223 tests réussis**, 14 fichiers ; typecheck et build réussis. Les 185 tests existants sont conservés. Ajouts : chargement robuste des préférences, contraste des six palettes et couleurs extrêmes, focus Prévu/Réel, neutralité des écarts récupérables, dates d’achat et mois sans mouvement.

Les modules du socle financier, de l’import/export, de la persistance et du stockage ont été comparés octet par octet avec l’archive v1.2.0 : **15 fichiers identiques**. Liste dans `non-regression-socle.json`.

## Validation dans le navigateur

**Résultat final : 68 contrôles navigateur réussis, 26 états contrôlés avec axe sans violation détectée, 28 captures finales.** Chrome 154.0.8037.97.

Le script `scripts/validate-browser.mjs` utilise un profil de navigateur isolé et le bien d’exemple. Il ne lit ni ne modifie les données personnelles d’un profil de navigateur existant.

Les outils de contrôle ne sont pas ajoutés aux dépendances de l’application :

```sh
npm install --prefix ../qa-tools playwright axe-core
npm exec --prefix ../qa-tools -- playwright install chromium
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Puis, dans un autre terminal ouvert dans le projet :

```sh
QA_MODULES=../qa-tools QA_URL=http://127.0.0.1:4173 node scripts/validate-browser.mjs
```

Avec Chrome installé, on peut ajouter `QA_CHANNEL=chrome`. Les résultats sont écrits dans `docs/validation-browser.json` et les captures dans `docs/screenshots/`.

### Parcours contrôlés

- Indicateurs de référence inchangés lors de la personnalisation.
- Six palettes, couleur libre, erreur de code couleur, réinitialisation, clair/sombre/auto et changements du thème système.
- Préférences persistantes après rechargement, y compris hors ligne.
- Focus Réel existant, Réel encore vide sur bien acquis, Prévu sur nouveau projet.
- Édition du Réel sans changement du Prévu ; charges récupérables présentées de façon neutre.
- Tab et Shift+Tab contenus ; Escape ; retour au déclencheur ; confirmations imbriquées ; fermeture simultanée de deux fenêtres.
- Ajout, sauvegarde, rechargement et suppression d’un mouvement d’essai.
- Chronologie depuis l’achat, mois à zéro, vue cumulée et détail du solde dépliable.
- Les cinq écrans aux largeurs 320, 375, 390, 430, 768 et 1280 px.
- Fenêtre d’ajout à 320 × 568 ; animations désactivées avec `prefers-reduced-motion`.
- Export et réimport JSON ; égalité du cash-flow après aller-retour.
- Service worker actif, rechargement complet avec réseau désactivé, manifeste standalone et icônes.
- Aucun appel réseau externe de l’application ni erreur JavaScript pendant les parcours.
- Contrôle axe WCAG 2 A/AA et 2.1 AA des cinq écrans, des palettes et des fenêtres en clair et sombre.

Le contexte de contrôle fonctionnel et hors ligne garde la CSP de production. Seul le contexte axe autorise l’injection du moteur de test via `bypassCSP` ; cela ne modifie pas la CSP du projet.

### Correction de prévisualisation

Le serveur Vite preview ajoutait `Vary: Origin`. Les modules chargés par le navigateur avec un en-tête Origin ne correspondaient pas aux entrées précachées sans cet en-tête, rendant le test hors ligne incomplet. `preview.cors: false` retire ce comportement uniquement sur le serveur de prévisualisation. Le service worker et son algorithme de cache restent inchangés. Un hébergement tiers doit également servir les fichiers statiques de façon cohérente ; son paramétrage n’a pas été testé ici.

## Portée et limites

Les tests navigateur utilisent Chrome headless et des dimensions mobiles, tablette et desktop. Les captures ont été relues visuellement. Les contrôles automatiques de contraste ne constituent pas une certification d’accessibilité.

Pas de test sur iPhone/Android physique, clavier logiciel réel, VoiceOver/TalkBack ni installation depuis un écran d’accueil iOS. Les safe areas, le défilement des fenêtres et le clavier décimal sont prévus dans le code, mais ces comportements natifs nécessitent encore une vérification sur appareil. Les sauvegardes financières restent compatibles ; les préférences visuelles, propres à l’appareil, ne sont pas exportées.
