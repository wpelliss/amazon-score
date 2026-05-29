/**
 * AmazonChooser — Scoring engine
 *
 * Moyenne pondérée de 3 facteurs, chacun noté sur 10 :
 *   score = noteScore × 50% + avisScore × 30% + prixScore × 20%
 *
 * Chaque facteur suit des paliers avec interpolation lisse.
 */
window.AC = window.AC || {};

AC.scoring = (() => {

  /**
   * Interpolation linéaire par paliers.
   * tiers = [[seuil, score], ...] trié par seuil croissant.
   */
  function interpolate(value, tiers) {
    if (value <= tiers[0][0]) return tiers[0][1];
    for (let i = 1; i < tiers.length; i++) {
      if (value <= tiers[i][0]) {
        const [x0, y0] = tiers[i - 1];
        const [x1, y1] = tiers[i];
        const t = (value - x0) / (x1 - x0);
        return y0 + t * (y1 - y0);
      }
    }
    return tiers[tiers.length - 1][1];
  }

  /**
   * Note /5 → score /10
   * <4.0  Médiocre (0-2)
   * 4.0+  Acceptable (5-8)
   * 4.5+  Super (8-10)
   * 4.7+  Parfait (10)
   */
  function ratingScore(rating) {
    if (rating < 4.0) return interpolate(rating, [[3.0, 0], [3.99, 2]]);
    if (rating < 4.5) return interpolate(rating, [[4.0, 5], [4.49, 7.9]]);
    if (rating < 4.7) return interpolate(rating, [[4.5, 8], [4.69, 9.9]]);
    return 10;
  }

  /**
   * Nombre d'avis → score /10
   * <50    Médiocre (0-3)
   * 50+    Moyen (4)
   * 100+   Bien (6)
   * 300+   Super (8)
   * 1000+  Parfait (10)
   */
  function reviewsScore(count) {
    return interpolate(count, [
      [0,     0],
      [50,    4],
      [100,   6],
      [300,   8],
      [1000, 10],
      [10000, 10],
    ]);
  }

  /**
   * Prix → score /10
   * <30€   Médiocre (0-3)
   * 30€+   Moyen (5)
   * 40€+   Qualité (7)
   * 100€+  Parfait (10)
   */
  function priceScore(price) {
    return interpolate(price, [
      [5,    1],
      [30,   5],
      [40,   7],
      [100, 10],
      [1000, 10],
    ]);
  }

  // Poids
  const W_RATING  = 0.50;
  const W_REVIEWS = 0.30;
  const W_PRICE   = 0.20;

  function computeScore(rating, reviewCount, price) {
    const score = ratingScore(rating) * W_RATING
                + reviewsScore(reviewCount) * W_REVIEWS
                + priceScore(price) * W_PRICE;
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Rareté par seuils absolus
   */
  const RARITIES = [
    { min: 9,  label: "Parfait",      key: "legendary" },
    { min: 8,  label: "Exceptionnel", key: "epic" },
    { min: 7,  label: "Bon",          key: "rare" },
    { min: 5,  label: "Moyen",        key: "common" },
    { min: 3,  label: "Mauvais",      key: "trash" },
    { min: -Infinity, label: "A jeter", key: "garbage" },
  ];

  function getRarity(score) {
    for (const r of RARITIES) {
      if (score >= r.min) return r;
    }
    return RARITIES[RARITIES.length - 1];
  }

  function assignRarities(products) {
    for (const p of products) {
      if (p.score == null) {
        p.rarity = getRarity(-1);
        continue;
      }
      p.rarity = getRarity(p.score);
    }
  }

  return { computeScore, getRarity, assignRarities, ratingScore, reviewsScore, priceScore };
})();
