// =====================================================================
// OT_Controles - tableau de bord des contrôles qualité de l'import GMAO
// Une ligne par contrôle, toujours présente (Statut OK si rien à signaler).
// Source : requête OT_Detail (aucun accès direct à un fichier).
// Chargement : tableau dans l'onglet 07_POINTS_A_VALIDER, cellule A6.
// Le détail des lignes concernées se filtre dans 04_DETAIL_OT,
// colonne « Contrôle qualité ».
// =====================================================================
let
    Detail = OT_Detail,
    Lignes = Table.Buffer(Table.SelectColumns(Detail,
        {"Ordre", "Ligne export", "Lignes export regroupées", "Contrôle qualité", "Écarts de structure"})),
    // numéros des lignes de l'export portées par une ligne du détail (doublons regroupés compris)
    LignesDe = (r as record) as list =>
        {r[Ligne export]}
            & (if r[Lignes export regroupées] = null then {}
                else List.Transform(Text.Split(r[Lignes export regroupées], ", "), Number.From)),
    NumerosLignes = (t as table) as list => List.Distinct(List.Combine(List.Transform(Table.ToRecords(t), LignesDe))),
    Definitions = {
        {"Ordre vide", "À vérifier"},
        {"OT présent sur plusieurs lignes de l'export", "À vérifier"},
        {"Poste technique vide", "À vérifier"},
        {"Poste technique trop court", "À vérifier"},
        {"Format du Poste technique inattendu", "À vérifier"},
        {"Date début planifiée vide", "À vérifier"},
        {"Date début planifiée illisible", "À vérifier"},
        {"Activité vide", "À vérifier"},
        {"Activité mal formée", "À vérifier"},
        {"Activité inconnue du référentiel", "À vérifier"},
        {"Couple Ordre + Activité en double", "Info"},
        {"Site ou équipe vide", "À vérifier"},
        {"Nouveau site", "À vérifier"},
        {"Nouvelle équipe", "À vérifier"},
        {"Type de travail autre que PRE", "Info"}
    },
    Exemples = (ordres as list, lignes as list) as text =>
        Text.Combine(List.FirstN(
            (if List.IsEmpty(ordres) then {} else ordres)
                & (if List.IsEmpty(ordres) then List.Transform(lignes, each "ligne " & Text.From(_)) else {}),
            10), ", "),
    CalculerStatut = (niveau as text, nombre as number) as text =>
        if nombre = 0 then "OK" else if niveau = "Info" then "INFO" else "À VÉRIFIER",
    // Ligne 0 : volume lu, pour vérifier d'un coup d'œil que l'export est complet
    Volume = [
        #"N°" = 0,
        Contrôle = "Lignes lues dans l'export",
        Niveau = "Info",
        #"Lignes de l'export" = List.Count(NumerosLignes(Lignes)),
        #"OT distincts" = List.Count(List.Distinct(List.RemoveNulls(Lignes[Ordre]))),
        #"Exemples (Ordre ou ligne)" = "",
        Statut = "INFO"
    ],
    // Ligne 1 : structure de l'export (colonnes absentes ou non utilisées)
    EcartsListe = List.Distinct(List.RemoveNulls(Lignes[Écarts de structure])),
    Structure = [
        #"N°" = 1,
        Contrôle = "Écart de structure de l'export",
        Niveau = "À vérifier",
        #"Lignes de l'export" = 0,
        #"OT distincts" = 0,
        #"Exemples (Ordre ou ligne)" = Text.Combine(EcartsListe, " | "),
        Statut = if List.IsEmpty(EcartsListe) then "OK" else "À VÉRIFIER"
    ],
    ParControle = List.Transform(List.Positions(Definitions), (i) =>
        let
            Libelle = Definitions{i}{0},
            NiveauControle = Definitions{i}{1},
            Touchees = Table.SelectRows(Lignes, each [Contrôle qualité] <> null
                and List.Contains(Text.Split([Contrôle qualité], " ; "), Libelle)),
            NumLignes = List.Sort(NumerosLignes(Touchees)),
            Ordres = List.Distinct(List.RemoveNulls(Touchees[Ordre]))
        in
            [
                #"N°" = i + 2,
                Contrôle = Libelle,
                Niveau = NiveauControle,
                #"Lignes de l'export" = List.Count(NumLignes),
                #"OT distincts" = List.Count(Ordres),
                #"Exemples (Ordre ou ligne)" = Exemples(Ordres, NumLignes),
                Statut = CalculerStatut(NiveauControle, List.Count(NumLignes))
            ]),
    Resultat = Table.TransformColumnTypes(
        Table.FromRecords({Volume, Structure} & ParControle),
        {{"N°", Int64.Type}, {"Contrôle", type text}, {"Niveau", type text}, {"Lignes de l'export", Int64.Type},
            {"OT distincts", Int64.Type}, {"Exemples (Ordre ou ligne)", type text}, {"Statut", type text}})
in
    Resultat
