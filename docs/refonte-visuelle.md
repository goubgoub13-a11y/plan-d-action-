# Refonte visuelle — copie de comparaison du 13 novembre 2026

## État des lieux avant modification

Source vérifiée : branche `claude/zealous-einstein-6u50ue`, commit `4e8a3cd4e2cdc456e81de2635836a37f105f82cb`. L'application autonome est `index.html`. Les données personnelles résident dans le navigateur ou les fichiers JSON de l'utilisateur, pas dans ce dépôt. Le module immobilier voisin est indépendant.

| Ensemble existant | Informations et fonctions à préserver | Présentation retenue |
| --- | --- | --- |
| Vue d'ensemble | Projets ouverts, échéances sous 7 jours, retards, priorités personnelles, relances, projets, prochains jalons, alternance, point hebdo, revue, rappels et démarrage | Synthèse chiffrée sobre, portefeuille en lignes, actions et jalons, repères de parcours et sauvegarde |
| Projets | Contextes, filtres, tri, statuts, dates, couleurs, responsables, objectifs, livrables, commentaires, sponsors, risques, santé | Tableau comparatif par défaut ; cartes toujours disponibles |
| Fiche projet | Aperçu, phases, actions, calendrier, Gantt, jalons, journal, analyses, courbes, références de planning, impression | Onglets explicites, phases maintenues dans l'aperçu, détail complet conservé |
| Plan d'action | Liste essentielle/détaillée, Kanban, filtres, phases, sélection multiple, création rapide, échéances, priorités, dépendances, récurrence, avancement | Composants harmonisés ; regroupement par projet conservé |
| Fiche action | Description, résultat, responsable, checklist, liens, risques, décisions, compétences, notes et suivis datés, relances | Même fiche et mêmes commandes, lisibilité renforcée |
| Feuille de route | Phases, trajectoire, QCDSE, jalons, arbitrages, filtres, édition, PDF | Même calcul et mêmes fonctions, accès direct sous Planifier |
| Gantt / Planning / Jalons | Glisser-déposer, dépendances, références, modes et zooms, périodes scolaires, jours fériés, exports | Trois destinations distinctes et visibles sous Planifier |
| Journal | Notes et revues, liens aux actions et projets | Accès direct sous Piloter |
| ISTP | Grille unique, preuves, états manuels, évaluations futures, préparation EEE, PDF, échéances du projet scolaire | Entrée ISTP — Évaluation et quatre sous-vues inchangées ; ancienne route Compétences compatible |
| Parcours | Objectif, calendrier d'alternance, compte à rebours, temps en entreprise, jalons clés | Mon alternance sous Parcours ISTP |
| Paramètres / sauvegardes | Profil, logos, thèmes, grille, JSON, Excel, CSV, Outlook, fichier lié, restauration, annulation, raccourcis | Accès permanent et boutons explicites Importer / Exporter |

### Diagnostic visuel

La navigation actuelle mélange destinations principales et outils masqués dans « Outils & parcours ». Des informations de pilotage sont distribuées entre cartes et fiches, et certaines tailles de texte descendent à 9–10 px. Les aplats de couleur attribués aux sections concurrencent les couleurs des projets. Le tableau d'accueil ne montre que quatre projets. La nouvelle organisation distingue les décisions de pilotage, la planification dans le temps et les obligations scolaires, sans supprimer les destinations existantes.

### Références consultées

