"""Transposition Python des requêtes Power Query de la V0.4 (V04/power-query/*.pq).

Sert à calculer l'état de démonstration chargé dans le classeur et à tester les règles,
faute de moteur Power Query dans l'environnement de construction. La référence reste le
code M : toute évolution d'une règle doit être faite dans les deux.
"""

import csv
import datetime as dt
from pathlib import Path

import openpyxl

LONGUEUR = 9

# ---------------------------------------------------------------- référentiels par défaut

SITES = [(s, "Principal") for s in ["SET", "SPS", "RNA", "VRS", "LRO", "ALZ", "VDY", "DEI", "SHL", "SVI"]] + [
    ("1TL", "À valider"), ("4TL", "À valider")]
EQUIPES = [("AA1", "Principal"), ("AA3", "Principal"), ("AA4", "Principal"), ("AA2", "À valider")]
ACTIVITES = [  # (activité, mot-clé de secours dans la Désignation, statut de la règle de secours)
    ("PIS", "PIS", "À valider"), ("EC", "EC", "À valider"), ("PILOTAGE", "PIL", "À valider"),
    ("FILTRE", "FILT", "À valider"), ("REV", "REV", "À valider"), ("SURV DEC", "SURV DEC", "À valider"),
    ("INSPECTION TSF", None, "Mot-clé à définir"), ("INSPECTION TA", None, "Mot-clé à définir"),
    ("ENDO", "ENDO", "À valider")]
OPERATIONS = [("PIS", "PIS", 1), ("EC Simple", "EC SIMPLE", 2), ("EC Filtre", "EC FILTRE", 3),
              ("Révision", "REVISION", 4), ("Revision", "REVISION", 4)]
COLONNES_PDM = [(c, c) for c in ["Site", "Équipe", "Code Emprise", "Code Installation", "Désignation", "Typologie",
                                 "Année", "Opération"]]
CORRESPONDANCES = [("G-I-MMM13", "G-I-MMN13", "Exemple fictif : code différent dans la GMAO")]
REGLES = [  # future comparaison programme / OT — NON appliquée
    ("PIS", "OT contenant PIS", "PIS", None),
    ("EC SIMPLE", "OT contenant EC sans FILTRE", "EC", "FILTRE"),
    ("EC FILTRE", "OT contenant EC et FILTRE", "EC + FILTRE", None),
    ("REVISION", "OT contenant REV", "REV", None)]

CHAMPS_PDM = ["Site", "Équipe", "Code Emprise", "Code Installation", "Désignation", "Typologie", "Année", "Opération"]
OBLIG_GMAO = ["Ordre", "Type de travail", "Désignation", "Poste travail princ.", "Groupe gestionnaires",
              "Date début planifiée", "Code site", "Poste technique", "Activité"]
ATTENDUES = ["Créé le", "Ordre", "Ordre supérieur", "Type d'ordre", "Type de travail", "Avis", "Désignation",
             "Statut utilisateur", "Statut système", "Saisi par", "Total coûts réels", "Poste travail princ.",
             "Groupe gestionnaires", "Secteur exploitation", "Date début planifiée", "Code site", "Poste technique",
             "Désign.poste techn.", "Équipement", "Groupe de gamme principale",
             "Compteur de groupe de gamme principale", "Date modif. fiche ordre", "Typologie", "Activité"]
DATES = ["Créé le", "Date début planifiée", "Date modif. fiche ordre"]
NOMBRES = ["Total coûts réels"]
STRUCTURANTS = ["Ordre", "Poste technique", "Code site", "Date début planifiée", "Désignation",
                "Groupe gestionnaires", "Poste travail princ."]

COLONNES_PDM_NORM = ["Site", "Équipe", "Code poste", "Désignation", "Typologie", "Année", "Opération affichée",
                     "Ordre opération", "Opération", "Code Emprise", "Code Installation", "Source code poste",
                     "Code poste GMAO", "Correspondance déclarée", "Contrôle qualité", "Ligne PDM",
                     "Lignes vides ignorées", "Fichier source", "Importé le"]
