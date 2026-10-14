# Compte rendu V0.4 : vision globale de la maintenance préventive

**Fichier :** `Prototype_Maintenance_Preventive_V04.xlsx` (la V0.3 n'a pas été modifiée).
**Données :** 100 % fictives (OT 910000001…, postes G-I-AAA01…, « Poste fictif Alpha »…). Seules les catégories réelles sont gardées : sites, équipes, activités et types d'opération du programme.

La V0.4 répond à deux questions, dans cet ordre :

1. **Sur ce site, dans cette équipe, sur chaque poste, qu'est-ce que j'ai à faire en maintenance préventive cette année et les années à venir ?** C'est l'onglet 01, construit à partir du programme (PDM).
2. **Les OT préventifs correspondants sont-ils bien dans la GMAO ?** C'est l'onglet 02, construit à partir de l'export GMAO, avec le détail dans l'onglet 03.

Il n'y a ni VBA ni macro. Tout repose sur Power Query, des tableaux Excel, des tableaux croisés dynamiques (TCD) et des segments.

---

## 1. Architecture

| Onglet | Contenu | Alimenté par |
|---|---|---|
| **01_VISION_GLOBALE** | Une ligne par poste : Site, Équipe, Code poste, Désignation, Typologie, puis une colonne par année (2026 à 2032). Les opérations d'une même année sont dans une seule case, par exemple « PIS + EC SIMPLE » ou « PIS + EC FILTRE + REVISION ». Trois indicateurs : postes affichés, opérations de l'année de référence, année de référence. Segments SITE, ÉQUIPE et TYPOLOGIE. | Requête `Vision_Globale` (programme) |
| **02_COUVERTURE_OT** | TCD en lignes Année / Site / Équipe / Code poste / Désignation, colonnes par activité (PIS, EC, PILOTAGE, FILTRE, REV…). Chaque nombre est un nombre d'OT distincts. Un TCD séparé donne le total d'OT préventifs distincts. Segments SITE, ÉQUIPE et ANNÉE, reliés aux deux TCD. | Requête `OT_Detail` |
| **03_DETAIL_OT** | Une ligne par OT préventif et par activité, avec les filtres Excel standards. La première ligne est figée. | Requête `OT_Detail` |
| **04_PARAMETRES** | Fichier programme, fichier GMAO, année de référence, date de dernière actualisation, puis « Contrôles à vérifier : X ». Les réglages techniques sont plus bas. | Saisie et formules |
| **05_NOTICE** | Mode d'emploi en une page. | Texte |
| 90 à 95 (masqués) | Contrôles, anomalies ligne à ligne, programme normalisé, rapprochement, référentiels (sites, équipes, activités, opérations, colonnes PDM, correspondances, règles de comparaison), code M. | Requêtes et saisie |

Requêtes Power Query intégrées au classeur (Données › Requêtes et connexions) :

```
PDM_Normalise ─┬─> Vision_Globale ──> 01
               └─> Rapprochement ──> 93
GMAO_Lignes (connexion seule) ─> OT_Detail ──> 03 ──> TCD de 02
                               ├─> Controles ──> 90 ──> « Contrôles à vérifier » (04)
                               └─> Anomalies ──> 91
```

Seules `PDM_Normalise` et `GMAO_Lignes` lisent des fichiers. Les autres requêtes ne lisent que des requêtes, ce qui évite les erreurs de confidentialité de Power Query (« Formula.Firewall »). Une copie du code M se trouve dans `power-query/` et dans l'onglet masqué 95_CODE_M.

## 2. Remplacer le programme (PDM)

1. Placer le nouveau fichier programme dans le même dossier que le classeur.
2. Dans 04_PARAMETRES, saisir son nom (par exemple `PDM_2027.xlsx`) à la place de `DEMO_PDM.xlsx`. Un chemin complet est aussi accepté (`C:\…\PDM.xlsx` ou `\\serveur\…`).
3. Lancer Données › Actualiser tout.

Format attendu : **une ligne par poste × année × opération**, comme `DATA_PDM_TEST.xlsx`, en `.xlsx` ou en `.csv` séparé par « ; ».
- Champs obligatoires : Site, Équipe, Année, Opération, et au moins Code Emprise ou Code Installation.
- Champs facultatifs : Désignation, Typologie.
- Si les colonnes du fichier ont d'autres noms (par exemple « Code installation » ou « Type opération source »), corriger la colonne de droite de **T_Colonnes_PDM** dans 94_REFERENTIELS. Il n'y a rien d'autre à toucher.
- Si une colonne manque, l'actualisation s'arrête avec un message qui la nomme.

Code poste du programme : **Code Emprise**. S'il est vide, ce sont les 9 premiers caractères de Code Installation (cas signalé dans les contrôles).

Une nouvelle année, un nouveau poste ou une nouvelle combinaison d'opérations apparaissent seuls à l'actualisation. Une nouvelle année ajoute une colonne à droite de 01.

## 3. Remplacer l'export GMAO

1. Exporter les OT avec les 24 colonnes habituelles, en `.xlsx` ou en `.csv` séparé par « ; ».
2. Placer le fichier dans le même dossier que le classeur et saisir son nom dans 04_PARAMETRES, ou bien enregistrer l'export sous le nom `DEMO_GMAO.xlsx`.
3. Lancer Données › Actualiser tout.

Règles appliquées à l'export :

- **Site** = Groupe gestionnaires.
- **Équipe** = Poste travail princ.
- **Année planifiée** = année de Date début planifiée.
- **Code poste** = Code site. Si Code site est vide, ce sont les 9 premiers caractères du Poste technique (cas signalé).
- **Écart de code** : si Code site et GAUCHE(Poste technique;9) diffèrent, le Code site est retenu et l'écart est signalé.
- **Activité** : la valeur est découpée sur « + », chaque morceau est nettoyé et passé en majuscules, et on obtient une ligne par activité. Une activité inconnue est gardée et signalée « à valider ».
- **Couverture** : seuls les OT dont le Type de travail est **PRE** sont pris en compte. Les autres OT ne figurent que dans les contrôles.
- **Lignes vides** : les lignes de fin d'export sans Ordre, poste, date, désignation, site ni équipe sont ignorées. Elles sont comptées en « Info », sans avertissement.
- **Ordre vide** : la ligne est signalée mais n'est jamais comptée comme un OT.
- **Comptage** : on compte le **nombre d'Ordres distincts**. Un OT « EC+PIS » compte 1 en EC, 1 en PIS et 1 seule fois dans le total. Un même couple Ordre + Activité présent sur plusieurs lignes n'est compté qu'une fois.

## 4. Actualiser tout

Données › **Actualiser tout** (Ctrl + Alt + F5) met à jour le programme et l'onglet 01, les OT et l'onglet 03, les deux TCD de 02, les contrôles, et la date de dernière actualisation dans 04.

Si Excel affiche « Activer le contenu » ou demande les niveaux de confidentialité, choisir **Organisationnel** pour les deux fichiers et pour le classeur.

## 5. Utiliser les segments

- **01** : SITE, ÉQUIPE, TYPOLOGIE. **02** : SITE, ÉQUIPE, ANNÉE (reliés au TCD principal et au total).
- Un clic sélectionne une valeur. Ctrl + clic en ajoute d'autres. L'entonnoir barré, en haut du segment, efface le filtre.
- Les indicateurs « Postes affichés » et « Opérations préventives [année] » de 01 suivent les filtres.
- L'année mise en évidence (colonne jaune pâle) est l'**Année de référence** de 04_PARAMETRES.
- Les sites 1TL et 4TL et l'équipe AA2 restent dans les données et dans les segments s'ils sont présents. Ils sont marqués « À valider » dans les référentiels et ne sont pas mis en avant.

## 6. Ouvrir le détail des OT

Dans 02, **double-cliquer sur un nombre**. Excel ouvre une nouvelle feuille avec les OT concernés : Ordre, Ordre supérieur, Groupe gestionnaires, Poste travail princ., Code site, Poste technique, Désign.poste techn., Activité source, Activité atomique, Date début planifiée, Année planifiée, Statuts, Désignation, Typologie, Équipement, etc. C'est la fonction native « Afficher les détails » d'Excel, sans macro. La feuille ainsi créée peut être supprimée après lecture.

Autre possibilité : l'onglet 03_DETAIL_OT, avec les filtres standards (par exemple sur un numéro d'Ordre ou un code poste).

