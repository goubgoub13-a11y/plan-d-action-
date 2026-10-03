# Historique des versions

## 1.2.0 — 2026-10-03

Finitions visuelles et deux évolutions d'expérience. **Aucun changement du moteur métier** : calculs, modèle de données, stockage, persister, import/export et PWA sont inchangés. Les 178 tests de la 1.1.0 passent sans modification ; 7 tests ajoutés (185).

**Saisie champ par champ** (onglet Projet)
- Les formulaires à colonnes Prévu / Réel sont remplacés par un parcours d'un seul champ par écran : grand montant, « Prévu » puis « Réel » (avec « Pas encore connu : le montant prévu est utilisé »), une aide d'une ligne et l'écart en pastille.
- Progression par points (cliquables), « 3 / 9 », Entrée ou « Suivant » pour avancer, « Terminé » sur le dernier champ ; total de la rubrique mis à jour en direct.
- Suggestions en un geste : frais de notaire estimés à 7,5 % du prix, reprise du montant payé quand une dépense est terminée, retour au calcul automatique de la mensualité.
- Financement : apport et montant emprunté liés, durée en années ou en mois ; l'alerte de mensualité incohérente reste affichée.
- Charges : les charges essentielles et celles déjà renseignées en premier ; nom, fréquence et suppression d'une charge personnalisée dans le même écran.
- L'écran Projet est en lecture : toucher une ligne ouvre directement le champ correspondant ; une rubrique vide propose « Renseigner ».

**Mois par mois** (onglet Analyse)
- Nouveau graphique : vue « Par mois » (barres autour de zéro) et vue « Cumulé » (courbe et aire).
- Série continue : les mois sans mouvement apparaissent (à zéro) jusqu'au mois en cours, pour lire une vraie chronologie.
- Toucher un mois affiche son détail : résultat, recettes, dépenses, cumul, argent injecté.
- Au-delà de 9 mois, le graphique défile horizontalement et s'ouvre sur les mois les plus récents.
- Accueil : mini-courbe du résultat cumulé dans la carte « Réalisé ».

**Finitions**
- Barre d'onglets flottante (pilule, flou d'arrière-plan), halo discret en fond d'écran.
- Contrôle segmenté et champs « grand montant » harmonisés ; animations d'entrée des étapes (désactivées si moins de mouvement demandé).
- Code retiré : ancien composant `DualRow` et anciens éditeurs de rubrique, styles devenus inutiles.
- Aucune dépendance ajoutée.

## 1.1.0 — 2026-10-03

Refonte du design et de l'expérience. **Aucun changement du moteur métier** : modèle de données, calculs, stockage, persister, import/export, Prévu / Réel / Réalisé, PWA et mode hors connexion sont ceux de la 1.0.2. Les 167 tests existants passent sans modification. Audit de l'interface et design system : [docs/DESIGN.md](docs/DESIGN.md).

