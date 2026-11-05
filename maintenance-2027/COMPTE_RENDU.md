# Compte rendu – Prototype de suivi maintenance 2027 (V0.1)

Livrable : `Prototype_Suivi_Maintenance_2027.xlsx`, construit uniquement à partir du pack anonymisé (`sources/`). Toutes les données sont fictives. Aucune valeur n'a été inventée, corrigée ou supprimée.

## 1. Principaux choix

**Six onglets, chacun avec un rôle précis**

| Onglet | Contenu |
|---|---|
| `01_SUIVI_2027` | La vue à montrer : 45 opérations 2027 sur 28 installations, indicateurs, filtres, volets figés. |
| `02_DONNEES_SOURCE` | Copie exacte de l'export fictif : 122 lignes de 2026 à 2032, mêmes colonnes, même ordre, mêmes types. |
| `03_REFERENTIEL` | Copie exacte du référentiel (5 codes, dont TYPE_E « À confirmer »). |
| `04_AVIS_UTILISATEURS` | Recueil des retours, une ligne par remarque. |
| `05_POINTS_A_VALIDER` | 9 hypothèses ou incohérences relevées, à trancher. |
| `06_NOTICE` | Mode d'emploi, origine de chaque colonne, procédure d'actualisation. |

**Table normalisée.** Une ligne correspond à une opération sur une installation. Il n'y a ni colonne par type d'opération ni colonne « dernière/prochaine date ». `T_Source` et `T_Referentiel` sont des tableaux Excel nommés, sans cellule fusionnée ni formule, donc importables tels quels dans Power BI (relation `Type opération source` → `Valeur source`).

**Colonnes de la vue.** Périmètre, Groupe, Code installation, Installation, **Opération**, Famille, Périodicité, Référence technique, Code type source, Statut référentiel, Point de vigilance.
- La colonne *Année* a été retirée de la vue : elle vaut toujours 2027, et l'année figure déjà dans le titre et dans `02`.
- Le *Code type source* est conservé pour garder le lien avec la GMAO.
- Opération, famille, référence et statut sont lus dans le référentiel par formule. Corriger le référentiel corrige donc la vue (testé). Un code absent du référentiel s'affiche « À confirmer » / « Absent du référentiel ».

**Vue figée et contrôlée plutôt que vue dynamique.** Les lignes 2027 de la vue sont des valeurs recopiées de la source à la construction. Deux autres options ont été écartées :
- des formules de filtrage dynamique (`FILTER`), réservées à Excel 365 ;
- des vues à base d'`INDEX` : elles cassent le tri et laissent des lignes vides.

Power Query viendra quand les colonnes auront été validées (voir la V0.2). Le risque d'une vue périmée est couvert par deux contrôles :
- la ligne 6 compare le nombre de lignes de l'année entre la source et la vue ;
- la colonne *Point de vigilance* signale toute ligne de la vue qui n'existe plus dans la source.

**Charte**
- Police Century Gothic.
- Vert canard pour le bandeau et les en-têtes.
- Jaune réservé au logo, au filet d'accent et aux informations « à confirmer ». Le texte de la cellule porte toujours l'information, la couleur ne fait que la souligner.
- Gris clair pour les indicateurs et les lignes alternées.
- Le logo RVB est le fichier d'origine, intégré sans retouche, avec un écart de ratio inférieur à 0,001 %.

## 2. Améliorations proposées (intégrées)

- **Indicateurs** : nombre d'opérations, installations concernées, lignes *affichées* (ce compteur suit les filtres), répartition par opération, statuts à confirmer et points de vigilance.
- **Contrôle source / vue** (ligne 6) et, sur chaque ligne, signalement « Absente de la source : actualiser ».
- **Doublons potentiels** : les lignes strictement identiques sont conservées et signalées (6 lignes en 2027).
- **Lignes alternées** qui restent régulières quand on filtre.
- **Recherche rapide** : celle des flèches de filtre, intégrée à Excel. Aucune macro.
- **Impression** A4 paysage : en-têtes répétés et pied de page « données fictives – la GMAO reste la source de référence ».
- **Avis** : listes déroulantes *Thème* (les 7 questions du brief) et *Priorité*, une ligne d'exemple, et une colonne *Suite donnée* pour l'équipe projet.
- **Aperçus** : les résultats des formules sont enregistrés dans le fichier. Un aperçu sur téléphone ou un import Power BI affiche donc les bons chiffres sans recalcul.

## 3. Points restant « À confirmer » (détail dans `05_POINTS_A_VALIDER`)

