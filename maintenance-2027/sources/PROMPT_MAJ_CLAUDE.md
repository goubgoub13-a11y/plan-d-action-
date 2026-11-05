# Mise à jour du projet – intégration de la couche OT préventifs GMAO

Tu disposes déjà, dans cette même conversation, du pack initial, du prototype Excel et de tout le cadrage précédent. **Ne repars pas de zéro et ne me redemande pas les fichiers déjà fournis.**

Je t’ajoute uniquement le fichier `MODELE_GMAO_PREV_ANONYMISE.csv`.

Toutes les valeurs du fichier sont fictives. En revanche, **les 24 noms de colonnes reproduisent exactement la structure utile de l’extraction GMAO étudiée**. Le futur outil doit donc être conçu pour qu’un vrai relevé ayant ces mêmes en-têtes puisse remplacer cette source sans reconstruction manuelle.

## 1. Cadrage fonctionnel à conserver

Le cœur du produit reste le **suivi / la programmation pluriannuelle de la maintenance préventive par poste** :

**Site → Équipe → Poste → Année → opérations préventives prévues.**

Le poste correspond fonctionnellement à `Code Installation + Désignation de l'installation` dans le programme préventif.

Les OT GMAO constituent maintenant une **couche complémentaire très intéressante**. Ils doivent permettre de vérifier combien d’OT préventifs existent réellement pour un site, une équipe, un poste, une année et une activité.

Le produit ne doit PAS devenir un suivi généraliste de tous les OT, ni être centré sur les statuts ACTI/TERM, backlog, retards, clôtures, etc.

## 2. Structure de la nouvelle source GMAO

Le fichier joint contient exactement les colonnes suivantes, dont les noms doivent être conservés dans la couche d’import :

- Créé le
- Ordre
- Ordre supérieur
- Type d'ordre
- Type de travail
- Avis
- Désignation
- Statut utilisateur
- Statut système
- Saisi par
- Total coûts réels
- Poste travail princ.
- Groupe gestionnaires
- Secteur exploitation
- Date début planifiée
- Code site
- Poste technique
- Désign.poste techn.
- Équipement
- Groupe de gamme principale
- Compteur de groupe de gamme principale
- Date modif. fiche ordre
- Typologie 
- Activité

Le fichier joint est en CSV uniquement pour te transmettre le schéma de manière anonymisée. **La vraie extraction pourra être un fichier Excel** : prévois donc une architecture où la source peut être remplacée par un nouvel export de même structure.

## 3. Correspondances fonctionnelles observées

Dans le test manuel effectué :

- `Groupe gestionnaires` = niveau **Site / périmètre** ;
- `Poste travail princ.` = niveau **Équipe** ;
- `Poste technique` = code technique détaillé ;
- `Ordre` = identifiant de l’OT ;
- l’année vient de `Date début planifiée`.

Un regroupement du poste a été créé à partir de `Poste technique` en prenant les **9 premiers caractères** :

`=GAUCHE(Poste technique;9)`

L’équivalent Power Query est :

`Text.Start([Poste technique], 9)`

Cette règle doit être **documentée et contrôlée**. Si `Poste technique` est vide, inférieur à 9 caractères ou ne respecte pas le format attendu, ne supprime pas la ligne silencieusement : remonte-la comme anomalie / point à valider.

## 4. Point essentiel : normaliser la colonne Activité

La colonne `Activité` peut contenir une seule activité :

- PIS
- EC
- REV

mais également plusieurs activités dans la même cellule séparées par `+`, par exemple :

- EC+PIS
- EC+REV
- EC+PIS+PILOTAGE+FILTRE
- EC+FILTRE

Il ne faut PAS considérer `EC+PIS+PILOTAGE+FILTRE` comme une catégorie unique.

La transformation doit produire une ligne par activité atomique.

Exemple :

`OT 123 | EC+PIS+FILTRE`

devient :

`OT 123 | EC`  
`OT 123 | PIS`  
`OT 123 | FILTRE`

Après l’éclatement, éviter le double comptage technique d’un même couple :

`Ordre + Activité atomique`.

## 5. Vue de couverture OT attendue

Le TCD refait manuellement a confirmé l’intérêt d’une vue de ce type :

| Site | Équipe | Code poste | PIS | EC | PILOTAGE | FILTRE | REV |
|---|---|---|---:|---:|---:|---:|---:|
| SITE A | EQ1 | Poste X | 1 | 1 | 0 | 0 | 0 |
| SITE A | EQ1 | Poste Y | 1 | 0 | 0 | 1 | 1 |

Le chiffre représente le **nombre d’OT distincts** correspondant à cette activité.

Le calcul cible est donc :

**Nombre d’OT DISTINCTS par Site × Équipe × Code poste × Année planifiée × Activité atomique.**

Ne te contente pas de compter les lignes brutes.

## 6. Architecture cible du classeur

