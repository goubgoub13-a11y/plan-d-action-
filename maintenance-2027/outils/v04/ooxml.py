"""Compléments OOXML qu'openpyxl ne sait pas écrire : requêtes Power Query intégrées,
tableaux croisés dynamiques, segments (slicers), thème aux couleurs de la charte.

Les structures reprennent celles d'Excel (modèle de requête de la bibliothèque
@microsoft/connected-workbooks, spécifications MS-QDEFF et MS-XLSX). Le classeur final est
contrôlé avec le validateur Open XML de Microsoft (outils/validation).
"""

import base64
import datetime as dt
import io
import json
import re
import struct
import zipfile
from xml.sax.saxutils import escape

from lxml import etree

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
NS_X14 = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
NS_X15 = "http://schemas.microsoft.com/office/spreadsheetml/2010/11/main"
NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
CT = "application/vnd.openxmlformats-officedocument.spreadsheetml."

# Parties binaires reprises du modèle Excel de connected-workbooks (licence MIT) :
# liste des autorisations Power Query et signature des liaisons, conservées telles quelles
# comme le fait la bibliothèque de Microsoft quand elle remplace la requête.
PERMISSIONS = ('﻿<?xml version="1.0" encoding="utf-8"?><PermissionList xmlns:xsd="http://www.w3.org/2001/XMLSchema" '
               'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><CanEvaluateFuturePackages>false'
               '</CanEvaluateFuturePackages><FirewallEnabled>true</FirewallEnabled></PermissionList>').encode("utf-8")


# Liaisons d'autorisation (MS-QDEFF « Permission Bindings ») du même modèle : Excel les ignore
# quand elles ne correspondent plus au paquet, comme le montre l'usage de la bibliothèque.
LIAISONS = base64.b64decode(
    "2gAAAAEAAADQjJ3fARXREYx6AMBPwpfrAQAAAGzqklKu/IFGiUNMRxj1uv4AAAAAAgAAAAAAA2YAAMAAAAAQAAAAzYAGquRQdYsiO62bBPxpLAA"
    "AAAAEgAAAoAAAABAAAAAH77imTZzfyeX4HwJDXFDyUAAAAINOCBVNd1x6LV0DhClLYQzeP3MPG4tE7M9wX5WUPdM4e5x1SKWd9UaIWBGPqgOmFq0R"
    "PBzCCQ/7FcHhOLFti8On3TKftqMUVtUEfjWzEr4TFAAAAOdTA+PyhkM5yxoICVnYKWjxVAyb")


def q(ns, tag):
    return f"{{{ns}}}{tag}"


class Paquet:
    """Classeur .xlsx manipulé partie par partie."""

    def __init__(self, chemin):
        with zipfile.ZipFile(chemin) as z:
            self.parts = {n: z.read(n) for n in z.namelist()}

    def xml(self, nom):
        return etree.fromstring(self.parts[nom])

    def ecrire(self, nom, racine_ou_octets):
        if isinstance(racine_ou_octets, bytes):
            self.parts[nom] = racine_ou_octets
        else:
            self.parts[nom] = etree.tostring(racine_ou_octets, xml_declaration=True, encoding="UTF-8", standalone=True)

    def override(self, nom, type_contenu):
        ct = self.xml("[Content_Types].xml")
        if not any(o.get("PartName") == "/" + nom for o in ct.findall(q(NS_CT, "Override"))):
            etree.SubElement(ct, q(NS_CT, "Override"), PartName="/" + nom, ContentType=type_contenu)
        self.ecrire("[Content_Types].xml", ct)

    def relation(self, source, type_rel, cible):
        dossier, fichier = source.rsplit("/", 1) if "/" in source else ("", source)
        nom_rels = f"{dossier}/_rels/{fichier}.rels" if dossier else f"_rels/{fichier}.rels"
        if nom_rels in self.parts:
            rels = self.xml(nom_rels)
        else:
            rels = etree.Element(q(NS_REL, "Relationships"), nsmap={None: NS_REL})
        ids = [int(re.sub(r"\D", "", r.get("Id")) or 0) for r in rels]
        rid = f"rId{max(ids, default=0) + 1}"
        etree.SubElement(rels, q(NS_REL, "Relationship"), Id=rid, Type=type_rel, Target=cible)
        self.ecrire(nom_rels, rels)
        return rid

    def cible(self, source, rid):
        dossier, fichier = source.rsplit("/", 1)
        rels = self.xml(f"{dossier}/_rels/{fichier}.rels")
        return next(r.get("Target") for r in rels if r.get("Id") == rid)

    def feuilles(self):
        """{nom de feuille: (chemin de la partie, sheetId, index)}"""
        wb = self.xml("xl/workbook.xml")
        res = {}
        for i, s in enumerate(wb.find(q(NS_MAIN, "sheets"))):
            cible = self.cible("xl/workbook.xml", s.get(q(NS_R, "id")))
            res[s.get("name")] = ("xl/" + cible.lstrip("/").replace("xl/", ""), int(s.get("sheetId")), i)
        return res

    def tables(self):
        """{nom du tableau: (chemin de la partie, id, feuille)}"""
        res = {}
        for feuille, (chemin, _, _) in self.feuilles().items():
            dossier, fichier = chemin.rsplit("/", 1)
            nom_rels = f"{dossier}/_rels/{fichier}.rels"
            if nom_rels not in self.parts:
                continue
            for r in self.xml(nom_rels):
                if r.get("Type").endswith("/table"):
                    part = "xl/tables/" + r.get("Target").rsplit("/", 1)[1]
                    t = self.xml(part)
                    res[t.get("name")] = (part, int(t.get("id")), feuille)
        return res

    def enregistrer(self, chemin):
        ordre = ["[Content_Types].xml", "_rels/.rels"] + [n for n in self.parts if n not in ("[Content_Types].xml", "_rels/.rels")]
        with zipfile.ZipFile(chemin, "w", zipfile.ZIP_DEFLATED) as z:
            for n in ordre:
                z.writestr(n, self.parts[n])


