# Audit visuel et direction — v1.3.0

Analyse réalisée avant modification à partir des captures de la v1.2.0 et du code, puis contrôle dans le navigateur. Le texte joint sert de brief de travail ; la demande actuelle de rendu professionnel, futuriste et de couleurs modifiables guide la direction finale.

## Ce qui est conservé

Le cash-flow domine déjà l'accueil ; le découpage Projet / Mouvements / Analyse est clair. Les montants séparent déjà chiffre, devise et période. Les formulaires progressifs, les icônes SVG, les explications financières et l'approche mobile sont de bonnes bases. Ils sont conservés. Aucun nouveau calcul financier n'est ajouté.

## Constats par écran

| Écran | Première lecture / lecture souhaitée | Finition à améliorer |
| --- | --- | --- |
| Accueil | Nom très volumineux, puis choix Prévu/Réel, puis cash-flow / identifier le bien puis lire rapidement le cash-flow | En-tête haut, fortes ombres, quatre cartes concurrentes, unités et détails sans rythme homogène. |
| Projet | Sections et total / fiche de consultation puis édition ciblée | Plusieurs niveaux de surfaces, montants secondaires trop proches du premier plan, contours et ombres répétés. |
| Édition | Prévu focalisé même si la ligne affiche le Réel / reprendre exactement le montant consulté | Risque de saisie dans la mauvaise colonne ; progression étroite, retour du focus et confinement clavier incomplets. |
| Mouvements | Totaux puis dates / repérer date, nature et montant | Listes très arrondies et ombrées ; les signes sont utiles et à conserver, les métadonnées doivent rester secondaires. |
| Ajout | Type, montant, catégories / montant dominant et validation près du pouce | Fenêtre sensible aux conteneurs animés et au scroll ; besoin de sécuriser la navigation clavier. |
| Analyse | Solde et longues listes / bilan puis évolution simple | Graphique ne remontant pas toujours à l'acquisition ; palette des graphiques à unifier avec la signature choisie. |
| Réglages | Sauvegarde / accès explicite à la personnalisation et aux données | Aucun choix de thème ou de couleur, mode sombre seulement lié au système. |
| États vides | Explication et action déjà présentes / un seul prochain geste | Conserver les appels à l'action ; appliquer la même finition et les mêmes contrastes que les états remplis. |

Les anciennes captures sont conservées dans `docs/screenshots/avant/` ; le dossier `undefined/` présent dans l'archive d'origine a été reclassé.

## Direction retenue : Minéral

Fond minéral clair ou graphite sombre, encre nette, surfaces mates et une couleur signature. La touche futuriste vient du dessin architectural filaire, des grandes valeurs, de la navigation flottante et des surfaces superposées. La transparence reste limitée à la navigation et au fond des fenêtres. Aucun effet lumineux permanent ni bibliothèque d'animation.

- Six palettes : Jade, Cobalt, Iris, Cuivre, Rose et Graphite.
- Couleur libre : sélecteur natif et code hexadécimal.
- Thème clair, sombre ou automatique, aperçu immédiat et réinitialisation.
- Nuances calculées séparément pour les fonds, les textes, les actions et les graphiques. Les couleurs sémantiques de recettes/dépenses restent stables.
- Choix locaux indépendants du modèle financier, de la base de données et du format de sauvegarde.

## Recherche Internet

Sources officielles consultées le 4 octobre 2026. Elles servent de références de principes, sans copie de composants ou d'actifs.

- [Linear — How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui) : réduction du bruit, hiérarchie, contrastes et cohérence des surfaces.
- [Linear — Welcome to the new Linear](https://linear.app/changelog/2024-03-20-new-linear-ui) : réglage des thèmes et fondations communes des modes clair/sombre.
- [Apple — Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/) : séparation entre contenu et commandes flottantes, regroupement par fonction et usage précis de la couleur.
- [Apple — Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) : formes tactiles et adaptation du matériau au contexte. Le projet utilise une transparence CSS discrète, sans prétendre reproduire le matériau natif Apple.