COLONNES_OT = ["Ordre", "Ordre supérieur", "Site", "Équipe", "Code poste", "Code site", "Poste technique",
               "Désign.poste techn.", "Désignation", "Date début planifiée", "Année planifiée", "Activité source",
               "Activité atomique", "Typologie", "Statut utilisateur", "Statut système", "Équipement", "Créé le",
               "Date modif. fiche ordre", "Désignation du poste", "Groupe gestionnaires", "Poste travail princ.",
               "Type d'ordre", "Type de travail", "Avis", "Saisi par", "Total coûts réels", "Secteur exploitation",
               "Groupe de gamme principale", "Compteur de groupe de gamme principale", "Source code poste",
               "Activité reconstruite (secours)", "Compte OT", "Contrôle qualité", "Ligne export",
               "Lignes export regroupées", "Fichier source", "Importé le"]
COLONNES_RAPPRO = ["Origine", "Site", "Équipe", "Code poste", "Désignation", "Code poste GMAO",
                   "Statut rapprochement", "Nb OT préventifs (GMAO)"]
COLONNES_CTL = ["N°", "Source", "Contrôle", "Niveau", "Nombre", "Statut", "Exemples", "Actualisé le"]
COLONNES_ANO = ["Source", "Ligne", "Ordre", "Code poste", "Site", "Équipe", "Contrôle", "Détail"]


class ErreurImport(Exception):
    pass


# ---------------------------------------------------------------- lecture et typage

def lire(chemin, feuille=""):
    chemin = Path(chemin)
    if chemin.suffix.lower() in (".csv", ".txt"):
        with open(chemin, encoding="utf-8-sig", newline="") as f:
            lignes = list(csv.reader(f, delimiter=";"))
    else:
        wb = openpyxl.load_workbook(chemin, data_only=True)
        ws = wb[feuille] if feuille else wb.worksheets[0]
        lignes = [list(r) for r in ws.iter_rows(values_only=True)]
    en_tetes = ["" if h is None else str(h).replace("﻿", "").strip() for h in lignes[0]]
    return en_tetes, [dict(zip(en_tetes, list(r) + [None] * (len(en_tetes) - len(r)))) for r in lignes[1:]]


def texte(v):
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    t = str(v).strip()
    return t or None


def date(v):
    if v is None:
        return None
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, (int, float)):
        return (dt.datetime(1899, 12, 30) + dt.timedelta(days=v)).date()
    t = str(v).strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(t, fmt).date()
        except ValueError:
            pass
    return None


def nombre(v):
    if v is None or isinstance(v, (int, float)):
        return v
    t = str(v).strip().replace(" ", "").replace(" ", "").replace(" ", "")
    try:
        return float(t.replace(",", ".")) if t else None
    except ValueError:
        return None


def annee(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, (dt.date, dt.datetime)):
        return v.year
    t = str(v).strip()
    try:
        return int(float(t.replace(",", "."))) if t else None
    except ValueError:
        return None


def statut_de(ref, v):
    if v is None:
        return None
    for code, statut in ref:
        if str(code) == v:
            return statut
    return "inconnu"


def normaliser(t):
    return " ".join(x for x in t.upper().strip().split(" ") if x)


# ---------------------------------------------------------------- PDM

