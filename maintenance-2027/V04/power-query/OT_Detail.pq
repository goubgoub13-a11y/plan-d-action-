// =====================================================================
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
    Types
