# Design — v1.1.0

La v1.1.0 change uniquement la présentation. Le modèle de données, les calculs, le stockage, le persister, l'import/export, la PWA et le fonctionnement hors connexion sont ceux de la v1.0.2. Les 167 tests métier existants passent sans modification.

## 1. Audit de l'interface v1.0.2

| Zone | Constat | Impression |
|---|---|---|
| Accueil | 8 indicateurs de même poids, puis un graphique, une comparaison en tableau à 4 colonnes, le réalisé, le détail du crédit et les alertes : tout sur un seul écran | trop dense, aucune hiérarchie après le cash-flow |
| Indicateurs | valeur et unité dans la même graisse (« 560 €/mois »), « € » aussi gros que le nombre | peu élégant, lecture lente |
| Prévu / Réel | tableau prévu / réel / écart à 4 colonnes serrées sur 390 px | « Excel » |
| Projet | une trentaine de champs visibles en permanence, onglets internes, bouton « Suivant » | formulaire administratif |
| Saisie des montants | « 60000 » sans séparateur, champs gris sur cartes blanches | prototype technique |
| Mouvements | groupés par mois, libellés sur deux lignes, totaux « Payé / Encaissé / Exploitation » sans hiérarchie | correct mais générique |
| Ajout d'un mouvement | sélecteur natif pour la catégorie, montant comme un champ parmi d'autres | lent pour un geste quotidien |
| Réglages | longs paragraphes, quatre boutons pleine largeur empilés, effacement au même niveau que le reste | technique, peu rassurant |
| Système | rayons 8, 12, 13, 14, 16, 18, 20, 24 px ; espacements arbitraires ; une seule ombre ; couleurs codées en dur | incohérent |
| Mode sombre | inversion rapide, cartes peu différenciées | plat |
| Navigation | 4 onglets, état actif uniquement par la couleur | correct, perfectible |

## 2. Direction artistique

**« Patrimonial calme »** : l'univers d'une banque privée plutôt que d'une fintech démonstrative.

- **Fond pierre chaude** (`#F3F2EE`) plutôt qu'un blanc pur, cartes blanches légèrement relevées.
- **Une seule couleur de marque** : vert sapin profond (`#134E40`), avec une nuance menthe en mode sombre. Elle identifie le produit sans le colorier.
- **Encre presque noire** (`#111A17`) et deux gris pour la hiérarchie du texte.
- **Couleurs fonctionnelles rares** :
  - vert pour un écart favorable ou une recette ;
  - terre cuite (et non rouge vif) pour un écart défavorable ;
  - ocre pour « à vérifier ».

  Les dépenses restent dans la couleur de l'encre : pas de rouge partout. Le sens d'un chiffre est toujours porté aussi par son signe (+ / −), jamais par la couleur seule.
- **Une carte principale** (le cash-flow), en dégradé sapin, avec une petite barre revenus / dépenses. C'est le seul élément « fort » de l'application.
- **Aucune police téléchargée** : la police système (SF Pro sur iPhone, Roboto sur Android) reste nette, rapide et hors ligne. La personnalité vient de la hiérarchie : grands chiffres serrés, unités réduites et atténuées.

## 3. Design system (tokens dans `src/styles/app.css`)

