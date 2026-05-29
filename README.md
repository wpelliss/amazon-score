# AmazonScore - Score Qualité Amazon

**Statut : Terminé (v2.0)**

Extension Chrome qui score et trie les produits Amazon.fr par qualité.

**Sources** : `../amazon-score/src/`

## Formule
```
score_brut = (note_étoiles_décimale) × nombre_avis × prix / 100000
score_final = percentile du score_brut sur la page (0-100%)
```
Catégories RPG : Déchet (≤0) | Ordinaire (>0) | Rare (≥50%) | Épique (≥75%) | Légendaire (≥95%)

## Pages supportées
- `/s` (recherche) : `.s-result-list` | `/gp` (meilleures ventes) : `#zg-right-col`

## Analyse du code actuel (content.js, 127 lignes)

### Bugs critiques
1. **Boucle dupliquée** : parcours identique 2 fois (1 pour scores, 1 pour affichage) → fusionner
2. **`liste.sort()` dans la boucle** : tri recalculé à chaque itération → sortir avant la boucle
3. **Parsing note fragile** : `note[0]+note[2]` lit des chars ASCII → utiliser parseFloat/regex
4. **Parsing prix fragile** : cascade de split('&nbsp;',',','€','>') → regex unique
5. **jQuery pour 3 lignes** : le tri final → remplacer par Array.from + sort + append
6. **Pas de MutationObserver** : contenu dynamique/pagination non détecté
7. **Aucune gestion d'erreur** : crash silencieux si élément manquant

### Architecture à refaire
- `window.onload` → observer 2 étages de chrome-utils.js (comme PDB Score et SenscritiqueLovemeter)
- Sélecteurs hardcodés → `ExtractionRegistry` avec fallback chain (si Amazon change le DOM, le tier suivant prend le relais)
- Code procédural → fonctions claires (extractData, calcScore, renderScore, sortProducts)

## Plan de finalisation

### Phase 1 — Réécriture du content.js
- [ ] Supprimer jQuery, tout en vanilla JS
- [ ] Parsing robuste : utiliser `parseNumber()` de chrome-utils.js
- [ ] Boucle unique : extraire données → calculer scores → trier → afficher
- [ ] `ExtractionRegistry` de chrome-utils.js pour les sélecteurs (fallback chain si Amazon change le DOM)
- [ ] `createTwoStageObserver` de chrome-utils.js pour le contenu dynamique/pagination
- [ ] Try/catch sur chaque produit (skip silencieux si données manquantes)

### Phase 2 — Fonctionnalités
- [ ] Popup options : seuils de couleurs personnalisables, pondérations note/avis/prix
- [ ] Support multi-domaines : amazon.com, .de, .es, .it (adapter sélecteurs + format prix)
- [ ] Badge sur l'icône extension avec le nombre de produits scorés
- [ ] chrome.storage.sync pour sauvegarder les préférences

### Phase 3 — Publication
- [ ] Page Chrome Web Store (description, screenshots)
- [ ] Icônes propres (SVG)

## Source
[_archives/sources/AmazonChooser/](../_archives/sources/AmazonChooser/)
