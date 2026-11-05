// =====================================================================
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
    Resultat
