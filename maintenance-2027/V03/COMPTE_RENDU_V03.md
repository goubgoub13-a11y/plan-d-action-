# Compte rendu V0.3 – Programme préventif et couche OT GMAO

**Livrables du dossier `V03/`**
- `Prototype_Maintenance_Preventive_V03.xlsx` : le classeur ;
- `power-query/` : les requêtes OT_Detail, OT_Couverture et OT_Controles, au format `.pq` ;
- `MODELE_GMAO_PREV_ANONYMISE.csv` : le modèle d'extraction, placé à côté du classeur ;
- ce compte rendu.

La V0.1 (`../Prototype_Suivi_Maintenance_2027.xlsx`) n'est pas modifiée. Toutes les données restent fictives, et aucune valeur n'a été inventée, corrigée ou supprimée.

> **Power Query n'est pas intégré au fichier.** Je n'ai pas Excel ici. Je ne peux donc pas vérifier qu'une requête insérée directement dans le `.xlsx` s'ouvre sans message de réparation. Comme le brief le prévoit, je fournis à la place :
> - le **code M complet** ;
> - des **feuilles, tableaux et paramètres prêts** à le recevoir ;
> - une **procédure d'installation en 5 étapes**, à faire une seule fois (section 7).
>
> En attendant cette installation, les zones OT contiennent un **instantané de démonstration**. Il est calculé avec les mêmes règles que le code M et a la même forme que ses résultats.

## 1. Nouvelle architecture

| Onglet | Rôle | Alimenté par |
|---|---|---|
| `01_PLAN_PREVENTIF` | **Cœur du produit.** Une ligne par poste × opération, une colonne par année (2026 à 2032). L'année d'analyse est surlignée. | Formules sur `T_Programme` |
| `02_COUVERTURE_OT` | Nombre d'**OT distincts** par année × site × équipe × code poste × activité, avec indicateurs pour l'année d'analyse. | Requête `OT_Couverture` |
| `03_DETAIL_PROGRAMME` | Programme normalisé (`T_Programme`) : copie exacte du jeu fictif, 122 lignes. | Import du programme |
| `04_DETAIL_OT` | OT normalisés : une ligne par couple Ordre × Activité atomique. | Requête `OT_Detail` |
| `05_REFERENTIEL` | Types du programme, activités GMAO, sites et équipes connus, table de correspondance des postes (vide). | Saisie du référent |
| `06_AVIS_UTILISATEURS` | Recueil des retours, avec un thème « Couverture OT » en plus. | Testeurs |
| `07_POINTS_A_VALIDER` | 13 questions métier, plus un rappel du nombre de contrôles à vérifier. | Équipe projet |
| `08_PARAMETRES` | Paramètres de l'import et tableau des contrôles qualité. | Saisie + requête `OT_Controles` |
| `09_NOTICE` | Mode d'emploi, règles, installation et actualisation. | — |
| `10_CODE_M` | Copie du code M dans le classeur, pour ne dépendre d'aucun autre fichier. | — |

**Séparation des deux couches.** Le programme préventif (01, 03) et les OT GMAO (02, 04) n'ont aucune formule en commun. Le seul lien est un repère dans 01, la tuile « OT GMAO 2027 (complément) », qui affiche le total sans faire de rapprochement.

**Écart avec l'architecture demandée.** Les contrôles sont placés dans 08 et non dans 07. Une table chargée par Power Query ne peut pas partager ses lignes avec la table des points métier sans risquer de la recouvrir. 07 garde donc les questions métier et rappelle le nombre de contrôles à vérifier.

## 2. Import GMAO

- La **source est remplaçable** : un fichier `.xlsx` (première feuille, ou la feuille indiquée) ou `.csv` (séparateur `;`, UTF-8).
- **Pas de chemin en dur.** Le chemin vient de `08_PARAMETRES` :
  - par défaut, le dossier du classeur, calculé avec `CELL("filename")`, plus le nom du fichier ;
  - sinon un chemin complet saisi, qui est alors prioritaire.
