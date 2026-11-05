// =====================================================================
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
    Resultat