## 7. Règles de rapprochement PDM ↔ GMAO

- La clé est **Code Emprise (PDM) = Code site (GMAO)**. Si Code Emprise est vide, ce sont les 9 premiers caractères du Code Installation.
- Les exceptions se saisissent à la main dans **T_Correspondance** (94_REFERENTIELS) : Code poste PDM, Code poste GMAO, Commentaire.
- Le rapprochement (onglet masqué 93) donne un statut par poste : **Correspondance automatique**, **Correspondance manuelle**, **Non rapproché**. Il signale aussi les OT préventifs dont le poste n'est pas au programme.
- Le TCD de 02 affiche la désignation du programme quand le poste est rapproché, sinon celle de la GMAO.
- **Aucun diagnostic « prévu / OT présent » n'est calculé.** Les règles de comparaison sont seulement documentées dans **T_Regles_Comparaison**, avec le statut À VALIDER :

| Opération programme | Règle OT proposée |
|---|---|
| PIS | OT contenant PIS |
| REVISION | OT contenant REV |
| EC FILTRE | OT contenant EC **et** FILTRE |
| EC SIMPLE | OT contenant EC **sans** FILTRE |

Données de démonstration : 34 postes en correspondance automatique, 1 en correspondance manuelle (G-I-MMM13 → G-I-MMN13) et 1 poste du programme sans OT (G-I-ZZZ26).