**Identité**
- Direction « patrimonial calme » : fond pierre, une seule couleur de marque (vert sapin), couleurs fonctionnelles rares, terre cuite plutôt que rouge vif.
- Nouveau monogramme (un toit et trois barres montantes) pour l'écran d'accueil et toutes les icônes de la PWA. `theme-color` clair et sombre.
- Design system à base de tokens (couleurs, surfaces, typographie, espacements en base 4, rayons, ombres, durées d'animation). Mode sombre retravaillé avec les mêmes tokens.

**Écrans**
- **Accueil** :
  - grande carte cash-flow avec barre revenus / dépenses ;
  - 4 indicateurs au lieu de 8, et une carte « Réalisé » ;
  - encadré « À vérifier » ;
  - le contrôle Prévu / Réel n'apparaît que lorsqu'il est utile.
- **Analyse** (nouvel onglet) :
  - solde net du projet et résultat par mois ;
  - Prévu / Réel sans tableau (valeur réelle, prévu, écart) ;
  - rentabilité et composition du coût.
- **Projet** : lecture d'abord, chaque rubrique affichant son total et ses lignes. « Modifier » ouvre le formulaire dans un panneau, avec l'état d'enregistrement. La synthèse du financement affiche une barre capital / intérêts / assurance.
- **Mouvements** : regroupement par jour, icône par catégorie, recettes en vert et dépenses en encre neutre. Ajout rapide : grand montant, pastilles de catégories fréquentes, bouton « Ajouter 620 € ».
- **Réglages** : la sauvegarde en premier, formulée sans jargon. L'effacement est isolé dans une « zone sensible ».
- Messages d'erreur reformulés : « Impossible d'enregistrer vos modifications. Vos données sont toujours visibles… ».

**Composants** : `Amount`, `Percent`, `Stat`, `Section`, `Line`, `DeltaPill`, `StackBar`, `Legend`, `EmptyState`, `Logo` ; contrôle segmenté à indicateur glissant ; jeu d'icônes unifié ; champs de montant avec séparateurs de milliers.

**Micro-interactions** : apparitions et transitions brèves, indicateur glissant, appui, panneaux, confirmations. Toutes sont désactivées si `prefers-reduced-motion` est actif.

**Dépendances** : aucune ajoutée.

**Tests** : 167 → 178 (`presentation.test.ts`, `ui.test.tsx`). Aucun test existant supprimé ni modifié.

## 1.0.2 — 2026-10-03

Sécurisation du socle, sans nouvelle fonctionnalité. Schéma de sauvegarde et base locale inchangés.

**P1 — `replaceAll()` exclusif** (`src/state/persister.ts`)
- *Avant* : une écriture incrémentale déjà engagée (échec suivi d'une nouvelle tentative, ou modification pendant l'écriture) pouvait programmer un timer après l'annulation faite par `replaceAll()`. Ce timer écrivait alors l'ancienne version **après** la restauration (course reproduite par un test, qui échouait sur la v1.0.1).
- *Correctif* :
  - une file unique pour toutes les opérations de stockage ;
  - un numéro de génération incrémenté par chaque restauration : une écriture antérieure ne modifie plus l'état et ne programme plus ni timer ni nouvelle tentative ;
  - aucun timer pendant une restauration ;
  - des restaurations successives exécutées dans l'ordre demandé.
- *Modifications pendant une restauration* : refusées (option A), dans le persister comme dans le store. Après la restauration, l'enregistrement normal reprend.

**Textes**
- Mouvements : ils alimentent le **suivi réalisé** et non plus « le réel ». Écran de bienvenue harmonisé.
- Argent personnel injecté : présenté comme une **estimation** fondée sur les déficits mensuels cumulés (sous-texte et aide détaillée avec exemple).

**PWA**
- `icon-maskable-512.png` est désormais précachée. Le service worker précache tout `public/` (liste générée, non codée en dur), et le build échoue si une icône du manifeste est absente.
- Plus d'avertissement au build (`import.meta.dirname`).

**Tests** : 154 → 167 (9 tests de concurrence `persister-replace.test.ts`, 4 tests PWA). Aucun test existant supprimé ni modifié.

## 1.0.1 — 2026-10-03

Correctif ciblé après audit indépendant. Pas de nouvelle fonctionnalité, ni d'écran ou de dépendance supplémentaire. Le schéma de sauvegarde est inchangé (voir [docs/MIGRATION.md](docs/MIGRATION.md)).

**P1 — Enregistrement local fiable** (`src/state/persister.ts`)
- Une modification n'est marquée enregistrée qu'**après** le succès de l'écriture IndexedDB. Avant, elle l'était dès le lancement de l'écriture : un échec pouvait laisser une version jamais réécrite.
- En cas d'échec, la version reste non enregistrée et en mémoire. Elle est retentée automatiquement (1 s, 3 s, 10 s, puis toutes les 30 s) et un bandeau propose « Réessayer ».
- Les écritures sont séquentielles : une ancienne écriture qui se termine après une nouvelle modification ne marque jamais la dernière version comme enregistrée. Un échec partiel est entièrement rejoué.
- Le navigateur avertit si l'on ferme la page avec des modifications non écrites.

**Prévu / Réel / Réalisé**
- La vue « Réel » n'est proposée que si un montant réel de référence existe. Un mouvement seul ne suffit plus.
- En vue Réel : une ligne « N montants encore prévus » et un petit rond creux ◦ sur les indicateurs qui utilisent encore du prévu. Le détail apparaît en touchant la carte.
- Une alerte s'affiche quand le payé d'une rubrique d'achat dépasse le montant utilisé par les calculs (ex. notaire : 5 400 € payés pour 5 000 € prévus). Rien n'est modifié automatiquement.

**Charges récupérables neutres**
- « Charges récupérées » et la nouvelle catégorie « Charges récupérables payées » n'ont plus aucun effet sur les recettes, le résultat, le solde net, l'argent injecté ou les rentabilités. Elles sont affichées à part, pour information.

**Argent personnel injecté et solde net** (remplacent « Sorti de ma poche »)
- Argent injecté = apport initial + déficits mensuels couverts de ma poche. Le calcul suit une trésorerie du bien mois par mois et ce montant ne diminue jamais.
- Solde net du projet = résultat d'exploitation cumulé − apport initial. Rien n'est compté deux fois entre l'apport, les paiements d'achat, le prêt et les mensualités.

**Imports et données locales**
- Montants négatifs refusés partout, mouvement à 0 € refusé, taux et durée bornés.
- Identifiants en double refusés : biens, mouvements, charges, catégories (y compris un identifiant réservé).
- Données locales endommagées : ce qui est sain est conservé, avec récupération partielle d'un bien. Une copie brute de l'original est mise en quarantaine, jamais effacée automatiquement. Un avertissement s'affiche et la copie se télécharge depuis Réglages. Base IndexedDB passée en version 2.

**Mensualité manuelle incohérente**
- Si mensualité × durée < capital : avertissement non bloquant, et intérêts, coût total et total remboursé affichés « incohérent » au lieu de 0 €.

**Tests** : 82 → 154. Aucun test v1.0.0 supprimé : ceux du journal sont adaptés aux nouveaux noms de champs, et celui de la mensualité incohérente attend désormais « incohérent » (null) au lieu de 0 €, conformément au nouveau comportement.

## 1.0.0 — 2026-10-03

Première version.

- Projet Prévu / Réel : achat, financement, location, charges
- Tableau de bord : cash-flow, effort d'épargne, coût du projet, argent investi, loyer, mensualité, rentabilités brute et nette (avant impôts), charges, rendement de l'apport, graphique revenus/dépenses, comparaison Prévu / Réel / Écart
- Journal des mouvements réels (catégories préremplies et personnalisées)
- « Sorti de ma poche » calculé à partir des mouvements
- Plusieurs biens (modèle), interface optimisée pour un seul
- Sauvegarde JSON versionnée (schéma 1) : export, partage, import validé avec confirmation
- PWA hors connexion, stockage IndexedDB local, aucune donnée transmise
- 82 tests unitaires