def pdm_normalise(chemin, colonnes=COLONNES_PDM, operations=OPERATIONS, sites=SITES, equipes=EQUIPES,
                  correspondances=CORRESPONDANCES, longueur=LONGUEUR, fichier_source=None, importe_le=None):
    en_tetes, brut = lire(chemin)
    paires = [(str(fichier).strip(), champ) for champ, fichier in colonnes
              if fichier is not None and str(fichier).strip() and champ in CHAMPS_PDM]
    trouve = lambda champ: any(c == champ and f in en_tetes for f, c in paires)
    manquants = [c for c in ["Site", "Équipe", "Année", "Opération"] if not trouve(c)]
    if not (trouve("Code Emprise") or trouve("Code Installation")):
        manquants.append("Code Emprise ou Code Installation")
    if manquants:
        raise ErreurImport("Champ(s) sans colonne correspondante dans le fichier PDM : " + ", ".join(manquants))
    ref_op = [(o.upper().strip(), lib, ordre) for o, lib, ordre in operations]
    exceptions = [(texte(a), texte(b)) for a, b, *_ in correspondances if texte(a) and texte(b)]
    lignes, n = [], 1
    for b in brut:
        n += 1
        r = {champ: None for champ in CHAMPS_PDM}
        for f, c in paires:
            if f in en_tetes:
                r[c] = b.get(f)
        r = {c: (annee(v) if c == "Année" else texte(v)) for c, v in r.items()}
        r["Ligne PDM"] = n
        lignes.append(r)
    utiles = [r for r in lignes if any(r[c] is not None for c in CHAMPS_PDM)]
    nb_vides = len(lignes) - len(utiles)
    for r in utiles:
        ce, ci = r["Code Emprise"], r["Code Installation"]
        r["Code poste"] = ce if ce is not None else (ci[:longueur] if ci is not None and len(ci) >= longueur else None)
        r["Source code poste"] = ("Code Emprise" if ce is not None else
                                  f"Code Installation ({longueur} car.)" if r["Code poste"] is not None else None)
        cle = None if r["Opération"] is None else r["Opération"].upper().strip()
        op = next((x for x in ref_op if x[0] == cle), None) if cle is not None else None
        r["_Op"] = op
        r["Opération affichée"] = op[1] if op else (None if r["Opération"] is None else r["Opération"].upper())
        r["Ordre opération"] = op[2] if op else 99
        e = [x for x in exceptions if x[0] == r["Code poste"]]
        r["Code poste GMAO"] = e[0][1] if e else r["Code poste"]
        r["Correspondance déclarée"] = bool(e)
        r["_Cle"] = (f"#L{r['Ligne PDM']}" if r["Code poste"] is None or r["Année"] is None
                     or r["Opération affichée"] is None
                     else f"{r['Code poste']}|{r['Année']}|{r['Opération affichée']}")
    occ = {}
    for r in utiles:
        occ[r["_Cle"]] = occ.get(r["_Cle"], 0) + 1
    maintenant = importe_le or dt.datetime.now().replace(microsecond=0)
    for r in utiles:
        ss, se = statut_de(sites, r["Site"]), statut_de(equipes, r["Équipe"])
        ctl = [
            "PDM : code poste impossible à déterminer" if r["Code poste"] is None else None,
            "PDM : Code Emprise vide (code repris du Code Installation)"
            if r["Code Emprise"] is None and r["Code poste"] is not None else None,
            "PDM : année vide ou invalide" if r["Année"] is None else None,
            "PDM : opération vide" if r["Opération"] is None else
            "PDM : opération inconnue (à valider)" if r["_Op"] is None else None,
            "PDM : opération en double" if occ[r["_Cle"]] > 1 and r["Code poste"] is not None else None,
            "PDM : site inconnu" if ss == "inconnu" else "PDM : site à valider" if ss == "À valider" else None,
            "PDM : équipe inconnue" if se == "inconnu" else "PDM : équipe à valider" if se == "À valider" else None,
        ]
        r["Contrôle qualité"] = " ; ".join(c for c in ctl if c) or None
        r["Lignes vides ignorées"] = nb_vides
        r["Fichier source"] = fichier_source if fichier_source is not None else str(chemin)
        r["Importé le"] = maintenant
    return [{c: r[c] for c in COLONNES_PDM_NORM} for r in sorted(utiles, key=lambda r: r["Ligne PDM"])]


def vision_globale(pdm):
    base = [r for r in pdm if r["Code poste"] is not None and r["Année"] is not None
            and r["Opération affichée"] is not None]
    annees = sorted({r["Année"] for r in base})
    postes = {}
    for r in base:
        postes.setdefault((r["Site"], r["Équipe"], r["Code poste"]), []).append(r)
    premier = lambda l: next((v for v in l if v is not None), None)
    sortie = []
    for (site, equipe, code), lignes in postes.items():
        ligne = {"Site": site, "Équipe": equipe, "Code poste": code,
                 "Désignation du poste": premier(r["Désignation"] for r in lignes),
                 "Typologie": premier(r["Typologie"] for r in lignes)}
        for a in annees:
            ops = sorted({(r["Ordre opération"], r["Opération affichée"]) for r in lignes if r["Année"] == a})
            ligne[str(a)] = " + ".join(o for _, o in ops) or None
        sortie.append(ligne)
    cle = lambda v: (v is not None, v or "")
    sortie.sort(key=lambda l: (cle(l["Site"]), cle(l["Équipe"]), cle(l["Code poste"])))
    return ["Site", "Équipe", "Code poste", "Désignation du poste", "Typologie"] + [str(a) for a in annees], sortie


