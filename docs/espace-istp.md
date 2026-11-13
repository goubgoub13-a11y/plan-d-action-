# ISTP — Évaluation (13 novembre 2026)

## Utilisation

L'entrée **ISTP — Évaluation** est ajoutée au menu principal. Elle contient quatre rubriques :

1. **Vue d'ensemble** : évaluation sélectionnée, preuves accessibles, points à discuter et accès à l'action centrale.
2. **Compétences** : référentiel existant `skills`, une ligne par compétence ; recherche par code/intitulé, filtres bloc/état/projet, fiche au clic. Les liens existants `action.skills` sont conservés. Le portfolio d'actions et les commandes historiques restent accessibles ; la route `#/competences` reste valide.
3. **Dossier des preuves** : 14 références initiales, preuves partagées entre compétences, ajout/modification/retrait ; liens HTTP(S) ou accès direct aux actions et vues existantes.
4. **Échéances** : lecture des actions et jalons du projet scolaire existant, avec sélection explicite du projet si la reconnaissance est ambiguë. Aucun projet ni calendrier supplémentaire n'est créé.

**Préparer mon EEE** permet de choisir les compétences d'une évaluation et d'ouvrir une présentation lisible. Les filtres peuvent ensuite restreindre cette présentation. Les évaluations futures sont ajoutées avec **Nouvelle évaluation**. L'export PDF prend les compétences choisies pour l'évaluation et les filtres actifs ; il fonctionne hors ligne avec le moteur PDF déjà embarqué pour la feuille de route.

## Préremplissage et prudence métier

La base initiale reprend exclusivement les déclarations de l'utilisateur arrêtées au 13/11/2026. Il n'y a aucune note officielle ni compétence initialement validée. La VSM préventive, l'analyse environnementale, les formations, les ateliers collectifs, la clôture et le REX ne sont pas présentés comme réalisés. Les causes de l'Ishikawa restent des hypothèses ; les notes multicritères ne sont pas un arbitrage officiel.

Les preuves externes sans URL restent « Document à rattacher · Lien à renseigner ». Leur préparation n'implique pas leur disponibilité dans l'application. Les références PRJ-001, PRJ-003 et PRJ-004 sont rapprochées des projets importés sans changement de nom, identifiant ou périmètre. En cas de référence ambiguë, aucun projet n'est choisi arbitrairement.

L'action PRJ-001-A06 est recherchée par référence, puis par intitulé non ambigu dans PRJ-001. Le bouton ouvre sa fiche et ses suivis existants : aucun compte rendu n'est recréé. Les actions associées aux compétences sont l'union des liens `action.skills` existants et des actions référencées par les preuves.

Le projet « Parcours ISTP — dernière année » est conservé. Une action EEE existante y est réutilisée. Si elle manque, une seule action centrale est ajoutée avec échéance au 17/11/2026 et une checklist de cinq contrôles. Aucune action n'est générée par compétence. Si le projet scolaire n'est pas présent ou n'est pas identifiable, sa sélection est demandée dans la rubrique Échéances ; aucun nouveau projet n'est inventé.

## Données et compatibilité

La structure optionnelle `istp` contient :

- `schema`, `seedVersion` : version locale et marqueur de préremplissage.
- `records` : informations personnelles de préparation, indexées par les identifiants du référentiel existant `skills`.
- `evidence` : preuves à identifiant stable, `skillIds` multiples, origine, description, état, date/version, URL/action/vue interne.
- `evaluations` : rendez-vous distincts, compétences choisies, notes de préparation et éventuelle action centrale.
- `settings` : projet scolaire sélectionné et marqueur d'action centrale.
- `deletedEvidenceIds` : références retirées, pour empêcher leur recréation par le préremplissage.

Les champs inconnus sont conservés. Le préremplissage est idempotent ; les données personnelles ne sont pas remplacées à chaque ouverture. Une sauvegarde JSON contenant `istp` restaure ce dossier. Si une sauvegarde JSON ancienne n'a pas ce champ, le dossier ISTP actuel est conservé et rattaché aux projets importés lorsque les références sont identifiables. Les autres données gardent le fonctionnement historique de remplacement après confirmation. Le bouton de remise à zéro et les points de restauration gardent leur sens.

Les états sont : À préparer, En cours, Preuve prête, Validée, Prévue plus tard. Passer une compétence à Validée exige le nom du tuteur, une date et une case de confirmation explicite. Aucune validation n'est déduite du statut d'une action ou de la disponibilité d'un document. Le niveau de maîtrise officiel n'est pas calculé.

Les préférences d'affichage sont rangées séparément dans `UI`. Le nom de stockage et la version du plan existants ne sont pas changés. Les nouvelles données font partie de l'export JSON habituel, de la sauvegarde locale et des copies de fichiers déjà prises en charge.

## Vérifications exécutées

`node --test tests/*.test.cjs` : **20 tests réussis**, dont 10 nouveaux contrôles ISTP. Vérifications : migration et idempotence, absence de projets inventés, rapprochement après import, réutilisation/création unique d'action centrale, conservation des noms/couleurs/logos/paramètres/champs inconnus/notes, refus des validations implicites, preuves multicompetences et URL sûres, filtres, routes anciennes et nouvelles, aller-retour import/export/réimport/rechargement, conservation des préparations lors d'un import ancien et génération PDF.

Contrôles dans le navigateur, avec une copie de test isolée :

- Import d'un JSON antérieur (4 projets, 2 actions, 1 jalon).
- Recherche A3C1, filtres état/projet/bloc ; ouverture de l'action A06 et lecture de son suivi déjà présent.
- Refus de validation sans confirmation ; modification du statut et d'un commentaire, conservés après rechargement.
- Ajout puis retrait d'une preuve ; retrait durable après rechargement.
- Choix de deux compétences pour l'EEE, affichage de la présentation et téléchargement d'un PDF de deux pages A4 paysage ; rendu PNG inspecté.
- Ajout d'une évaluation future ; export JSON et réimportation de ce fichier via l'importateur réel (File/FileReader), avec dossier et évaluations conservés.

Les tests de l'ensemble des autres vues et de la feuille de route continuent de passer. Le code des projets, actions, notes, jalons, Gantt et de la feuille de route n'est pas refondu.

## Limites réelles

Le dépôt contient le code de l'application, pas la sauvegarde personnelle stockée dans le navigateur de l'utilisateur. Les essais utilisent un fichier de contrôle au format existant ; aucun contrôle des données personnelles réelles ne peut être affirmé. Les liens SharePoint/OneDrive/GitHub sont à renseigner et restent soumis aux droits d'accès habituels. Aucun document externe n'est téléversé ou simulé par ce changement.

Contrôles effectués sous Chromium et tests Node. Windows/macOS ne sont pas matériellement testés dans cet environnement ; les composants HTML et le modèle de stockage restent ceux de l'application. La synchronisation de fichiers, les exports Excel/Outlook et le glisser-déposer du Gantt ne sont pas réécrits ni intégralement retestés.
