# Migration v1.0.0 → v1.0.1

## En résumé

**Aucune action requise.** Les données existantes et les sauvegardes v1.0.0 restent utilisables telles quelles.

## Fichier de sauvegarde (JSON)

- `schemaVersion` reste **1** : aucun champ ajouté, renommé ou supprimé.
- Une sauvegarde v1.0.0 s'importe en v1.0.1 sans conversion. C'est vérifié par un test sur une vraie sauvegarde produite par la v1.0.0 (`tests/fixtures/backup-v1.0.0.json`, voir `tests/robustness.test.ts`).
- La validation à l'import est plus stricte : montants négatifs refusés, mouvement à 0 € refusé, taux de 0 à 100 %, durée de 0 à 1 200 mois, identifiants uniques. La v1.0.0 ne permettait pas de saisir de telles valeurs dans l'interface. Seul un fichier modifié à la main peut donc être refusé, avec un message indiquant le champ en cause.
- Une sauvegarde exportée par la v1.0.1 porte `"appVersion": "1.0.1"` et reste lisible par la v1.0.0 (même schéma).

## Base locale (IndexedDB)

- La version de la base passe de **1 à 2**, pour ajouter la table `quarantine` (copies des enregistrements endommagés).
- La mise à niveau est automatique à la première ouverture de la v1.0.1. Les tables `properties` et `settings` ne sont pas modifiées. C'est vérifié par un test qui ouvre une base créée au format v1.
- Si une ancienne version de l'application est encore ouverte dans un autre onglet, fermez-le : le navigateur bloque la mise à niveau tant qu'il reste ouvert.

## Changements d'interprétation (sans modification des données)

| Avant (v1.0.0) | Maintenant (v1.0.1) |
|---|---|
| « Charges récupérées » comptées comme une recette | neutres : aucun effet sur les indicateurs |
| « Sorti de ma poche » = apport + déficit **net** cumulé (un excédent ultérieur pouvait effacer une injection passée) | « Argent personnel injecté » : apport + déficits **mensuels** couverts, jamais diminué ; plus « Solde net du projet » |
| Un simple mouvement faisait passer l'accueil en vue « Réel » | seuls les montants réels de référence le font |
| Mensualité manuelle incohérente → intérêts affichés à 0 € | avertissement, coûts affichés « incohérent » |

Une nouvelle catégorie de dépense, « Charges récupérables payées », est disponible. Les catégories font partie du code, pas des données : aucune migration n'est nécessaire.

## Pour une future évolution du schéma

Incrémenter `SCHEMA_VERSION` (`src/domain/types.ts`), puis ajouter l'étape `n → n+1` dans `MIGRATIONS` (`src/backup/backup.ts`). Conserver la fixture v1.0.0 et en ajouter une par version.