# ---------------------------------------------------------------- GMAO

def reconstruire(designation, activites):
    import re
    mots = " " + " ".join(x for x in re.split(r"[ +\-/,;:()\[\].]", (designation or "").upper()) if x) + " "
    trouvees = [code for code, motcle, _ in activites if motcle and (" " + normaliser(motcle)) in mots]
    return "+".join(normaliser(c) for c in trouvees) or None


def gmao_lignes(chemin, activites=ACTIVITES, sites=SITES, equipes=EQUIPES, longueur=LONGUEUR, secours=False,
                fichier_source=None, importe_le=None):
    en_tetes, brut = lire(chemin)
    manquantes = [c for c in OBLIG_GMAO if c not in en_tetes]
    if manquantes:
        raise ErreurImport("Colonne(s) introuvable(s) dans l'export : " + ", ".join(manquantes))
    absentes = [c for c in ATTENDUES if c not in en_tetes]
    codes = [normaliser(a) for a, _, _ in activites]
    lignes = []
    for n, b in enumerate(brut, start=2):
        r = {c: (date(b.get(c)) if c in DATES else nombre(b.get(c)) if c in NOMBRES else texte(b.get(c)))
             for c in ATTENDUES}
        r["Ligne export"] = n
        r["_DateBrute"] = texte(b.get("Date début planifiée"))
        lignes.append(r)
    utiles = [r for r in lignes if any(r[c] is not None for c in STRUCTURANTS) or r["_DateBrute"] is not None]
    nb_vides = len(lignes) - len(utiles)
    nb_ordre = {}
    for r in utiles:
        if r["Ordre"] is not None:
            nb_ordre[r["Ordre"]] = nb_ordre.get(r["Ordre"], 0) + 1
    maintenant = importe_le or dt.datetime.now().replace(microsecond=0)
    for r in utiles:
        pt, cs = r["Poste technique"], r["Code site"]
        r["Site"], r["Équipe"] = r["Groupe gestionnaires"], r["Poste travail princ."]
        r["Code poste"] = cs if cs is not None else (pt[:longueur] if pt is not None and len(pt) >= longueur else None)
        r["Source code poste"] = ("Code site" if cs is not None else
                                  f"Poste technique ({longueur} car.)" if r["Code poste"] is not None else None)
        d = r["Date début planifiée"]
        r["Année planifiée"] = None if d is None else d.year
        r["Activité reconstruite (secours)"] = (reconstruire(r["Désignation"], activites)
                                                if secours and r["Activité"] is None and r["Désignation"] else None)
        txt = r["Activité"] if r["Activité"] is not None else r["Activité reconstruite (secours)"]
        segments = [] if txt is None else [normaliser(s) for s in txt.split("+")]
        atomiques = list(dict.fromkeys(s for s in segments if s))
        r["_Activites"] = {"Segments": segments, "Atomiques": atomiques}
        r["Est préventif"] = r["Type de travail"] is not None and r["Type de travail"].upper() == "PRE"
        r["Nb lignes de l'OT"] = nb_ordre.get(r["Ordre"]) if r["Ordre"] is not None else None
        ss, se = statut_de(sites, r["Site"]), statut_de(equipes, r["Équipe"])
        ctl = [
            "Ordre vide" if r["Ordre"] is None else None,
            "Doublon OT éventuel" if r["Nb lignes de l'OT"] is not None and r["Nb lignes de l'OT"] > 1 else None,
            "Code poste impossible à déterminer" if r["Code poste"] is None else None,
            "Code site vide : code poste repris du Poste technique" if cs is None and r["Code poste"] is not None else None,
            "Poste technique vide" if pt is None else None,
            "Code site ≠ GAUCHE(Poste technique;9)" if cs is not None and pt is not None and pt[:longueur] != cs else None,
            "Date début planifiée vide" if r["_DateBrute"] is None else None,
            "Date début planifiée invalide" if r["_DateBrute"] is not None and d is None else None,
            "Activité source vide alors que Désignation est renseignée"
            if r["Activité"] is None and r["Désignation"] is not None else None,
            "Activité vide" if r["Activité"] is None and r["Désignation"] is None else None,
            "Activité reconstruite depuis la Désignation (secours)"
            if r["Activité reconstruite (secours)"] is not None else None,
            "Activité mal formée" if "" in segments and r["Activité"] is not None else None,
            "Activité inconnue (à valider)" if any(a not in codes for a in atomiques) else None,
            "Site inconnu" if ss == "inconnu" else "Site à valider" if ss == "À valider" else None,
            "Site vide" if r["Site"] is None else None,
            "Équipe inconnue" if se == "inconnu" else "Équipe à valider" if se == "À valider" else None,
            "Équipe vide" if r["Équipe"] is None else None,
            "Type de travail différent de PRE (exclu de la couverture)" if not r["Est préventif"] else None,
        ]
        r["Contrôles"] = [c for c in ctl if c]
        r["Lignes vides ignorées"] = nb_vides
        r["Colonnes absentes"] = ", ".join(absentes) or None
        r["Fichier source"] = fichier_source if fichier_source is not None else str(chemin)
        r["Importé le"] = maintenant
    return sorted(utiles, key=lambda r: r["Ligne export"])