def inserer_dans_ordre(parent, element, apres):
    """Insère element après le dernier enfant dont le nom local figure dans `apres` (ordre du schéma)."""
    pos = 0
    for i, enfant in enumerate(parent):
        if etree.QName(enfant).localname in apres:
            pos = i + 1
    parent.insert(pos, element)


# ---------------------------------------------------------------- styles et thème

ORDRE_POLICE = ["b", "i", "strike", "condense", "extend", "outline", "shadow", "u", "vertAlign", "sz", "color",
                "name", "family", "charset", "scheme"]


def ordonner_polices(p):
    """openpyxl écrit les propriétés de police dans un ordre que le schéma n'attend pas : on les range."""
    st = p.xml("xl/styles.xml")
    for font in st.iter(q(NS_MAIN, "font")):
        enfants = sorted(font, key=lambda e: ORDRE_POLICE.index(etree.QName(e).localname))
        for e in enfants:
            font.append(e)
    p.ecrire("xl/styles.xml", st)


def theme_charte(p, accents, police):
    """Couleurs d'accent et police du thème : les styles de tableau, de TCD et de segment suivent la charte."""
    nom = next(n for n in p.parts if n.startswith("xl/theme/"))
    th = p.xml(nom)
    schema = th.find(f".//{q(NS_A, 'clrScheme')}")
    for i, couleur in enumerate(accents, start=1):
        noeud = schema.find(q(NS_A, f"accent{i}"))
        for e in list(noeud):
            noeud.remove(e)
        etree.SubElement(noeud, q(NS_A, "srgbClr"), val=couleur)
    for latin in th.iter(q(NS_A, "latin")):
        if latin.getparent().tag in (q(NS_A, "majorFont"), q(NS_A, "minorFont")):
            latin.set("typeface", police)
    p.ecrire(nom, th)


# ---------------------------------------------------------------- Power Query

def _opc(fichiers):
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as z:
        for nom, contenu in fichiers.items():
            z.writestr(nom, contenu)
    return tampon.getvalue()