- Asana, [Portfolios overview](https://help.asana.com/s/article/portfolios-overview?language=en_US) : lecture du portefeuille et accès aux projets.
- Linear, [Project overview et milestones](https://linear.app/changelog/2024-05-02-the-next-generation-of-linear-projects) : propriétés du projet et contexte réunis, détails accessibles.
- Nielsen Norman Group, [8 Design Guidelines for Complex Applications](https://www.nngroup.com/articles/complex-application-design/) : réduire l'encombrement sans réduire les capacités, séparer informations principales et secondaires.

Application au besoin NaTran : tableau en lignes, titres factuels, peu de couleurs de fond, détail conservé dans les fiches. Aucun graphique décoratif ni indicateur inventé.

## Copie et retour arrière

L'original `index.html` reste identique. La copie est `refonte/index.html`, publiée sous `plan-action/refonte/index.html`. La branche `sauvegarde/avant-refonte-visuelle-2026-11-13` conserve le point de départ complet.

Au premier lancement de la copie, les données et préférences de l'original sont copiées si elles existent sur la même origine dans ce navigateur. Les modifications ultérieures restent indépendantes. Si l'original est un fichier local, un autre navigateur ou une autre origine, importer le JSON habituel. Le lien « Version actuelle » ramène à l'original. Pour transférer volontairement les modifications, exporter le JSON de la copie puis l'importer dans l'original.

Le format JSON et les migrations métier ne changent pas. La copie utilise ses propres clés de stockage, points de restauration et base de liaison fichier. Aucun fichier automatiquement lié dans l'original n'est reconnecté implicitement. Un nouveau fichier de sauvegarde proposé porte un nom distinct.

## Vérifications effectuées

- 28 tests automatisés sur l'original et les invariants de la copie, puis les 20 tests métier existants exécutés sur la copie : 48 succès, aucune erreur.
- Contrôle de l'identité exacte du fichier original, de toutes les routes et commandes, des phases, de la feuille de route, des migrations ISTP et de la génération PDF.
- Import/export/réimport JSON, champs inconnus, logos, préférences et notes conservés ; isolation des stockages et absence de réimport automatique après la première ouverture.
- Contrôle dans Chromium avec un jeu de données explicitement fictif : import via le lecteur JSON, tableau de bord, projets en tableau et cartes, filtres, phases, fiche action, ajout d'une note et persistance après rechargement, feuille de route, recherche A3C1 et accès au journal de l'action depuis ISTP.
- Inspection visuelle en thème clair et sombre et à 390 px de largeur ; correction du bouton de préparation hebdomadaire sur petit écran.

Limites : les données personnelles présentes dans le navigateur de l'utilisateur n'étaient pas accessibles ; la validation utilise des sauvegardes de contrôle. Aucun test sur machine Windows ou Mac physique n'a été effectué. Les documents externes restent soumis à leurs liens et droits d'accès existants. Les modifications effectuées dans la copie et dans l'original ne se synchronisent pas : le transfert volontaire utilise le JSON.

## Deuxième amélioration : fiches latérales et réunions

- La même copie reçoit une fiche action de lecture en trois onglets : Synthèse, Suivi et Preuves & compétences. Statut, échéance, prochaine étape et nouvelle note peuvent être enregistrés ensemble. L'édition complète conserve checklist, dépendances, charge, récurrence, risques, compétences et tous les autres champs.
- Les liens « Ouvrir l'action et ses notes » ouvrent directement le suivi. La page, ses filtres et sa position restent en arrière-plan. Une fermeture avec saisie non enregistrée demande confirmation ; les onglets se parcourent aussi aux flèches du clavier.
- Rubrique Réunions et raccourci Mode réunion sur l'accueil : réunions datées, participants, période d'avancées, sélection libre d'actions et compétences, ou reprise de la sélection d'une EEE existante. Recherche, ordre des points, retrait, modification et suppression avec annulation.
- Présentation avec navigation réduite, un point à la fois, preuves accessibles dans la fiche latérale, passage précédent/suivant et notes de décision enregistrées automatiquement. L'impression prépare tous les points, pas uniquement celui affiché ; le PDF passe par la fonction d'impression du navigateur.
- Nouvelle collection JSON optionnelle `meetings` : identifiants stables, références aux actions/compétences, notes propres au rendez-vous. Aucun clonage d'action ou de compétence et aucune validation officielle implicite. Les réunions relisent les données actuelles des fiches : elles ne sont pas un archivage figé ; imprimer le dossier pour garder une version datée.
- Finition visuelle : typographie et alignements renforcés, sections moins encadrées, surfaces sobres, couleurs des projets conservées, thèmes clair/sombre et adaptation aux petits écrans.

Sources de la deuxième amélioration : `refonte/interface.js` et `refonte/interface.css`, embarquées dans `refonte/index.html` avec `python scripts/build-interface.py`. Le HTML reste autonome. Ne pas reconstruire cette version depuis l'ancien générateur temporaire de la première copie.

Vérification V2 : 32 tests sur l'original et les invariants de la copie, puis 20 tests métier sur la copie. Les nouveaux tests couvrent sélection sans doublons, reprise EEE, données sources non modifiées, références absentes, période de suivi, récurrence métier, dates incohérentes, persistance et export/réimport des réunions. Contrôles Chromium : nouvelle note depuis la fiche, recherche et sélection action + A3C1, présentation, accès direct au compte rendu, édition complète, protection d'un brouillon et notes retrouvées après rechargement. Le dialogue d'impression a été déclenché ; aucune imprimante physique n'a été testée.
