/**
 * AmazonChooser — Scoring engine
 *
 * Moyenne pondérée de 2 facteurs, chacun noté sur 10 :
 *   score = noteScore × 65% + avisScore × 35%
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

  // Poids
  const W_RATING  = 0.65;
  const W_REVIEWS = 0.35;

  function computeScore(rating, reviewCount) {
    const score = ratingScore(rating) * W_RATING
                + reviewsScore(reviewCount) * W_REVIEWS;
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Rareté par combinaison note min + avis min (ordre du meilleur au moins bon).
   */
  const RARITY_THRESHOLDS = [
    { noteMin: 4.7, avisMin: 100, label: "Parfait",      key: "legendary" },
    { noteMin: 4.5, avisMin: 100, label: "Exceptionnel", key: "epic"      },
    { noteMin: 4.0, avisMin: 100, label: "Bon",          key: "rare"      },
    { noteMin: 4.0, avisMin: 50,  label: "Moyen",        key: "common"    },
    { noteMin: 4.0, avisMin: 10,  label: "Mauvais",      key: "trash"     },
  ];

  const RARITY_GARBAGE = { label: "A jeter", key: "garbage" };

  function getRarityFromThresholds(rating, reviewCount) {
    if (rating == null || reviewCount == null) return null;
    for (const t of RARITY_THRESHOLDS) {
      if (rating >= t.noteMin && reviewCount >= t.avisMin) {
        return { label: t.label, key: t.key };
      }
    }
    return RARITY_GARBAGE;
  }

  /**
   * Retourne le prochain palier atteignable avec plus d'avis (note inchangée).
   * Ex : { nextLabel: "Bon", need: 100, gap: 23 }
   */
  function getAvisHint(rating, reviewCount) {
    if (rating == null || reviewCount == null) return null;
    // Parcourir du moins bon au meilleur parmi ceux que la note permet d'atteindre
    const reachable = RARITY_THRESHOLDS.filter(t => rating >= t.noteMin).reverse();
    for (const t of reachable) {
      if (reviewCount < t.avisMin) {
        return { nextLabel: t.label, need: t.avisMin, gap: t.avisMin - reviewCount };
      }
    }
    return null;
  }

  function assignRarities(products) {
    for (const p of products) {
      p.rarity = getRarityFromThresholds(p.rating, p.reviewCount);
    }
  }

  return { computeScore, assignRarities, getRarityFromThresholds, getAvisHint, ratingScore, reviewsScore };
})();