Conserve le travail déjà réalisé dans la conversation et fais évoluer le prototype vers au minimum :

- `01_PLAN_PREVENTIF` : vue pluriannuelle de programmation préventive, cœur du produit ;
- `02_COUVERTURE_OT` : vue Site × Équipe × Poste × Activité / nombre d’OT ;
- `03_DETAIL_PROGRAMME` : table normalisée du programme préventif ;
- `04_DETAIL_OT` : table normalisée issue de l’import GMAO ;
- `05_REFERENTIEL` ;
- `06_AVIS_UTILISATEURS` ;
- `07_POINTS_A_VALIDER` ;
- `08_PARAMETRES` ;
- `09_NOTICE`.

Tu peux simplifier cette architecture si tu proposes mieux, mais garde la séparation entre programme préventif et OT GMAO.

## 7. Power Query / import automatique

Power Query devient maintenant une brique pertinente pour la couche OT GMAO, car le schéma de l’export est connu.

Je veux que le fichier final puisse fonctionner à terme ainsi :

1. je récupère une nouvelle extraction GMAO ;
2. je remplace le relevé précédent ou je sélectionne le nouveau fichier ;
3. je clique sur **Données > Actualiser tout** ;
4. les tables normalisées, TCD et vues sont automatiquement mises à jour.

Prévoir dans `08_PARAMETRES` au minimum :

- chemin/emplacement de la source GMAO ;
- année d’analyse sélectionnée ;
- date de dernière actualisation.

Évite absolument un chemin en dur propre à ton environnement de développement.

La requête Power Query doit notamment :

1. charger le relevé GMAO ;
2. vérifier que les colonnes obligatoires existent ;
3. typer les dates / textes / nombres ;
4. créer `Code poste` depuis les 9 premiers caractères de `Poste technique` ;
5. créer `Année planifiée` depuis `Date début planifiée` ;
6. scinder `Activité` sur le séparateur `+` ;
7. nettoyer les espaces ;
8. développer les activités en lignes ;
9. gérer les doublons techniques pour ne pas compter plusieurs fois le même `Ordre + Activité atomique` ;
10. charger une table propre exploitable par TCD et Power BI.

Le système doit continuer à fonctionner lorsque :

- le nombre de lignes change ;
- de nouveaux OT apparaissent ;
- certains OT disparaissent de l’extraction suivante ;
- une nouvelle année apparaît ;
- une nouvelle activité apparaît ;
- de nouveaux sites ou équipes apparaissent.

Si une colonne obligatoire disparaît ou change de nom, produire une **erreur explicite ou un contrôle visible**, pas un résultat silencieusement faux.

Si ton environnement ne permet pas d’intégrer Power Query dans le `.xlsx` de façon réellement fiable, ne prétends pas que c’est opérationnel. Dans ce cas :

- fournis le **code M complet** ;
- prépare toutes les feuilles, tables et paramètres ;
- donne une procédure très courte pour installer la requête une seule fois dans Excel Desktop.

## 8. Comparaison future programme / OT

Prépare l’architecture pour pouvoir comparer plus tard :

- opération prévue dans le programme préventif ;
- OT correspondant présent dans la GMAO.

Exemples de situations qui pourront être analysées plus tard :

- prévu + OT présent ;
- prévu + aucun OT identifié ;
- OT présent + aucune opération retrouvée dans le programme.

**Ne crée toutefois pas encore de diagnostic automatique**, car la clé de rapprochement exacte entre le programme/PDM et la GMAO doit encore être validée métier.

## 9. Contrôles qualité

Prévoir des contrôles visibles sur :

- Poste technique vide ;
- Poste technique de moins de 9 caractères ;
- Date début planifiée vide ou invalide ;
- Activité vide ;
- activité atomique inconnue du référentiel ;
- OT dupliqué dans la source ;
- couple `Ordre + Activité atomique` dupliqué après normalisation ;
- nouveau site / nouvelle équipe.

Ne supprime aucune valeur atypique silencieusement.

## 10. Livrables

Ne remplace pas les versions précédentes.

Créer une nouvelle version, par exemple :

`Prototype_Maintenance_Preventive_V03.xlsx`

et :

`COMPTE_RENDU_V03.md`

Le compte rendu doit expliquer :

- la nouvelle architecture ;
- l’import GMAO ;
- la logique Power Query ;
- la règle de création du Code poste ;
- la normalisation d’Activité ;
- le comptage distinct des OT ;
- le fonctionnement de `Actualiser tout` ;
- les contrôles mis en place ;
- les points métier encore à confirmer ;
- la préparation à une future exploitation Power BI.

## Principe final

Ne perds jamais la priorité fonctionnelle :

**le produit reste d’abord un outil de programmation et de suivi de la maintenance préventive par poste.**

La couche OT sert en complément à répondre à :

**« Les OT préventifs correspondant à ce que je dois faire sont-ils bien présents dans la GMAO ? »**
