# Mon bien locatif — v1.0.0

Application mobile personnelle pour suivre un investissement immobilier locatif, **du projet avant achat jusqu'au suivi réel**.

Elle répond en quelques secondes à ces questions : combien coûte l'appartement, combien j'ai sorti de ma poche, combien coûte le crédit, combien rapporte le locataire, quel est mon cash-flow et mon effort d'épargne, quelles sont mes rentabilités brute et nette (avant impôts), quel rendement pour mon apport, et comment le réel se compare au prévu.

- **PWA** installable sur téléphone, fonctionne **hors connexion**
- **100 % locale** : pas de compte, pas de serveur, pas d'API, pas de statistiques, aucune donnée transmise
- Données dans **IndexedDB** sur l'appareil, **sauvegarde / restauration** par fichier JSON versionné
- Dépendances d'exécution : **React** uniquement

---

## Sommaire

1. [Installation et lancement](#1-installation-et-lancement)
2. [Installer l'application sur un téléphone](#2-installer-lapplication-sur-un-téléphone)
3. [Compréhension fonctionnelle](#3-compréhension-fonctionnelle)
4. [Les écrans](#4-les-écrans)
5. [Modèle de données](#5-modèle-de-données)
6. [Calculs](#6-calculs)
7. [Complexités évitées : décisions prises](#7-complexités-évitées--décisions-prises)
8. [Architecture technique](#8-architecture-technique)
9. [Sauvegarde](#9-sauvegarde)
10. [Confidentialité et sécurité](#10-confidentialité-et-sécurité)
11. [Tests](#11-tests)
12. [Fonctionnalités V1 et pistes V2](#12-fonctionnalités-v1-et-pistes-v2)
13. [Limites connues](#13-limites-connues)

---

## 1. Installation et lancement

Prérequis : **Node.js 22.12 ou plus récent** (voir `.nvmrc`) et npm.

```bash
npm install          # installe les dépendances
npm run dev          # serveur de développement : http://localhost:5173
npm test             # lance les 82 tests
npm run typecheck    # vérification TypeScript
npm run build        # build de production dans dist/
npm run preview      # sert le build : http://localhost:4173
```

`npm run build` vérifie aussi les types avant de construire. Le dossier `dist/` est un site statique autonome. Le service worker (mode hors connexion) n'est actif qu'avec le build de production, pas avec `npm run dev`.

Pour tester sur un téléphone du même réseau Wi-Fi : `npm run preview -- --host`, puis ouvrez l'adresse « Network » affichée. Attention : sans HTTPS, le navigateur du téléphone n'activera ni le mode hors connexion ni l'installation (voir §2).

`npm run icons` régénère les icônes PNG de `public/icons/` (script Node sans dépendance).

## 2. Installer l'application sur un téléphone

Une PWA doit être servie en **HTTPS** pour être installable et fonctionner hors ligne. Le contenu de `dist/` est statique et peut être hébergé n'importe où, sans aucun serveur applicatif. Les données ne transitent **jamais** par l'hébergeur : il ne fournit que les fichiers de l'application, et tout le reste se passe dans le navigateur. Exemples :

- **GitHub Pages**, **Netlify** (glisser-déposer du dossier `dist/`), **Cloudflare Pages**, ou tout hébergement statique ;
- les chemins sont relatifs (`base: './'`) : l'application fonctionne aussi dans un sous-dossier.

Puis, sur le téléphone :

- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮ → « Installer l'application ».

Après la première visite, l'application fonctionne sans connexion.

## 3. Compréhension fonctionnelle

Une application **personnelle**, pas un logiciel de gestion locative. Une seule logique pour tout le cycle de vie du bien :

1. **Avant l'achat**, je simule le projet : prix, frais, travaux, crédit, loyer, charges. J'obtiens immédiatement le coût total, l'apport, la mensualité, le cash-flow, l'effort d'épargne et les rentabilités.
2. **Après l'achat**, je ne change pas d'outil. Chaque montant a une case *Prévu* et une case *Réel*. Le *Réel* remplace progressivement le *Prévu* au fur et à mesure que les chiffres définitifs sont connus (acte notarié, offre de prêt, bail, avis de taxe foncière…).
3. **Au quotidien**, j'enregistre des **mouvements** : ce que j'ai réellement payé et encaissé (date, dépense ou recette, montant, catégorie, note). Ils répondent à « combien m'a-t-il vraiment coûté, combien m'a-t-il rapporté, combien ai-je sorti de ma poche ».
4. Le tableau de bord compare **Prévu / Réel / Écart**.

Tous les indicateurs sont **avant fiscalité**.

## 4. Les écrans

Quatre onglets, en bas de l'écran :

| Onglet | Contenu |
|---|---|
| **Accueil** | Nom du bien ; bascule *Prévu / Réel* (dès qu'une donnée réelle existe) ; grande carte **cash-flow** (avec l'effort d'épargne s'il est négatif) ; 8 cartes : coût du projet, investi personnellement, loyer, mensualité, rentabilité brute, rentabilité nette, charges, rendement de l'apport ; **un seul graphique** (revenus vs dépenses mensuels) ; tableau *Prévu / Réel / Écart* ; synthèse des mouvements (« sorti de ma poche ») ; détail du crédit replié. Chaque carte s'ouvre sur sa formule et son calcul détaillé. |
| **Projet** | Quatre rubriques : **Achat** (bien, phase « acheté », 9 postes de coût), **Financement** (apport, emprunt, taux, durée en années ou mois, mensualité auto ou saisie, assurance, coût du crédit), **Location** (loyer HC, charges récupérables, date de début, vacance, impayés), **Charges** (mensuelles, annuelles ou ponctuelles, avec équivalents mensuel et annuel). Chaque montant : colonnes *Prévu* et *Réel*. Les colonnes *Réel* n'apparaissent qu'une fois le bien marqué « acheté » (ou dès qu'un montant réel existe). |
| **Mouvements** | Journal par mois, filtre dépenses / recettes, totaux. Ajout en un écran : type, montant, catégorie (préremplie ou nouvelle), date, note. Montant suggéré pour le loyer, la mensualité et l'assurance. « Copier au mois suivant » pour les mouvements récurrents. |
| **Réglages** | Mes biens (ajouter, renommer, choisir, supprimer), **sauvegarde** (exporter, partager, restaurer, date de la dernière sauvegarde), confidentialité, toutes les formules, bien d'exemple, effacement complet. |

Au premier lancement, un écran d'accueil propose de créer son projet, de découvrir un exemple (« Appartement Saint-Étienne ») ou de restaurer une sauvegarde.

**Principes UX** : boutons et champs de 44 à 48 px de haut, clavier numérique décimal (virgule acceptée), champ vide = « non renseigné », panneaux qui montent du bas plutôt que de nouvelles pages, aide « i » plutôt que des infobulles (inutilisables au doigt), mode sombre automatique, animations réduites si le système le demande.

## 5. Modèle de données

Défini dans `src/domain/types.ts`. Schéma **version 1**.

```ts
Amount   = { planned: number | null; actual: number | null }   // la brique Prévu / Réel

AppData  = { properties: Property[]; settings: Settings }

Property = {
  id, name, address,
  phase: 'project' | 'owned',  purchaseDate,
  createdAt, updatedAt,
  acquisition: { price, notary, agency, loanFees, guarantee, broker, works, furniture, otherFees : Amount },
  loan:   { borrowed, ratePct, durationMonths, monthlyPayment /* null = auto */, insuranceMonthly : Amount },
  rental: { rent, recoverableCharges : Amount; startDate; vacancyMonthsPerYear; unpaidPct },
  charges:   ChargeItem[],   // { id, label, frequency: 'once'|'monthly'|'yearly', amount: Amount, categoryId? }
  movements: Movement[],     // { id, date: 'AAAA-MM-JJ', type: 'expense'|'income', amount > 0, categoryId, note }
}

Settings = { activePropertyId, customCategories: { id, label, kind }[], lastBackupAt }
```

- **Plusieurs biens** sont prévus dans le modèle. L'interface est optimisée pour un seul : le sélecteur de biens n'apparaît qu'à partir de deux.
- Les **catégories de mouvements** sont prédéfinies (`src/domain/categories.ts`) : achat (mêmes identifiants que les postes d'achat), charges (mêmes identifiants que les rubriques de charges), crédit, recettes. Les catégories créées par l'utilisateur sont globales à tous les biens.
- Montants en euros, nombres décimaux. Dates au format ISO.
- L'apport n'est **pas stocké** : il se déduit (coût total − emprunt).

## 6. Calculs

Les formules sont centralisées dans `src/calc/` (fonctions pures, testées) et documentées en détail dans **[docs/FORMULES.md](docs/FORMULES.md)**. En résumé :

| Indicateur | Formule |
|---|---|
| Coût total du projet | prix + notaire + agence + dossier + garantie + courtier + travaux + mobilier + autres frais |
| Investi personnellement | max(0, coût total − emprunt) + dépenses ponctuelles |
| Mensualité | C·t / (1 − (1+t)^−n), t = taux/12, arrondie au centime ; remplacée par la valeur saisie si elle existe |
| Coût du crédit | intérêts (M·n − C) + assurance (assurance·n) + frais de dossier, garantie, courtier |
| Rentabilité brute | loyer annuel HC / coût total × 100 |
| Rentabilité nette (avant impôts) | (loyer annuel conservé − charges annuelles) / coût total × 100, crédit **non** déduit |
| Cash-flow mensuel | loyer conservé − mensualité − assurance − charges mensuelles (charges annuelles / 12) |
| Effort d'épargne | max(0, − cash-flow) |
| Rendement de mon apport | cash-flow annuel / investi personnellement × 100 |
| Sorti de ma poche (réel) | apport réel + déficit cumulé des mouvements hors achat |

*Loyer conservé* = loyer HC × (12 − mois de vacance) / 12 × (1 − % impayés). Les charges récupérables sont neutres et exclues des rentabilités.

## 7. Complexités évitées : décisions prises

| Risque de complexité | Solution retenue (la plus simple) |
|---|---|
| Deux applications ou deux jeux de données (simulation vs réel) | Un seul modèle : chaque montant = `{ planned, actual }`. Le réel remplace le prévu montant par montant. |
| Rapprocher automatiquement mouvements et montants réels | Pas d'automatisme trompeur (un acompte n'est pas un coût final). L'écran affiche « payé à ce jour » et propose de le reprendre en un geste. |
| Double saisie apport / emprunt incohérente | L'apport est calculé (coût − emprunt). Le saisir ajuste l'emprunt. |
| Frais de financement saisis à deux endroits | Saisis une seule fois, dans *Achat* (ils font partie du coût). *Financement* les reprend dans le coût du crédit. |
| Tableau d'amortissement, différés, taux variables, modulation | Formule de mensualité constante + saisie manuelle de la mensualité exacte de la banque. |
| Comptabilité (débit/crédit, plan comptable, rapprochements) | Mouvements simples : date, dépense ou recette, montant, catégorie, note. |
| Annualiser des dépenses réelles irrégulières (taxe foncière payée une fois par an…) | Le réel des charges se saisit par rubrique (« taxe foncière réelle : 640 €/an »). Les mouvements servent au bilan de trésorerie, pas à extrapoler. |
| Générer automatiquement les mensualités sur 25 ans | Saisie manuelle + « Copier au mois suivant » + montant suggéré. |
| Fiscalité (LMNP, micro-BIC, déficit foncier, TMI…) | Hors V1. Tous les indicateurs sont libellés « avant impôts ». |
| Multi-biens lourd | Modèle multi-biens, interface mono-bien (sélecteur visible à partir de 2 biens). |
| Router, gestionnaire d'état, bibliothèque UI ou de graphiques, outils PWA | Aucun : 4 onglets en état React, contexte simple, CSS maison, un graphique en barres CSS, service worker de 30 lignes généré au build. |
| Chiffrement / mot de passe local | Hors V1 (pas d'authentification demandée). Les données restent dans le stockage privé du navigateur. |

## 8. Architecture technique

**React 18 + TypeScript + Vite**, PWA statique.

```
src/
  domain/        modèle de données, catégories, fabriques (bien vide, exemple)
  calc/          calculs financiers PURS — aucune dépendance à React ni au stockage
    loan.ts        mensualité, coût du crédit
    resolve.ts     règle Prévu / Réel → nombres simples
    metrics.ts     indicateurs (coût, rentabilités, cash-flow…)
    journal.ts     synthèse des mouvements réels
  storage/       persistance derrière une interface DataStorage
    indexedDb.ts   implémentation IndexedDB (2 tables : biens, réglages)
    memory.ts      implémentation mémoire (tests, repli si IndexedDB indisponible)
  backup/        format de sauvegarde
    backup.ts      export, import, versions, migrations
    schema.ts      validation stricte de toutes les données lues
  state/         store React (contexte) : état, écriture différée et incrémentale
  ui/            composants génériques (champs, panneaux, dialogues, icônes)
  screens/       les écrans (Accueil, Projet, Mouvements, Réglages, Bienvenue)
  styles/        une feuille de style (thème clair/sombre)
tests/           tests Vitest
docs/            FORMULES.md
scripts/         génération des icônes
vite.config.ts   build + service worker hors connexion + politique de sécurité (CSP)
```

Flux : `Écran → store (updateProperty) → IndexedDB` pour l'écriture ; `Property → resolveInputs(scénario) → computeMetrics → affichage` pour la lecture. Les écrans n'implémentent aucune formule.

**Persistance** : chaque modification est enregistrée automatiquement environ 250 ms après la saisie. Seuls les biens modifiés sont réécrits, et l'enregistrement est immédiat quand l'application passe en arrière-plan. L'application demande au navigateur un stockage persistant (`navigator.storage.persist()`). Si IndexedDB est indisponible (certaines navigations privées), l'application fonctionne en mémoire et affiche un avertissement permanent.

**Ajouter un module fiscal plus tard** : créer `src/calc/tax/` qui consomme `ResolvedInputs` et `Metrics` (déjà calculés et testés) et produit des indicateurs « après impôts ». Il faudrait aussi ajouter au modèle un champ optionnel `tax` dans `Property` (avec une migration de schéma 1 → 2 dans `backup.ts`), puis une rubrique *Fiscalité* dans l'écran Projet. Les calculs existants ne changent pas.

**Évolution du schéma** : incrémenter `SCHEMA_VERSION` (`src/domain/types.ts`) et ajouter une fonction dans `MIGRATIONS` (`src/backup/backup.ts`). Les anciennes sauvegardes sont migrées à l'import. Les rubriques d'achat absentes d'un ancien fichier sont déjà complétées automatiquement.

## 9. Sauvegarde

**Exporter** : *Réglages → Exporter une sauvegarde* crée `immobilier-backup-AAAA-MM-JJ.json`. Sur mobile, *Partager le fichier…* permet de l'enregistrer dans Fichiers, un cloud personnel, un e-mail à soi-même, etc. Un rappel apparaît sur l'accueil si aucune sauvegarde n'a été faite depuis plus de 30 jours.

**Format** :

```json
{
  "app": "immobilier-locatif",
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-10-03T10:12:00.000Z",
  "data": { "properties": [ … ], "settings": { … } }
}
```

**Importer** : *Réglages → Restaurer une sauvegarde* (ou depuis l'écran de bienvenue). Contrôles effectués **avant** toute modification :

- fichier vide, trop gros (> 25 Mo), JSON invalide ou tronqué ;
- fichier d'une autre application ;
- version de schéma absente, invalide ou **plus récente** que l'application (message invitant à mettre à jour) ;
- validation champ par champ : types, nombres finis et bornés, dates réelles (`2026-02-31` refusé), énumérations, identifiants en double. Les erreurs sont affichées avec leur emplacement (5 au maximum) ;
- **confirmation** avec un résumé (date, nombre de biens et de mouvements, noms), et avertissement explicite si des données existantes vont être remplacées ;
- remplacement **atomique** (une seule transaction IndexedDB) : en cas d'échec, les données actuelles restent intactes.

## 10. Confidentialité et sécurité

- Aucun compte, aucune authentification, aucun serveur, aucune API externe, aucune télémétrie, aucun analytics, aucune police ou ressource externe.
- Une **Content-Security-Policy** stricte est ajoutée au build (`connect-src 'self'`, `script-src 'self'`) : le navigateur empêcherait toute connexion vers un autre domaine, même par erreur.
- Le service worker ne met en cache que les fichiers de l'application et ignore toute requête vers un autre domaine.
- Les données financières ne quittent l'appareil que si **vous** exportez un fichier.
- `npm audit` : 0 vulnérabilité connue (dépendances de production et de développement) à la date de la v1.0.0.

## 11. Tests

```bash
npm test
```

82 tests (Vitest) dans `tests/` :

| Fichier | Couverture |
|---|---|
| `loan.test.ts` | mensualité (cas de référence 100 000 € / 3 % / 20 ans = 554,60 €), taux 0 %, sans crédit, durée inconnue, mensualité manuelle, coût total du crédit |
| `metrics.test.ts` | coût total, travaux importants, rentabilités brute et nette, charges récupérables neutres, vacance et impayés, loyer nul, coût nul, conversion des charges mensuelles/annuelles/ponctuelles, cash-flow, effort d'épargne, aucun apport, aucun crédit, emprunt > coût, rendement de l'apport, données incomplètes (bien vierge sans NaN), distinction prévu/réel, réel à 0 €, mensualité réelle vs prévue, mouvements et paiements partiels |
| `journal.test.ts` | totaux payés/encaissés, déficit cumulé, sorti de ma poche, catégories personnalisées, arrondis |
| `backup.test.ts` | export versionné, nom du fichier, aller-retour exact, indicateurs identiques après restauration, rejets (vide, tronqué, étranger, version future, montant texte, date impossible, valeurs hors bornes, doublons), migrations, stockage IndexedDB (simulé par `fake-indexeddb`) et mémoire, **restauration remplaçant des données existantes**, persistance entre deux ouvertures |
| `format.test.ts` | formats français (€, %, dates), lecture des saisies (« 1 200,50 »), ajout d'un mois |

L'interface a en outre été vérifiée manuellement dans Chromium (390 × 844, clair et sombre) : création d'un projet de zéro, exemple, ajout de mouvement, persistance après rechargement, fonctionnement hors connexion, export → effacement → import d'un fichier corrompu (refusé) puis valide (chiffres identiques), aucune erreur console. Ces scénarios navigateur ne sont pas inclus comme tests automatisés dans le projet.

## 12. Fonctionnalités V1 et pistes V2

**Implémenté en V1**

- Projet complet Prévu / Réel : achat (9 postes), financement (calcul ou saisie de la mensualité, durée en années ou mois), location (loyer HC, charges récupérables, vacance, impayés), charges (mensuelles, annuelles, ponctuelles, rubriques personnalisées)
- Tableau de bord : cash-flow, effort d'épargne, 8 indicateurs, graphique revenus/dépenses, Prévu / Réel / Écart, détail du crédit, formule de chaque indicateur
- Journal des mouvements avec catégories préremplies et personnalisées, filtres, copie au mois suivant
- « Sorti de ma poche » réel à partir des mouvements
- Plusieurs biens (modèle complet, interface légère)
- Sauvegarde JSON versionnée : export, partage, import validé avec confirmation, rappel de sauvegarde
- PWA installable, hors connexion, mode sombre, 100 % locale
- Bien d'exemple

**Volontairement laissé pour une V2**

- Module fiscal (micro-foncier / réel, LMNP micro-BIC / réel, amortissements, déficit foncier, TMI, prélèvements sociaux, plus-value)
- Tableau d'amortissement du prêt, capital restant dû, enrichissement (capital remboursé), valeur estimée du bien
- Mouvements récurrents automatiques (loyer et mensualité générés chaque mois)
- Graphique d'évolution dans le temps (cash-flow réel mois par mois)
- Vue consolidée de plusieurs biens
- Export CSV/tableur des mouvements, pièces jointes (factures, quittances)
- Révision annuelle du loyer (IRL), suivi des quittances
- Verrouillage par code ou biométrie, chiffrement de la sauvegarde
- Tests d'interface automatisés (Playwright)

## 13. Limites connues

- **Stockage navigateur** : les données vivent dans le navigateur où l'application est ouverte. Effacer les données du site, désinstaller la PWA ou (sur iOS) une longue inutilisation peut les supprimer : **exportez des sauvegardes régulières**. Une PWA installée et une ouverture dans le navigateur ne partagent pas forcément le même stockage sur iOS.
- Le crédit est modélisé à taux fixe et mensualités constantes, sans différé ni remboursement anticipé.
- Le « Sorti de ma poche » réel ne compte que ce qui est saisi en mouvements (notamment les mensualités).
- Le rendement de l'apport est un indicateur de trésorerie : il compte le remboursement du capital comme une dépense.
- Interface en français uniquement, montants en euros.
- Plusieurs onglets ouverts simultanément sur l'application peuvent s'écraser mutuellement (dernière écriture gagnante).

---

Version **1.0.0** — voir [CHANGELOG.md](CHANGELOG.md).