## 8. Points métier à valider

1. **Clé de rapprochement** : Code Emprise = Code site. D'après vous, 397 postes sur 399 correspondent. Les 2 exceptions sont à saisir dans T_Correspondance.
2. **Règles de comparaison programme ↔ OT** (tableau ci-dessus), et en particulier : une opération EC Filtre se traduit-elle bien par un OT « EC + FILTRE » ?
3. **Sites 1TL et 4TL, équipe AA2** : à intégrer, à exclure ou à garder en « à valider » ?
4. **Statut des OT** : aujourd'hui, tous les OT PRE sont comptés, quel que soit leur Statut système ou utilisateur. Faut-il exclure les OT annulés ou techniquement clôturés ?
5. **Année planifiée** = année de Date début planifiée. Est-ce la bonne date, ou faut-il tenir compte des reports ?
6. **Activité vide alors que la Désignation est renseignée** : la reconstruction par mots-clés est désactivée (04_PARAMETRES, « Non »). Les mots-clés sont PIS, EC, PIL, FILT, REV, SURV DEC et ENDO. Ceux d'INSPECTION TA et d'INSPECTION TSF restent à définir. À valider avant toute activation.
7. **Activités inconnues** : elles sont gardées et signalées. Il faut décider lesquelles ajouter au référentiel T_Ref_Activites.
8. **Longueur du code poste** : 9 caractères (réglage dans 04).
9. **Format réel du PDM** : on attend une ligne par poste × année × opération. Il reste à confirmer les noms de colonnes à reporter dans T_Colonnes_PDM.

## 9. Ce qui a été vérifié, et comment

Je n'ai pas Microsoft Excel. Les vérifications ont été faites autrement :

