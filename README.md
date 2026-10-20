# Plan d'action · NaTran — Objectif Ingénieur

Une page HTML autonome pour piloter tes projets d'alternance (NaTran) et d'école (ISTP) : projets, plan d'action, Gantt, planning, jalons, journal de bord et compétences.

**Aucune installation, aucun code.** Double-clique sur `index.html` : la page s'ouvre dans ton navigateur (Chrome ou Edge recommandés). Les logos NaTran et ISTP sont intégrés au fichier.

Au premier lancement, la page est **vierge** (aucun projet) : importe ta sauvegarde (.json) ou ton classeur Excel depuis le tableau de bord. Elle contient déjà :
- ta **grille de compétences ISTP** : les 24 compétences de la grille d'évaluation en entreprise (A1C1 à A11C3), rangées par bloc ;
- ton **calendrier d'alternance ISTP** (Ingénieur Génie industriel FA) pour la dernière année : périodes à l'école **P13 à P17** et **épreuves finales du 6 au 24 septembre 2027**. La mobilité internationale est comptée en entreprise.

## Interface Essentiel — 20 octobre 2026

L’accueil montre trois repères (projets ouverts, échéances à 7 jours, retards), quatre actions prioritaires et un résumé des projets. Le jaune NaTran est rétabli ; le logo noir transparent est utilisé sur fond clair, le jaune sur fond sombre.

| Accès | Contenu |
|---|---|
| **Vue d’ensemble** | Priorités, relances, projets, trois prochains jalons et alternance |
| **Projets** | Cartes avec objectif et avancement ; ouvrir un projet pour consulter ses prochaines actions |
| **Projet → Plus → Détails & analyse** | Cadrage complet, phases, courbe réel/prévu, contrôles, risques, décisions et planning de référence |
| **Plan d’action** | Liste essentielle par défaut ; **Filtres** pour affiner et **Options → Tableau détaillé** pour toutes les colonnes |
| **Plan d’action → Options** | Sélection multiple, replanification, export Excel et ajout rapide |
| **Fiche action** | Récapitulatif et suivi daté en premier ; définition, pilotage, risques, compétences et récurrence dans des sections dépliables |
| **Planning** | Calendrier des actions, points de suivi, jalons et alternance |
| **Outils & parcours** | Gantt, jalons, journal de bord, compétences et mon alternance |
| **Paramètres & sauvegardes** | Profil, calendrier, logos, imports/exports et restauration |

Les données, identifiants, historiques et formats de sauvegarde sont conservés. Aucune donnée de démonstration n’est ajoutée au plan. Les autres applications du dépôt ne sont pas modifiées.

Validation : `node --test tests/plan-action.test.cjs` vérifie la conservation des données, les points de restauration, les vues, les filtres et le calcul d’avancement. Le suivi puis le rechargement et le filtrage ont également été vérifiés dans le navigateur sur des données de test séparées.

## Pensé pour l'alternance