| Famille | Tokens |
|---|---|
| Surfaces | `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-strong` |
| Texte | `--ink`, `--ink-2`, `--ink-3` |
| Marque | `--brand`, `--brand-strong`, `--brand-soft`, `--on-brand` |
| Fonctionnelles | `--pos`, `--neg`, `--warn` et leurs variantes `-soft` |
| Carte principale | `--hero-from`, `--hero-to`, `--hero-ink`, `--hero-in`, `--hero-out` |
| Données | `--data-a` à `--data-d` (gamme sapin + sable, 4 teintes maximum) |
| Typographie | `--fs-display` 52, `--fs-xl` 26, `--fs-lg` 20, `--fs-md` 17, `--fs-body` 16, `--fs-sm` 14, `--fs-xs` 12 ; graisses `--fw-*` |
| Espacements | base 4 : `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 20, `--s-6` 24, `--s-8` 32, `--s-10` 40 |
| Rayons | `--r-sm` 10 (pastilles), `--r-md` 14 (champs, boutons), `--r-lg` 20 (cartes), `--r-xl` 28 (carte principale, panneaux) |
| Profondeur | `--shadow-1` (cartes), `--shadow-2` (panneaux, bouton +), `--shadow-hero` ; en sombre, des bordures remplacent les ombres |
| Mouvement | `--dur-1` 120 ms, `--dur-2` 220 ms, `--dur-3` 360 ms, `--ease` ; tout est désactivé si `prefers-reduced-motion` |

Le mode sombre redéfinit les mêmes tokens (surfaces étagées, menthe à la place du sapin, bordures discrètes). Il suit automatiquement le thème du téléphone.

### Composants (`src/ui/`)

| Composant | Rôle |
|---|---|
| `Amount`, `Percent` | Chiffre typographié : grand nombre, petite unité atténuée, signe typographique « − », libellé accessible complet (« Cash-flow : +82 € ») |
| `Stat` | Carte indicateur : libellé, valeur, unité (« par mois »), précision |
| `Section` | Carte de rubrique : icône, titre, valeur principale, action « Modifier » |
| `Line` | Ligne libellé / valeur, avec aide sous le libellé ou précision sous la valeur |
| `DeltaPill` | Écart signé sur fond doux |
| `StackBar` + `Legend` | Barre de répartition simple (coût du projet, coût du crédit) |
| `EmptyState` | État vide : icône, titre, phrase, action |
| `Segmented` | Contrôle segmenté avec indicateur glissant (Prévu / Réel, filtres, type de mouvement) |
| `Icon` | Jeu unique d'icônes au trait (1,7 px), plus une icône par catégorie de mouvement |
| `Logo` | Monogramme : un toit et trois barres montantes |

Les helpers de présentation (`moneyParts`, `pctParts`, `formatInput`, `dayLabel`) sont des fonctions pures testées (`tests/presentation.test.ts`).

## 4. Écrans

**Question posée à chaque écran : quelle est l'information la plus importante ?**

| Écran | Information principale | Ensuite |
|---|---|---|
| Accueil | Cash-flow mensuel (carte principale) | 4 indicateurs : rentabilité nette, loyer, mensualité, coût du projet ; puis le réalisé (argent injecté, solde net) ; puis « À vérifier » |
| Projet | Le total de chaque rubrique | Lignes en lecture ; « Modifier » ouvre le formulaire dans un panneau, avec un retour « Enregistré sur l'appareil » |
| Mouvements | La liste, groupée par jour | Totaux, filtre, bouton + toujours accessible |
| Analyse | Ce que le bien a rapporté ou coûté (solde net) | Résultat par mois, Prévu / Réel, rentabilité, composition du coût |
| Réglages | La sauvegarde | Mes biens, confidentialité, aide, zone sensible séparée |

**Prévu / Réel / Réalisé** :
- Prévu / Réel est un contrôle segmenté unique sous le nom du bien. Il n'apparaît que si un montant réel existe. Le libellé de la carte principale indique le mode (« Cash-flow réel »).
- Une seule ligne discrète signale les montants encore prévus. Le même rond creux ◦ marque les indicateurs concernés.
- Le réalisé a sa propre carte et son propre onglet (Analyse, Mouvements).

**Ajout d'un mouvement** : le type, puis un grand montant centré (« − 620 € »), puis des pastilles pour les catégories fréquentes. La liste complète reste accessible via « Autre catégorie… ». Le bouton indique le montant (« Ajouter 620 € »).

## 5. Micro-interactions

Toutes sont brèves (120 à 360 ms) et désactivées si l'utilisateur demande moins de mouvement :
- apparition douce et décalée des blocs d'un écran ;
- fondu au changement d'onglet ;
- indicateur glissant du contrôle segmenté ;
- léger fondu de la carte principale quand on passe de Prévu à Réel ;
- léger enfoncement au toucher des cartes et boutons ;
- montée des panneaux ;
- message de confirmation après l'ajout d'un mouvement ;
- état d'enregistrement dans les éditeurs.

## 6. Accessibilité

- Zones tactiles de 40 à 64 px de haut. Les boutons principaux et les champs font 48 px.
- Focus clavier visible (anneau sapin).
- Contrastes : encre sur pierre, et blanc sur sapin, sont au-delà de WCAG AA.
- Les montants ont un libellé accessible complet. Les icônes décoratives sont masquées aux lecteurs d'écran.
- Les recettes et dépenses se distinguent par le signe, pas seulement par la couleur.

## 7. Responsive et PWA

- Colonne de 560 px (600 px dès 720 px de large), centrée ; la navigation suit la même largeur.
- Vérifié à 320, 390, 430, 768 et 1 280 px, sans aucun défilement horizontal.
- Marges de sécurité iPhone en haut et en bas.
- `theme-color` clair et sombre, nouvelles icônes PNG générées depuis le même monogramme.