def _metadonnees(requetes, maintenant):
    items = ['<Item><ItemLocation><ItemType>AllFormulas</ItemType><ItemPath /></ItemLocation><StableEntries /></Item>']
    for r in requetes:
        nom = r["nom"]
        if r.get("tableau"):
            n = len(r["colonnes"])
            types = base64.b64encode(bytes([6] * n)).decode()
            noms = escape(json.dumps(r["colonnes"], ensure_ascii=False), {'"': "&quot;"})
            identites = json.dumps([f"Section1/{nom}/AutoRemovedColumns1.{{{c},{i}}}" for i, c in enumerate(r["colonnes"])],
                                   ensure_ascii=False)
            relation = escape(json.dumps({"columnCount": n, "keyColumnNames": [], "queryRelationships": [],
                                          "columnIdentities": json.loads(identites), "ColumnCount": n,
                                          "KeyColumnNames": [], "ColumnIdentities": json.loads(identites),
                                          "RelationshipInfo": []}, ensure_ascii=False), {'"': "&quot;"})
            entrees = (
                '<Entry Type="IsPrivate" Value="l0" /><Entry Type="FillEnabled" Value="l1" />'
                '<Entry Type="FillObjectType" Value="sTable" /><Entry Type="FillToDataModelEnabled" Value="l0" />'
                '<Entry Type="BufferNextRefresh" Value="l1" /><Entry Type="ResultType" Value="sTable" />'
                '<Entry Type="NameUpdatedAfterFill" Value="l0" /><Entry Type="NavigationStepName" Value="sNavigation" />'
                f'<Entry Type="FillTarget" Value="s{escape(r["tableau"])}" />'
                '<Entry Type="FilledCompleteResultToWorksheet" Value="l1" /><Entry Type="AddedToDataModel" Value="l0" />'
                f'<Entry Type="FillCount" Value="l{r["lignes"]}" /><Entry Type="FillErrorCode" Value="sUnknown" />'
                f'<Entry Type="FillErrorCount" Value="l0" /><Entry Type="FillLastUpdated" Value="d{maintenant}" />'
                f'<Entry Type="FillColumnTypes" Value="s{types}" /><Entry Type="FillColumnNames" Value="s{noms}" />'
                '<Entry Type="FillStatus" Value="sComplete" />'
                f'<Entry Type="RelationshipInfoContainer" Value="s{relation}" />')
        else:
            entrees = (
                '<Entry Type="IsPrivate" Value="l0" /><Entry Type="FillEnabled" Value="l0" />'
                '<Entry Type="FillObjectType" Value="sConnectionOnly" /><Entry Type="FillToDataModelEnabled" Value="l0" />'
                '<Entry Type="ResultType" Value="sTable" /><Entry Type="NameUpdatedAfterFill" Value="l0" />'
                '<Entry Type="NavigationStepName" Value="sNavigation" /><Entry Type="AddedToDataModel" Value="l0" />'
                f'<Entry Type="FillLastUpdated" Value="d{maintenant}" /><Entry Type="FillErrorCode" Value="sUnknown" />'
                '<Entry Type="FillStatus" Value="sComplete" />')
        items.append(f'<Item><ItemLocation><ItemType>Formula</ItemType><ItemPath>Section1/{escape(nom)}</ItemPath>'
                     f'</ItemLocation><StableEntries>{entrees}</StableEntries></Item>')
    xml = ('﻿<?xml version="1.0" encoding="utf-8"?><LocalPackageMetadataFile '
           'xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
           f'<Items>{"".join(items)}</Items></LocalPackageMetadataFile>').encode("utf-8")
    contenu = _opc({})  # paquet de métadonnées vide, comme dans les classeurs Excel
    return struct.pack("<I", 0) + struct.pack("<I", len(xml)) + xml + struct.pack("<I", len(contenu)) + contenu


def datamashup(requetes, liaisons, culture="fr-FR"):
    """Partie DataMashup (MS-QDEFF) : section M partagée, autorisations, métadonnées, liaisons."""
    section = "section Section1;\r\n" + "".join(
        f"\r\nshared {r['nom']} = {r['code'].strip()};\r\n" for r in requetes)
    paquet = _opc({
        "[Content_Types].xml": '﻿<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/'
                               'package/2006/content-types"><Default Extension="xml" ContentType="text/xml" />'
                               '<Default Extension="m" ContentType="application/x-ms-m" /></Types>',
        "Config/Package.xml": '﻿<?xml version="1.0" encoding="utf-8"?><Package xmlns:xsd="http://www.w3.org/2001/'
                              'XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Version>2.99.202.0'
                              f'</Version><MinVersion>2.21.0.0</MinVersion><Culture>{culture}</Culture></Package>',
        "Formulas/Section1.m": section,
    })
    maintenant = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")
    meta = _metadonnees(requetes, maintenant)
    binaire = (struct.pack("<I", 0) + struct.pack("<I", len(paquet)) + paquet + struct.pack("<I", len(PERMISSIONS))
               + PERMISSIONS + struct.pack("<I", len(meta)) + meta + liaisons)
    xml = ('<?xml version="1.0" encoding="utf-16"?><DataMashup xmlns="http://schemas.microsoft.com/DataMashup">'
           + base64.b64encode(binaire).decode() + "</DataMashup>")
    return "﻿".encode("utf-16-le") + xml.encode("utf-16-le"), section


