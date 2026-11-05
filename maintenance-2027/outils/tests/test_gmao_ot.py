"""Tests des règles de la couche OT (transposition Python des requêtes M).

Lancement : python3 maintenance-2027/outils/tests/test_gmao_ot.py
Le fichier d'essai avec anomalies est fabriqué ici, à partir du modèle anonymisé,
pour que chaque anomalie injectée soit lisible dans le code.
"""

import csv
import datetime as dt
import sys
import tempfile
from collections import Counter
from pathlib import Path

import openpyxl

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))
import gmao_ot as g  # noqa: E402

MODELE = ICI.parents[1] / "sources" / "MODELE_GMAO_PREV_ANONYMISE.csv"
ACTIVITES = ["PIS", "EC", "PILOTAGE", "FILTRE", "REV"]


def lire_modele():
    with open(MODELE, encoding="utf-8-sig", newline="") as f:
        lignes = list(csv.reader(f, delimiter=";"))
    return lignes[0], lignes[1:]


def sites_du_modele():
    en_tetes, lignes = lire_modele()
    i, j = en_tetes.index("Groupe gestionnaires"), en_tetes.index("Poste travail princ.")
    return sorted({(l[i], l[j]) for l in lignes})


def ecrire_csv(chemin, en_tetes, lignes):
    with open(chemin, "w", encoding="utf-8-sig", newline="") as f:
        csv.writer(f, delimiter=";", lineterminator="\r\n").writerows([en_tetes] + lignes)


def test_modele():
    en_tetes, lignes = lire_modele()
    assert len(en_tetes) == 24 and en_tetes[22] == "Typologie ", "l'en-tête « Typologie » garde son espace final"
    detail = g.ot_detail(MODELE, ACTIVITES, sites_du_modele())
    attendu = sum(len(l[23].split("+")) for l in lignes)
    assert len(detail) == attendu, (len(detail), attendu)
    assert all(d["Contrôle qualité"] is None for d in detail)
    assert {d["Activité atomique"] for d in detail} == set(ACTIVITES)
    assert all(d["Code poste"] == d["Poste technique"][:9] for d in detail)
    # comptage distinct recalculé indépendamment, directement depuis le CSV brut
    i = {n: k for k, n in enumerate(en_tetes)}
    ref = Counter()
    for l in lignes:
        for a in set(l[i["Activité"]].split("+")):
            annee = dt.datetime.strptime(l[i["Date début planifiée"]], "%d/%m/%Y").year
            ref[(annee, l[i["Groupe gestionnaires"]], l[i["Poste travail princ."]], l[i["Poste technique"]][:9], a)] += 1
    colonnes, couverture = g.ot_couverture(detail)
    assert colonnes[4:9] == ACTIVITES, colonnes
    calc = Counter()
    for c in couverture:
        for a in ACTIVITES:
            if c[a]:
                calc[(c["Année planifiée"], c["Site"], c["Équipe"], c["Code poste"], a)] = c[a]
    assert calc == ref
    controles = g.ot_controles(detail)
    assert controles[0]["Lignes de l'export"] == 90 and controles[0]["OT distincts"] == 90
    assert all(c["Statut"] == "OK" for c in controles[1:]), [c for c in controles if c["Statut"] != "OK"]
    return detail, couverture