def ot_detail(gmao, pdm=None):
    eclate = []
    for r in sorted((r for r in gmao if r["Est préventif"] and r["Ordre"] is not None),
                    key=lambda r: r["Ligne export"]):
        for a in (r["_Activites"]["Atomiques"] or [None]):
            e = dict(r)
            e["Activité atomique"] = a
            e["_Cle"] = r["Ordre"] + "|" + ("#VIDE" if a is None else a)
            eclate.append(e)
    for k, e in enumerate(eclate, start=1):
        e["_Seq"] = k
    nb, lignes = {}, {}
    for e in eclate:
        nb[e["_Cle"]] = nb.get(e["_Cle"], 0) + 1
        lignes.setdefault(e["_Cle"], set()).add(e["Ligne export"])
    vus, garde = set(), []
    for e in eclate:
        if e["_Cle"] not in vus:
            vus.add(e["_Cle"])
            e["Lignes export regroupées"] = ", ".join(map(str, sorted(lignes[e["_Cle"]]))) if nb[e["_Cle"]] > 1 else None
            e["_Nb"] = nb[e["_Cle"]]
            garde.append(e)
    premiere = {}
    for e in garde:
        premiere.setdefault(e["Ordre"], e["_Seq"])
    des_pdm = {}
    for p in sorted(pdm or [], key=lambda p: p["Ligne PDM"]):
        if p["Code poste GMAO"] is not None and p["Désignation"] is not None:
            des_pdm.setdefault(p["Code poste GMAO"], p["Désignation"])
    des_gmao = {}
    for e in sorted(garde, key=lambda e: e["Ligne export"]):
        if e["Code poste"] is not None and e["Désign.poste techn."] is not None:
            des_gmao.setdefault(e["Code poste"], e["Désign.poste techn."])
    sortie = []
    for e in garde:
        e["Compte OT"] = 1 if e["_Seq"] == premiere[e["Ordre"]] else 0
        e["Désignation du poste"] = des_pdm.get(e["Code poste"], des_gmao.get(e["Code poste"]))
        ctl = e["Contrôles"] + (["Couple Ordre + Activité en double"] if e["_Nb"] > 1 else [])
        e["Contrôle qualité"] = " ; ".join(ctl) or None
        e["Activité source"] = e["Activité"]
        sortie.append({c: e[c] for c in COLONNES_OT})
    return sortie


