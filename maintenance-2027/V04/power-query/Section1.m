section Section1;

shared PDM_Normalise = // =====================================================================
// PDM_Normalise - programme préventif normalisé
// Une ligne par poste x année x opération. Source de 01_VISION_GLOBALE.
// Paramètres (04_PARAMETRES) : P_CheminPDM, P_FeuillePDM, P_LongueurCodePoste.
// Tables (94_REFERENTIELS) : T_Colonnes_PDM, T_Ref_Operations, T_Ref_Sites,
//   T_Ref_Equipes, T_Correspondance.
// Code poste = Code Emprise ; à défaut, 9 premiers caractères de Code Installation.
// =====================================================================
let
    // 1. Entrées du classeur et fichier PDM, lus dans une seule étape
    Entrees =
        let
            Lire = (nom as text) as any =>
                let
                    Contenu = Excel.CurrentWorkbook(){[Name = nom]}[Content]
                in
                    if Table.RowCount(Contenu) = 0 then null else Contenu{0}[Column1],
            Nettoyer = (v as any) as text => if v = null then "" else Text.Trim(Text.From(v)),
            LireTable = (nom as text) as table => Table.Buffer(Excel.CurrentWorkbook(){[Name = nom]}[Content]),
            CheminLu = Nettoyer(Lire("P_CheminPDM")),
            LongueurLue = Lire("P_LongueurCodePoste")
        in
            [
                Chemin = CheminLu,
                Feuille = Nettoyer(Lire("P_FeuillePDM")),
                Longueur = if LongueurLue = null then 9 else Number.RoundDown(Number.From(LongueurLue)),
                Colonnes = LireTable("T_Colonnes_PDM"),
                Operations = LireTable("T_Ref_Operations"),
                Sites = LireTable("T_Ref_Sites"),
                Equipes = LireTable("T_Ref_Equipes"),
                Correspondances = LireTable("T_Correspondance"),
                Binaire =
                    if CheminLu = "" then
                        error Error.Record("Paramètre manquant", "04_PARAMETRES : le fichier programme (PDM) n'est pas renseigné.")
                    else
                        Binary.Buffer(File.Contents(CheminLu))
            ],

    // 2. Lecture : CSV (séparateur ;) ou classeur Excel (feuille P_FeuillePDM, sinon la première)
    CheminMinuscule = Text.Lower(Entrees[Chemin]),
    Brut =
        if Text.EndsWith(CheminMinuscule, ".csv") or Text.EndsWith(CheminMinuscule, ".txt") then
            Table.PromoteHeaders(
                Csv.Document(Entrees[Binaire], [Delimiter = ";", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
                [PromoteAllScalars = true])
        else
            let
                Feuilles = Table.SelectRows(Excel.Workbook(Entrees[Binaire], null, true), each [Kind] = "Sheet"),
                Choix = if Entrees[Feuille] = "" then Feuilles else Table.SelectRows(Feuilles, each [Item] = Entrees[Feuille]),
                Donnees =
                    if Table.RowCount(Choix) = 0 then
                        error Error.Record("Feuille introuvable", "Aucune feuille « " & Entrees[Feuille] & " » dans le fichier PDM.")
                    else
                        Choix{0}[Data]
            in
                Table.PromoteHeaders(Donnees, [PromoteAllScalars = true]),
    EnTetes = Table.TransformColumnNames(Brut, each Text.Trim(Text.Replace(_, "#(FEFF)", ""))),

    // 3. Correspondance des colonnes (T_Colonnes_PDM : Champ -> Colonne dans le fichier PDM)
    Champs = {"Site", "Équipe", "Code Emprise", "Code Installation", "Désignation", "Typologie", "Année", "Opération"},
    Paires = List.Select(
        List.Transform(Table.ToRecords(Entrees[Colonnes]),
            (r) => {if r[#"Colonne dans le fichier PDM"] = null then "" else Text.Trim(Text.From(r[#"Colonne dans le fichier PDM"])), r[Champ]}),
        each _{0} <> "" and List.Contains(Champs, _{1})),
    Presentes = Table.ColumnNames(EnTetes),
    ChampTrouve = (champ as text) as logical =>
        List.AnyTrue(List.Transform(Paires, each _{1} = champ and List.Contains(Presentes, _{0}))),
    Manquants = List.Select({"Site", "Équipe", "Année", "Opération"}, each not ChampTrouve(_))
        & (if ChampTrouve("Code Emprise") or ChampTrouve("Code Installation") then {} else {"Code Emprise ou Code Installation"}),
    Renomme =
        if List.IsEmpty(Manquants) then
            Table.SelectColumns(
                Table.RenameColumns(
                    Table.SelectColumns(EnTetes, List.Distinct(List.Transform(Paires, each _{0})), MissingField.Ignore),
                    List.Select(Paires, each List.Contains(Presentes, _{0}) and _{0} <> _{1}), MissingField.Ignore),
                Champs, MissingField.UseNull)
        else
            error Error.Record("Colonnes PDM introuvables",
                "Champ(s) sans colonne correspondante dans le fichier PDM : " & Text.Combine(Manquants, ", ")
                    & ". Corriger T_Colonnes_PDM ou le fichier (voir 05_NOTICE).", Manquants),

    // 4. Typage tolérant
    VersTexte = (v as any) as nullable text =>
        if v = null then null else let t = Text.Trim(Text.From(v)) in if t = "" then null else t,
    VersAnnee = (v as any) as nullable number =>
        if v = null then null
        else if v is number then Number.RoundDown(v)
        else if v is date or v is datetime then Date.Year(v)
        else let t = Text.Trim(Text.From(v)) in if t = "" then null else try Number.RoundDown(Number.FromText(t, "fr-FR")) otherwise null,
    Indexe = Table.AddIndexColumn(Renomme, "Ligne PDM", 2, 1),
    Types = Table.TransformColumns(Indexe,
        List.Transform(List.RemoveItems(Champs, {"Année"}), each {_, VersTexte, type nullable text})
            & {{"Année", VersAnnee, Int64.Type}}),

    // 5. Lignes techniques vides (aucun champ renseigné) : ignorées et comptées
    Utiles = Table.SelectRows(Types, each List.NonNullCount(Record.ToList(Record.SelectFields(_, Champs))) > 0),
    NbVides = Table.RowCount(Types) - Table.RowCount(Utiles),

    // 6. Code poste
    Longueur = Entrees[Longueur],
    AvecCode = Table.AddColumn(Utiles, "Code poste", each
        if [Code Emprise] <> null then [Code Emprise]
        else if [Code Installation] <> null and Text.Length([Code Installation]) >= Longueur then Text.Start([Code Installation], Longueur)
        else null, type nullable text),
    AvecSource = Table.AddColumn(AvecCode, "Source code poste", each
        if [Code Emprise] <> null then "Code Emprise"
        else if [Code poste] <> null then "Code Installation (" & Text.From(Longueur) & " car.)" else null, type nullable text),

    // 7. Opération : libellé de la vue et ordre d'affichage (T_Ref_Operations)
    Cle = (t as nullable text) as nullable text => if t = null then null else Text.Upper(Text.Trim(t)),
    RefOp = List.Buffer(List.Transform(Table.ToRecords(Entrees[Operations]),
        (r) => {Cle(Text.From(r[#"Opération PDM"])), Text.From(r[#"Libellé affiché"]), r[Ordre]})),
    TrouverOp = (op as nullable text) as nullable list =>
        let c = Cle(op), l = List.Select(RefOp, each _{0} = c) in if c = null or List.IsEmpty(l) then null else l{0},
    AvecOp = Table.AddColumn(AvecSource, "_Op", each TrouverOp([Opération])),
    AvecLibelle = Table.AddColumn(AvecOp, "Opération affichée", each
        if [_Op] <> null then [_Op]{1} else if [Opération] = null then null else Text.Upper([Opération]), type nullable text),
    AvecOrdre = Table.AddColumn(AvecLibelle, "Ordre opération", each if [_Op] <> null then [_Op]{2} else 99, Int64.Type),

    // 8. Code poste côté GMAO : identique, sauf exception déclarée dans T_Correspondance
    Exceptions = List.Buffer(List.Select(List.Transform(Table.ToRecords(Entrees[Correspondances]),
        (r) => {VersTexte(r[#"Code poste PDM"]), VersTexte(r[#"Code poste GMAO"])}), each _{0} <> null and _{1} <> null)),
    AvecGmao = Table.AddColumn(AvecOrdre, "Code poste GMAO", each
        let e = List.Select(Exceptions, (x) => x{0} = [Code poste]) in if List.IsEmpty(e) then [Code poste] else e{0}{1},
        type nullable text),
    AvecTypeRappro = Table.AddColumn(AvecGmao, "Correspondance déclarée", each
        List.AnyTrue(List.Transform(Exceptions, (x) => x{0} = [Code poste])), type logical),

    // 9. Contrôles
    StatutDe = (t as table, colonne as text, v as nullable text) as nullable text =>
        let l = Table.SelectRows(t, each Text.From(Record.Field(_, colonne)) = v) in
            if v = null then null else if Table.RowCount(l) = 0 then "inconnu" else Text.From(l{0}[Statut]),
    Cles = Table.AddColumn(AvecTypeRappro, "_Cle", each
        if [Code poste] = null or [Année] = null or [Opération affichée] = null then "#L" & Text.From([Ligne PDM])
        else [Code poste] & "|" & Text.From([Année]) & "|" & [Opération affichée], type text),
    Occurrences = Table.Group(Cles, {"_Cle"}, {{"_Nb", each Table.RowCount(_), Int64.Type}}),
    AvecNb = Table.Join(Cles, "_Cle", Table.RenameColumns(Occurrences, {{"_Cle", "_Cle2"}}), "_Cle2"),
    AvecControle = Table.AddColumn(AvecNb, "Contrôle qualité", (r) =>
        let
            StatutSite = StatutDe(Entrees[Sites], "Site", r[Site]),
            StatutEquipe = StatutDe(Entrees[Equipes], "Équipe", r[Équipe]),
            Liste = List.RemoveNulls({
                if r[Code poste] = null then "PDM : code poste impossible à déterminer" else null,
                if r[Code Emprise] = null and r[Code poste] <> null then "PDM : Code Emprise vide (code repris du Code Installation)" else null,
                if r[Année] = null then "PDM : année vide ou invalide" else null,
                if r[Opération] = null then "PDM : opération vide"
                    else if r[_Op] = null then "PDM : opération inconnue (à valider)" else null,
                if r[_Nb] > 1 and r[Code poste] <> null then "PDM : opération en double" else null,
                if StatutSite = "inconnu" then "PDM : site inconnu" else if StatutSite = "À valider" then "PDM : site à valider" else null,
                if StatutEquipe = "inconnu" then "PDM : équipe inconnue" else if StatutEquipe = "À valider" then "PDM : équipe à valider" else null
            })
        in
            if List.IsEmpty(Liste) then null else Text.Combine(Liste, " ; "), type nullable text),
    Maintenant = DateTime.LocalNow(),
    AvecTrace = Table.AddColumn(Table.AddColumn(Table.AddColumn(AvecControle,
        "Lignes vides ignorées", each NbVides, Int64.Type),
        "Fichier source", each Entrees[Chemin], type text),
        "Importé le", each Maintenant, type datetime),
    Resultat = Table.Sort(
        Table.SelectColumns(AvecTrace, {"Site", "Équipe", "Code poste", "Désignation", "Typologie", "Année",
            "Opération affichée", "Ordre opération", "Opération", "Code Emprise", "Code Installation", "Source code poste",
            "Code poste GMAO", "Correspondance déclarée", "Contrôle qualité", "Ligne PDM", "Lignes vides ignorées",
            "Fichier source", "Importé le"}),
        {{"Ligne PDM", Order.Ascending}})
in
    Resultat;

shared Vision_Globale = // =====================================================================
// Vision_Globale - UNE LIGNE = UN POSTE, une colonne par année du programme.
// Dans une cellule, les opérations de l'année sont réunies : « PIS + EC SIMPLE ».
// Source : requête PDM_Normalise uniquement (les OT ne construisent pas le planning).
// Chargement : tableau T_Vision dans 01_VISION_GLOBALE.
// =====================================================================
let
    Programme = PDM_Normalise,
    Base = Table.SelectRows(Programme, each [Code poste] <> null and [Année] <> null and [Opération affichée] <> null),
    Annees = List.Sort(List.Distinct(Base[Année])),
    NomsAnnees = List.Transform(Annees, Text.From),
    PremierRenseigne = (l as list) as any => let v = List.RemoveNulls(l) in if List.IsEmpty(v) then null else v{0},
    Postes = Table.Group(Base, {"Site", "Équipe", "Code poste"}, {
        {"Désignation du poste", each PremierRenseigne([Désignation]), type nullable text},
        {"Typologie", each PremierRenseigne([Typologie]), type nullable text},
        {"_Lignes", each _, type table}}),
    // Opérations d'une année : sans doublon, dans l'ordre du référentiel (PIS, EC SIMPLE, EC FILTRE, REVISION…)
    Cellule = (lignes as table, annee as number) as nullable text =>
        let
            Ops = Table.Distinct(Table.SelectColumns(Table.SelectRows(lignes, each [Année] = annee),
                {"Opération affichée", "Ordre opération"})),
            Triees = Table.Sort(Ops, {{"Ordre opération", Order.Ascending}, {"Opération affichée", Order.Ascending}})
        in
            if Table.RowCount(Triees) = 0 then null else Text.Combine(Triees[Opération affichée], " + "),
    AvecAnnees = Table.AddColumn(Postes, "_Annees", (p) =>
        Record.FromList(List.Transform(Annees, (a) => Cellule(p[_Lignes], a)), NomsAnnees)),
    Developpe = Table.ExpandRecordColumn(Table.RemoveColumns(AvecAnnees, {"_Lignes"}), "_Annees", NomsAnnees),
    Types = Table.TransformColumnTypes(Developpe, List.Transform(NomsAnnees, each {_, type text})),
    Resultat = Table.Sort(Types, {{"Site", Order.Ascending}, {"Équipe", Order.Ascending}, {"Code poste", Order.Ascending}})
in
    Resultat;

shared GMAO_Lignes = // =====================================================================
// GMAO_Lignes - lecture et contrôle de l'export GMAO (requête de préparation,
// non chargée). Une ligne par ligne utile de l'export, tous types de travail.
// Paramètres (04_PARAMETRES) : P_CheminGMAO, P_FeuilleGMAO, P_LongueurCodePoste,
//   P_ActiviteSecours (Oui / Non).
// Tables (94_REFERENTIELS) : T_Ref_Activites, T_Ref_Sites, T_Ref_Equipes.
// Règles : Site = Groupe gestionnaires ; Équipe = Poste travail princ. ;
//   Code poste = Code site, à défaut 9 premiers caractères du Poste technique ;
//   Année planifiée = année de la Date début planifiée.
// =====================================================================
let
    // 1. Entrées du classeur et fichier GMAO, lus dans une seule étape
    Entrees =
        let
            Lire = (nom as text) as any =>
                let
                    Contenu = Excel.CurrentWorkbook(){[Name = nom]}[Content]
                in
                    if Table.RowCount(Contenu) = 0 then null else Contenu{0}[Column1],
            Nettoyer = (v as any) as text => if v = null then "" else Text.Trim(Text.From(v)),
            LireTable = (nom as text) as table => Table.Buffer(Excel.CurrentWorkbook(){[Name = nom]}[Content]),
            CheminLu = Nettoyer(Lire("P_CheminGMAO")),
            LongueurLue = Lire("P_LongueurCodePoste")
        in
            [
                Chemin = CheminLu,
                Feuille = Nettoyer(Lire("P_FeuilleGMAO")),
                Longueur = if LongueurLue = null then 9 else Number.RoundDown(Number.From(LongueurLue)),
                Secours = Text.Upper(Nettoyer(Lire("P_ActiviteSecours"))) = "OUI",
                Activites = LireTable("T_Ref_Activites"),
                Sites = LireTable("T_Ref_Sites"),
                Equipes = LireTable("T_Ref_Equipes"),
                Binaire =
                    if CheminLu = "" then
                        error Error.Record("Paramètre manquant", "04_PARAMETRES : le fichier GMAO n'est pas renseigné.")
                    else
                        Binary.Buffer(File.Contents(CheminLu))
            ],

    // 2. Lecture : CSV (séparateur ;) ou classeur Excel (feuille P_FeuilleGMAO, sinon la première)
    CheminMinuscule = Text.Lower(Entrees[Chemin]),
    Brut =
        if Text.EndsWith(CheminMinuscule, ".csv") or Text.EndsWith(CheminMinuscule, ".txt") then
            Table.PromoteHeaders(
                Csv.Document(Entrees[Binaire], [Delimiter = ";", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
                [PromoteAllScalars = true])
        else
            let
                Feuilles = Table.SelectRows(Excel.Workbook(Entrees[Binaire], null, true), each [Kind] = "Sheet"),
                Choix = if Entrees[Feuille] = "" then Feuilles else Table.SelectRows(Feuilles, each [Item] = Entrees[Feuille]),
                Donnees =
                    if Table.RowCount(Choix) = 0 then
                        error Error.Record("Feuille introuvable", "Aucune feuille « " & Entrees[Feuille] & " » dans l'export GMAO.")
                    else
                        Choix{0}[Data]
            in
                Table.PromoteHeaders(Donnees, [PromoteAllScalars = true]),
    // « Typologie » est exporté avec un espace final : les espaces de début et de fin sont retirés
    EnTetes = Table.TransformColumnNames(Brut, each Text.Trim(Text.Replace(_, "#(FEFF)", ""))),

    // 3. Structure : colonnes obligatoires (sinon erreur explicite) et 24 colonnes attendues
    Obligatoires = {"Ordre", "Type de travail", "Désignation", "Poste travail princ.", "Groupe gestionnaires",
        "Date début planifiée", "Code site", "Poste technique", "Activité"},
    Attendues = {"Créé le", "Ordre", "Ordre supérieur", "Type d'ordre", "Type de travail", "Avis", "Désignation",
        "Statut utilisateur", "Statut système", "Saisi par", "Total coûts réels", "Poste travail princ.",
        "Groupe gestionnaires", "Secteur exploitation", "Date début planifiée", "Code site", "Poste technique",
        "Désign.poste techn.", "Équipement", "Groupe de gamme principale", "Compteur de groupe de gamme principale",
        "Date modif. fiche ordre", "Typologie", "Activité"},
    Presentes = Table.ColumnNames(EnTetes),
    Manquantes = List.Difference(Obligatoires, Presentes),
    Absentes = List.Difference(Attendues, Presentes),
    Structure =
        if List.IsEmpty(Manquantes) then
            Table.SelectColumns(EnTetes, Attendues, MissingField.UseNull)
        else
            error Error.Record("Colonnes GMAO obligatoires absentes",
                "Colonne(s) introuvable(s) dans l'export : " & Text.Combine(Manquantes, ", ")
                    & ". Vérifier l'export ou le nom des colonnes (voir 05_NOTICE).", Manquantes),
    Indexe = Table.AddIndexColumn(Structure, "Ligne export", 2, 1),

    // 4. Typage tolérant : une valeur illisible devient vide et elle est signalée
    VersTexte = (v as any) as nullable text =>
        if v = null then null else let t = Text.Trim(Text.From(v)) in if t = "" then null else t,
    VersDate = (v as any) as nullable date =>
        if v = null then null
        else if v is date then v
        else if v is datetime then Date.From(v)
        else if v is datetimezone then Date.From(v)
        else if v is number then (try Date.From(v) otherwise null)
        else
            let t = Text.Trim(Text.From(v)) in
                if t = "" then null
                else try Date.FromText(t, "fr-FR") otherwise try Date.From(DateTime.FromText(t, "fr-FR")) otherwise null,
    VersNombre = (v as any) as nullable number =>
        if v = null then null
        else if v is number then v
        else
            let t = Text.Remove(Text.Trim(Text.From(v)), {" ", "#(00A0)", "#(202F)"}) in
                if t = "" then null else try Number.FromText(t, "fr-FR") otherwise null,
    AvecDateBrute = Table.AddColumn(Indexe, "_DateBrute", each VersTexte([#"Date début planifiée"]), type nullable text),
    ColonnesDates = {"Créé le", "Date début planifiée", "Date modif. fiche ordre"},
    ColonnesNombres = {"Total coûts réels"},
    Types = Table.TransformColumns(AvecDateBrute,
        List.Transform(List.Difference(Attendues, ColonnesDates & ColonnesNombres), each {_, VersTexte, type nullable text})
            & List.Transform(ColonnesDates, each {_, VersDate, type nullable date})
            & List.Transform(ColonnesNombres, each {_, VersNombre, type nullable number})),

    // 5. Lignes techniques vides (aucun champ structurant renseigné) : ignorées et comptées
    Structurants = {"Ordre", "Poste technique", "Code site", "Date début planifiée", "Désignation",
        "Groupe gestionnaires", "Poste travail princ."},
    Utiles = Table.SelectRows(Types, each
        List.NonNullCount(Record.ToList(Record.SelectFields(_, Structurants))) > 0 or [_DateBrute] <> null),
    NbVides = Table.RowCount(Types) - Table.RowCount(Utiles),

    // 6. Site, Équipe, Code poste (Code site prioritaire), Année planifiée
    Longueur = Entrees[Longueur],
    AvecCles = Table.AddColumn(Table.AddColumn(Table.AddColumn(Utiles,
        "Site", each [Groupe gestionnaires], type nullable text),
        "Équipe", each [#"Poste travail princ."], type nullable text),
        "Code poste", each
            if [Code site] <> null then [Code site]
            else if [Poste technique] <> null and Text.Length([Poste technique]) >= Longueur then Text.Start([Poste technique], Longueur)
            else null, type nullable text),
    AvecSource = Table.AddColumn(AvecCles, "Source code poste", each
        if [Code site] <> null then "Code site"
        else if [Code poste] <> null then "Poste technique (" & Text.From(Longueur) & " car.)" else null, type nullable text),
    AvecAnnee = Table.AddColumn(AvecSource, "Année planifiée", each
        if [#"Date début planifiée"] = null then null else Date.Year([#"Date début planifiée"]), Int64.Type),

    // 7. Activité : découpée sur « + », espaces et casse normalisés ; activité inconnue conservée
    Normaliser = (t as text) as text => Text.Combine(List.Select(Text.Split(Text.Upper(Text.Trim(t)), " "), each _ <> ""), " "),
    RefActivites = List.Buffer(List.Transform(List.Select(Table.ToRecords(Entrees[Activites]), each [Activité] <> null), (r) => [
        Code = Normaliser(Text.From(r[Activité])),
        MotCle = if r[#"Mot-clé dans Désignation (secours)"] = null then null
            else Normaliser(Text.From(r[#"Mot-clé dans Désignation (secours)"]))])),
    CodesConnus = List.Buffer(List.Transform(RefActivites, each [Code])),
    // Secours désactivable (P_ActiviteSecours) : reconnaissance de mots-clés dans la Désignation
    Reconstruire = (designation as nullable text) as nullable text =>
        let
            Mots = " " & Text.Combine(List.Select(Text.SplitAny(Text.Upper(if designation = null then "" else designation),
                " +-/,;:()[]."), each _ <> ""), " ") & " ",
            Trouvees = List.Select(RefActivites, each [MotCle] <> null and Text.Contains(Mots, " " & [MotCle]))
        in
            if List.IsEmpty(Trouvees) then null else Text.Combine(List.Transform(Trouvees, each [Code]), "+"),
    AvecReconstruite = Table.AddColumn(AvecAnnee, "Activité reconstruite (secours)", each
        if Entrees[Secours] and [Activité] = null and [Désignation] <> null then Reconstruire([Désignation]) else null,
        type nullable text),
    AvecActivites = Table.AddColumn(AvecReconstruite, "_Activites", each
        let
            Texte = if [Activité] <> null then [Activité] else [#"Activité reconstruite (secours)"],
            Segments = if Texte = null then {} else List.Transform(Text.Split(Texte, "+"), Normaliser)
        in
            [Segments = Segments, Atomiques = List.Distinct(List.Select(Segments, each _ <> ""))]),

    // 8. Doublons d'OT dans l'export
    AvecPre = Table.AddColumn(AvecActivites, "Est préventif", each
        [Type de travail] <> null and Text.Upper([Type de travail]) = "PRE", type logical),
    NbParOrdre = Table.Group(Table.SelectRows(AvecPre, each [Ordre] <> null), {"Ordre"},
        {{"Nb lignes de l'OT", each Table.RowCount(_), Int64.Type}}),
    AvecNb = Table.Join(AvecPre, "Ordre", Table.RenameColumns(NbParOrdre, {{"Ordre", "_Ordre2"}}), "_Ordre2", JoinKind.LeftOuter),

    // 9. Contrôles par ligne (aucune ligne n'est supprimée)
    StatutDe = (t as table, colonne as text, v as nullable text) as nullable text =>
        let l = Table.SelectRows(t, each Text.From(Record.Field(_, colonne)) = v) in
            if v = null then null else if Table.RowCount(l) = 0 then "inconnu" else Text.From(l{0}[Statut]),
    AvecControles = Table.AddColumn(AvecNb, "Contrôles", (r) =>
        let
            Pt = r[Poste technique],
            Cs = r[Code site],
            A = r[_Activites],
            StatutSite = StatutDe(Entrees[Sites], "Site", r[Site]),
            StatutEquipe = StatutDe(Entrees[Equipes], "Équipe", r[Équipe])
        in
            List.RemoveNulls({
                if r[Ordre] = null then "Ordre vide" else null,
                if r[#"Nb lignes de l'OT"] <> null and r[#"Nb lignes de l'OT"] > 1 then "Doublon OT éventuel" else null,
                if r[Code poste] = null then "Code poste impossible à déterminer" else null,
                if Cs = null and r[Code poste] <> null then "Code site vide : code poste repris du Poste technique" else null,
                if Pt = null then "Poste technique vide" else null,
                if Cs <> null and Pt <> null and Text.Start(Pt, Longueur) <> Cs then "Code site ≠ GAUCHE(Poste technique;9)" else null,
                if r[_DateBrute] = null then "Date début planifiée vide" else null,
                if r[_DateBrute] <> null and r[#"Date début planifiée"] = null then "Date début planifiée invalide" else null,
                if r[Activité] = null and r[Désignation] <> null then "Activité source vide alors que Désignation est renseignée" else null,
                if r[Activité] = null and r[Désignation] = null then "Activité vide" else null,
                if r[#"Activité reconstruite (secours)"] <> null then "Activité reconstruite depuis la Désignation (secours)" else null,
                if List.Contains(A[Segments], "") and r[Activité] <> null then "Activité mal formée" else null,
                if List.AnyTrue(List.Transform(A[Atomiques], each not List.Contains(CodesConnus, _))) then "Activité inconnue (à valider)" else null,
                if StatutSite = "inconnu" then "Site inconnu" else if StatutSite = "À valider" then "Site à valider" else null,
                if r[Site] = null then "Site vide" else null,
                if StatutEquipe = "inconnu" then "Équipe inconnue" else if StatutEquipe = "À valider" then "Équipe à valider" else null,
                if r[Équipe] = null then "Équipe vide" else null,
                if not r[Est préventif] then "Type de travail différent de PRE (exclu de la couverture)" else null
            }), type list),
    Maintenant = DateTime.LocalNow(),
    Resultat = Table.Sort(
        Table.AddColumn(Table.AddColumn(Table.AddColumn(Table.AddColumn(
            Table.RemoveColumns(AvecControles, {"_DateBrute", "_Ordre2"}),
            "Lignes vides ignorées", each NbVides, Int64.Type),
            "Colonnes absentes", each if List.IsEmpty(Absentes) then null else Text.Combine(Absentes, ", "), type nullable text),
            "Fichier source", each Entrees[Chemin], type text),
            "Importé le", each Maintenant, type datetime),
        {{"Ligne export", Order.Ascending}})
in
    Resultat;

shared OT_Detail = // =====================================================================
// OT_Detail - OT PRÉVENTIFS normalisés : une ligne par couple Ordre x Activité atomique.
// Seuls les OT avec Type de travail = PRE et un numéro d'Ordre sont retenus.
// Source du tableau croisé 02_COUVERTURE_OT (double-clic = détail des OT).
// Chargement : tableau T_OT_Detail dans 03_DETAIL_OT.
// =====================================================================
let
    Lignes = Table.SelectRows(GMAO_Lignes, each [Est préventif] and [Ordre] <> null),
    // Une ligne par activité atomique ; un OT sans activité garde une ligne (activité vide, signalée)
    AvecAtomiques = Table.AddColumn(Lignes, "Activité atomique", each
        let a = [_Activites][Atomiques] in if List.IsEmpty(a) then {null} else a),
    Eclate = Table.ExpandListColumn(AvecAtomiques, "Activité atomique"),
    AvecSeq = Table.AddIndexColumn(Table.Sort(Eclate, {{"Ligne export", Order.Ascending}}), "_Seq", 1, 1),
    // Doublon technique : un même couple Ordre + Activité n'est gardé qu'une fois
    AvecCle = Table.AddColumn(AvecSeq, "_Cle", each
        [Ordre] & "|" & (if [Activité atomique] = null then "#VIDE" else [Activité atomique]), type text),
    Couples = Table.Group(AvecCle, {"_Cle"}, {
        {"_Nb", each Table.RowCount(_), Int64.Type},
        {"_Lignes", each Text.Combine(List.Transform(List.Sort(List.Distinct([Ligne export])), Text.From), ", "), type text}}),
    AvecNb = Table.Join(AvecCle, "_Cle", Table.RenameColumns(Couples, {{"_Cle", "_Cle2"}}), "_Cle2"),
    SansDoublon = Table.Distinct(Table.Buffer(Table.Sort(AvecNb, {{"_Seq", Order.Ascending}})), {"_Cle"}),
    AvecRegroupees = Table.AddColumn(SansDoublon, "Lignes export regroupées", each
        if [_Nb] > 1 then [_Lignes] else null, type nullable text),
    // Compte OT = 1 sur une seule ligne par Ordre : la somme donne un nombre d'OT distincts
    PremieresLignes = Table.Group(AvecRegroupees, {"Ordre"}, {{"_Premiere", each List.Min([_Seq]), Int64.Type}}),
    AvecPremiere = Table.Join(AvecRegroupees, "Ordre", Table.RenameColumns(PremieresLignes, {{"Ordre", "_Ordre3"}}), "_Ordre3"),
    AvecCompte = Table.AddColumn(AvecPremiere, "Compte OT", each if [_Seq] = [_Premiere] then 1 else 0, Int64.Type),
    // Désignation du poste : celle du programme (code poste GMAO), sinon celle de l'export
    Programme = try Table.Buffer(Table.SelectRows(PDM_Normalise, each [Code poste GMAO] <> null and [Désignation] <> null))
        otherwise #table({"Code poste GMAO", "Désignation", "Ligne PDM"}, {}),
    DesignationsPdm = Table.Buffer(Table.Group(Table.Sort(Programme, {{"Ligne PDM", Order.Ascending}}), {"Code poste GMAO"},
        {{"_DesPdm", each List.First([Désignation]), type nullable text}})),
    DesignationsGmao = Table.Buffer(Table.Group(
        Table.Sort(Table.SelectRows(AvecCompte, each [Code poste] <> null and [#"Désign.poste techn."] <> null), {{"Ligne export", Order.Ascending}}),
        {"Code poste"}, {{"_DesGmao", each List.First([#"Désign.poste techn."]), type nullable text}})),
    AvecDesPdm = Table.NestedJoin(AvecCompte, {"Code poste"}, DesignationsPdm, {"Code poste GMAO"}, "_P", JoinKind.LeftOuter),
    AvecDesGmao = Table.NestedJoin(AvecDesPdm, {"Code poste"}, DesignationsGmao, {"Code poste"}, "_G", JoinKind.LeftOuter),
    AvecDesignation = Table.AddColumn(AvecDesGmao, "Désignation du poste", each
        if not Table.IsEmpty([_P]) then [_P]{0}[_DesPdm] else if not Table.IsEmpty([_G]) then [_G]{0}[_DesGmao] else null,
        type nullable text),
    // Contrôle qualité de la ligne
    AvecControle = Table.AddColumn(AvecDesignation, "Contrôle qualité", each
        let l = [Contrôles] & (if [_Nb] > 1 then {"Couple Ordre + Activité en double"} else {})
        in if List.IsEmpty(l) then null else Text.Combine(l, " ; "), type nullable text),
    Renomme = Table.RenameColumns(Table.Sort(AvecControle, {{"_Seq", Order.Ascending}}), {{"Activité", "Activité source"}}),
    Resultat = Table.SelectColumns(Renomme, {
        "Ordre", "Ordre supérieur", "Site", "Équipe", "Code poste", "Code site", "Poste technique",
        "Désign.poste techn.", "Désignation", "Date début planifiée", "Année planifiée", "Activité source",
        "Activité atomique", "Typologie", "Statut utilisateur", "Statut système", "Équipement", "Créé le",
        "Date modif. fiche ordre", "Désignation du poste", "Groupe gestionnaires", "Poste travail princ.",
        "Type d'ordre", "Type de travail", "Avis", "Saisi par", "Total coûts réels", "Secteur exploitation",
        "Groupe de gamme principale", "Compteur de groupe de gamme principale", "Source code poste",
        "Activité reconstruite (secours)", "Compte OT", "Contrôle qualité", "Ligne export",
        "Lignes export regroupées", "Fichier source", "Importé le"}),
    Types = Table.TransformColumnTypes(Resultat, {{"Activité atomique", type text}, {"Ligne export", Int64.Type}})
in
    Types;

shared Rapprochement = // =====================================================================
// Rapprochement - correspondance des postes entre programme (PDM) et GMAO.
// Règle : PDM[Code Emprise] = GMAO[Code site] (code poste), sauf exception
//   déclarée dans T_Correspondance. Aucun diagnostic prévu / réalisé ici.
// Statuts : Correspondance automatique | Correspondance manuelle | Non rapproché
//   | OT sans poste au programme.
// Chargement : tableau T_Rapprochement (onglet technique masqué).
// =====================================================================
let
    Programme = Table.SelectRows(PDM_Normalise, each [Code poste] <> null),
    PostesPdm = Table.Group(Programme, {"Code poste"}, {
        {"Site", each List.First(List.RemoveNulls([Site])), type nullable text},
        {"Équipe", each List.First(List.RemoveNulls([Équipe])), type nullable text},
        {"Désignation", each List.First(List.RemoveNulls([Désignation])), type nullable text},
        {"Code poste GMAO", each List.First([Code poste GMAO]), type nullable text},
        {"Déclarée", each List.AnyTrue([Correspondance déclarée]), type logical}}),
    Ot = Table.SelectRows(GMAO_Lignes, each [Est préventif] and [Ordre] <> null and [Code poste] <> null),
    PostesGmao = Table.Buffer(Table.Group(Ot, {"Code poste"}, {
        {"Nb OT préventifs (GMAO)", each List.Count(List.Distinct([Ordre])), Int64.Type},
        {"_Site", each List.First(List.RemoveNulls([Site])), type nullable text},
        {"_Equipe", each List.First(List.RemoveNulls([Équipe])), type nullable text},
        {"_Designation", each List.First(List.RemoveNulls([#"Désign.poste techn."])), type nullable text}})),
    CotePdm = Table.AddColumn(
        Table.NestedJoin(PostesPdm, {"Code poste GMAO"}, PostesGmao, {"Code poste"}, "_G", JoinKind.LeftOuter),
        "Statut rapprochement", each
            if Table.IsEmpty([_G]) then "Non rapproché"
            else if [Déclarée] then "Correspondance manuelle" else "Correspondance automatique", type text),
    CotePdmFinal = Table.AddColumn(Table.AddColumn(CotePdm,
        "Nb OT préventifs (GMAO)", each if Table.IsEmpty([_G]) then 0 else [_G]{0}[#"Nb OT préventifs (GMAO)"], Int64.Type),
        "Origine", each "Programme", type text),
    CodesUtilises = List.Buffer(List.RemoveNulls(PostesPdm[Code poste GMAO])),
    CoteGmao = Table.FromRecords(List.Transform(
        Table.ToRecords(Table.SelectRows(PostesGmao, each not List.Contains(CodesUtilises, [Code poste]))),
        (r) => [Code poste = null, Site = r[_Site], Équipe = r[_Equipe], Désignation = r[_Designation],
            #"Code poste GMAO" = r[Code poste], Déclarée = false, Statut rapprochement = "OT sans poste au programme",
            #"Nb OT préventifs (GMAO)" = r[#"Nb OT préventifs (GMAO)"], Origine = "GMAO"]),
        type table [Code poste = nullable text, Site = nullable text, Équipe = nullable text, Désignation = nullable text,
            #"Code poste GMAO" = nullable text, Déclarée = logical, Statut rapprochement = text,
            #"Nb OT préventifs (GMAO)" = Int64.Type, Origine = text]),
    Colonnes = {"Origine", "Site", "Équipe", "Code poste", "Désignation", "Code poste GMAO", "Statut rapprochement",
        "Nb OT préventifs (GMAO)"},
    Resultat = Table.Sort(
        Table.Combine({Table.SelectColumns(CotePdmFinal, Colonnes), Table.SelectColumns(CoteGmao, Colonnes)}),
        {{"Origine", Order.Descending}, {"Site", Order.Ascending}, {"Équipe", Order.Ascending},
            {"Code poste", Order.Ascending}, {"Code poste GMAO", Order.Ascending}})
in
    Resultat;

shared Controles = // =====================================================================
// Controles - une ligne par contrôle qualité (statut OK / À VÉRIFIER / INFO).
// Lu par 04_PARAMETRES (« Contrôles à vérifier : X »). Le détail ligne par
// ligne est dans la requête Anomalies.
// Chargement : tableau T_Controles (onglet technique masqué 90_CONTROLES).
// =====================================================================
let
    Maintenant = DateTime.LocalNow(),
    Vide = #table({"Contrôles", "Ligne export", "Ordre"}, {}),
    // Table.Buffer force l'évaluation : une source illisible devient une ligne de contrôle
    Gmao = try Table.Buffer(GMAO_Lignes) otherwise null,
    Pdm = try Table.Buffer(PDM_Normalise) otherwise null,
    Rappro = try Table.Buffer(Rapprochement) otherwise null,
    Ot = try Table.Buffer(OT_Detail) otherwise null,
    Exemples = (valeurs as list) as text => Text.Combine(List.FirstN(List.Distinct(List.RemoveNulls(valeurs)), 10), ", "),
    Ligne = (source as text, controle as text, niveau as text, nombre as number, exemples as text) as record => [
        Source = source, #"Contrôle" = controle, Niveau = niveau, Nombre = nombre, Exemples = exemples,
        Statut = if niveau = "Info" then "INFO" else if nombre = 0 then "OK" else "À VÉRIFIER"],
    // Contrôles portés ligne par ligne (liste « Contrôles » de GMAO_Lignes, texte « Contrôle qualité » du PDM)
    ParLigneGmao = (libelle as text, niveau as text) as record =>
        let
            T = Table.SelectRows(Gmao, each List.Contains([Contrôles], libelle)),
            Ex = List.Transform(Table.ToRecords(T), each if [Ordre] <> null then [Ordre] else "ligne " & Text.From([Ligne export]))
        in
            Ligne("GMAO", libelle, niveau, Table.RowCount(T), Exemples(Ex)),
    ParLignePdm = (libelle as text) as record => ParLignePdmNiveau(libelle, "À vérifier"),
    ParLignePdmNiveau = (libelle as text, niveau as text) as record =>
        let
            T = Table.SelectRows(Pdm, each [Contrôle qualité] <> null and List.Contains(Text.Split([Contrôle qualité], " ; "), libelle)),
            Ex = List.Transform(Table.ToRecords(T), each if [Code poste] <> null then [Code poste] & " " & Text.From([Année])
                else "ligne " & Text.From([Ligne PDM]))
        in
            Ligne("PDM", libelle, niveau, Table.RowCount(T), Exemples(Ex)),
    LignesGmao =
        if Gmao = null then {Ligne("GMAO", "Export GMAO illisible : vérifier le fichier et 04_PARAMETRES", "À vérifier", 1, "")}
        else
            {
                Ligne("GMAO", "Lignes lues dans l'export (hors lignes vides)", "Info", Table.RowCount(Gmao), ""),
                Ligne("GMAO", "Lignes techniques vides ignorées", "Info",
                    if Table.IsEmpty(Gmao) then 0 else Gmao{0}[Lignes vides ignorées], ""),
                Ligne("GMAO", "OT préventifs retenus (PRE, Ordre renseigné)", "Info",
                    if Ot = null then 0 else List.Count(List.Distinct(Ot[Ordre])), ""),
                Ligne("GMAO", "Colonnes absentes de l'export", "À vérifier",
                    if Table.IsEmpty(Gmao) or Gmao{0}[Colonnes absentes] = null then 0 else 1,
                    if Table.IsEmpty(Gmao) or Gmao{0}[Colonnes absentes] = null then "" else Gmao{0}[Colonnes absentes])
            }
            & List.Transform({
                {"Ordre vide", "À vérifier"},
                {"Doublon OT éventuel", "À vérifier"},
                {"Code poste impossible à déterminer", "À vérifier"},
                {"Code site vide : code poste repris du Poste technique", "Info"},
                {"Poste technique vide", "À vérifier"},
                {"Code site ≠ GAUCHE(Poste technique;9)", "À vérifier"},
                {"Date début planifiée vide", "À vérifier"},
                {"Date début planifiée invalide", "À vérifier"},
                {"Activité vide", "À vérifier"},
                {"Activité source vide alors que Désignation est renseignée", "À vérifier"},
                {"Activité reconstruite depuis la Désignation (secours)", "Info"},
                {"Activité mal formée", "À vérifier"},
                {"Activité inconnue (à valider)", "À vérifier"},
                {"Site inconnu", "À vérifier"},
                {"Site à valider", "À vérifier"},
                {"Site vide", "À vérifier"},
                {"Équipe inconnue", "À vérifier"},
                {"Équipe à valider", "À vérifier"},
                {"Équipe vide", "À vérifier"},
                {"Type de travail différent de PRE (exclu de la couverture)", "À vérifier"}
            }, each ParLigneGmao(_{0}, _{1}))
            & {
                let
                    T = if Ot = null then Vide else Table.SelectRows(Ot, each [Contrôle qualité] <> null
                        and List.Contains(Text.Split([Contrôle qualité], " ; "), "Couple Ordre + Activité en double"))
                in
                    Ligne("GMAO", "Couple Ordre + Activité en double (compté une fois)", "Info", Table.RowCount(T), Exemples(T[Ordre]))
            },
    LignesPdm =
        if Pdm = null then {Ligne("PDM", "Fichier programme illisible : vérifier le fichier et 04_PARAMETRES", "À vérifier", 1, "")}
        else
            {
                Ligne("PDM", "Lignes du programme lues", "Info", Table.RowCount(Pdm), ""),
                Ligne("PDM", "Postes du programme", "Info", List.Count(List.Distinct(List.RemoveNulls(Pdm[Code poste]))), "")
            }
            & {ParLignePdmNiveau("PDM : Code Emprise vide (code repris du Code Installation)", "Info")}
            & List.Transform({"PDM : code poste impossible à déterminer", "PDM : année vide ou invalide",
                "PDM : opération vide", "PDM : opération inconnue (à valider)", "PDM : opération en double",
                "PDM : site inconnu", "PDM : site à valider", "PDM : équipe inconnue", "PDM : équipe à valider"}, ParLignePdm),
    LignesRappro =
        if Rappro = null then {}
        else
            let
                Statut = (s as text) as table => Table.SelectRows(Rappro, each [Statut rapprochement] = s)
            in
                {
                    Ligne("Rapprochement", "Postes : correspondance automatique", "Info",
                        Table.RowCount(Statut("Correspondance automatique")), ""),
                    Ligne("Rapprochement", "Postes : correspondance manuelle (T_Correspondance)", "Info",
                        Table.RowCount(Statut("Correspondance manuelle")), Exemples(Statut("Correspondance manuelle")[Code poste])),
                    Ligne("Rapprochement", "Rapprochement PDM/GMAO impossible : poste sans OT préventif", "À vérifier",
                        Table.RowCount(Statut("Non rapproché")), Exemples(Statut("Non rapproché")[Code poste])),
                    Ligne("Rapprochement", "Rapprochement PDM/GMAO impossible : OT sans poste au programme", "À vérifier",
                        Table.RowCount(Statut("OT sans poste au programme")), Exemples(Statut("OT sans poste au programme")[Code poste GMAO]))
                },
    Liste = LignesPdm & LignesGmao & LignesRappro,
    Resultat = Table.AddColumn(
        Table.AddIndexColumn(Table.FromRecords(Liste,
            type table [Source = text, #"Contrôle" = text, Niveau = text, Nombre = Int64.Type, Exemples = text, Statut = text]),
            "N°", 1, 1),
        "Actualisé le", each Maintenant, type datetime),
    Ordonne = Table.SelectColumns(Resultat, {"N°", "Source", "Contrôle", "Niveau", "Nombre", "Statut", "Exemples", "Actualisé le"})
in
    Ordonne;

shared Anomalies = // =====================================================================
// Anomalies - détail des contrôles : une ligne par ligne source et par contrôle.
// Chargement : tableau T_Anomalies (onglet technique masqué 91_ANOMALIES).
// =====================================================================
let
    Gmao = try Table.Buffer(GMAO_Lignes) otherwise null,
    Pdm = try Table.Buffer(PDM_Normalise) otherwise null,
    Type = type table [Source = text, Ligne = Int64.Type, Ordre = nullable text, #"Code poste" = nullable text,
        Site = nullable text, #"Équipe" = nullable text, #"Contrôle" = text, Détail = nullable text],
    DeGmao = if Gmao = null then {} else List.Combine(List.Transform(
        Table.ToRecords(Table.SelectRows(Gmao, each not List.IsEmpty([Contrôles]))),
        (r) => List.Transform(r[Contrôles], (c) => [Source = "GMAO", Ligne = r[Ligne export], Ordre = r[Ordre],
            #"Code poste" = r[Code poste], Site = r[Site], #"Équipe" = r[Équipe], #"Contrôle" = c,
            Détail = r[Désignation]]))),
    DePdm = if Pdm = null then {} else List.Combine(List.Transform(
        Table.ToRecords(Table.SelectRows(Pdm, each [Contrôle qualité] <> null)),
        (r) => List.Transform(Text.Split(r[Contrôle qualité], " ; "), (c) => [Source = "PDM", Ligne = r[Ligne PDM],
            Ordre = null, #"Code poste" = r[Code poste], Site = r[Site], #"Équipe" = r[Équipe], #"Contrôle" = c,
            Détail = Text.From(r[Année]) & " " & (if r[Opération] = null then "" else r[Opération])]))),
    Resultat = Table.FromRecords(DePdm & DeGmao, Type)
in
    Resultat;
