# Formules de calcul — v1.0.2

Toutes les formules sont implémentées **une seule fois**, dans `src/calc/` :

| Fichier | Contenu |
|---|---|
| `src/calc/loan.ts` | mensualité, coût du crédit |
| `src/calc/resolve.ts` | règle Prévu / Réel (quel montant utiliser) |
| `src/calc/metrics.ts` | coût du projet, rentabilités, cash-flow, effort d'épargne, rendement de l'apport |
| `src/calc/journal.ts` | réalisé : argent personnel injecté, solde net, charges récupérables, écarts réel / réalisé |

Ces fonctions sont pures (aucun accès au stockage ni à l'interface) et couvertes par `tests/`.
Les textes d'aide affichés dans l'application (`src/screens/explain.tsx`) décrivent ces mêmes formules.

Tout est **avant fiscalité**.

---

## 1. Prévu / Réel / Réalisé

| Notion | Définition | Données |
|---|---|---|
| **Prévu** | estimation avant l'achat | champ `planned` de chaque montant |
| **Réel** | caractéristiques définitives / connues du projet (prix signé, prêt, mensualité bancaire, loyer du bail, taxe foncière connue…) | champ `actual` de chaque montant |
| **Réalisé** | flux effectivement payés et encaissés, dans le temps | mouvements |

**Quel montant est utilisé ?**

- **Scénario Prévu** : `planned`, ou 0 s'il est vide.
- **Scénario Réel** : `actual` s'il est renseigné (y compris 0 €), sinon `planned` (repli), sinon 0.

**Quand afficher « Réel » ?** Seulement si au moins un montant `actual` est saisi. Un mouvement ne suffit jamais (v1.0.1).

**Repli identifiable** : en vue Réel, chaque indicateur connaît les montants encore prévus qu'il utilise (`referenceFields`, `estimatedInputs`, `KPI_INPUTS` dans `src/calc/resolve.ts`) :

| Indicateur | Montants utilisés |
|---|---|
| Coût du projet | achat |
| Investi personnellement | achat, prêt, charges |
| Loyer | location |
| Mensualité | prêt |
| Charges | charges |
| Rentabilité brute | achat, location |
| Rentabilité nette | achat, location, charges |
| Cash-flow, effort d'épargne | location, prêt, charges |
| Rendement de l'apport | tout |

La **mensualité** est considérée comme réelle si la banque l'a donnée (`monthlyPayment.actual`), ou si le capital, le taux et la durée réels sont tous saisis.

**Mensualité de crédit en Réel** : la mensualité réelle saisie si elle existe ; sinon la mensualité prévue saisie à la main, *tant que* le capital, le taux et la durée n'ont pas été corrigés en réel ; sinon le calcul automatique.

**Réel et réalisé ne se mélangent pas** : un mouvement ne remplace **jamais** automatiquement un montant (un acompte de travaux de 620 € n'est pas le coût final de travaux prévus à 5 000 €). Deux aides :
- *Projet › Achat* affiche « Payé à ce jour » et propose de reprendre ce total comme montant réel ;
- si le payé d'une rubrique d'achat **dépasse** le montant utilisé par les calculs (ex. notaire : 5 000 € prévus, 5 400 € payés, réel non saisi), une alerte le signale (`acquisitionDiscrepancies`).

**Écart** = Réel − Prévu. Vert si favorable (coût plus bas, loyer ou cash-flow plus hauts), rouge sinon.

---

## 2. Coût total du projet

```
Coût total = prix d'achat
           + frais de notaire
           + frais d'agence (acquéreur)
           + frais de dossier + garantie / caution + courtier   (frais de financement payés à l'achat)
           + travaux
           + mobilier / équipement
           + autres frais d'achat
```

Les intérêts et l'assurance emprunteur n'en font pas partie : ils sont payés au fil des mensualités.

## 3. Crédit

Prêt amortissable à taux fixe, mensualités constantes.

```
t = taux nominal annuel / 12 / 100
n = nombre de mensualités (durée en mois)
C = capital emprunté

Mensualité hors assurance M = C × t / (1 − (1 + t)^−n)     arrondie au centime
Si taux = 0 :              M = C / n
Si C ≤ 0 ou n ≤ 0 :         M = 0  (données incomplètes)
```

Une mensualité saisie à la main (montant exact de la banque) **remplace** M.

**Mensualité incohérente** (v1.0.1) : si une mensualité saisie vérifie `M × n < C`, le prêt ne serait jamais remboursé. La saisie est conservée (non bloquante) et utilisée pour le cash-flow, mais un avertissement s'affiche et les intérêts, le coût total du financement et le total remboursé valent « incohérent » (null) au lieu d'un 0 € trompeur.

```
Mensualité avec assurance   = M + assurance mensuelle
Coût des intérêts           = M × n − C      (null si M × n < C : saisie incohérente)
Coût de l'assurance         = assurance mensuelle × n
Frais de financement        = frais de dossier + garantie + courtier
Coût total du financement   = intérêts + assurance + frais de financement
Total remboursé à la banque = C + intérêts + assurance
```

Sans durée connue, les coûts cumulés (intérêts, assurance, total remboursé) ne sont pas estimés (0).

## 4. Apport et argent investi

```
Apport (argent personnel à l'achat) = max(0, coût total − montant emprunté)
Investi personnellement             = apport + dépenses ponctuelles (charges « ponctuelles »)
```

Dans l'écran *Financement*, l'apport n'est pas stocké : le saisir modifie le montant emprunté (`emprunt = coût total − apport`). Il n'existe ainsi qu'une seule source de vérité.

## 5. Loyers

```
Loyer annuel théorique (hors charges) = loyer mensuel HC × 12
Loyer annuel conservé                 = loyer mensuel HC × (12 − mois de vacance par an) × (1 − provision impayés %)
Loyer mensuel conservé                = loyer annuel conservé / 12
```

Les **charges récupérables** sont saisies à part. Elles sont payées par le locataire puis reversées : elles n'entrent dans **aucun** calcul de rentabilité ou de cash-flow. Elles servent seulement à afficher le loyer charges comprises.

## 6. Charges propriétaire

Chaque charge a une fréquence : mensuelle, annuelle ou ponctuelle.

```
Équivalent annuel  : mensuelle × 12 ; annuelle × 1 ; ponctuelle → 0 (non récurrente)
Équivalent mensuel : équivalent annuel / 12
Charges annuelles  = Σ équivalents annuels
Charges mensuelles = charges annuelles / 12        (provision mensuelle des charges annuelles)
Dépenses ponctuelles = Σ montants ponctuels        (ajoutées à l'argent investi)
```

## 7. Rentabilités

```
Rentabilité brute = loyer annuel théorique HC / coût total × 100

Rentabilité nette avant fiscalité
                  = (loyer annuel conservé − charges annuelles) / coût total × 100
```

La rentabilité nette **ne déduit pas** le crédit (ni intérêts ni capital) : c'est la rentabilité du bien lui-même.
Si le coût total vaut 0, les rentabilités sont « — » (non calculables).

## 8. Cash-flow et effort d'épargne

```
Cash-flow mensuel = loyer mensuel conservé
                  − mensualité hors assurance
                  − assurance emprunteur mensuelle
                  − charges mensuelles

Cash-flow annuel  = cash-flow mensuel × 12
Effort d'épargne  = max(0, − cash-flow mensuel)
```

## 9. Rendement de mon apport (cash-on-cash)

```
Rendement de mon apport = cash-flow annuel / investi personnellement × 100
```

Indicateur de **trésorerie** : le remboursement du capital y est compté comme une dépense alors qu'il constitue un enrichissement (vous possédez une part croissante du bien). Le rendement économique réel est donc supérieur. Non calculable (« — ») si rien n'a été investi personnellement.

## 10. Réalisé (mouvements)

Calculé uniquement à partir des mouvements (`src/calc/journal.ts`), sauf l'apport initial.

### 10.1 Classement des mouvements

| Classe | Catégories | Traitement |
|---|---|---|
| Achat | prix, notaire, agence, dossier, garantie, courtier, travaux, mobilier, autres frais | coût d'acquisition, financé par l'apport + le prêt : **hors** résultat d'exploitation |
| Récupérables | « Charges récupérées (locataire) », « Charges récupérables payées » | **neutres** : exclus de tous les indicateurs, affichés à part |
| Exploitation | tout le reste (loyers, autres recettes, mensualités, assurance, charges, taxes, catégories personnalisées) | résultat d'exploitation |

### 10.2 Charges récupérables : neutres

Les charges récupérables sont collectées auprès du locataire pour payer une dépense correspondante : ce n'est pas un revenu. Ces deux catégories n'augmentent ni ne diminuent jamais : les recettes, le résultat d'exploitation, le solde net, l'argent injecté, le cash-flow ou les rentabilités. Côté projet, le champ « Charges récupérables » de la location n'entre déjà dans aucun calcul. Les montants reçus et payés sont affichés à titre informatif (« Charges récupérables (neutres) »). Exemple : loyer 550 € + charges récupérées 50 € → recettes = 550 €.

### 10.3 Résultat d'exploitation

```
Recettes             = Σ recettes d'exploitation            (hors récupérables)
Dépenses courantes   = Σ dépenses d'exploitation            (hors achat, hors récupérables)
Résultat d'exploitation cumulé = recettes − dépenses courantes
```

### 10.4 Argent personnel injecté (ne diminue jamais)

```
Apport initial = max(0, coût d'acquisition − montant emprunté)   (scénario Réel : réel, sinon prévu)
                 compté dès que le bien est marqué « acheté », 0 avant.

Injections d'exploitation : pour chaque mois civil, dans l'ordre chronologique,
    trésorerie du bien ← trésorerie + (recettes du mois − dépenses courantes du mois)
    si trésorerie < 0 :  injection du mois = − trésorerie ; trésorerie ← 0
    (la trésorerie démarre à 0 € ; un excédent reste dans le bien et sert les mois suivants)

Argent personnel injecté = apport initial + Σ injections du mois
```

Propriétés : un mois bénéficiaire n'efface jamais une injection passée ; dans un même mois l'ordre de saisie n'a pas d'effet ; l'ordre de saisie des mois non plus (tri chronologique). Les paiements d'achat ne s'ajoutent pas à l'apport : ils sont déjà couverts par l'apport (part personnelle) et le prêt (part bancaire, remboursée via les mensualités) — **aucun double comptage**.

**C'est une estimation** fondée sur les déficits mensuels cumulés du projet, pas le relevé exact des virements depuis le compte personnel. À l'intérieur d'un mois civil, les dates ne comptent pas. Exemple : 500 € payés le 2 et un loyer de 600 € le 25 donnent un mois à +100 €, donc aucune injection, même si les 500 € ont été avancés quelques jours.

| Cas (audit) | Injecté | Solde net |
|---|---|---|
| Apport 5 000 €, aucun mouvement | 5 000 € | −5 000 € |
| Apport 5 000 €, déficit de 100 € | 5 100 € | −5 100 € |
| Apport 5 000 €, mois 1 −100 €, mois 2 +150 € | **5 100 €** (pas 5 000 €) | −4 950 € (trésorerie restante 150 €) |

### 10.5 Solde net du projet

```
Solde net = résultat d'exploitation cumulé − apport initial
          = trésorerie restante du bien − argent personnel injecté
```

Positif : le bien a rapporté plus que ce que j'y ai mis ; négatif : ce qu'il m'a coûté jusqu'à aujourd'hui. C'est la version sans double comptage de « recettes encaissées − dépenses payées » : la partie de l'achat payée par la banque n'y figure qu'au travers des mensualités remboursées. Le capital remboursé y est compté comme une dépense (indicateur de trésorerie).

### 10.6 Ce qu'il faut saisir

Les mensualités de crédit et l'assurance emprunteur doivent être saisies comme mouvements pour être comptées (« Copier au mois suivant » accélère la saisie).

## 11. Cas limites (testés)

| Cas | Comportement |
|---|---|
| Aucun apport (financement à 100 % et plus) | apport = 0, rendement de l'apport « — » |
| Emprunt > coût total | apport = 0 + avertissement |
| Aucun crédit | mensualité 0, cash-flow = loyer conservé − charges |
| Taux 0 % | M = C / n |
| Loyer nul | rentabilités 0 %, cash-flow négatif, avertissement |
| Coût nul | rentabilités « — », jamais NaN ni Infinity |
| Emprunt sans durée ni mensualité | mensualité 0 + avertissement |
| Mensualité saisie incohérente (M × n < C) | avertissement ; intérêts, coût total et total remboursé « incohérent » (null), saisie conservée |
| Un mouvement mais aucun montant réel | vue « Réel » non proposée, chiffres = prévu |
| Charges récupérées enregistrées en recette | neutres : aucun effet sur les indicateurs |
| Montant réel 0 € | pris en compte (ne retombe pas sur le prévu) |