def ajouter_requetes(p, requetes, liaisons):
    """requetes : [{nom, code, tableau (ou None = connexion seule), colonnes, lignes}]"""
    tables = p.tables()
    feuilles = p.feuilles()
    # 1. Partie DataMashup (customXml)
    contenu, section = datamashup(requetes, liaisons)
    p.ecrire("customXml/item1.xml", contenu)
    p.ecrire("customXml/itemProps1.xml", (
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\r\n<ds:datastoreItem ds:itemID="{4A1F2C3D-5E6F-4A7B-8C9D-0E1F2A3B4C5D}" '
        'xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef '
        'ds:uri="http://schemas.microsoft.com/DataMashup"/></ds:schemaRefs></ds:datastoreItem>').encode("utf-8"))
    p.relation("customXml/item1.xml", REL + "customXmlProps", "itemProps1.xml")
    p.override("customXml/itemProps1.xml", "application/vnd.openxmlformats-officedocument.customXmlProperties+xml")
    p.relation("xl/workbook.xml", REL + "customXml", "../customXml/item1.xml")
    # 2. Connexions
    cx = etree.Element(q(NS_MAIN, "connections"), nsmap={None: NS_MAIN})
    for i, r in enumerate(requetes, start=1):
        attrs = dict(id=str(i), keepAlive="1", name=f"Requête - {r['nom']}",
                     description=f"Connexion à la requête « {r['nom']} » dans le classeur.", type="5",
                     refreshedVersion="8", background="0")
        if r.get("tableau"):
            attrs["saveData"] = "1"
        c = etree.SubElement(cx, q(NS_MAIN, "connection"), **attrs)
        etree.SubElement(c, q(NS_MAIN, "dbPr"),
                         connection=f'Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;Location={r["nom"]};Extended Properties=""',
                         command=f"SELECT * FROM [{r['nom']}]")
        r["connexion"] = i
    p.ecrire("xl/connections.xml", cx)
    p.relation("xl/workbook.xml", REL + "connections", "connections.xml")
    p.override("xl/connections.xml", CT + "connections+xml")
    # 3. Tableaux liés aux requêtes
    wb = p.xml("xl/workbook.xml")
    noms = wb.find(q(NS_MAIN, "definedNames"))
    if noms is None:
        noms = etree.Element(q(NS_MAIN, "definedNames"))
        inserer_dans_ordre(wb, noms, {"fileVersion", "fileSharing", "workbookPr", "workbookProtection", "bookViews",
                                      "sheets", "functionGroups", "externalReferences"})
    n_qt = 0
    for r in requetes:
        if not r.get("tableau"):
            continue
        n_qt += 1
        part, _, feuille = tables[r["tableau"]]
        t = p.xml(part)
        t.set("tableType", "queryTable")
        colonnes = t.find(q(NS_MAIN, "tableColumns"))
        champs = []
        for k, col in enumerate(colonnes, start=1):
            col.set("uniqueName", str(k))
            col.set("queryTableFieldId", str(k))
            champs.append((k, col.get("name"), col.get("id")))
        assert [c[1] for c in champs] == r["colonnes"], (r["nom"], [c[1] for c in champs], r["colonnes"])
        p.ecrire(part, t)
        qt = etree.Element(q(NS_MAIN, "queryTable"), nsmap={None: NS_MAIN}, name=f"ExternalData_{n_qt}",
                           connectionId=str(r["connexion"]), autoFormatId="16", applyNumberFormats="0",
                           applyBorderFormats="0", applyFontFormats="0", applyPatternFormats="0",
                           applyAlignmentFormats="0", applyWidthHeightFormats="0", adjustColumnWidth="0")
        rf = etree.SubElement(qt, q(NS_MAIN, "queryTableRefresh"), nextId=str(len(champs) + 1))
        fs = etree.SubElement(rf, q(NS_MAIN, "queryTableFields"), count=str(len(champs)))
        for k, nom, col_id in champs:
            etree.SubElement(fs, q(NS_MAIN, "queryTableField"), id=str(k), name=nom, tableColumnId=col_id)
        nom_qt = f"xl/queryTables/queryTable{n_qt}.xml"
        p.ecrire(nom_qt, qt)
        p.override(nom_qt, CT + "queryTable+xml")
        p.relation(part, REL + "queryTable", f"../queryTables/queryTable{n_qt}.xml")
        _, _, index = feuilles[feuille]
        a, b = t.get("ref").split(":")
        cellule = lambda c: "$" + re.match(r"[A-Z]+", c).group() + "$" + re.search(r"\d+", c).group()
        etree.SubElement(noms, q(NS_MAIN, "definedName"), name=f"ExternalData_{n_qt}", localSheetId=str(index),
                         hidden="1").text = f"'{feuille}'!{cellule(a)}:{cellule(b)}"
    p.ecrire("xl/workbook.xml", wb)
    return section


# ---------------------------------------------------------------- tableaux croisés dynamiques

def _num(v):
    return repr(float(v)) if isinstance(v, float) and not float(v).is_integer() else str(int(v))


def _date(v):
    if isinstance(v, dt.datetime):
        return v.strftime("%Y-%m-%dT%H:%M:%S")
    return dt.datetime(v.year, v.month, v.day).strftime("%Y-%m-%dT%H:%M:%S")


