// =====================================================================
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
    Resultat
