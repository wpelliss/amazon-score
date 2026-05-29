# AmazonScore

Extension Chrome qui score et trie les produits Amazon.fr par qualité.

## Fonctionnement

Moyenne pondérée de 3 facteurs, chacun noté /10 :

```
score = note(50%) + avis(30%) + prix(20%)
```

**Note /5 → /10**
- < 4.0 : médiocre (0–2)
- 4.0–4.5 : acceptable (5–8)
- 4.5–4.7 : bien (8–10)
- ≥ 4.7 : parfait (10)

**Nombre d'avis → /10**
- < 50 : médiocre (0–4)
- 50–300 : moyen (4–8)
- ≥ 1000 : parfait (10)

**Prix → /10**
- < 30€ : médiocre (0–5)
- 30–100€ : moyen–bien (5–10)
- ≥ 100€ : parfait (10)

## Barème

| Score | Label |
|---|---|
| ≥ 9 | Parfait |
| ≥ 8 | Exceptionnel |
| ≥ 7 | Bon |
| ≥ 5 | Moyen |
| ≥ 3 | Mauvais |
| < 3 | A jeter |

## Pages supportées

- **Recherche** (`/s`) : badge sur chaque résultat
- **Meilleures ventes** (`/bestsellers`, `/gp/bestsellers`) : scroll invisible pour charger tous les produits, tri par score, lien vers la page meilleures ventes depuis une fiche produit
- **Fiche produit** (`/dp/`, `/gp/product/`) : badge inline à côté des étoiles, attente du chargement différé Amazon

## Architecture (v2.0)

```
src/
├── manifest.json   Manifest V3
├── scoring.js      Moteur de scoring (interpolation par paliers)
├── parser.js       Extraction DOM (note / avis / prix, fallbacks multi-sélecteurs)
├── ui.js           Rendu badges + tooltips + tri bestsellers
└── content.js      Point d'entrée (détection page, scroll invisible, MutationObserver)
```

Zéro dépendance, vanilla JS.

## Installation (non publié)

1. Cloner le repo
2. `chrome://extensions` → activer le mode développeur
3. "Charger l'extension non empaquetée" → sélectionner le dossier `src/`

## Roadmap

### Fonctionnalités
- [ ] Popup options : pondérations et seuils de couleurs personnalisables
- [ ] `chrome.storage.sync` pour persister les préférences
- [ ] Badge sur l'icône extension avec le nombre de produits scorés
- [ ] Support multi-domaines (amazon.com, .de, .es, .it)

### Publication
- [ ] Icônes SVG
- [ ] Page Chrome Web Store