def _valeur(v):
    if v is None:
        return "<m/>"
    if isinstance(v, bool):
        return f'<b v="{int(v)}"/>'
    if isinstance(v, (int, float)):
        return f'<n v="{_num(v)}"/>'
    if isinstance(v, (dt.date, dt.datetime)):
        return f'<d v="{_date(v)}"/>'
    return f'<s v="{escape(str(v), {chr(34): "&quot;"})}"/>'


def _shared_items(valeurs, items=None):
    """Attributs sharedItems déduits des valeurs ; items = liste ordonnée des éléments partagés."""
    nn = [v for v in valeurs if v is not None]
    blanc = len(nn) < len(valeurs)
    nombres = [v for v in nn if isinstance(v, (int, float)) and not isinstance(v, bool)]
    dates = [v for v in nn if isinstance(v, (dt.date, dt.datetime))]
    textes = [v for v in nn if isinstance(v, str)]
    a = {}
    if not nn:
        a = {"containsNonDate": "0", "containsString": "0", "containsBlank": "1"}
    elif dates and not textes and not nombres:
        a = {"containsSemiMixedTypes": "0", "containsNonDate": "0", "containsDate": "1", "containsString": "0",
             "minDate": _date(min(dates)), "maxDate": _date(max(dates) + dt.timedelta(days=1))}
        if blanc:
            del a["containsSemiMixedTypes"]
            a["containsBlank"] = "1"
    elif nombres and not textes and not dates:
        a = {"containsSemiMixedTypes": "0", "containsString": "0", "containsNumber": "1"}
        if all(float(v).is_integer() for v in nombres):
            a["containsInteger"] = "1"
        a["minValue"], a["maxValue"] = _num(min(nombres)), _num(max(nombres))
        if blanc:
            del a["containsSemiMixedTypes"]
            a["containsBlank"] = "1"
    elif blanc:
        a = {"containsBlank": "1"}
    attrs = "".join(f' {k}="{v}"' for k, v in a.items())
    if items is None:
        return f"<sharedItems{attrs}/>"
    return f'<sharedItems{attrs} count="{len(items)}">' + "".join(_valeur(v) for v in items) + "</sharedItems>"