- **Les 24 en-têtes sont conservés.** Seuls les espaces de fin sont retirés : l'export contient `Typologie ` avec un espace final.
- **6 colonnes sont obligatoires** : Ordre, Poste technique, Date début planifiée, Activité, Groupe gestionnaires, Poste travail princ.
  - Si l'une d'elles manque, l'actualisation s'arrête sur une **erreur explicite** qui la nomme.
  - Une autre colonne attendue absente est créée vide. Une colonne en trop est ignorée. Dans les deux cas, le contrôle « Écart de structure » le signale.
- **Typage tolérant**, sans suppression :
  - dates : valeur Excel, ou texte `jj/mm/aaaa` (culture fr-FR) ;
  - montants : virgule décimale ;
  - Ordre : texte, car c'est un identifiant ;
  - une date illisible devient vide et elle est signalée.
- **Correspondances du test manuel** : Site = `Groupe gestionnaires`, Équipe = `Poste travail princ.`, identifiant d'OT = `Ordre`.

## 3. Logique Power Query

| Requête | Accès aux données | Résultat | Chargement |
|---|---|---|---|
| `OT_Detail` | Paramètres et référentiels du classeur, fichier GMAO | 1 ligne par Ordre × Activité, 36 colonnes | `04_DETAIL_OT!A1` |
| `OT_Couverture` | Uniquement `OT_Detail` | Tableau croisé, une colonne par activité | `02_COUVERTURE_OT!A8` |
| `OT_Controles` | Uniquement `OT_Detail` | 17 lignes de contrôle | `08_PARAMETRES!A20` |

`OT_Detail` lit tout ce qui vient de l'extérieur (paramètres, référentiels, fichier) **dans une seule étape**. Les deux autres requêtes ne lisent que `OT_Detail`. Cette structure limite le risque d'erreur `Formula.Firewall` d'Excel.

Les étapes de `OT_Detail` suivent le brief :
1. charger la source ;
2. contrôler les colonnes obligatoires ;
3. typer les valeurs ;
4. calculer `Code poste` ;
5. calculer `Année planifiée` ;
6. découper `Activité` sur `+` ;
7. nettoyer les espaces ;
8. passer à une ligne par activité ;
9. dédoublonner `Ordre + Activité` ;
10. produire une table propre.

La table finale comprend :
- les clés d'analyse : Ordre, Activité atomique, Année planifiée, Site, Équipe, Code poste ;
- la colonne « Contrôle qualité » ;
- les 24 colonnes de l'export ;
- des colonnes de traçabilité : ligne de l'export, lignes regroupées, fichier source, date d'actualisation.

## 4. Règle du Code poste

- **Code poste = les 9 premiers caractères de `Poste technique`.**
  - Excel : `=GAUCHE(Poste technique;9)`.
  - Power Query : `Text.Start([Poste technique], 9)`.
- La longueur 9 est un paramètre (`P_LongueurCodePoste`), modifiable sans toucher au code.
- Trois cas sont contrôlés. La ligne est **toujours gardée** et signalée :
  - Poste technique **vide** : Code poste vide, affiché « (vide) » dans la couverture ;
  - Poste technique **plus court que 9 caractères** : la valeur entière est reprise ;
  - **format inattendu** : le 10e caractère n'est pas `-`, le séparateur observé partout dans le modèle (`G-I-A1100-FILT01`). Ce séparateur est un paramètre ; le laisser vide désactive le contrôle.

## 5. Normalisation d'Activité

- `EC+PIS+PILOTAGE+FILTRE` est découpé sur `+`. Chaque morceau est nettoyé de ses espaces et mis en majuscules, ce qui donne 4 lignes : EC, PIS, PILOTAGE, FILTRE.
- Les activités connues sont listées dans `T_Ref_Activites` (onglet 05) : PIS, EC, PILOTAGE, FILTRE, REV.
  - Une activité absente de cette liste est gardée et signalée « inconnue ».
  - Elle apparaît aussi comme **nouvelle colonne** de la couverture, après les activités connues.
- Une activité vide, ou un segment vide comme dans `EC++PIS`, est signalé. La ligne est gardée.
- **Doublons techniques** : un couple `Ordre + Activité` n'est gardé qu'une fois. C'est le cas d'un OT présent deux fois dans l'export, ou d'une saisie `EC+EC`. La ligne conservée indique les lignes de l'export regroupées avec elle. Aucune ligne ne disparaît donc sans trace.