def fabriquer_essai(dossier):
    en_tetes, lignes = lire_modele()
    i = {n.strip(): k for k, n in enumerate(en_tetes)}
    base = lignes[0]

    def variante(**changements):
        l = list(base)
        for col, v in changements.items():
            l[i[col]] = v
        return l

    ordre = iter(range(990000001, 990000100))
    nouvelles = {
        "doublon exact de la ligne 2": list(base),
        "ordre vide": variante(Ordre=""),
        "poste vide": variante(Ordre=str(next(ordre)), **{"Poste technique": ""}),
        "poste court": variante(Ordre=str(next(ordre)), **{"Poste technique": "G-I-A11"}),
        "format": variante(Ordre=str(next(ordre)), **{"Poste technique": "G-I-A1100X01"}),
        "date vide": variante(Ordre=str(next(ordre)), **{"Date début planifiée": ""}),
        "date illisible": variante(Ordre=str(next(ordre)), **{"Date début planifiée": "31/02/2026"}),
        "activité vide": variante(Ordre=str(next(ordre)), Activité=""),
        "activité mal formée": variante(Ordre=str(next(ordre)), Activité="EC++PIS"),
        "activité inconnue": variante(Ordre=str(next(ordre)), Activité="EC+XYZ"),
        "espaces et minuscules": variante(Ordre=str(next(ordre)), Activité=" ec + pis "),
        "activité répétée": variante(Ordre=str(next(ordre)), Activité="EC+EC"),
        "nouveau site": variante(Ordre=str(next(ordre)), **{"Groupe gestionnaires": "SITE99"}),
        "nouvelle équipe": variante(Ordre=str(next(ordre)), **{"Poste travail princ.": "EQ9"}),
        "type de travail": variante(Ordre=str(next(ordre)), **{"Type de travail": "COR"}),
        "nouvelle année": variante(Ordre=str(next(ordre)), **{"Date début planifiée": "15/03/2028"}),
    }
    # structure : « Avis » retirée, une colonne inconnue ajoutée
    k = en_tetes.index("Avis")
    entete_essai = [h for h in en_tetes if h != "Avis"] + ["Colonne en trop"]
    toutes = [base] + list(nouvelles.values())
    corps = [[v for j, v in enumerate(l) if j != k] + ["x"] for l in toutes]
    chemin = Path(dossier) / "EXPORT_ESSAI_ANOMALIES.csv"
    ecrire_csv(chemin, entete_essai, corps)
    numeros = {nom: n for n, nom in enumerate(nouvelles, start=3)}  # ligne 2 = base
    return chemin, numeros


def test_anomalies(dossier):
    chemin, n = fabriquer_essai(dossier)
    detail = g.ot_detail(chemin, ACTIVITES, sites_du_modele())
    ctl = {c["Contrôle"]: c for c in g.ot_controles(detail)}
    lignes = lambda libelle: sorted(g.numeros_lignes([d for d in detail
                                     if d["Contrôle qualité"] and libelle in d["Contrôle qualité"].split(" ; ")]))
    attendus = {
        "Ordre vide": [n["ordre vide"]],
        "OT présent sur plusieurs lignes de l'export": [2, n["doublon exact de la ligne 2"]],
        "Poste technique vide": [n["poste vide"]],
        "Poste technique trop court": [n["poste court"]],
        "Format du Poste technique inattendu": [n["format"]],
        "Date début planifiée vide": [n["date vide"]],
        "Date début planifiée illisible": [n["date illisible"]],
        "Activité vide": [n["activité vide"]],
        "Activité mal formée": [n["activité mal formée"]],
        "Activité inconnue du référentiel": [n["activité inconnue"]],
        "Couple Ordre + Activité en double": [2, n["doublon exact de la ligne 2"], n["activité répétée"]],
        "Site ou équipe vide": [],
        "Nouveau site": [n["nouveau site"]],
        "Nouvelle équipe": [n["nouvelle équipe"]],
        "Type de travail autre que PRE": [n["type de travail"]],
    }
    for libelle, lignes_attendues in attendus.items():
        assert lignes(libelle) == lignes_attendues, (libelle, lignes(libelle), lignes_attendues)
        assert ctl[libelle]["Statut"] == ("OK" if not lignes_attendues else
                                          "INFO" if ctl[libelle]["Niveau"] == "Info" else "À VÉRIFIER")
    assert "Avis" in ctl["Écart de structure de l'export"]["Exemples (Ordre ou ligne)"]
    assert "Colonne en trop" in ctl["Écart de structure de l'export"]["Exemples (Ordre ou ligne)"]
    # aucune ligne de l'export n'est perdue : soit présente, soit regroupée avec la ligne conservée
    assert set(g.numeros_lignes(detail)) == set(range(2, 2 + 1 + len(n)))
    assert ctl["Lignes lues dans l'export"]["Lignes de l'export"] == 1 + len(n)
    assert [d["Lignes export regroupées"] for d in detail if d["Ligne export"] == 2] == ["2, 3", "2, 3"]
    # doublon exact : un seul couple par activité, compté une fois
    base = [d for d in detail if d["Ligne export"] == 2]
    assert [d["Activité atomique"] for d in base] == ["EC", "PIS"]
    assert not [d for d in detail if d["Ligne export"] == n["doublon exact de la ligne 2"]]
    # « EC+EC » ne donne qu'une ligne ; « ec + pis » est normalisé
    assert [d["Activité atomique"] for d in detail if d["Ligne export"] == n["activité répétée"]] == ["EC"]
    assert [d["Activité atomique"] for d in detail if d["Ligne export"] == n["espaces et minuscules"]] == ["EC", "PIS"]
    assert [d["Contrôle qualité"] for d in detail if d["Ligne export"] == n["espaces et minuscules"]] == [None, None]
    # poste trop court : la ligne reste, code poste = valeur entière
    assert [d["Code poste"] for d in detail if d["Ligne export"] == n["poste court"]] == ["G-I-A11", "G-I-A11"]
    # nouvelle activité et nouvelle année apparaissent dans la couverture
    colonnes, couverture = g.ot_couverture(detail)
    assert "XYZ" in colonnes and "(vide)" in colonnes
    assert 2028 in {c["Année planifiée"] for c in couverture} and None in {c["Année planifiée"] for c in couverture}
    # la ligne 2 et son doublon = 1 seul OT dans la couverture
    poste = [c for c in couverture if c["Code poste"] == "G-I-A1100" and c["Année planifiée"] == 2026
             and c["Site"] == "SITE01" and c["Équipe"] == "EQ1"][0]
    ordres_poste = {d["Ordre"] for d in detail if d["Code poste"] == "G-I-A1100" and d["Année planifiée"] == 2026
                    and d["Groupe gestionnaires"] == "SITE01" and d["Poste travail princ."] == "EQ1"}
    assert poste["OT distincts (toutes activités)"] == len(ordres_poste)
    assert poste["EC"] == len({d["Ordre"] for d in detail if d["Code poste"] == "G-I-A1100"
                               and d["Année planifiée"] == 2026 and d["Groupe gestionnaires"] == "SITE01"
                               and d["Poste travail princ."] == "EQ1" and d["Activité atomique"] == "EC"})
    return ctl