def rapprochement(pdm, gmao):
    postes_pdm = {}
    for p in pdm:
        if p["Code poste"] is None:
            continue
        x = postes_pdm.setdefault(p["Code poste"], {"Site": None, "Équipe": None, "Désignation": None,
                                                     "Code poste GMAO": p["Code poste GMAO"], "Déclarée": False})
        for c in ("Site", "Équipe", "Désignation"):
            if x[c] is None:
                x[c] = p[c]
        x["Déclarée"] = x["Déclarée"] or p["Correspondance déclarée"]
    postes_gmao = {}
    for r in gmao:
        if r["Est préventif"] and r["Ordre"] is not None and r["Code poste"] is not None:
            x = postes_gmao.setdefault(r["Code poste"], {"ordres": set(), "Site": None, "Équipe": None, "Des": None})
            x["ordres"].add(r["Ordre"])
            for c, s in (("Site", "Site"), ("Équipe", "Équipe"), ("Des", "Désign.poste techn.")):
                if x[c] is None:
                    x[c] = r[s]
    sortie = []
    for code, x in postes_pdm.items():
        g = postes_gmao.get(x["Code poste GMAO"])
        sortie.append({"Origine": "Programme", "Site": x["Site"], "Équipe": x["Équipe"], "Code poste": code,
                       "Désignation": x["Désignation"], "Code poste GMAO": x["Code poste GMAO"],
                       "Statut rapprochement": "Non rapproché" if g is None else
                       "Correspondance manuelle" if x["Déclarée"] else "Correspondance automatique",
                       "Nb OT préventifs (GMAO)": 0 if g is None else len(g["ordres"])})
    utilises = {x["Code poste GMAO"] for x in postes_pdm.values() if x["Code poste GMAO"] is not None}
    for code, g in postes_gmao.items():
        if code not in utilises:
            sortie.append({"Origine": "GMAO", "Site": g["Site"], "Équipe": g["Équipe"], "Code poste": None,
                           "Désignation": g["Des"], "Code poste GMAO": code,
                           "Statut rapprochement": "OT sans poste au programme",
                           "Nb OT préventifs (GMAO)": len(g["ordres"])})
    cle = lambda v: (v is not None, v or "")
    sortie.sort(key=lambda l: (0 if l["Origine"] == "Programme" else 1, cle(l["Site"]), cle(l["Équipe"]),
                               cle(l["Code poste"]), cle(l["Code poste GMAO"])))
    return sortie


CONTROLES_GMAO = [
    ("Ordre vide", "À vérifier"), ("Doublon OT éventuel", "À vérifier"),
    ("Code poste impossible à déterminer", "À vérifier"),
    ("Code site vide : code poste repris du Poste technique", "Info"), ("Poste technique vide", "À vérifier"),
    ("Code site ≠ GAUCHE(Poste technique;9)", "À vérifier"), ("Date début planifiée vide", "À vérifier"),
    ("Date début planifiée invalide", "À vérifier"), ("Activité vide", "À vérifier"),
    ("Activité source vide alors que Désignation est renseignée", "À vérifier"),
    ("Activité reconstruite depuis la Désignation (secours)", "Info"), ("Activité mal formée", "À vérifier"),
    ("Activité inconnue (à valider)", "À vérifier"), ("Site inconnu", "À vérifier"), ("Site à valider", "À vérifier"),
    ("Site vide", "À vérifier"), ("Équipe inconnue", "À vérifier"), ("Équipe à valider", "À vérifier"),
    ("Équipe vide", "À vérifier"), ("Type de travail différent de PRE (exclu de la couverture)", "À vérifier")]
CONTROLES_PDM = ["PDM : code poste impossible à déterminer", "PDM : année vide ou invalide", "PDM : opération vide",
                 "PDM : opération inconnue (à valider)", "PDM : opération en double", "PDM : site inconnu",
                 "PDM : site à valider", "PDM : équipe inconnue", "PDM : équipe à valider"]