## 6. Comptage distinct des OT

La couverture compte le **nombre d'Ordre distincts** par année planifiée × site × équipe × code poste × activité atomique. Elle ne compte pas des lignes brutes.

- Une colonne « OT distincts (toutes activités) » donne le total par poste. **Ce n'est pas la somme des colonnes d'activité** : un OT EC+PIS compte 1 en EC, 1 en PIS, et 1 seule fois au total.
- Une ligne sans numéro d'Ordre compte comme un OT à part. Elle est signalée.
- Sur le modèle, on obtient :
  - 90 OT et 180 couples Ordre × Activité ;
  - 72 OT en 2026 (SITE01 à SITE08) et **18 en 2027** (SITE09 et SITE10) ;
  - en 2027, par activité : PIS 10, EC 14, PILOTAGE 5, FILTRE 10, REV 6.
- J'ai vérifié chaque case contre un recalcul indépendant fait directement sur le CSV brut.
- **Tableau croisé ou Power BI sur `04_DETAIL_OT`** : la fonction « Nombre » suffit, car chaque couple Ordre × Activité n'y apparaît qu'une fois.

## 7. Installation et fonctionnement de « Actualiser tout »

**Installation, à faire une seule fois dans Excel Desktop sous Windows** (aussi détaillée dans 09_NOTICE) :
1. Enregistrer le classeur sur le poste, dans le dossier de l'extraction, puis vérifier le nom du fichier dans 08_PARAMETRES.
2. Ouvrir Données › Obtenir des données › Requête vide, puis Éditeur avancé. Coller `OT_Detail.pq` et nommer la requête **OT_Detail**.
3. Faire de même pour **OT_Couverture** puis **OT_Controles**. Choisir ensuite Fermer et charger dans… › Créer uniquement la connexion.
4. Effacer les instantanés de démonstration : tout `04_DETAIL_OT`, `02_COUVERTURE_OT` à partir de A8, et `08_PARAMETRES` à partir de A20. Retirer les filtres avant.
5. Charger chaque requête dans… › Tableau › Feuille existante : `04!A1`, `02!A8`, `08!A20`.

Si Excel demande les niveaux de confidentialité, choisir « Organisationnel ». Si l'erreur `Formula.Firewall` apparaît malgré tout : Options de requête › Confidentialité › Ignorer, si la politique interne l'autorise.

**Ensuite, à chaque nouvelle extraction** :
1. Remplacer le fichier.
2. Cliquer sur **Données › Actualiser tout**.
3. Le détail, la couverture, les contrôles, la date d'actualisation et les indicateurs de 01 et 02 se mettent à jour.

