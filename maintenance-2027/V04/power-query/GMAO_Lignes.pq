// =====================================================================
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
    Resultat
