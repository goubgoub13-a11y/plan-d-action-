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
