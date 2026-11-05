// =====================================================================
// OT_Detail - import et normalisation de l'extraction GMAO (OT préventifs)
// Résultat : une ligne par couple Ordre x Activité atomique, sans doublon.
// Chargement : tableau dans l'onglet 04_DETAIL_OT, cellule A1.
// Paramètres (08_PARAMETRES) : P_CheminSource, P_FeuilleSource,
//   P_LongueurCodePoste, P_SeparateurCodePoste.
// Référentiels (05_REFERENTIEL) : T_Ref_Activites, T_Ref_Sites.
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
            CheminLu = Nettoyer(Lire("P_CheminSource")),
            LongueurLue = Lire("P_LongueurCodePoste")
        in
            [
                Chemin = CheminLu,
                Feuille = Nettoyer(Lire("P_FeuilleSource")),
                Longueur = if LongueurLue = null then 9 else Number.RoundDown(Number.From(LongueurLue)),
                Separateur = Nettoyer(Lire("P_SeparateurCodePoste")),
                RefActivites = Table.Buffer(Excel.CurrentWorkbook(){[Name = "T_Ref_Activites"]}[Content]),
                RefSites = Table.Buffer(Excel.CurrentWorkbook(){[Name = "T_Ref_Sites"]}[Content]),
                Binaire =
                    if CheminLu = "" then
                        error Error.Record(
                            "Paramètre manquant",
                            "08_PARAMETRES : le chemin de l'extraction GMAO (P_CheminSource) est vide.")
                    else
                        Binary.Buffer(File.Contents(CheminLu))
            ],

    // 2. Lecture : CSV (séparateur ;) ou classeur Excel (feuille P_FeuilleSource, sinon la première)
    CheminMinuscule = Text.Lower(Entrees[Chemin]),
    EstTexte = Text.EndsWith(CheminMinuscule, ".csv") or Text.EndsWith(CheminMinuscule, ".txt"),
    Brut =
        if EstTexte then
            Table.PromoteHeaders(
                Csv.Document(Entrees[Binaire], [Delimiter = ";", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
                [PromoteAllScalars = true])
        else
            let
                Classeur = Excel.Workbook(Entrees[Binaire], null, true),
                Feuilles = Table.SelectRows(Classeur, each [Kind] = "Sheet"),
                Choix =
                    if Entrees[Feuille] = "" then Feuilles
                    else Table.SelectRows(Feuilles, each [Item] = Entrees[Feuille]),
                Donnees =
                    if Table.RowCount(Choix) = 0 then
                        error Error.Record(
                            "Feuille introuvable",
                            "Aucune feuille « " & Entrees[Feuille] & " » dans l'extraction GMAO.")
                    else
                        Choix{0}[Data]
            in
                Table.PromoteHeaders(Donnees, [PromoteAllScalars = true]),

    // 3. En-têtes : espaces de début et de fin retirés (ex. « Typologie » exporté avec un espace final)
    EnTetes = Table.TransformColumnNames(Brut, each Text.Trim(Text.Replace(_, "#(FEFF)", ""))),

    // 4. Structure : 6 colonnes obligatoires (sinon erreur explicite), 24 colonnes attendues
    Obligatoires = {"Ordre", "Poste technique", "Date début planifiée", "Activité",
        "Groupe gestionnaires", "Poste travail princ."},
    Attendues = {"Créé le", "Ordre", "Ordre supérieur", "Type d'ordre", "Type de travail", "Avis",
        "Désignation", "Statut utilisateur", "Statut système", "Saisi par", "Total coûts réels",
        "Poste travail princ.", "Groupe gestionnaires", "Secteur exploitation", "Date début planifiée",
        "Code site", "Poste technique", "Désign.poste techn.", "Équipement", "Groupe de gamme principale",
        "Compteur de groupe de gamme principale", "Date modif. fiche ordre", "Typologie", "Activité"},
    Presentes = Table.ColumnNames(EnTetes),
    Manquantes = List.Difference(Obligatoires, Presentes),
    Absentes = List.Difference(Attendues, Presentes),
    Ignorees = List.Difference(Presentes, Attendues),
    EcartsStructure =
        Text.Combine(
            List.Select({
                if List.IsEmpty(Absentes) then "" else "Colonnes absentes (laissées vides) : " & Text.Combine(Absentes, ", "),
                if List.IsEmpty(Ignorees) then "" else "Colonnes non utilisées : " & Text.Combine(Ignorees, ", ")
            }, each _ <> ""),
            " | "),
    Structure =
        if List.IsEmpty(Manquantes) then
            Table.SelectColumns(EnTetes, Attendues, MissingField.UseNull)
        else
            error Error.Record(
                "Colonnes GMAO obligatoires absentes",
                "Colonne(s) introuvable(s) dans l'extraction : " & Text.Combine(Manquantes, ", ")
                    & ". Vérifier l'export ou le nom des colonnes (voir 09_NOTICE).",
                Manquantes),

    // 5. Numéro de ligne dans l'export (ligne 1 = en-têtes)
    Indexe = Table.AddIndexColumn(Structure, "Ligne export", 2, 1),

    // 6. Typage tolérant : une valeur illisible devient vide et elle est signalée (étape 8)
    VersTexte = (v as any) as nullable text =>
        if v = null then null
        else
            let
                t = Text.Trim(Text.From(v))
            in
                if t = "" then null else t,
    VersDate = (v as any) as nullable date =>
        if v = null then null
        else if v is date then v
        else if v is datetime then Date.From(v)
        else if v is datetimezone then Date.From(v)
        else if v is number then (try Date.From(v) otherwise null)
        else
            let
                t = Text.Trim(Text.From(v))
            in
                if t = "" then null
                else try Date.FromText(t, "fr-FR")
                    otherwise try Date.From(DateTime.FromText(t, "fr-FR"))
                    otherwise null,
    VersNombre = (v as any) as nullable number =>
        if v = null then null
        else if v is number then v
        else
            let
                t = Text.Remove(Text.Trim(Text.From(v)), {" ", "#(00A0)", "#(202F)"})
            in
                if t = "" then null else try Number.FromText(t, "fr-FR") otherwise null,
    AvecDateBrute = Table.AddColumn(Indexe, "_DateBrute", each VersTexte([#"Date début planifiée"]), type nullable text),
    ColonnesDates = {"Créé le", "Date début planifiée", "Date modif. fiche ordre"},
    ColonnesNombres = {"Total coûts réels"},
    ColonnesTextes = List.Difference(Attendues, ColonnesDates & ColonnesNombres),
    Types =
        Table.TransformColumns(
            AvecDateBrute,
            List.Transform(ColonnesTextes, each {_, VersTexte, type nullable text})
                & List.Transform(ColonnesDates, each {_, VersDate, type nullable date})
                & List.Transform(ColonnesNombres, each {_, VersNombre, type nullable number})),

    // 7. Code poste = N premiers caractères du Poste technique (N = P_LongueurCodePoste, 9 par défaut)
    //    Année planifiée = année de la Date début planifiée
    Longueur = Entrees[Longueur],
    Separateur = Entrees[Separateur],
    AvecCodePoste = Table.AddColumn(Types, "Code poste",
        each if [Poste technique] = null then null else Text.Start([Poste technique], Longueur), type nullable text),
    AvecAnnee = Table.AddColumn(AvecCodePoste, "Année planifiée",
        each if [#"Date début planifiée"] = null then null else Date.Year([#"Date début planifiée"]), Int64.Type),

    // 8. Contrôles par ligne de l'export (aucune ligne n'est supprimée)
    Texte = (v as any) as nullable text => if v = null then null else Text.Trim(Text.From(v)),
    SitesConnus = List.Buffer(List.RemoveNulls(List.Transform(Table.Column(Entrees[RefSites], "Site"), Texte))),
    CouplesConnus = List.Buffer(List.RemoveNulls(List.Transform(Table.ToRecords(Entrees[RefSites]),
        (r) => if r[Site] = null or r[Équipe] = null then null else Texte(r[Site]) & "|" & Texte(r[Équipe])))),
    AvecCleOrdre = Table.AddColumn(AvecAnnee, "_CleOrdre",
        each if [Ordre] = null then "#LIGNE-" & Text.From([Ligne export]) else [Ordre], type text),
    LignesParOrdre = Table.Group(AvecCleOrdre, {"_CleOrdre"},
        {{"Nb lignes export de l'OT", each Table.RowCount(_), Int64.Type}}),
    AvecNbLignes = Table.Join(AvecCleOrdre, "_CleOrdre",
        Table.RenameColumns(LignesParOrdre, {{"_CleOrdre", "_CleOrdre2"}}), "_CleOrdre2"),
    OrdreExport = Table.Sort(AvecNbLignes, {{"Ligne export", Order.Ascending}}),
    Segments = Table.AddColumn(OrdreExport, "_Segments",
        each if [Activité] = null then {} else List.Transform(Text.Split([Activité], "+"), each Text.Upper(Text.Trim(_))),
        type list),
    ControlesLigne = Table.AddColumn(Segments, "_ControlesLigne", (r) =>
        let
            Poste = r[Poste technique],
            Site = r[Groupe gestionnaires],
            Equipe = r[#"Poste travail princ."]
        in
            List.RemoveNulls({
                if r[Ordre] = null then "Ordre vide" else null,
                if r[#"Nb lignes export de l'OT"] > 1 and r[Ordre] <> null then "OT présent sur plusieurs lignes de l'export" else null,
                if Poste = null then "Poste technique vide" else null,
                if Poste <> null and Text.Length(Poste) < Longueur then "Poste technique trop court" else null,
                if Poste <> null and Separateur <> "" and Text.Length(Poste) > Longueur
                    and Text.Middle(Poste, Longueur, 1) <> Separateur
                    then "Format du Poste technique inattendu" else null,
                if r[_DateBrute] = null then "Date début planifiée vide" else null,
                if r[_DateBrute] <> null and r[#"Date début planifiée"] = null then "Date début planifiée illisible" else null,
                if r[Activité] = null then "Activité vide" else null,
                if r[Activité] <> null and List.Contains(r[_Segments], "") then "Activité mal formée" else null,
                if Site = null or Equipe = null then "Site ou équipe vide" else null,
                if Site <> null and not List.Contains(SitesConnus, Site) then "Nouveau site" else null,
                if Site <> null and Equipe <> null and List.Contains(SitesConnus, Site)
                    and not List.Contains(CouplesConnus, Site & "|" & Equipe)
                    then "Nouvelle équipe" else null,
                if r[#"Type de travail"] <> null and r[#"Type de travail"] <> "PRE" then "Type de travail autre que PRE" else null
            }),
        type list),

    // 9. Activité : une ligne par activité atomique (séparateur « + », espaces retirés, majuscules)
    AvecActivites = Table.AddColumn(ControlesLigne, "Activité atomique",
        each let a = List.Select([_Segments], each _ <> "") in if List.IsEmpty(a) then {null} else a),
    Eclate = Table.ExpandListColumn(AvecActivites, "Activité atomique"),
    AvecSequence = Table.AddIndexColumn(Eclate, "_Seq", 1, 1),
    CodesActivites = List.Buffer(List.RemoveNulls(List.Transform(Table.Column(Entrees[RefActivites], "Activité"),
        each if _ = null then null else Text.Upper(Text.Trim(Text.From(_)))))),
    AvecRang = Table.AddColumn(AvecSequence, "Ordre d'affichage activité",
        each let p = List.PositionOf(CodesActivites, [Activité atomique]) in if p < 0 then 999 else p + 1, Int64.Type),

    // 10. Doublons techniques : un même couple Ordre + Activité n'est compté qu'une fois
    AvecCleCouple = Table.AddColumn(AvecRang, "_CleCouple",
        each [_CleOrdre] & "|" & (if [Activité atomique] = null then "#VIDE" else [Activité atomique]), type text),
    Couples = Table.Group(AvecCleCouple, {"_CleCouple"},
        {{"Occurrences Ordre+Activité", each Table.RowCount(_), Int64.Type},
            {"_LignesCouple", each Text.Combine(List.Transform(List.Sort(List.Distinct([Ligne export])), Text.From), ", "),
                type text}}),
    AvecNbCouples = Table.Join(AvecCleCouple, "_CleCouple",
        Table.RenameColumns(Couples, {{"_CleCouple", "_CleCouple2"}}), "_CleCouple2"),
    Trie = Table.Buffer(Table.Sort(AvecNbCouples, {{"_Seq", Order.Ascending}})),
    SansDoublon = Table.Distinct(Trie, {"_CleCouple"}),
    // la ligne conservée garde la trace des lignes de l'export regroupées avec elle
    AvecRegroupees = Table.AddColumn(SansDoublon, "Lignes export regroupées",
        each if [#"Occurrences Ordre+Activité"] > 1 then [_LignesCouple] else null, type nullable text),

    // 11. Synthèse des contrôles de la ligne
    AvecControle = Table.AddColumn(AvecRegroupees, "Contrôle qualité", (r) =>
        let
            Liste = r[_ControlesLigne]
                & (if r[Activité atomique] <> null and r[#"Ordre d'affichage activité"] = 999
                    then {"Activité inconnue du référentiel"} else {})
                & (if r[#"Occurrences Ordre+Activité"] > 1 then {"Couple Ordre + Activité en double"} else {})
        in
            if List.IsEmpty(Liste) then null else Text.Combine(Liste, " ; "),
        type nullable text),
    Maintenant = DateTime.LocalNow(),
    AvecTrace = Table.AddColumn(
        Table.AddColumn(
            Table.AddColumn(AvecControle, "Écarts de structure",
                each if EcartsStructure = "" then null else EcartsStructure, type nullable text),
            "Fichier source", each Entrees[Chemin], type text),
        "Importé le", each Maintenant, type datetime),

    // 12. Table finale : clés d'analyse d'abord, puis colonnes de l'export, puis traçabilité
    Colonnes = {"Ordre", "Activité atomique", "Année planifiée", "Groupe gestionnaires", "Poste travail princ.",
        "Code poste", "Contrôle qualité", "Ligne export"}
        & List.Difference(Attendues, {"Ordre", "Groupe gestionnaires", "Poste travail princ."})
        & {"Ordre d'affichage activité", "Nb lignes export de l'OT", "Occurrences Ordre+Activité",
            "Lignes export regroupées", "Écarts de structure", "Fichier source", "Importé le"},
    Resultat = Table.TransformColumnTypes(Table.SelectColumns(AvecTrace, Colonnes),
        {{"Activité atomique", type text}, {"Ligne export", Int64.Type}})
in
    Resultat