- **Structure du fichier** : validation par le validateur officiel Microsoft Open XML SDK, sans aucune erreur. La validation porte sur les tableaux, les TCD, les segments, les requêtes intégrées et les connexions.
- **Code M** : les 7 requêtes sont analysées sans erreur par l'analyseur Power Query de Microsoft. La logique des requêtes est reproduite en Python et testée sur les données de démonstration.
- **26 contrôles de livraison** (`outils/v04/tests_v04.py`), tous réussis :
  - dans 01 : une ligne = un poste, et « PIS + EC SIMPLE » dans une seule case ;
  - segments reliés aux bons tableaux et TCD ;
  - uniquement les OT PRE ;
  - Ordres vides non comptés ;
  - lignes vides ignorées ;
  - priorité au Code site, et repli sur le Poste technique ;
  - comptage distinct recalculé de façon indépendante depuis l'export brut ;
  - découpage « EC+PIS+PILOTAGE+FILTRE » en 4 activités ;
  - nouveau site, nouvelle activité, nouvelle équipe ou nouvelle année traités sans casser le calcul ;
  - données entièrement fictives, aucun chemin local dans le fichier.
- **Rendu visuel** : contrôlé avec LibreOffice, qui n'affiche ni les segments ni Power Query.

## 10. Ce que je n'ai PAS pu tester dans Microsoft Excel

1. **L'ouverture sans message « réparation »**. Le fichier est conforme au schéma, mais Excel peut être plus strict, notamment sur les segments et les requêtes intégrées.
2. **L'actualisation Power Query réelle** :
   - les requêtes apparaissent-elles dans Données › Requêtes et connexions ?
   - Actualiser tout fonctionne-t-il sans erreur ?
   - quels messages de confidentialité ou de « Formula.Firewall » s'affichent ?
   - les délais sur de vrais volumes (plusieurs milliers d'OT).
3. **La lecture du dossier par `CELL("filename")`** :
   - le classeur doit être enregistré ;
   - s'il est ouvert depuis SharePoint, Teams ou OneDrive, CELL peut renvoyer une adresse `https://` que Power Query ne sait pas lire comme un fichier local. Dans ce cas, saisir le chemin complet du fichier dans 04_PARAMETRES (dossier synchronisé local).
4. **Les segments** :
   - leur affichage (taille, couleurs du style sombre adapté à la charte, police) ;
   - le filtrage réel de T_Vision et des deux TCD au clic ;
   - leur maintien après une actualisation.
5. **Le recalcul des indicateurs de 01** (SOUS.TOTAL / DECALER) quand un segment est actif.
6. **Les TCD** :
   - reconstruction à l'ouverture (« actualiser à l'ouverture ») ;
   - disposition tabulaire avec étiquettes répétées ;
   - ordre des colonnes d'activités ;
   - mise à jour après Actualiser tout. Si un TCD semble en retard d'une actualisation, relancer Actualiser tout une seconde fois.
7. **Le double-clic « Afficher les détails »** sur un nombre de 02, et les colonnes de la feuille créée.
8. **Les mises en forme après actualisation** :
   - les largeurs de colonnes ;
   - les hauteurs de ligne de 01 (cases sur deux lignes) ;
   - la colonne de l'année de référence ;
   - l'en-tête et le format conditionnel d'une nouvelle colonne d'année.
9. **Excel pour Mac et Excel en ligne** : Power Query y est limité pour les fichiers locaux. La cible visée est Excel Microsoft 365 sous Windows.
10. **L'impression** (zones et mise en page) et la police Century Gothic si elle n'est pas installée sur le poste.

## Fichiers livrés

| Fichier | Rôle |
|---|---|
| `Prototype_Maintenance_Preventive_V04.xlsx` | Le prototype. |
| `DEMO_PDM.xlsx`, `DEMO_GMAO.xlsx` | Données de démonstration fictives, lues par défaut. Les garder dans le même dossier que le classeur. |
| `power-query/*.pq`, `Section1.m` | Copie du code M des requêtes. |
| `../outils/v04/` | Régénération (`construire.py`), règles en Python (`regles.py`), données fictives (`donnees_demo.py`), contrôles de livraison (`tests_v04.py`). |
