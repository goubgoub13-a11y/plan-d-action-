# Livraison — Mon bien locatif v1.3.0

## Résultat

Une évolution de l’application existante, avec une direction **Minéral** : surfaces claires ou graphite, typographie financière précise, motif architectural filaire et navigation flottante. La personnalité futuriste reste discrète et adaptée au suivi immobilier.

Dans **Réglages → Apparence**, six palettes (Jade, Cobalt, Iris, Cuivre, Rose, Graphite), une couleur personnalisée, les modes clair/sombre/automatique, un aperçu et une réinitialisation. Le choix est immédiat et mémorisé localement. Les nuances sont adaptées pour conserver le contraste. Les couleurs fonctionnelles positives/négatives restent distinctes de la couleur signature.

## Audit initial

L’interface v1.2.0 possédait une bonne hiérarchie métier et des interactions utiles. Les principales faiblesses étaient la hauteur de l’en-tête, les nombreuses cartes et ombres, l’absence de personnalisation, le focus Prévu même sur une valeur réelle et le confinement incomplet du clavier dans les fenêtres. L’analyse détaillée et les sources Internet sont dans [AUDIT-VISUEL-V1.3.md](AUDIT-VISUEL-V1.3.md).

## Modifications par écran

| Écran | Évolution |
| --- | --- |
| Accueil | En-tête plus compact, accès direct à l’apparence, cash-flow dominant, dessin architectural discret, bloc de quatre indicateurs avec séparateurs, navigation flottante mieux intégrée. |
| Projet | Sections et montants mieux hiérarchisés, lignes plus lisibles, ombres allégées ; consultation avant édition conservée. |
| Édition | Réel focalisé s’il existe ou si le bien est acquis ; Prévu sinon. Champs indépendants, progression accessible, touches et retour de focus cohérents. |
| Mouvements | Dates, libellés, notes et montants différenciés ; icônes circulaires, signes +/− conservés, charges récupérables visuellement neutres. |
| Ajout | Montant central, catégories rapides, pied de fenêtre accessible, validation et confirmations intégrées à la gestion commune des fenêtres. |
| Analyse | Solde puis graphique avant les détails ; décomposition du solde dépliable ; chronologie depuis l’achat, mois sans mouvement à zéro, vues mensuelle/cumulée conservées. |
| Réglages | Nouvelle section Apparence, six palettes, couleur libre, mode clair/sombre/auto, aperçu, persistance locale et réinitialisation. |
| Premier lancement et états vides | Même système visuel, appel à l’action existant conservé et captures de validation. |

## Design system et interactions

- Tokens de surfaces, contraste, espacements, rayons et profondeur consolidés dans `refinement.css` ; calcul des couleurs dans `palette.ts`.
- Polices natives, chiffres tabulaires, unités discrètes et poids harmonisés. Aucune police ni image distante.
- Modes clair et sombre explicites ; Auto suit les changements du système.
- États survol, pression, focus-visible, désactivé et code couleur invalide.
- Animations courtes ; `prefers-reduced-motion` et réduction de transparence pris en compte.
- Panneaux portés directement dans le document pour éviter les problèmes de positionnement dans les conteneurs animés.
- Pile de fenêtres : clavier contenu dans la fenêtre active, arrière-plan inerte, Escape, retour au déclencheur, fermeture simultanée et confirmations imbriquées.
- Confirmation : action Annuler focalisée initialement.

## Technique et conservation du socle

**Aucune dépendance ajoutée ou supprimée dans le projet.** React reste la seule bibliothèque d’exécution. Le moteur de validation navigateur utilise Playwright et axe-core depuis un dossier d’outillage séparé ; ils ne sont pas embarqués dans l’application.

Les 15 fichiers des dossiers `calc`, `domain`, `backup`, `storage`, `state` sont strictement identiques à la v1.2.0 : formules, modèle, persister et sauvegardes conservés. Les changements de chronologie concernent uniquement la série d’affichage. Les mouvements antérieurs à l’achat sont conservés dans cette série pour ne pas perdre leur contribution au cumul.

Préférences visuelles : petite entrée `localStorage` distincte, avec validation et valeurs de repli. Les sauvegardes financières ne changent pas et ne transportent pas ces préférences propres à l’appareil.

Le service worker n’a pas été modifié. La configuration du serveur de prévisualisation a été ajustée pour retirer `Vary: Origin`, qui gênait la recherche des ressources en cache hors ligne.

Le build final contient environ 51,2 ko de CSS et 268,5 ko de JavaScript avant compression ; environ 10,5 ko et 83,7 ko gzip respectivement. L’augmentation totale gzip par rapport à la v1.2.0 est d’environ 5,5 ko.

## Validation et captures

**Résultat final : 68 contrôles navigateur réussis, 26 états contrôlés avec axe sans violation détectée, 28 captures finales.** Chrome 154.0.8037.97.

- **223 tests unitaires réussis**, dont les 185 tests existants.
- **Typecheck et build réussis.**
- Contrôles navigateur, PWA, hors ligne, import/export, préférences, fenêtres et responsive : rapport [validation-browser.json](validation-browser.json).
- Contrôle automatisé d’accessibilité en clair et sombre, incluant palettes et fenêtres : détails dans le même rapport.
- Captures finales : [CAPTURES.md](CAPTURES.md), dans `docs/screenshots/`.
- Comparaison du socle : [non-regression-socle.json](non-regression-socle.json).

Les captures historiques ont été déplacées du dossier `undefined/` fourni vers `docs/screenshots/avant/`. L’archive livrée ne contient pas de dossier `undefined/`.

Les tests sont effectués dans Chrome headless avec dimensions mobiles. Une vérification sur iPhone/Android physique reste nécessaire pour le clavier logiciel, les safe areas réelles et l’installation native. Procédure reproductible et portée exacte : [VALIDATION-V1.3.md](VALIDATION-V1.3.md).