def controles(gmao, pdm, rappro, ot, actualise_le):
    def ligne(source, controle, niveau, nb, exemples=""):
        return {"Source": source, "Contrôle": controle, "Niveau": niveau, "Nombre": nb, "Exemples": exemples,
                "Statut": "INFO" if niveau == "Info" else "OK" if nb == 0 else "À VÉRIFIER"}

    def ex(valeurs):
        return ", ".join(list(dict.fromkeys(v for v in valeurs if v is not None))[:10])

    l = [ligne("PDM", "Lignes du programme lues", "Info", len(pdm)),
         ligne("PDM", "Postes du programme", "Info", len({p["Code poste"] for p in pdm if p["Code poste"]}))]
    for lib, niveau in [("PDM : Code Emprise vide (code repris du Code Installation)", "Info")] + [
            (c, "À vérifier") for c in CONTROLES_PDM]:
        t = [p for p in pdm if p["Contrôle qualité"] and lib in p["Contrôle qualité"].split(" ; ")]
        l.append(ligne("PDM", lib, niveau, len(t),
                       ex(f"{p['Code poste']} {p['Année']}" if p["Code poste"] is not None and p["Année"] is not None
                          else f"ligne {p['Ligne PDM']}" if p["Code poste"] is None else None for p in t)))
    absentes = gmao[0]["Colonnes absentes"] if gmao else None
    l += [ligne("GMAO", "Lignes lues dans l'export (hors lignes vides)", "Info", len(gmao)),
          ligne("GMAO", "Lignes techniques vides ignorées", "Info", gmao[0]["Lignes vides ignorées"] if gmao else 0),
          ligne("GMAO", "OT préventifs retenus (PRE, Ordre renseigné)", "Info", len({o["Ordre"] for o in ot})),
          ligne("GMAO", "Colonnes absentes de l'export", "À vérifier", 0 if absentes is None else 1, absentes or "")]
    for lib, niveau in CONTROLES_GMAO:
        t = [r for r in gmao if lib in r["Contrôles"]]
        l.append(ligne("GMAO", lib, niveau, len(t),
                       ex(r["Ordre"] if r["Ordre"] is not None else f"ligne {r['Ligne export']}" for r in t)))
    t = [o for o in ot if o["Contrôle qualité"] and "Couple Ordre + Activité en double" in o["Contrôle qualité"].split(" ; ")]
    l.append(ligne("GMAO", "Couple Ordre + Activité en double (compté une fois)", "Info", len(t), ex(o["Ordre"] for o in t)))
    statut = lambda s: [r for r in rappro if r["Statut rapprochement"] == s]
    l += [ligne("Rapprochement", "Postes : correspondance automatique", "Info", len(statut("Correspondance automatique"))),
          ligne("Rapprochement", "Postes : correspondance manuelle (T_Correspondance)", "Info",
                len(statut("Correspondance manuelle")), ex(r["Code poste"] for r in statut("Correspondance manuelle"))),
          ligne("Rapprochement", "Rapprochement PDM/GMAO impossible : poste sans OT préventif", "À vérifier",
                len(statut("Non rapproché")), ex(r["Code poste"] for r in statut("Non rapproché"))),
          ligne("Rapprochement", "Rapprochement PDM/GMAO impossible : OT sans poste au programme", "À vérifier",
                len(statut("OT sans poste au programme")),
                ex(r["Code poste GMAO"] for r in statut("OT sans poste au programme")))]
    for k, x in enumerate(l, start=1):
        x["N°"] = k
        x["Actualisé le"] = actualise_le
    return [{c: x[c] for c in COLONNES_CTL} for x in l]


def anomalies(gmao, pdm):
    sortie = []
    for p in pdm:
        if p["Contrôle qualité"]:
            for c in p["Contrôle qualité"].split(" ; "):
                sortie.append({"Source": "PDM", "Ligne": p["Ligne PDM"], "Ordre": None, "Code poste": p["Code poste"],
                               "Site": p["Site"], "Équipe": p["Équipe"], "Contrôle": c,
                               "Détail": None if p["Année"] is None else f"{p['Année']} {p['Opération'] or ''}"})
    for r in gmao:
        for c in r["Contrôles"]:
            sortie.append({"Source": "GMAO", "Ligne": r["Ligne export"], "Ordre": r["Ordre"],
                           "Code poste": r["Code poste"], "Site": r["Site"], "Équipe": r["Équipe"], "Contrôle": c,
                           "Détail": r["Désignation"]})
    return sortie