def test_colonne_obligatoire(dossier):
    en_tetes, lignes = lire_modele()
    chemin = Path(dossier) / "EXPORT_SANS_ACTIVITE.csv"
    ecrire_csv(chemin, [h if h != "Activité" else "Activite (renommée)" for h in en_tetes], lignes)
    try:
        g.ot_detail(chemin, ACTIVITES, sites_du_modele())
    except g.ErreurImport as e:
        assert "Activité" in str(e)
        return str(e)
    raise AssertionError("une colonne obligatoire absente doit lever une erreur explicite")


def test_excel_equivalent(dossier, detail_csv):
    """Le même export au format Excel (valeurs typées) donne le même résultat."""
    en_tetes, lignes = lire_modele()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(en_tetes)
    for l in lignes:
        valeurs = []
        for h, v in zip(en_tetes, l):
            h = h.strip()
            if v == "":
                valeurs.append(None)
            elif h in g.COLONNES_DATES:
                valeurs.append(dt.datetime.strptime(v, "%d/%m/%Y"))
            elif h in ("Ordre", "Compteur de groupe de gamme principale"):
                valeurs.append(int(v))
            elif h in g.COLONNES_NOMBRES:
                valeurs.append(float(v.replace(",", ".")))
            else:
                valeurs.append(v)
        ws.append(valeurs)
    chemin = Path(dossier) / "EXPORT.xlsx"
    wb.save(chemin)
    detail_xlsx = g.ot_detail(chemin, ACTIVITES, sites_du_modele())
    ignorer = {"Fichier source", "Importé le"}
    a = [{k: v for k, v in d.items() if k not in ignorer} for d in detail_csv]
    b = [{k: v for k, v in d.items() if k not in ignorer} for d in detail_xlsx]
    assert a == b


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        detail, couverture = test_modele()
        print(f"OK modèle : {len(detail)} lignes Ordre x Activité, {len(couverture)} lignes de couverture, 0 anomalie")
        ctl = test_anomalies(tmp)
        print("OK anomalies : " + ", ".join(f"{k} = {v['Lignes de l\'export']}" for k, v in ctl.items()
                                            if v["Statut"] != "OK"))
        print("OK colonne obligatoire absente : " + test_colonne_obligatoire(tmp))
        test_excel_equivalent(tmp, detail)
        print("OK même résultat avec un export .xlsx typé")
