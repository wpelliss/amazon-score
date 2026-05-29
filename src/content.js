/**
 * AmazonChooser v2.0 — Point d'entrée
 *
 * - Bestsellers : scroll invisible pour charger tous les produits, puis scoring
 * - Produit : attente que les éléments de notation soient chargés, puis scoring
 * - Recherche : scoring direct
 * - MutationObserver pour les chargements dynamiques
 */
(() => {
  let running = false;
  let observer = null;

  function run() {
    if (running) return;
    running = true;

    try {
      const { pageType, products } = AC.parser.parseProducts();
      if (!pageType || products.length === 0) return;

      if (observer) observer.disconnect();
      AC.ui.renderBadges(products);
      AC.ui.sortProducts(pageType, products);
      startObserver();
    } finally {
      running = false;
    }
  }

  function startObserver() {
    const target = document.querySelector(
      '.s-main-slot, #zg-right-col, #zg_browseRoot, #gridItemRoot, #dp-container, #ppd'
    );
    if (target && !observer) {
      observer = new MutationObserver(() => {
        clearTimeout(observer._debounce);
        observer._debounce = setTimeout(run, 800);
      });
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  /**
   * Page produit : attend que #acrPopover existe (chargé en différé par Amazon).
   * Tente toutes les 200ms, max 3s, puis lance le scoring avec ce qui est dispo.
   */
  function waitForProductData() {
    return new Promise(resolve => {
      let attempts = 0;
      const maxAttempts = 15; // 15 × 200ms = 3s max

      const check = () => {
        attempts++;
        const hasRating = document.querySelector('#acrPopover, #averageCustomerReviews .a-icon-alt');
        if (hasRating || attempts >= maxAttempts) {
          resolve();
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });
  }

  /**
   * Scroll invisible pour forcer le lazy loading Amazon (bestsellers).
   */
  function invisibleScroll() {
    return new Promise(resolve => {
      const savedScroll = window.scrollY;

      // Screenshot figé de la page en fond
      const snapshot = document.documentElement.cloneNode(true);
      snapshot.querySelectorAll('script, style, link').forEach(el => el.remove());
      snapshot.style.cssText = `
        position: absolute; top: -${savedScroll}px; left: 0; width: 100%;
        pointer-events: none;
      `;

      // Overlay : snapshot + voile assombri + loader
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        z-index: 999999; overflow: hidden;
      `;
      overlay.appendChild(snapshot);

      const dimmer = document.createElement('div');
      dimmer.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.35);
        display: flex; align-items: center; justify-content: center;
      `;

      const loaderBox = document.createElement('div');
      loaderBox.style.cssText = `
        background: white; border-radius: 12px; padding: 28px 36px;
        display: flex; flex-direction: column; align-items: center; gap: 14px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      `;

      const spinner = document.createElement('div');
      spinner.style.cssText = `
        width: 36px; height: 36px; border: 3px solid #e0e0e0;
        border-top-color: #c45200; border-radius: 50%;
      `;

      const label = document.createElement('span');
      label.style.cssText = `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px; color: #555; font-weight: 500;
      `;
      label.textContent = 'Analyse des produits…';

      let angle = 0;
      const spinInterval = setInterval(() => {
        angle = (angle + 12) % 360;
        spinner.style.transform = `rotate(${angle}deg)`;
      }, 25);

      loaderBox.appendChild(spinner);
      loaderBox.appendChild(label);
      dimmer.appendChild(loaderBox);
      overlay.appendChild(dimmer);
      document.body.appendChild(overlay);

      const step = Math.floor(window.innerHeight * 0.8);
      let passes = 0;
      const maxPasses = 3;

      function scrollPass() {
        return new Promise(done => {
          let position = 0;
          const interval = setInterval(() => {
            const maxH = document.body.scrollHeight;
            if (position < maxH) {
              position += step;
              window.scrollTo(0, position);
            } else {
              clearInterval(interval);
              setTimeout(done, 500);
            }
          }, 100);
        });
      }

      (async () => {
        let prevHeight = 0;
        while (passes < maxPasses) {
          await scrollPass();
          passes++;
          const newHeight = document.body.scrollHeight;
          if (newHeight <= prevHeight) break;
          prevHeight = newHeight;
        }

        window.scrollTo(0, savedScroll);
        clearInterval(spinInterval);
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 300);
      })();
    });
  }

  // --- Lancement selon le type de page ---
  const pageType = AC.parser.detectPageType();

  if (pageType === 'bestsellers') {
    invisibleScroll().then(() => {
      run();
    });
  } else if (pageType === 'product') {
    // Attendre que le bloc notation soit chargé par Amazon
    waitForProductData().then(() => {
      run();
    });
  } else {
    run();
  }
})();
