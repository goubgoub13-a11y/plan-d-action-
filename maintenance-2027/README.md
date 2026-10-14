# Prototype de suivi maintenance 2027

Prototype Excel (V0.1) de suivi annuel de maintenance, construit à partir d'un pack de données **100 % fictives**. La future GMAO reste la source de référence : ce classeur n'en est qu'une lecture.

| Fichier | Contenu |
|---|---|
| `Prototype_Suivi_Maintenance_2027.xlsx` | Le prototype à ouvrir dans Excel. |
| `COMPTE_RENDU.md` | Choix, améliorations, points à confirmer, limites, recommandations V0.2. |
| `sources/` | Pack d'origine : brief, données, ancien suivi et référentiel fictifs, charte, logos. |
| `outils/construire_prototype.py` | Script qui régénère le classeur à partir de `sources/`. |

## Régénérer le classeur

```bash
python3 maintenance-2027/outils/construire_prototype.py
```

Il faut Python 3 avec `openpyxl` et `lxml`. Si LibreOffice (`soffice`) est installé, le script enregistre aussi les résultats des formules dans le fichier, pour que les aperçus sans calcul affichent les bons chiffres. Sans LibreOffice, Excel calcule les formules à l'ouverture.

## V0.3 : programme préventif + couche OT GMAO

Dossier `V03/` : la V0.1 ci-dessus est conservée telle quelle.

| Fichier | Contenu |
|---|---|
| `V03/Prototype_Maintenance_Preventive_V03.xlsx` | Plan préventif pluriannuel (cœur du produit) et couverture des OT préventifs GMAO. |
| `V03/COMPTE_RENDU_V03.md` | Architecture, import GMAO, Power Query, contrôles, points à confirmer, Power BI. |
| `V03/power-query/*.pq` | Code M des requêtes OT_Detail, OT_Couverture, OT_Controles (à installer une fois, voir 09_NOTICE). |
| `V03/MODELE_GMAO_PREV_ANONYMISE.csv` | Extraction modèle, placée à côté du classeur (chemin par défaut). |
| `outils/construire_prototype_v03.py` | Régénère le classeur V0.3. |
| `outils/gmao_ot.py` | Transposition Python des requêtes M (instantané de démonstration, tests). |
| `outils/tests/test_gmao_ot.py` | Tests des règles : éclatement des activités, comptage distinct, contrôles, export .xlsx. |

```bash
python3 maintenance-2027/outils/tests/test_gmao_ot.py
python3 maintenance-2027/outils/construire_prototype_v03.py
```
