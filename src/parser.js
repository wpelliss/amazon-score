/**
 * AmazonChooser — DOM parser
 *
 * Extrait note, nb avis et prix de chaque produit sur la page.
 * Sélecteurs multiples avec fallbacks pour résister aux changements DOM Amazon.
 */
window.AC = window.AC || {};

AC.parser = (() => {
  // --- Regex patterns ---
  const RATING_REGEX = /(\d)[.,](\d)\s*sur\s*5/;

  // --- Helpers ---

  function extractNumber(text) {
    if (!text) return null;
    // Gérer "4,7 k" / "4.7k" / "12,3 k" → 4700, 12300
    const kMatch = text.match(/(\d+)[.,]?(\d*)\s*k/i);
    if (kMatch) {
      const whole = parseInt(kMatch[1]);
      const frac = kMatch[2] ? parseInt(kMatch[2]) : 0;
      return whole * 1000 + frac * 100;
    }
    const cleaned = text.replace(/[\s.\u00a0()]/g, '');
    const num = parseInt(cleaned);
    return (!isNaN(num) && num > 0) ? num : null;
  }

  function extractRating(text) {
    if (!text) return null;
    // Direct numeric
    const num = parseFloat(text.replace(',', '.'));
    if (!isNaN(num) && num >= 1 && num <= 5) return num;
    // Regex "X,Y sur 5"
    const match = text.match(RATING_REGEX);
    if (match) return parseInt(match[1]) + parseInt(match[2]) / 10;
    return null;
  }

  function extractPrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[€$£\s\u00a0]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return (!isNaN(num) && num > 0) ? num : null;
  }

  // --- Page produit : extracteurs ciblés sur les IDs stables ---

  function parseProductPage() {
    const el = document.getElementById('dp-container') || document.getElementById('ppd');
    if (!el) return null;

    // Note : bloc #averageCustomerReviews ou #acrPopover
    const rating = extractRating(
      document.querySelector('#acrPopover')?.getAttribute('title')
      || document.querySelector('#averageCustomerReviews .a-icon-alt')?.textContent
      || document.querySelector('#acrPopover .a-icon-alt')?.textContent
    );

    // Nombre d'avis : #acrCustomerReviewText ("3 902 évaluations")
    const reviewCount = extractNumber(
      document.querySelector('#acrCustomerReviewText')?.textContent
    );

    // Prix : input hidden en priorité (toujours dans le HTML initial),
    // puis blocs de prix classiques en fallback
    const priceInput = document.querySelector('#twister-plus-price-data-price')?.value;
    const price = (priceInput && parseFloat(priceInput)) || extractPrice(
      document.querySelector('#corePrice_feature_div .a-price .a-offscreen')?.textContent
      || document.querySelector('.apex-pricetopay-value .a-offscreen')?.textContent
      || document.querySelector('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen')?.textContent
      || document.querySelector('#priceblock_ourprice')?.textContent
      || document.querySelector('#priceblock_dealprice')?.textContent
      || document.querySelector('#price_inside_buybox')?.textContent
    );

    if (rating == null && reviewCount == null && price == null) return null;

    const score = (rating != null && reviewCount != null && price != null)
      ? AC.scoring.computeScore(rating, reviewCount, price)
      : null;

    return { el, rating, reviewCount, price, score, originalRank: 0, isProductPage: true };
  }

  // --- Pages liste : extracteurs génériques par élément ---

  function parseRating(el) {
    const sources = [
      () => el.querySelector('[data-rating]')?.getAttribute('data-rating'),
      () => el.querySelector('.a-icon-alt')?.textContent,
      () => el.querySelector('[aria-label*="sur 5"]')?.getAttribute('aria-label'),
    ];
    for (const src of sources) {
      const result = extractRating(src());
      if (result != null) return result;
    }
    return null;
  }

  function parseReviewCount(el) {
    const sources = [
      () => el.querySelector('[data-reviews]')?.getAttribute('data-reviews'),
      () => el.querySelector('.a-size-base.s-underline-text')?.textContent,
      () => {
        const links = el.querySelectorAll('a[href*="#customerReviews"]');
        for (const link of links) {
          const text = link.textContent.replace(/[\s.\u00a0]/g, '');
          const match = text.match(/^(\d+)/);
          if (match && parseInt(match[1]) > 10) return match[1];
        }
        return null;
      },
      () => el.querySelector('.a-size-small .a-link-normal')?.textContent,
      () => {
        const spans = el.querySelectorAll('span.a-size-base, span.a-size-small');
        for (const s of spans) {
          const cleaned = s.textContent.replace(/[\s.\u00a0]/g, '');
          if (/^\d+$/.test(cleaned) && parseInt(cleaned) > 0) return cleaned;
        }
        return null;
      },
    ];
    for (const src of sources) {
      const result = extractNumber(src());
      if (result != null) return result;
    }
    return null;
  }

  function parsePrice(el) {
    const sources = [
      () => el.querySelector('[data-a-price] .a-offscreen')?.textContent,
      () => el.querySelector('.a-price .a-offscreen')?.textContent,
      () => el.querySelector('.a-color-price')?.textContent,
      () => el.querySelector('[data-a-price]')?.getAttribute('data-a-price'),
    ];
    for (const src of sources) {
      const result = extractPrice(src());
      if (result != null) return result;
    }
    return null;
  }

  // --- Page detection ---

  function detectPageType() {
    const path = window.location.pathname;
    if (path === '/s' || path.startsWith('/s?') || path.startsWith('/s/')) return 'search';
    if (path.includes('/dp/') || path.includes('/gp/product/')) return 'product';
    if (path.includes('/bestsellers') || path.includes('/gp/bestsellers')) return 'bestsellers';
    return null;
  }

  // --- Product extraction ---

  function getProductElements(pageType) {
    let elements = [];

    if (pageType === 'search') {
      elements = [...document.querySelectorAll(
        '[data-component-type="s-search-result"], .s-result-item[data-asin]'
      )];
    } else if (pageType === 'bestsellers') {
      const selectors = [
        '#gridItemRoot [data-asin]',
        '[id^="p13n-asin-"]',
        '.zg-grid-general-faceout',
        '.p13n-sc-uncoverable-faceout',
      ];
      for (const sel of selectors) {
        elements = [...document.querySelectorAll(sel)];
        if (elements.length > 0) break;
      }
    }

    return elements.filter(el =>
      !elements.some(other => other !== el && el.contains(other))
    );
  }

  function parseProducts() {
    const pageType = detectPageType();
    if (!pageType) return { pageType: null, products: [] };

    const products = [];

    if (pageType === 'product') {
      // Page produit : extracteurs dédiés, pas de querySelector générique
      const product = parseProductPage();
      if (product) products.push(product);
    } else {
      // Pages liste : parsing par élément
      const elements = getProductElements(pageType);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const rating = parseRating(el);
        const reviewCount = parseReviewCount(el);
        const price = parsePrice(el);

        if (rating == null && reviewCount == null && price == null) continue;

        const score = (rating != null && reviewCount != null && price != null)
          ? AC.scoring.computeScore(rating, reviewCount, price)
          : null;

        products.push({ el, rating, reviewCount, price, score, originalRank: i });
      }
    }

    AC.scoring.assignRarities(products);
    return { pageType, products };
  }

  return { parseProducts, detectPageType };
})();
