// =====================================================================
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
    Resultat
