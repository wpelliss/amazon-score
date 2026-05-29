/**
 * AmazonScore — UI rendering
 *
 * Injecte les badges de rareté et les tooltips dans le DOM Amazon.
 * Gère le tri sur les pages bestsellers.
 */
window.AC = window.AC || {};

AC.ui = (() => {

  /**
   * Trouve le lien meilleures ventes le plus spécifique sur la page produit.
   * Cherche d'abord dans .zg_hrsr (sous-catégorie), prend le DERNIER item de la liste.
   * Fallback sur le lien principal ref=pd_zg_ts_.
   */
  function findBestsellersLink() {
    // Stratégie 1 : chercher tout lien avec un nodeId numérique dans le chemin
    // Format cible : /gp/bestsellers/hi/2677581031 (nodeId = 5+ chiffres)
    const nodePattern = /\/gp\/bestsellers\/([^\/\?#]+)\/(\d{5,})/;
    const allLinks = [...document.querySelectorAll('a[href*="/gp/bestsellers/"]')];
    const specificLinks = allLinks.filter(a => nodePattern.test(a.pathname));

    if (specificLinks.length > 0) {
      // Le dernier = sous-catégorie la plus spécifique (Amazon liste du général au spécifique)
      const link = specificLinks[specificLinks.length - 1];
      const match = link.pathname.match(nodePattern);
      const category = link.textContent.trim();
      const container = link.closest('li, .a-list-item, span.a-list-item');
      const rankText = container ? container.textContent : '';
      const rankMatch = rankText.match(/[#nN°°]\s*(\d+)/);
      return {
        url: `https://www.amazon.fr/gp/bestsellers/${match[1]}/${match[2]}`,
        rank: rankMatch ? parseInt(rankMatch[1]) : null,
        category,
      };
    }

    // Stratégie 2 : fallback .zg_hrsr (structure ancienne)
    const zgItems = [...document.querySelectorAll('.zg_hrsr li .a-list-item')];
    if (zgItems.length > 0) {
      const subItem = zgItems[zgItems.length - 1];
      const link = subItem.querySelector('a[href*="/bestsellers/"]');
      const text = subItem.textContent.trim();
      const rankMatch = text.match(/(\d+)\s*en\s*/);
      if (link && rankMatch) {
        return {
          url: link.href,
          rank: parseInt(rankMatch[1]),
          category: link.textContent.trim(),
        };
      }
    }

    // Stratégie 3 : catégorie principale sans nodeId (dernier recours)
    const mainLink = document.querySelector('a[href*="/gp/bestsellers/"][href*="ref=pd_zg_ts_"]');
    if (mainLink) {
      const container = mainLink.closest('.a-list-item');
      if (container) {
        const text = container.textContent;
        const rankMatch = text.match(/(\d+)\s*en\s+([^(]+)/);
        if (rankMatch) {
          return {
            url: mainLink.href,
            rank: parseInt(rankMatch[1]),
            category: rankMatch[2].trim(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Crée un noeud div de ligne pour le tooltip via DOM API (pas innerHTML).
   */
  function createTooltipLine(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div;
  }

  /**
   * Crée le badge DOM pour un produit.
   * Gère le cas score null (product.rarity === null) → badge ac-unknown.
   */
  function createBadge(product) {
    const { rarity, rating, reviewCount, price, score } = product;

    const badge = document.createElement('div');
    badge.title = 'AmazonScore';

    // Cas score null : badge neutre sans tooltip de scores
    if (rarity === null) {
      badge.className = 'ac-badge ac-unknown';
      const label = document.createElement('span');
      label.className = 'ac-label';
      label.textContent = '— (N/A)';
      badge.appendChild(label);
      return badge;
    }

    badge.className = `ac-badge ac-${rarity.key}`;

    // Label principal avec affordance tooltip
    const label = document.createElement('span');
    label.className = 'ac-label';
    label.textContent = `ℹ ${rarity.label}`;
    badge.appendChild(label);

    // Tooltip : note brute + avis + prix + hint prochain palier
    const tooltip = document.createElement('div');
    tooltip.className = 'ac-tooltip';

    if (rating != null) {
      tooltip.appendChild(createTooltipLine(`Note : ${rating.toFixed(1)} / 5`));
    }
    if (reviewCount != null) {
      const hint = AC.scoring.getAvisHint(rating, reviewCount);
      const hintText = hint ? ` (+${hint.gap} pour ${hint.nextLabel})` : '';
      tooltip.appendChild(createTooltipLine(`Avis : ${reviewCount.toLocaleString('fr-FR')}${hintText}`));
    }
    if (price != null) {
      tooltip.appendChild(createTooltipLine(`Prix : ${price.toFixed(2)} €`));
    }

    badge.appendChild(tooltip);

    // Tooltip flip : détection de débordement après insertion dans le DOM
    badge.addEventListener('mouseenter', () => {
      // Rendre visible pour mesurer (display: block transitoire via classe)
      tooltip.style.visibility = 'hidden';
      tooltip.style.display = 'block';

      const rect = tooltip.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Flip horizontal : débordement à droite
      if (rect.right > vw) {
        tooltip.classList.add('ac-tooltip--flip-x');
      } else {
        tooltip.classList.remove('ac-tooltip--flip-x');
      }

      // Flip vertical : débordement en bas
      if (rect.bottom > vh) {
        tooltip.classList.add('ac-tooltip--flip-y');
      } else {
        tooltip.classList.remove('ac-tooltip--flip-y');
      }

      tooltip.style.visibility = '';
      tooltip.style.display = '';
    });

    return badge;
  }

  function renderBadges(products) {
    for (const product of products) {
      // Eviter les doublons : marqueur sur l'élément
      if (product.el.hasAttribute('data-ac-done')) continue;
      product.el.setAttribute('data-ac-done', '1');

      // Accepter rarity === null (score null) — badge ac-unknown quand même
      // On skip uniquement si rarity est undefined (produit non analysé)
      if (product.rarity === undefined) continue;

      const badge = createBadge(product);

      // Clé de tri : rareté en priorité, puis nombre d'avis en tiebreaker
      const RARITY_LEVEL = { legendary: 5, epic: 4, rare: 3, common: 2, trash: 1, garbage: 0 };
      const rarityLevel = product.rarity ? (RARITY_LEVEL[product.rarity.key] ?? -1) : -1;
      const sortKey = rarityLevel * 1000000 + (product.reviewCount || 0);
      product.el.setAttribute('data-ac-score', sortKey);
      product.el.setAttribute('data-ac-rank', product.originalRank);

      // Insertion selon le type de page
      if (product.isProductPage) {
        // Page produit : badge + lien bestsellers inline à côté des étoiles
        badge.classList.add('ac-badge-inline');

        const wrapper = document.createElement('div');
        wrapper.className = 'ac-product-wrapper';
        wrapper.appendChild(badge);

        // Lien vers la page meilleures ventes de la catégorie
        const bsLink = findBestsellersLink();
        if (bsLink) {
          const link = document.createElement('a');
          link.href = bsLink.url;
          link.className = 'ac-badge-inline ac-bestseller-link';
          link.textContent = `#${bsLink.rank} ${bsLink.category}`;
          link.title = `Voir les meilleures ventes en ${bsLink.category}`;
          wrapper.appendChild(link);
        }

        const anchor = document.querySelector('#averageCustomerReviews, #titleSection');
        if (anchor) {
          anchor.style.display = 'flex';
          anchor.style.alignItems = 'center';
          anchor.style.flexWrap = 'wrap';
          anchor.style.gap = '8px';
          anchor.appendChild(wrapper);
        } else {
          product.el.prepend(wrapper);
        }
      } else {
        // Pages liste : badge en overlay coin supérieur gauche
        product.el.style.position = product.el.style.position || 'relative';
        product.el.appendChild(badge);
      }
    }
  }

  function sortProducts(pageType, products) {
    if (pageType !== 'bestsellers') return;

    const scored = products.filter(p => p.score != null && p.el.parentNode);
    if (scored.length < 2) return;

    function findSortableLevel() {
      let current = scored[0].el;
      while (current.parentNode && current.parentNode !== document.body) {
        const parent = current.parentNode;
        const children = [...parent.children];
        const withScore = children.filter(
          child => child.querySelector('[data-ac-score]') || child.hasAttribute('data-ac-score')
        );
        if (withScore.length >= 2) return parent;
        current = parent;
      }
      return null;
    }

    const container = findSortableLevel();
    if (!container) return;

    const sortable = [...container.children].filter(
      child => child.querySelector('[data-ac-score]') || child.hasAttribute('data-ac-score')
    );

    sortable
      .sort((a, b) => {
        const scoreOf = el => parseFloat(
          el.getAttribute('data-ac-score') ||
          el.querySelector('[data-ac-score]')?.getAttribute('data-ac-score') || '-1'
        );
        const rankOf = el => parseFloat(
          el.getAttribute('data-ac-rank') ||
          el.querySelector('[data-ac-rank]')?.getAttribute('data-ac-rank') || '0'
        );
        const diff = scoreOf(b) - scoreOf(a);
        if (Math.abs(diff) < 0.001) return rankOf(a) - rankOf(b);
        return diff;
      })
      .forEach(item => container.appendChild(item));
  }

  return { renderBadges, sortProducts };
})();