1. **TYPE_E « Opération spécifique »** : référence technique et statut « À confirmer ». 4 opérations 2027 sont concernées.
2. **Doublons stricts** dans la source : INST-006, INST-010 et INST-021 (TYPE_A, 2027), INST-040 (TYPE_A, 2028), INST-020 (TYPE_E, 2029). S'agit-il d'interventions distinctes ou d'un doublon d'extraction ? Quel identifiant unique la GMAO fournira-t-elle ?
3. **Périodicité.** Dans 7 cas, l'intervalle entre deux occurrences diffère de la périodicité indiquée. Exemple : INST-017, révision « 6 ans », prévue en 2027 puis en 2029. Aucune année n'est recalculée : seules les années présentes dans la source sont affichées.
4. **Ancien suivi.** Les mêmes codes y portent d'autres libellés (INST-001 = « Installation Démo 01 » contre « Installation A1 »). Aucun rapprochement n'a été fait.
5. **Correspondance probable mais non documentée** entre les colonnes de l'ancien suivi et les codes : contrôle → TYPE_A, révision → TYPE_D, contrôle filtre → TYPE_C. Cette hypothèse n'a pas été appliquée.
6. **Périmètre et Groupe** n'existent que sous forme de codes, sans libellés lisibles.
7. **Référence technique** portée par le type d'opération et non par l'installation : cela correspond-il à la réalité ?
8. **Granularité.** La source ne donne que l'année. Faut-il un mois ou une date ?
9. **Vue N+1 ou pluriannuelle** : serait-elle utile ? La source couvre 2026 à 2032.

## 4. Éléments des anciens suivis non intégrés mais potentiellement utiles

Les éléments suivants proviennent de `EXEMPLE_SUIVI_ACTUEL.xlsx` :
- **Tournée** : utile pour organiser les passages et comme filtre de terrain.
- **Dates de dernière réalisation** par opération (contrôle, révision, contrôle filtre).
- **Dates prévisionnelles précises** (« prochain… »), alors que la source ne donne que l'année.
- **Observation locale** : commentaire libre (« À revalider », « Préparation à anticiper », « RAS »).

Ils ne sont pas intégrés pour trois raisons. Les codes ne se rapprochent pas de façon fiable de la source (point 3.4). La correspondance entre colonnes et types n'est pas confirmée (point 3.5). Enfin, ces informations doivent venir de la GMAO, pas d'un fichier local. Sous forme normalisée, elles deviendraient des colonnes de la ligne d'opération : *Date dernière réalisation*, *Date prévue*, *Tournée / secteur*, *Commentaire*. Elles sont à demander dans l'extraction GMAO.

## 5. Limites de la V0.1

- **La vue n'est pas reconstruite automatiquement.** Après un nouvel export, le contrôle signale « VUE À ACTUALISER », mais seul le script `outils/construire_prototype.py` régénère la vue (Python + openpyxl).
- **Les 5 tuiles de répartition** sont liées aux lignes 2 à 6 du référentiel. Si le référentiel s'agrandit, il faudra ajouter des tuiles ou passer par un tableau croisé.
- **Pas de segments (slicers)** : les filtres natifs d'Excel suffisent pour la V0.1.
- **Pas de protection de feuille** : une saisie accidentelle dans `01` reste possible.
- **Doublons** : faute d'identifiant d'opération, ils sont détectés sur code + type + périodicité + année.
- **Vérifications faites avec LibreOffice** : recalcul sans erreur des 243 formules, rendu visuel, données comparées cellule par cellule aux sources, simulation d'un nouvel export. **Le fichier n'a pas été ouvert dans Microsoft Excel** dans cet environnement. À vérifier dans Excel : ouverture sans message de réparation, flèches de filtre, rendu de Century Gothic, aperçu avant impression.

## 6. Recommandations pour la V0.2

1. Faire tester la V0.1 par les responsables (`04`) et trancher les points de `05`.
2. Définir l'extraction GMAO cible, avec ces colonnes : identifiant d'opération ou de gamme, code et libellé installation, libellés de périmètre et de groupe, type, périodicité, année et date ou mois prévus, date de dernière réalisation, statut, tournée ou secteur, date d'extraction.
3. Remplacer la vue figée par une requête **Power Query** : export → typage → filtre sur l'année (paramètre) → fusion avec le référentiel. La mise à jour se fera alors par *Données › Actualiser tout*.
4. Ajouter des référentiels pour les périmètres et les groupes (libellés, responsables).
5. Ajouter des segments sur Périmètre, Groupe et Opération, et un tableau croisé pour la répartition.
6. Protéger `01` une fois la structure validée, en laissant filtres et tris autorisés.
7. Si un besoin de saisie apparaît : créer une table de commentaires séparée, reliée par l'identifiant d'opération, sans jamais modifier les données source.
8. Power BI : partir du modèle `T_Source` + `T_Referentiel` et reprendre les indicateurs de la vue comme mesures.