- **Moi / les autres** : indique ton prénom et tes autres noms dans les plans (*Pilote projet*…) ; tes actions sont séparées de celles à **relancer**. Le bouton *Relancé* note la relance et fixe le prochain point à J+7.
- **Calendrier d'alternance** (*Paramètres → Alternance*) : ajoute ou modifie une période (école, épreuves, congés). Les dates cibles qui tombent pendant l'école sont signalées, avec un bouton pour les décaler.
- **Replanifier les retards** : un assistant propose de nouvelles dates (en évitant l'école, les week-ends et les jours fériés) et les affiche avant d'appliquer.
- **Point hebdo** : un texte prêt à envoyer (terminé, en cours, points d'attention, semaine prochaine, jalons, prochaine période à l'ISTP), à copier dans Teams ou dans un mail.
- **Parcours ISTP** : un modèle de projet (rapport, livret, visite du tuteur, soutenance, épreuves finales) à compléter.
- **Actions récurrentes** : la suivante est créée quand tu termines la courante (chaque semaine, toutes les 2 semaines, chaque mois).
- **Vers Outlook** : export `.ics` de tes dates cibles, points de suivi, jalons et périodes à l'ISTP.

## Suivi d'une action

1. *Plan d'action* → choisis ton projet avec le sélecteur **Tous les projets**, en haut.
2. Clique sur l'action : le récapitulatif s'affiche, avec la zone **Suivi de l'action** prête (date du jour).
3. Écris ce que tu as fait, règle l'**avancement après**, puis **Ajouter au suivi** (ou `Ctrl + Entrée`).

L'avancement du projet est la moyenne de ses actions : il se met à jour aussitôt. Une entrée antidatée garde son pourcentage sans modifier l'avancement actuel. Le suivi apparaît aussi dans le *Journal de bord*, dans le *point hebdo* (« Ce que j'ai fait ») et dans l'export Excel (onglet *Suivi des actions*).

## Compétences

La liste vient de la colonne *Compétences* de la grille d'évaluation en entreprise ISTP (Ingénieur Génie industriel, version du 16/10/2024). Dans la fiche d'une action, coche les compétences travaillées ; le bouton ⓘ explique chacune d'elles. *Paramètres → Compétences* permet de modifier un intitulé ou une explication, d'ajouter tes propres compétences et de remettre la grille d'origine.

À l'import d'une ancienne sauvegarde, les 8 anciennes compétences par défaut sont remplacées par la compétence de la grille la plus proche ; celles que tu avais ajoutées toi-même sont gardées dans « Autres compétences ».

## Excel

*Paramètres → Excel & Outlook* :
- **Exporter en Excel** : un classeur avec les onglets Projets, Plan d'action, Jalons et Journal, avec les mêmes colonnes que ton modèle.
- **Importer un Excel** : relit les onglets *Projets*, *Plan d'action* et *Planning Gantt* de ton modèle. Ce qui existe déjà (même ID) est mis à jour, le reste est ajouté.

L'import/export Excel télécharge un module à la demande : il faut une connexion Internet. Hors ligne, l'export CSV fonctionne toujours.

## Sauvegarde

- **Automatique** : chaque modification est enregistrée tout de suite dans le navigateur (indicateur « Enregistré · hh:mm »).
- **Copie dans un fichier** (Chrome / Edge) : *Paramètres → Sauvegarde → Choisir un fichier*, par exemple dans OneDrive.
- **Points de restauration** : une copie par jour, 14 jours. Si l'espace du navigateur est plein, les plus anciens sont supprimés pour que ton plan reste enregistré.
- **Ctrl + Z** annule la dernière modification.

> Les données restent dans le navigateur utilisé. Si tu vides les données de navigation ou changes de navigateur, utilise ton fichier de sauvegarde ou un export pour les retrouver.

## Utiliser la page sur un autre PC (PC du travail)

La page est un simple fichier : copie `index.html` sur l'autre PC (mail, OneDrive, clé USB ou téléchargement depuis GitHub), puis double-clique dessus.

**Les données ne suivent pas le fichier** : elles sont enregistrées dans le navigateur de chaque PC. Pour les transférer :
- *Paramètres → Sauvegarde → Sauvegarde (.json)* sur le premier PC, puis *Importer (.json)* sur l'autre ;
- ou, si les deux PC ont accès au même dossier OneDrive : *Choisir un fichier* sur le premier, *Ouvrir un fichier existant* sur l'autre. Chaque modification est écrite dans ce fichier, et à l'ouverture la page propose de charger la version la plus récente.

Il n'y a **pas de synchronisation automatique** entre appareils (PC, téléphone) : chaque navigateur a sa propre copie. Le plus simple est de choisir un appareil principal.

## Confidentialité

Tout ce que tu saisis reste dans ton navigateur : la page n'envoie tes données nulle part (ni à GitHub, ni ailleurs). Elle charge seulement les polices d'écriture (Google Fonts) et, à la demande, le module Excel (cdnjs).

> Le fichier `index.html` ne contient plus aucun projet. Les anciennes versions, qui contenaient le plan PRJ-001, restent visibles dans l'historique Git : passe le dépôt en privé si ces informations sont internes.

## Raccourcis

`/` rechercher · `N` nouvelle action · `Ctrl + Entrée` ajouter au suivi · `Ctrl + Z` annuler · `Ctrl + S` forcer la sauvegarde · `Échap` fermer
