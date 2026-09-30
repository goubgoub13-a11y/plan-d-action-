# Plan d'action · NaTran — Objectif Ingénieur

Une page HTML autonome pour piloter tes projets d'alternance (NaTran) et d'école (ISTP) : projets, plan d'action, Gantt, planning, jalons, journal de bord et compétences.

**Aucune installation, aucun code.** Double-clique sur `index.html` : la page s'ouvre dans ton navigateur (Chrome ou Edge recommandés). Les logos NaTran et ISTP sont intégrés au fichier.

Au premier lancement, la page contient :
- ton plan Excel *Plan_action_NaTran_v7_avec_Gantt* : le projet **PRJ-001 — Harmonisation du suivi maintenance multi-sites**, ses **40 actions** réparties en 10 phases et ses **10 jalons (J1 → J10)** ;
- ton **calendrier d'alternance ISTP** (Ingénieur Génie industriel FA) pour la dernière année : périodes à l'école **P13 à P17** et **épreuves finales du 6 au 24 septembre 2027**. La mobilité internationale est comptée en entreprise.

## Les fenêtres

| Fenêtre | À quoi elle sert |
|---|---|
| **Tableau de bord** | En-tête *Ma semaine* (en entreprise ou à l'ISTP, prochaine période, jours en entreprise restants, J-xxx avant le diplôme, frise du parcours), bannière *Depuis ta dernière visite*, boutons rapides, indicateurs, *Mes priorités* / *À relancer*, prochains jalons, projets |
| **Projets** | Une carte par projet : ID, chef de projet, avancement, risque, santé |
| **Page projet** | Objectif, livrables, avancement par phase, **contrôle du plan**, glissement par rapport à la référence, courbe réel/prévu, risques & décisions, plan d'action, Gantt, planning, jalons, journal. Bouton imprimante = **fiche projet PDF** |
| **Plan d'action** | Sélecteur **Ton projet** (tous les projets ou un seul), actions par phase, filtres (dont *Moi* / *Les autres*), puces de filtres actifs, **sélection multiple** (décaler, statut, responsable, priorité, terminer), ajout rapide, vue Kanban |
| **Fiche action** | Clic sur une action : **récapitulatif** (projet, statut, avancement, dates, prochaine étape) et **suivi daté** — la date du jour est déjà remplie, tu écris ce que tu as fait et l'avancement atteint. L'avancement de l'action et celui du projet se recalculent tout seuls |
| **Gantt** | Ligne *Alternance* (périodes ISTP, épreuves), jours fériés, planning de référence en fantôme, glisser-déposer pour replanifier |
| **Planning** | Calendrier teinté les jours à l'ISTP, jours fériés, dates cibles, prochains points et jalons |
| **Jalons** | Frise chronologique ; un jalon qui tombe pendant l'école est signalé |
| **Journal de bord** | Notes, **revue hebdomadaire** guidée, points hebdo gardés et tout le **suivi des actions** par date |
| **Compétences** | Portfolio : actions reliées à chaque compétence, preuves (liens), texte à copier pour le rapport et la soutenance |

## Pensé pour l'alternance

- **Moi / les autres** : indique ton prénom et tes autres noms dans les plans (*Pilote projet*…) ; tes actions sont séparées de celles à **relancer**. Le bouton *Relancé* note la relance et fixe le prochain point à J+7.
- **Calendrier d'alternance** (*Paramètres → Alternance*) : ajoute ou modifie une période (école, épreuves, congés). Les dates cibles qui tombent pendant l'école sont signalées, avec un bouton pour les décaler.
- **Replanifier les retards** : un assistant propose de nouvelles dates (en évitant l'école, les week-ends et les jours fériés) et les affiche avant d'appliquer.
- **Point hebdo** : un texte prêt à envoyer (terminé, en cours, points d'attention, semaine prochaine, jalons, prochaine période à l'ISTP), à copier dans Teams ou dans un mail.
- **Parcours ISTP** : un modèle de projet (rapport, livret, visite du tuteur, soutenance, épreuves finales) à compléter.
- **Actions récurrentes** : la suivante est créée quand tu termines la courante (chaque semaine, toutes les 2 semaines, chaque mois).
- **Vers Outlook** : export `.ics` de tes dates cibles, points de suivi, jalons et périodes à l'ISTP.

## Suivi d'une action

1. *Plan d'action* → choisis ton projet en haut (**Ton projet**).
2. Clique sur l'action : le récapitulatif s'affiche, avec la zone **Suivi de l'action** prête (date du jour).
3. Écris ce que tu as fait, règle l'**avancement après**, puis **Ajouter au suivi** (ou `Ctrl + Entrée`).

L'avancement du projet est la moyenne de ses actions : il se met à jour aussitôt. Une entrée antidatée garde son pourcentage sans modifier l'avancement actuel. Le suivi apparaît aussi dans le *Journal de bord*, dans le *point hebdo* (« Ce que j'ai fait ») et dans l'export Excel (onglet *Suivi des actions*).

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

> Le fichier `index.html` contient le plan de départ issu de ton classeur Excel (PRJ-001). Si le dépôt GitHub est public, ce plan de départ est visible par tous : passe le dépôt en privé si ces informations sont internes.

## Raccourcis

`/` rechercher · `N` nouvelle action · `Ctrl + Entrée` ajouter au suivi · `Ctrl + Z` annuler · `Ctrl + S` forcer la sauvegarde · `Échap` fermer