def ajouter_tcd(p, feuille, tableau, colonnes, lignes, champs_partages, tcds, rendu=None):
    """Cache de TCD sur un tableau Excel + tableaux croisés définis par `tcds`.

    champs_partages : {colonne: liste ordonnée des éléments} (champs utilisés en ligne, colonne ou segment)
    tcds : liste de dicts {nom, ref, lignes:[colonnes], colonne: colonne ou None, valeur: (colonne, fonction, titre),
           filtres:[colonnes pour segments hors axes], titre_lignes, premier_col}
    """
    index = {c: i for i, c in enumerate(colonnes)}
    # Définition du cache
    champs = []
    for c in colonnes:
        valeurs = [l[c] for l in lignes]
        items = champs_partages.get(c)
        champs.append(f'<cacheField name="{escape(c, {chr(34): "&quot;"})}" numFmtId="0">{_shared_items(valeurs, items)}</cacheField>')
    maintenant = (dt.datetime.now() - dt.datetime(1899, 12, 30)).total_seconds() / 86400
    definition = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<pivotCacheDefinition xmlns="{NS_MAIN}" xmlns:r="{NS_R}" '
        f'r:id="rId1" refreshOnLoad="1" refreshedBy="Prototype" refreshedDate="{maintenant:.6f}" createdVersion="6" '
        f'refreshedVersion="6" minRefreshableVersion="3" recordCount="{len(lignes)}">'
        f'<cacheSource type="worksheet"><worksheetSource name="{tableau}"/></cacheSource>'
        f'<cacheFields count="{len(colonnes)}">{"".join(champs)}</cacheFields>'
        f'<extLst><ext uri="{{725AE2AE-9491-48be-B2B4-4EB974FC3084}}" xmlns:x14="{NS_X14}">'
        f'<x14:pivotCacheDefinition pivotCacheId="1"/></ext></extLst></pivotCacheDefinition>')
    enregistrements = []
    for l in lignes:
        vals = []
        for c in colonnes:
            items = champs_partages.get(c)
            vals.append(f'<x v="{items.index(l[c])}"/>' if items is not None else _valeur(l[c]))
        enregistrements.append("<r>" + "".join(vals) + "</r>")
    records = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<pivotCacheRecords xmlns="{NS_MAIN}" '
               f'xmlns:r="{NS_R}" count="{len(lignes)}">{"".join(enregistrements)}</pivotCacheRecords>')
    p.ecrire("xl/pivotCache/pivotCacheDefinition1.xml", definition.encode("utf-8"))
    p.ecrire("xl/pivotCache/pivotCacheRecords1.xml", records.encode("utf-8"))
    p.relation("xl/pivotCache/pivotCacheDefinition1.xml", REL + "pivotCacheRecords", "pivotCacheRecords1.xml")
    p.override("xl/pivotCache/pivotCacheDefinition1.xml", CT + "pivotCacheDefinition+xml")
    p.override("xl/pivotCache/pivotCacheRecords1.xml", CT + "pivotCacheRecords+xml")
    rid_cache = p.relation("xl/workbook.xml", REL + "pivotCacheDefinition", "pivotCache/pivotCacheDefinition1.xml")
    wb = p.xml("xl/workbook.xml")
    caches = etree.Element(q(NS_MAIN, "pivotCaches"))
    etree.SubElement(caches, q(NS_MAIN, "pivotCache"), cacheId="1").set(q(NS_R, "id"), rid_cache)
    inserer_dans_ordre(wb, caches, {"fileVersion", "fileSharing", "workbookPr", "workbookProtection", "bookViews",
                                    "sheets", "functionGroups", "externalReferences", "definedNames", "calcPr",
                                    "oleSize", "customWorkbookViews"})
    p.ecrire("xl/workbook.xml", wb)

    chemin_feuille = p.feuilles()[feuille][0]
    for k, t in enumerate(tcds, start=1):
        axes = {c: "axisRow" for c in t["lignes"]}
        if t.get("colonne"):
            axes[t["colonne"]] = "axisCol"
        champs_pivot = []
        for c in colonnes:
            items = champs_partages.get(c)
            attrs = 'compact="0" outline="0" showAll="0"'
            if c in axes:
                liste = "".join(f'<item x="{i}"/>' for i in range(len(items)))
                ext = ""
                if axes[c] == "axisRow":
                    ext = (f'<extLst><ext uri="{{2946ED86-A175-432a-8AC1-64E0C546D7DE}}" xmlns:x14="{NS_X14}">'
                           f'<x14:pivotField fillDownLabels="1"/></ext></extLst>')
                champs_pivot.append(f'<pivotField axis="{axes[c]}" {attrs} defaultSubtotal="0">'
                                    f'<items count="{len(items)}">{liste}</items>{ext}</pivotField>')
            elif c == t["valeur"][0]:
                champs_pivot.append(f'<pivotField dataField="1" {attrs}/>')
            elif c in t.get("filtres", []):
                liste = "".join(f'<item x="{i}"/>' for i in range(len(items))) + '<item t="default"/>'
                champs_pivot.append(f'<pivotField {attrs}><items count="{len(items) + 1}">{liste}</items></pivotField>')
            else:
                champs_pivot.append(f'<pivotField {attrs}/>')
        lignes_xml = "".join(f'<field x="{index[c]}"/>' for c in t["lignes"])
        col_xml = (f'<colFields count="1"><field x="{index[t["colonne"]]}"/></colFields>' if t.get("colonne") else "")
        valeur, fonction, titre = t["valeur"]
        definition_tcd = (
            f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<pivotTableDefinition xmlns="{NS_MAIN}" '
            f'name="{t["nom"]}" cacheId="1" applyNumberFormats="0" applyBorderFormats="0" applyFontFormats="0" '
            f'applyPatternFormats="0" applyAlignmentFormats="0" applyWidthHeightFormats="1" dataCaption="Valeurs" '
            f'grandTotalCaption="Total" missingCaption="0" updatedVersion="6" minRefreshableVersion="3" '
            f'useAutoFormatting="0" rowGrandTotals="0" colGrandTotals="{1 if t.get("total_bas") else 0}" '
            f'itemPrintTitles="1" createdVersion="6" indent="0" compact="0" compactData="0" outline="1" '
            f'outlineData="1" gridDropZones="0" multipleFieldFilters="0">'
            f'<location ref="{t["ref"]}" firstHeaderRow="1" firstDataRow="{t["premiere_ligne"]}" '
            f'firstDataCol="{len(t["lignes"])}"/>'
            f'<pivotFields count="{len(colonnes)}">{"".join(champs_pivot)}</pivotFields>'
            f'<rowFields count="{len(t["lignes"])}">{lignes_xml}</rowFields>{col_xml}'
            f'<dataFields count="1"><dataField name="{escape(titre)}" fld="{index[valeur]}" subtotal="{fonction}" '
            f'baseField="0" baseItem="0"/></dataFields>'
            f'<pivotTableStyleInfo name="PivotStyleLight16" showRowHeaders="1" showColHeaders="1" '
            f'showRowStripes="0" showColStripes="0" showLastColumn="1"/>'
            f'</pivotTableDefinition>')
        nom = f"xl/pivotTables/pivotTable{k}.xml"
        p.ecrire(nom, definition_tcd.encode("utf-8"))
        p.relation(nom, REL + "pivotCacheDefinition", "../pivotCache/pivotCacheDefinition1.xml")
        p.override(nom, CT + "pivotTable+xml")
        p.relation(chemin_feuille, REL + "pivotTable", f"../pivotTables/pivotTable{k}.xml")