Les indicateurs retrouvent leurs colonnes par leur nom (`INDEX/EQUIV` sur l'en-tête). Ils continuent donc de fonctionner quand le nombre de lignes change, quand des OT apparaissent ou disparaissent, et quand une nouvelle année, activité, équipe ou un nouveau site apparaît.

J'ai **simulé** cette mise à jour : j'ai chargé, aux mêmes emplacements, le résultat d'un export d'essai qui contenait une activité inconnue, une nouvelle année et une anomalie de chaque type. Toutes les formules ont suivi, sans aucune erreur, et les 13 contrôles concernés sont passés « À VÉRIFIER ».

## 8. Contrôles mis en place

Le tableau de 08_PARAMETRES affiche une ligne par contrôle. Chaque ligne indique le statut (OK, À VÉRIFIER ou INFO), le nombre de lignes de l'export et d'OT concernés, et jusqu'à 10 exemples. Le détail des lignes se filtre dans `04_DETAIL_OT`, colonne « Contrôle qualité ».

Liste des contrôles :
- volume lu ;
- écart de structure ;
- Ordre vide ;
- **OT présent sur plusieurs lignes de l'export** ;
- **Poste technique vide**, **trop court**, **de format inattendu** ;
- **Date début planifiée vide**, **illisible** ;
- **Activité vide**, mal formée, **inconnue du référentiel** ;
- **couple Ordre + Activité en double** ;
- site ou équipe vide ;
- **nouveau site**, **nouvelle équipe** (par rapport à `T_Ref_Sites`) ;
- Type de travail autre que PRE (Info).

Une colonne obligatoire absente arrête l'actualisation avec un message explicite, au lieu de produire un résultat faux sans le dire.

**Testé sur un export d'essai** fabriqué à partir du modèle, avec une anomalie de chaque type : chaque contrôle se déclenche exactement sur les lignes piégées, et aucune ligne n'est perdue. Un export `.xlsx` typé donne le même résultat que le CSV. Script : `outils/tests/test_gmao_ot.py`.

Côté programme, 01 affiche aussi un contrôle (ligne 6) : la somme des cases du plan doit égaler le nombre de lignes de `T_Programme`. Les doublons apparaissent en ●×2 et sont signalés.

## 9. Points métier encore à confirmer (détail dans 07)

1. **Hiérarchie** : Périmètre = Site et Groupe = Équipe côté programme ? Avec quels libellés lisibles ?
2. **Clé de rapprochement** entre programme et GMAO : les postes INST-xxx et les codes G-I-A1100 n'ont rien en commun. La table `T_Correspondance_Postes` est prête mais vide.
3. **Activités** : que signifient EC, PIS et PILOTAGE ? Quelle correspondance avec les types du programme ? Les hypothèses FILTRE → TYPE_C et REV → TYPE_D sont notées mais **non appliquées**.
4. **Code poste** : la règle « 9 caractères, puis `-` » vaut-elle pour tous les sites ?
5. **Site** : `Code site` (TECH-xx) correspond un pour un à `Groupe gestionnaires`. Quel champ fait référence ?
6. **Équipe** : `Secteur exploitation` est identique à `Poste travail princ.` sur les 90 lignes. Les deux restent-ils toujours identiques ?
7. **Périmètre de l'extraction** : sera-t-elle limitée au préventif ? Dans le modèle, tout est ZPR2 / PRE.
8. **Date de référence** : l'année planifiée doit-elle venir de « Date début planifiée » ?
9. **Statuts ACTI / TERM** : conservés mais non exploités. Faut-il exclure certains statuts, par exemple les OT annulés ?
10. Repris de la V0.1 : TYPE_E à confirmer, doublons du programme, intervalles différents de la périodicité.

## 10. Préparation Power BI et comparaison future

- **Tables plates prêtes à l'import** : `T_Programme`, le détail OT, `T_Referentiel`, `T_Ref_Activites` et `T_Ref_Sites`.
  - Relation programme : `Type opération source` → `Valeur source`.
  - Relation OT : `Activité atomique` → `T_Ref_Activites[Activité]`.
- **Mesure de couverture dans Power BI** : `DISTINCTCOUNT(Ordre)`, découpée par année, site, équipe, poste et activité.
- **Comparaison prévu / OT, préparée mais pas activée.** Trois cas seront à distinguer : prévu avec OT présent, prévu sans OT, OT hors programme. Il faut d'abord valider deux correspondances : poste programme ↔ code poste GMAO, et type d'opération ↔ activité. La jointure se fera alors sur année + poste + activité, sans changer la structure des tables.

## Limites de la V0.3

- **Power Query n'est pas intégré.** L'installation se fait une fois, à la main (section 7). Je n'ai pas pu exécuter le code M : il est validé par l'analyseur M officiel de Microsoft (syntaxe) et par une transposition Python testée. Il faudra vérifier dans Excel la première actualisation, en particulier les niveaux de confidentialité.
- **Après installation, les tables chargées prennent le style Excel par défaut.** On peut choisir un style clair dans Création de tableau.
- **La vue 01 garde la limite de la V0.1** : ses cases se recalculent, mais une nouvelle combinaison poste / opération demande de régénérer la vue (`outils/construire_prototype_v03.py`). Recommandation : passer le programme en Power Query dès que sa source réelle sera connue.
- **Le dossier par défaut repose sur `CELL("filename")`.** Si le classeur est ouvert depuis SharePoint ou OneDrive en ligne, il faut saisir un chemin local complet.
- **Vérifié avec LibreOffice** : 1 077 formules sans erreur, rendu visuel, données comparées case par case aux sources, simulation d'actualisation. **Le classeur n'a pas été ouvert dans Microsoft Excel.**
