// =====================================================================
// OT_Couverture - nombre d'OT DISTINCTS par
//   Année planifiée x Site x Équipe x Code poste x Activité atomique.
// Site = Groupe gestionnaires ; Équipe = Poste travail princ.
// Source : requête OT_Detail (aucun accès direct à un fichier).
// Chargement : tableau dans l'onglet 02_COUVERTURE_OT, cellule A8.
// Une colonne par activité présente (ordre du référentiel, puis inconnues).
// =====================================================================
let
    Detail = OT_Detail,
    Base = Table.SelectColumns(Detail, {"Ordre", "Ligne export", "Année planifiée", "Groupe gestionnaires",
        "Poste travail princ.", "Code poste", "Activité atomique", "Ordre d'affichage activité", "Contrôle qualité"}),
    // Une valeur manquante reste visible comme « (vide) » au lieu de disparaître
    Vide = (v as nullable text) as text => if v = null then "(vide)" else v,
    Cles = Table.TransformColumns(
        Table.RenameColumns(Base, {{"Groupe gestionnaires", "Site"}, {"Poste travail princ.", "Équipe"}}),
        {{"Site", Vide, type text}, {"Équipe", Vide, type text}, {"Code poste", Vide, type text},
            {"Activité atomique", Vide, type text}}),
    // Identifiant d'OT : le numéro d'ordre ; une ligne sans numéro compte comme un OT à part
    AvecOT = Table.AddColumn(Cles, "_OT",
        each if [Ordre] = null then "#LIGNE-" & Text.From([Ligne export]) else [Ordre], type text),
    // Activités en colonnes : ordre du référentiel, puis activités inconnues par ordre alphabétique
    OrdreActivites = Table.Sort(
        Table.Distinct(Table.SelectColumns(AvecOT, {"Activité atomique", "Ordre d'affichage activité"})),
        {{"Ordre d'affichage activité", Order.Ascending}, {"Activité atomique", Order.Ascending}}),
    Activites = List.Distinct(OrdreActivites[Activité atomique]),
    ParPoste = Table.Group(AvecOT, {"Année planifiée", "Site", "Équipe", "Code poste"},
        {{"_Lignes", each _, type table}}),
    AvecComptes = Table.AddColumn(ParPoste, "_Comptes", (g) =>
        Record.FromList(
            List.Transform(Activites, (a) =>
                List.Count(List.Distinct(Table.SelectRows(g[_Lignes], each [Activité atomique] = a)[_OT]))),
            Activites)),
    Developpe = Table.ExpandRecordColumn(AvecComptes, "_Comptes", Activites),
    AvecTotal = Table.AddColumn(Developpe, "OT distincts (toutes activités)",
        each List.Count(List.Distinct([_Lignes][_OT])), Int64.Type),
    AvecVigilance = Table.AddColumn(AvecTotal, "OT avec point de contrôle",
        each List.Count(List.Distinct(Table.SelectRows([_Lignes], each [Contrôle qualité] <> null)[_OT])), Int64.Type),
    SansDetail = Table.RemoveColumns(AvecVigilance, {"_Lignes"}),
    Types = Table.TransformColumnTypes(SansDetail,
        {{"Année planifiée", Int64.Type}} & List.Transform(Activites, each {_, Int64.Type})),
    Resultat = Table.Sort(Types, {{"Année planifiée", Order.Ascending}, {"Site", Order.Ascending},
        {"Équipe", Order.Ascending}, {"Code poste", Order.Ascending}})
in
    Resultat
