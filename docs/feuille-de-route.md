# Feuille de route — ajout du 13 novembre 2026

## Utilisation

Navigation **Feuille de route**. Choisir une année ou **Vision globale**, puis un projet et/ou un contexte. Les projets sans dates restent visibles. Les dates des phases proviennent des débuts et échéances des actions ; une date manquante reste « À définir ». La feuille de route n'affiche pas les actions détaillées.

Les jalons marqués **clé** sont prioritaires ; si aucun n'est marqué clé pour un projet, tous ses jalons sont présentés. Les prochaines échéances et les retards concernent la période sélectionnée. Les blocages et l'état d'avancement sont ceux du projet au moment de l'ouverture.

**Compléter QCDSE** ajoute des informations facultatives : contribution industrielle, qualité, coûts, contraintes de délais, sécurité, environnement, décisions explicitement en attente. Les anciens arbitrages sont affichés séparément, sans leur attribuer un statut d'attente.

**Exporter en PDF** télécharge directement un PDF A4 paysage, suivant les filtres affichés : trajectoire globale puis synthèses des projets, QCDSE et jalons. Les textes longs sont paginés. L'export fonctionne sans réseau : moteur PDF et police sont intégrés dans l'HTML.

## Sauvegardes

Aucun changement de version, de clé de stockage ou de format d'import/export. Les fonctions `migrate`, `validData`, `replaceState`, `exportJSON`, `importJSONFile` restent inchangées. Aucun projet de démonstration n'est inséré.

La lecture ne modifie aucune donnée métier. Un projet ne reçoit le nouveau champ facultatif `roadmap` qu'en enregistrant le formulaire QCDSE. Propriétés : `contribution`, `quality`, `costs`, `deadlines`, `safety`, `environment`, `pendingDecisions` (chaînes). L'absence de champ équivaut à une chaîne vide, affichée « Non renseigné ». Les clés inconnues de cet objet sont préservées. Les préférences de filtre sont rangées dans `UI.roadmap`, séparément des données métier.

## Validation réellement exécutée

- `node --test tests/*.test.cjs` : 10 tests réussis (5 existants, 5 ajoutés).
- Rendu de tous les onglets et du Gantt ; filtres année/projet/contexte ; phases, dates manquantes, jalons clés, champs inconnus et absence de données de démonstration.
- Fonctions réelles d'import/export JSON exécutées avec un fichier de contrôle, réimportation et comparaison des objets. Lecture de fichier et téléchargement simulés dans Node ; normalisation déjà existante prise en compte.
- Navigateur : import du fichier de contrôle (3 projets, 2 actions, 3 jalons), vision annuelle/globale, filtre projet, formulaire QCDSE, enregistrement/rechargement, export JSON et réimportation confirmée ; compléments QCDSE conservés. Gantt, changement d'échelle et filtre « Terminées » manipulés.
- PDF téléchargé dans le navigateur, contrôlé avec `pdfinfo` et rendu en PNG : A4 paysage, 2 pages pour le projet filtré, accents et mise en page vérifiés.
- Moteur PDF embarqué exécuté en test : génération d'un document paysage filtré sur un projet.

Limites : la sauvegarde personnelle de l'utilisateur n'était pas présente dans le dépôt ni jointe à cette demande. Les contrôles sont réalisés sur un fichier de test conforme au modèle, et ne constituent pas un contrôle de ses données réelles. Les actions de glisser-déposer du Gantt, les services externes Excel/Outlook et la synchronisation OneDrive n'ont pas été retestés ; leur code n'a pas changé.

## Fichiers

- `index.html` : onglet, styles isolés, calculs en lecture, formulaire facultatif, PDF autonome ; aucun changement des autres vues.
- `tests/roadmap.test.cjs` : vérifications dédiées.
- `docs/feuille-de-route.md` : utilisation, modèle, validations et limites.
- `docs/roadmap-third-party-licenses.txt` : licences des composants PDF embarqués.

## Dépendances embarquées

jsPDF 4.2.1 (MIT), distribution UMD officielle ; police DejaVu Sans, sous-ensemble latin et caractères usuels français. Aucun module n'est téléchargé à l'ouverture ou à l'export PDF.
