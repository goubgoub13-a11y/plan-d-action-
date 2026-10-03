# Formules de calcul — v1.0.0

Toutes les formules sont implémentées **une seule fois**, dans `src/calc/` :

| Fichier | Contenu |
|---|---|
| `src/calc/loan.ts` | mensualité, coût du crédit |
| `src/calc/resolve.ts` | règle Prévu / Réel (quel montant utiliser) |
| `src/calc/metrics.ts` | coût du projet, rentabilités, cash-flow, effort d'épargne, rendement de l'apport |
| `src/calc/journal.ts` | synthèse des mouvements réels, « sorti de ma poche » |

Ces fonctions sont pures (aucun accès au stockage ni à l'interface) et couvertes par `tests/`.
Les textes d'aide affichés dans l'application (`src/screens/explain.tsx`) décrivent ces mêmes formules.

Tout est **avant fiscalité**.

---

## 1. Prévu / Réel : quel montant est utilisé ?

Chaque montant du projet est stocké sous la forme `{ planned, actual }` (`null` = non renseigné).

- **Scénario Prévu** : `planned`, ou 0 s'il est vide.
- **Scénario Réel** : `actual` s'il est renseigné (y compris 0 €), sinon `planned`, sinon 0.

Le « Réel » est donc toujours le **meilleur chiffre connu** : il part de la simulation et se précise au fur et à mesure des saisies.

**Mensualité de crédit en Réel** : la mensualité réelle saisie si elle existe ; sinon la mensualité prévue saisie à la main, *tant que* le capital, le taux et la durée n'ont pas été corrigés en réel ; sinon le calcul automatique.

**Mouvements et rubriques d'achat** : les mouvements ne remplacent **pas** automatiquement un montant prévu. Un acompte de travaux de 620 € ne signifie pas que les travaux prévus à 5 000 € ont coûté 620 €. L'écran *Projet › Achat* affiche « Payé à ce jour » et propose de reprendre ce total comme montant réel quand la dépense est terminée. Il n'y a donc jamais de double comptage.

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

```
Mensualité avec assurance   = M + assurance mensuelle
Coût des intérêts           = max(0, M × n − C)
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

## 10. Suivi réel (mouvements)

Calculé uniquement à partir des mouvements enregistrés (dépenses et recettes réellement payées ou encaissées).

```
Total payé            = Σ dépenses
Total encaissé        = Σ recettes
Résultat global       = total encaissé − total payé
Dépenses d'achat      = Σ dépenses des catégories d'achat (prix, notaire, travaux…)
Résultat hors achat   = total encaissé − (total payé − dépenses d'achat)
Déficit cumulé        = max(0, − résultat hors achat)

Sorti de ma poche     = apport réel (coût total réel − emprunt réel)
                      + déficit cumulé
```

- Pour que les mensualités soient prises en compte, elles doivent être saisies comme mouvements (catégories « Mensualité de crédit » et « Assurance emprunteur »). Le bouton « Copier au mois suivant » rend cette saisie rapide.
- Un excédent d'exploitation ne vient pas diminuer l'apport : il apparaît dans « Résultat hors achat ».
- Les catégories personnalisées sont traitées comme des dépenses ou recettes d'exploitation.

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
| Mensualité saisie incohérente (trop basse) | intérêts plafonnés à 0, jamais négatifs |
| Montant réel 0 € | pris en compte (ne retombe pas sur le prévu) |
