// =====================================================================
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
    Ordonne
