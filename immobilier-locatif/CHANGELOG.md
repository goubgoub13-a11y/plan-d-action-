# Historique des versions

## 1.0.1 — 2026-10-03

Correctif ciblé après audit indépendant. Pas de nouvelle fonctionnalité, ni d'écran ou de dépendance supplémentaire. Le schéma de sauvegarde est inchangé (voir [docs/MIGRATION.md](docs/MIGRATION.md)).

**P1 — Enregistrement local fiable** (`src/state/persister.ts`)
- Une modification n'est marquée enregistrée qu'**après** le succès de l'écriture IndexedDB. Avant, elle l'était dès le lancement de l'écriture : un échec pouvait laisser une version jamais réécrite.
- En cas d'échec, la version reste non enregistrée et en mémoire. Elle est retentée automatiquement (1 s, 3 s, 10 s, puis toutes les 30 s) et un bandeau propose « Réessayer ».
- Les écritures sont séquentielles : une ancienne écriture qui se termine après une nouvelle modification ne marque jamais la dernière version comme enregistrée. Un échec partiel est entièrement rejoué.
- Le navigateur avertit si l'on ferme la page avec des modifications non écrites.

**Prévu / Réel / Réalisé**
- La vue « Réel » n'est proposée que si un montant réel de référence existe. Un mouvement seul ne suffit plus.
- En vue Réel : une ligne « N montants encore prévus » et un petit rond creux ◦ sur les indicateurs qui utilisent encore du prévu. Le détail apparaît en touchant la carte.
- Une alerte s'affiche quand le payé d'une rubrique d'achat dépasse le montant utilisé par les calculs (ex. notaire : 5 400 € payés pour 5 000 € prévus). Rien n'est modifié automatiquement.

**Charges récupérables neutres**
- « Charges récupérées » et la nouvelle catégorie « Charges récupérables payées » n'ont plus aucun effet sur les recettes, le résultat, le solde net, l'argent injecté ou les rentabilités. Elles sont affichées à part, pour information.

**Argent personnel injecté et solde net** (remplacent « Sorti de ma poche »)
- Argent injecté = apport initial + déficits mensuels couverts de ma poche. Le calcul suit une trésorerie du bien mois par mois et ce montant ne diminue jamais.
- Solde net du projet = résultat d'exploitation cumulé − apport initial. Rien n'est compté deux fois entre l'apport, les paiements d'achat, le prêt et les mensualités.

**Imports et données locales**
- Montants négatifs refusés partout, mouvement à 0 € refusé, taux et durée bornés.
- Identifiants en double refusés : biens, mouvements, charges, catégories (y compris un identifiant réservé).
- Données locales endommagées : ce qui est sain est conservé, avec récupération partielle d'un bien. Une copie brute de l'original est mise en quarantaine, jamais effacée automatiquement. Un avertissement s'affiche et la copie se télécharge depuis Réglages. Base IndexedDB passée en version 2.

**Mensualité manuelle incohérente**
- Si mensualité × durée < capital : avertissement non bloquant, et intérêts, coût total et total remboursé affichés « incohérent » au lieu de 0 €.

**Tests** : 82 → 154. Aucun test v1.0.0 supprimé : ceux du journal sont adaptés aux nouveaux noms de champs, et celui de la mensualité incohérente attend désormais « incohérent » (null) au lieu de 0 €, conformément au nouveau comportement.

## 1.0.0 — 2026-10-03

Première version.

- Projet Prévu / Réel : achat, financement, location, charges
- Tableau de bord : cash-flow, effort d'épargne, coût du projet, argent investi, loyer, mensualité, rentabilités brute et nette (avant impôts), charges, rendement de l'apport, graphique revenus/dépenses, comparaison Prévu / Réel / Écart
- Journal des mouvements réels (catégories préremplies et personnalisées)
- « Sorti de ma poche » calculé à partir des mouvements
- Plusieurs biens (modèle), interface optimisée pour un seul
- Sauvegarde JSON versionnée (schéma 1) : export, partage, import validé avec confirmation
- PWA hors connexion, stockage IndexedDB local, aucune donnée transmise
- 82 tests unitaires
