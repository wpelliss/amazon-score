# AmazonScore

**v2.2** — Extension Chrome qui évalue et trie les produits Amazon.fr par qualité.

## Fonctionnement

La rareté est déterminée directement par des seuils combinés **note + nombre d'avis** :

| Rareté | Note min | Avis min |
|---|---|---|
| Parfait | ≥ 4.7 | ≥ 100 |
| Exceptionnel | ≥ 4.5 | ≥ 100 |
| Bon | ≥ 4.0 | ≥ 100 |
| Moyen | ≥ 4.0 | ≥ 50 |
| Mauvais | ≥ 4.0 | ≥ 10 |
| A jeter | tout le reste | — |

Le tooltip affiche note, nombre d'avis, prix, et indique le prochain palier atteignable.
Si note ET avis sont indisponibles, le badge affiche `— (N/A)` en gris.

## Pages supportées

- **Recherche** (`/s`) : badge sur chaque résultat
- **Meilleures ventes** (`/bestsellers`, `/gp/bestsellers`) : bouton de déclenchement → scroll invisible + tri par rareté puis avis
- **Fiche produit** (`/dp/`, `/gp/product/`) : badge inline à côté des étoiles + lien "Top des ventes · Catégorie"

## Architecture (v2.2)

```
src/
├── manifest.json   Manifest V3
├── scoring.js      Seuils de rareté note+avis, hint prochain palier
├── parser.js       Extraction DOM (note / avis / prix, fallbacks multi-sélecteurs)
├── ui.js           Rendu badges + tooltips + tri bestsellers + lien Top des ventes
└── content.js      Point d'entrée (détection page, bouton trigger, MutationObserver)
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
