# AmazonScore — Analyse Critique

> Générée le 2026-05-30 par workflow multi-agents (56 agents, 3 phases de recherche web + 10 analystes spécialisés + 4 profils clients + 3 itérations de validation)

## Executive Summary

Le projet est fonctionnel et architecturalement propre pour un dev solo sans bundler. L'ordre de chargement, le zéro-dépendance, les fallbacks multi-sélecteurs et le debounce MutationObserver sont des décisions correctes. Deux problèmes fondamentaux coexistent : un bug fonctionnel silencieux (l'observer n'est jamais recréé après le premier run, ce qui prive l'outil de sa fonction principale sur les pages à scroll infini) et une erreur de conception avérée (le facteur prix favorise structurellement les produits chers, ce qui inverse l'utilité du tri bestsellers). Ces deux points méritent correction même pour un usage purement personnel. Tout le reste — XSS théorique, overlay anxiogène, accessibilité, publication CWS — est conditionnel à des décisions non prises.

---

## Tenants et aboutissants

**Forces réelles**

L'architecture est la bonne pour ce contexte : 4 modules à responsabilité unique, ordre de chargement explicite, aucune dépendance externe. Le pattern de fallbacks ordonnés dans parser.js (data-attribute > sélecteur stable > sélecteur fragile) est la stratégie correcte face aux A/B tests Amazon. La garde `data-ac-done` est posée avant tout travail DOM. Le clamp `Math.max(0, Math.min(10, score))` est une valeur de sécurité correcte. `invisibleScroll()` nettoie dans tous les cas. Le tiebreaker bestsellers par rang Amazon est logiquement juste.

**Limites fondamentales**

Ce projet est calibré pour l'électronique grand public. Le priceScore en paliers absolus produit des résultats cohérents dans ce contexte précis et non ailleurs. Sur une recherche qui mélange livres, câbles et SSD, le score est faussé par construction — pas par un bug, par un choix de design. Le projet peut rester dans cet état si l'usage est exclusivement l'électronique. Dès que le périmètre s'étend (livres, alimentaire, équipement sport), le score ment structurellement.

**Positionnement réel**

Fakespot est fermé. RateBud existe mais cible le grand public anglophone. Sur amazon.fr, le vacuum est réel. Le tooltip décomposé (contribution par facteur) est genuinement différenciant — c'est la seule feature qui n'existe nulle part ailleurs sur ce marché. Si la décision de publication change un jour, ce différenciateur est le bon angle d'attaque, pas le score en lui-même.

---

## Problèmes par priorité

### Critiques (bloquants pour usage fiable)

**Bug observer — recréation silencieusement impossible**
Cause racine : `observer.disconnect()` ligne 21 de content.js sans `observer = null`. La condition `if (target && !observer)` dans `startObserver()` est donc toujours false après le premier run. L'observer est déconnecté et jamais recréé. Les produits chargés dynamiquement après la première passe (scroll infini sur /s, chargement lazy sur bestsellers) ne sont jamais scorés. Bug silencieux — visuellement tout semble fonctionner, mais la moitié de l'utilité disparaît sur les pages longues.
Correction : ajouter `observer = null` après `observer.disconnect()` à la ligne 21. Remplacer `observer._debounce` par `let debounceTimer = null` dans la closure. 3 lignes.

**Formule prix — biais structurel inversé**
`priceScore(8) = 1.48`, `priceScore(100) = 10`. Le facteur prix représente 20% du score final et avantage structurellement les produits chers. L'effet est amplifié sur la page bestsellers : le tri par score remonte mécaniquement les produits 80-150€ et enterre les bons petits prix, produisant exactement l'inverse de ce qu'un outil d'aide à la décision devrait faire. Le vrai problème n'est pas que le score soit légèrement biaisé — c'est que le tri bestsellers amplifie le biais en réorganisant activement la page.

**score=null → rarity='A jeter' sur données partiellement absentes**
Deux chemins distincts produisent ce résultat :
- **(A) Prix absent sur pages liste** (produit avec sélection de taille, bundle) : `parseProducts()` retourne `price=null`, `score=null`, `getRarity(-1)` → 'A jeter'. Un produit 4.8★ / 3000 avis est affiché 'A jeter' uniquement parce qu'Amazon masque son prix.
- **(B) Timeout `waitForProductData()` sur page produit** : si `#acrPopover` ne charge pas en 3s (15 × 200ms), `resolve()` est appelé, `run()` s'exécute avec `rating=null`, `score=null` → 'A jeter' sur la page produit. Connexion lente ou A/B test Amazon peuvent déclencher ce cas silencieusement.

### Importants (dégradent l'expérience)

**Tooltip overflow viewport**
`.ac-tooltip` est positionné `top: calc(100% + 6px)` sans détection de débordement bas d'écran. Sur les badges en bas de grille — cas courant sur toute page /s avec plus d'une rangée — le tooltip est systématiquement tronqué ou invisible hors viewport. Débordement horizontal identique : `white-space: nowrap` + `left: 0` sans contrainte de largeur.
Fix : détecter `getBoundingClientRect()` du badge et basculer en `bottom: calc(100% + 6px)` si `badge.getBoundingClientRect().bottom + tooltipHeight > window.innerHeight`. ~10 lignes.

**innerHTML tooltip — structurellement incorrect**
`tooltip.innerHTML = lines.join('<br>')` avec des données issues du DOM Amazon. En pratique le vecteur XSS est quasi-nul (les parsers retournent des Number, `toFixed()` ne peut pas produire du HTML). Mais l'analyse statique de Google pour le CWS flagge `innerHTML` sur des variables non-littérales. Si la publication devient un objectif, c'est un rejet automatique.
Fix : `lines.forEach(line => { const div = document.createElement('div'); div.textContent = line; tooltip.appendChild(div); })`. 5 lignes, zéro régression.

**spinInterval leak en cas d'exception dans scrollPass()**
Le bloc async de `invisibleScroll()` (content.js lignes 147-165) n'a pas de try/catch. Si `scrollPass()` lève une exception, `clearInterval(spinInterval)` et `overlay.remove()` ne sont jamais atteints. L'overlay reste figé indéfiniment — récupération uniquement par rechargement de page.
Fix : wrapper le bloc async en try/catch avec cleanup dans le catch. 5 lignes.

**Overlay bestsellers — UX anxiogène**
Le voile sombre `rgba(0,0,0,0.35)` + z-index 999999 + spinner pendant 5-10s est la signature visuelle d'une attaque phishing pour tout utilisateur non-initié. Correction minimale : remplacer `'Analyse des produits…'` par `'AmazonScore analyse les produits…'` (1 ligne). Correction complète : bandeau localisé non-bloquant dans `#zg-right-col` — refactoring non trivial.

**Attribution manquante sur le badge**
Aucun élément visuel ne relie 'Bon (7.3/10)' à AmazonScore. Pour tout utilisateur qui n'a pas installé l'extension lui-même, l'hypothèse première est bug Amazon ou phishing. Un `title='AmazonScore'` sur le badge résout le problème en 1 attribut.

**Affordance tooltip absente**
Rien n'indique que le badge est interactif. La valeur différenciante principale (le tooltip décomposé) est découverte par accident. Ajouter `cursor: pointer` + un indicateur `ℹ` dans le label coûte 3 lignes.

**Bug `extractNumber()` sur deux décimales avec 'k'**
`'4,75k'` donne `kMatch[2]='75'`, formule `frac*100` retourne `11500` au lieu de `4750`. Amazon n'utilise pas ce format aujourd'hui, mais c'est une bombe à retardement.
Formule correcte : `Math.round((whole + parseFloat('0.' + kMatch[2])) * 1000)`.

**`detectPageType()` — branche morte + branche non validée**
`path.startsWith('/s?')` est mort — `window.location.pathname` ne contient jamais le query string. La branche `/s/` est potentiellement valide sur certaines configurations Amazon régionales — ne pas supprimer sans validation préalable.

### Mineurs (nice-to-fix)

- `parseReviewCount()` fallback final : filtre `> 0` trop large, peut capturer des codes vendeur. Remplacer par `> 10`.
- `findSortableLevel()` : heuristique de remontée peut s'arrêter sur un container intermédiaire sur certaines pages bestsellers imbriquées.
- Libellé tooltip `(50%)` ambigu. Remplacer par `'Note (50% du score) : 4.7/5 → 9.4/10'`.
- Cohérence nomenclature : 'AmazonChooser' dans les commentaires vs 'AmazonScore' dans le manifest.
- `cloneNode(true)` sur `documentElement` : pic mémoire de 2-5 MB pendant toute la durée du scroll (~15s). Mesurable sur Chrome sous contrainte.
- Spinner via `setInterval` à 25ms → remplacer par `@keyframes` + `prefers-reduced-motion`.
- CSP absente du manifest : impact réel nul en MV3 sans popup ni background. Signal négatif pour un reviewer CWS uniquement.

---

## Questions ouvertes

**1. Quelle sémantique pour le score ?**
Le score mesure quoi : la qualité perçue (indépendante du prix), le rapport qualité/prix (pénaliser les chers si leur note ne le justifie pas), ou la probabilité d'achat satisfaisant ? Ces trois réponses conduisent à trois formules différentes. La formule actuelle n'est clairement aucune des trois.

**2. Score partiel quand un facteur manque — oui ou non ?**
Un produit 4.8★ / 3000 avis sans prix visible affiché 'A jeter' est un faux négatif destructeur. Un score partiel `~7.2/10` avec marqueur d'incertitude est plus honnête. Mais le `~` risque de créer de la confusion pour un utilisateur non-technique. Outil analytique (précision > simplicité) ou outil grand public (simplicité > précision) ?

**3. Overlay bestsellers : bloquer ou ne pas bloquer ?**
Le scroll invisible est fonctionnellement nécessaire. Remplacer l'overlay bloquant par un bandeau non-bloquant signifie que l'utilisateur peut cliquer sur un lien pendant les 3 passes — conflits potentiels. Les deux solutions ont des inconvénients réels.

**4. Labels de rareté : absolus ou relatifs par page ?**
Seuils absolus = cohérence inter-pages, prévisibilité. Seuils percentiles sur /s = pertinence comparative plus haute mais complexité significative (pass de collecte avant le pass de scoring). Ces deux modes sont architecturalement incompatibles sans refactoring de content.js.

**5. Publication CWS : vraiment jamais ?**
Le gap technique est anecdotique (innerHTML + CSP + privacy policy + renommage = une journée de travail). Le vrai blocage est la maintenance réactive post-publication — Amazon casse les sélecteurs sans prévenir, et il faudrait réagir vite pour éviter les reviews 1 étoile. Si cette contrainte est acceptable, la publication est envisageable.

---

## Retours clients synthétisés

**Ce que tous les profils ont en commun**

Personne ne comprend spontanément que le prix est un facteur positif dans le score. Zéro utilisateur sur les profils testés n'aurait deviné qu'un produit cher score mieux qu'un produit bon marché équivalent en note et avis. C'est le biais le plus universellement détecté et rejeté — même les power users analytiques le rejettent.

**Ce qui bloque les non-techniques**

L'overlay bestsellers est le point de désinstallation le plus immédiat : voile sombre + spinner + page figée = signature phishing. La découverte que les badges viennent d'une extension et non d'Amazon est un moment de friction non résolu. Le tooltip est découvert par accident — jamais de manière intentionnelle.

**Ce que les analytiques voient en premier**

Le biais prix est détecté immédiatement et invalide la confiance dans l'outil. L'effet composé formule prix + tri bestsellers est l'impact le plus concret : ce n'est pas juste un artefact de score individuel, c'est une réorganisation active de la page dans le mauvais sens sur les cas d'usage budget-sensibles.

**Ce qui est bien reçu sans réserve**

Le concept est perçu comme utile partout. Le tooltip décomposé (quand découvert) est considéré comme la feature la plus informative. Les labels textuels 'Parfait / Exceptionnel / Bon / Moyen / Mauvais / A jeter' sont compris sans ambiguïté — le vocabulaire RPG interne n'est pas visible et n'est donc pas un problème. 'A jeter' reste brutal pour un produit avec simplement peu d'avis, mais c'est le seul label contesté.

---

## Plan d'action révisé

### Si l'objectif est la publication Chrome Web Store

**Prérequis non négociables**

1. `innerHTML` → DOM API dans ui.js (5 lignes) — rejet automatique par analyse statique Google
2. Renommer l'extension : 'AmazonScore' utilise la marque Amazon dans un pattern que Google scrute. 'ShopScore' ou 'ScoreProduit' sont propres. Manifest + commentaires.
3. Privacy policy hébergée (GitHub Pages ou Gist raw) : une page, deux phrases, obligatoire depuis 2024 même sans collecte
4. Screenshots 1280x800 : minimum 1 requis, bloquant pour compléter la fiche
5. CSP explicite dans manifest.json (2 lignes)
6. Corriger la formule prix — parce qu'un outil qui classe les livres moins bien que les SSD va recevoir des reviews 1 étoile immédiates

**Effort estimé** : 1-2 journées. Délai de review Google : 2-3 semaines (review manuelle quasi-certaine sur extensions Amazon). Frais : 5 USD. Risque résiduel : maintenance réactive post-publication — Amazon casse ses sélecteurs DOM sans prévenir.

### Si l'objectif est l'outil personnel amélioré

Par ordre de retour sur investissement :

1. `observer = null` après `disconnect()` — **1 ligne**, bug fonctionnel direct sur toutes les pages à scroll infini. Impact immédiat sur l'usage quotidien.
2. Formule prix → 65/35 note/avis dans scoring.js — **5 lignes**. Supprimer `priceScore()` de `computeScore()`, passer `W_RATING` à 0.65 et `W_REVIEWS` à 0.35, garder le prix affiché dans le tooltip comme métadonnée informative. C'est la seule correction dont l'impact est visible à chaque usage.
3. Score partiel sur données manquantes — **~25 lignes** dans `parseProducts()` et `parseProductPage()`. Calculer sur les facteurs disponibles quand exactement 2/3 sont présents, marquer `isPartialScore: true`, afficher '~7.2/10' dans le badge.
4. Tooltip overflow viewport — **~10 lignes JS**. `getBoundingClientRect()` sur le badge + basculement conditionnel.
5. Attribution overlay — **1 ligne**. `'Analyse des produits…'` → `'AmazonScore analyse les produits…'`.
6. Affordance tooltip — **3 lignes**. `cursor: pointer` + indicateur `ℹ` dans le label.
7. `innerHTML` → DOM API — **5 lignes**. Anti-pattern structurel même hors CWS.
8. Libellé tooltip `(50%)` → `(50% du score)` — **3 occurrences, 1 ligne chacune**.

### Ce qui ne sera probablement jamais fait (et c'est OK)

- **Publication CWS** : le blocage est la maintenance réactive, pas les corrections techniques.
- **Support multi-domaines** : scope creep. Amazon.fr valide la proposition.
- **Popup options avec sliders** : sort du scope 'extension légère sans dépendances'.
- **Scoring catégoriel** : requiert les breadcrumbs de catégorie Amazon — une dépendance DOM supplémentaire potentiellement instable.
- **Seuils percentiles** : changement d'architecture non trivial, bénéfice marginal pour un usage solo.
- **Icônes SVG, badge sur l'icône, promotional tile** : pur polish.

---

## Recommandation finale

Deux corrections changent l'outil de manière mesurable sur l'usage quotidien et méritent une session de reprise : `observer = null` après `disconnect()` (1 ligne, bug silencieux qui prive l'extension de sa fonction principale sur les pages longues) et la suppression du facteur prix de `computeScore()` au profit d'une pondération 65/35 note/avis (5 lignes, le seul changement qui réconcilie le score avec sa promesse implicite). Ces deux corrections prennent une heure ensemble. Tout le reste est conditionnel : soit à une décision de publication qui n'est pas prise, soit à des cas d'usage grand public qui ne sont pas le contexte réel.

Le projet est dans un état propre pour ce qu'il est : un outil personnel de niche, bien architecturé, avec un différenciateur réel (le tooltip décomposé) et un défaut de conception assumé (le priceScore). Classé 'Projets terminés', c'est la bonne décision. Si Amazon casse son DOM et que les badges disparaissent, ça vaut une session de correctif. Si la décision de partager l'extension change un jour, les deux items CWS non-négociables sont le renommage (1h) et la privacy policy (30min) — le reste est de la propreté.

Ne pas se laisser convaincre par l'analyse que les 15 autres points ont la même urgence que les 2 premiers : ils n'ont pas.