# ---------------------------------------------------------------- segments

def _ancre_segment(nom, de, a, tableau, id_forme):
    """Ancre de dessin d'un segment ; de/a = (col, décalage EMU, ligne, décalage EMU), 0-based."""
    requis, ns_req = ("sle15", "http://schemas.microsoft.com/office/drawing/2012/slicer") if tableau else (
        "a14", "http://schemas.microsoft.com/office/drawing/2010/main")
    texte = ("Cette forme représente un segment de table. Les segments de table sont pris en charge dans Excel 2013 "
             "ou version ultérieure." if tableau else
             "Cette forme représente un segment. Les segments sont pris en charge dans Excel 2010 ou version ultérieure.")
    xml = (
        f'<xdr:twoCellAnchor xmlns:xdr="{NS_XDR}" xmlns:a="{NS_A}" editAs="oneCell">'
        f'<xdr:from><xdr:col>{de[0]}</xdr:col><xdr:colOff>{de[1]}</xdr:colOff><xdr:row>{de[2]}</xdr:row>'
        f'<xdr:rowOff>{de[3]}</xdr:rowOff></xdr:from>'
        f'<xdr:to><xdr:col>{a[0]}</xdr:col><xdr:colOff>{a[1]}</xdr:colOff><xdr:row>{a[2]}</xdr:row>'
        f'<xdr:rowOff>{a[3]}</xdr:rowOff></xdr:to>'
        f'<mc:AlternateContent xmlns:mc="{NS_MC}"><mc:Choice xmlns:{requis}="{ns_req}" Requires="{requis}">'
        f'<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="{id_forme}" name="{escape(nom)}"/>'
        f'<xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
        f'<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/drawing/2010/slicer">'
        f'<sle:slicer xmlns:sle="http://schemas.microsoft.com/office/drawing/2010/slicer" name="{escape(nom)}"/>'
        f'</a:graphicData></a:graphic></xdr:graphicFrame></mc:Choice>'
        f'<mc:Fallback><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="{id_forme + 500}" name=""/><xdr:cNvSpPr>'
        f'<a:spLocks noTextEdit="1"/></xdr:cNvSpPr></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="1828800" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
        f'<a:solidFill><a:prstClr val="white"/></a:solidFill><a:ln w="1"><a:solidFill><a:prstClr val="green"/>'
        f'</a:solidFill></a:ln></xdr:spPr><xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip"/>'
        f'<a:lstStyle/><a:p><a:r><a:rPr lang="fr-FR" sz="1100"/><a:t>{escape(texte)}</a:t></a:r></a:p>'
        f'</xdr:txBody></xdr:sp></mc:Fallback></mc:AlternateContent><xdr:clientData/></xdr:twoCellAnchor>')
    return etree.fromstring(xml)


def ajouter_segments(p, feuille, segments, tableau, n_depart, tcds=None, champs_partages=None, cache_id=1):
    """segments : [{nom, cache, legende, source (nom du champ), colonnes (boutons par ligne), de, a,
                    (tableau) table_id, colonne_table}]"""
    feuilles = p.feuilles()
    chemin, sheet_id, _ = feuilles[feuille]
    wb = p.xml("xl/workbook.xml")
    noms = wb.find(q(NS_MAIN, "definedNames"))
    rids = []
    for k, s in enumerate(segments, start=n_depart):
        if tableau:
            corps = (f'<extLst><x:ext uri="{{2F2917AC-EB37-4324-AD4E-5DD8C200BD13}}" xmlns:x15="{NS_X15}">'
                     f'<x15:tableSlicerCache tableId="{s["table_id"]}" column="{s["colonne_table"]}" '
                     f'sortOrder="ascending"/></x:ext></extLst>')
        else:
            items = champs_partages[s["source"]]
            ordre = sorted(range(len(items)), key=lambda i: (items[i] is None, str(items[i])))
            corps = ("<pivotTables>" + "".join(f'<pivotTable tabId="{sheet_id}" name="{t}"/>' for t in tcds)
                     + f'</pivotTables><data><tabular pivotCacheId="{cache_id}"><items count="{len(items)}">'
                     + "".join(f'<i x="{i}" s="1"/>' for i in ordre) + "</items></tabular></data>")
        cache = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<slicerCacheDefinition xmlns="{NS_X14}" '
                 f'xmlns:mc="{NS_MC}" mc:Ignorable="x" xmlns:x="{NS_MAIN}" name="{s["cache"]}" '
                 f'sourceName="{escape(s["source"])}">{corps}</slicerCacheDefinition>')
        nom_cache = f"xl/slicerCaches/slicerCache{k}.xml"
        p.ecrire(nom_cache, cache.encode("utf-8"))
        p.override(nom_cache, "application/vnd.ms-excel.slicerCache+xml")
        rids.append(p.relation("xl/workbook.xml", "http://schemas.microsoft.com/office/2007/relationships/slicerCache",
                               f"slicerCaches/slicerCache{k}.xml"))
        etree.SubElement(noms, q(NS_MAIN, "definedName"), name=s["cache"]).text = "#N/A"
    # Partie « slicers » de la feuille
    corps = "".join(f'<slicer name="{escape(s["nom"])}" cache="{s["cache"]}" caption="{escape(s["legende"])}" '
                    f'columnCount="{s["colonnes"]}" style="SlicerStyleDark1" rowHeight="241300"/>' for s in segments)
    n_slicers = sum(1 for n in p.parts if n.startswith("xl/slicers/")) + 1
    nom_slicers = f"xl/slicers/slicer{n_slicers}.xml"
    p.ecrire(nom_slicers, (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<slicers xmlns="{NS_X14}" '
                           f'xmlns:mc="{NS_MC}" mc:Ignorable="x" xmlns:x="{NS_MAIN}">{corps}</slicers>').encode("utf-8"))
    p.override(nom_slicers, "application/vnd.ms-excel.slicer+xml")
    rid_slicers = p.relation(chemin, "http://schemas.microsoft.com/office/2007/relationships/slicer",
                             f"../slicers/slicer{n_slicers}.xml")
    # Liste des caches dans le classeur (x14 pour les TCD, x15 pour les tableaux)
    ext_lst = wb.find(q(NS_MAIN, "extLst"))
    if ext_lst is None:
        ext_lst = etree.SubElement(wb, q(NS_MAIN, "extLst"))
    if tableau:
        ext = etree.SubElement(ext_lst, q(NS_MAIN, "ext"), uri="{46BE6895-7355-4a93-B00E-2C351335B9C9}",
                               nsmap={"x15": NS_X15})
        conteneur = etree.SubElement(ext, q(NS_X15, "slicerCaches"), nsmap={"x14": NS_X14})
    else:
        ext = etree.Element(q(NS_MAIN, "ext"), uri="{BBE1A952-AA13-448e-AADC-164F8A28A991}", nsmap={"x14": NS_X14})
        ext_lst.insert(0, ext)
        conteneur = etree.SubElement(ext, q(NS_X14, "slicerCaches"))
    for rid in rids:
        etree.SubElement(conteneur, q(NS_X14, "slicerCache")).set(q(NS_R, "id"), rid)
    p.ecrire("xl/workbook.xml", wb)
    # Liste des segments dans la feuille
    ws = p.xml(chemin)
    ws_ext = ws.find(q(NS_MAIN, "extLst"))
    if ws_ext is None:
        ws_ext = etree.SubElement(ws, q(NS_MAIN, "extLst"))
    if tableau:
        ext = etree.SubElement(ws_ext, q(NS_MAIN, "ext"), uri="{3A4CF648-6AED-40f4-86FF-DC5316D8AED3}",
                               nsmap={"x15": NS_X15})
        liste = etree.SubElement(ext, q(NS_X14, "slicerList"), nsmap={"x14": NS_X14})
    else:
        ext = etree.SubElement(ws_ext, q(NS_MAIN, "ext"), uri="{A8765BA9-456A-4dab-B4F3-ACF838C121DE}",
                               nsmap={"x14": NS_X14})
        liste = etree.SubElement(ext, q(NS_X14, "slicerList"))
    etree.SubElement(liste, q(NS_X14, "slicer")).set(q(NS_R, "id"), rid_slicers)
    p.ecrire(chemin, ws)
    # Formes dans le dessin de la feuille
    dossier, fichier = chemin.rsplit("/", 1)
    rels = p.xml(f"{dossier}/_rels/{fichier}.rels")
    dessin = "xl/drawings/" + next(r.get("Target") for r in rels if r.get("Type").endswith("/drawing")).rsplit("/", 1)[1]
    d = p.xml(dessin)
    for k, s in enumerate(segments):
        d.append(_ancre_segment(s["nom"], s["de"], s["a"], tableau, 100 + n_depart * 10 + k))
    p.ecrire(dessin, d)
