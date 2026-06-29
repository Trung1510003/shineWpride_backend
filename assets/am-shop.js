/**
 * Mobile filter drawer and sort handling for the Artistry shop page.
 */

function initAmShopFilters() {
  const sections = document.querySelectorAll('.am-shop-section');
  if (!sections.length) return;

  sections.forEach((section) => {
    if (section.dataset.amShopInit === 'true') return;
    section.dataset.amShopInit = 'true';

    const root = section.querySelector('[data-am-shop-filters]');
    const openButton = section.querySelector('[data-am-shop-open]');
    const closeElements = section.querySelectorAll('[data-am-shop-close]');
    const sortSelect = section.querySelector('[data-am-shop-sort]');
    const facetsForm = section.querySelector('facets-form-component');

    const openFilters = () => {
      if (!root) return;
      root.dataset.open = 'true';
      document.documentElement.classList.add('am-shop-filters-open');
    };

    const closeFilters = () => {
      if (!root) return;
      root.dataset.open = 'false';
      document.documentElement.classList.remove('am-shop-filters-open');
    };

    openButton?.addEventListener('click', openFilters);

    closeElements.forEach((element) => {
      element.addEventListener('click', closeFilters);
    });

    sortSelect?.addEventListener('change', () => {
      if (facetsForm && typeof facetsForm.updateFilters === 'function') {
        facetsForm.updateFilters();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && root?.dataset.open === 'true') {
        closeFilters();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initAmShopFilters);
document.addEventListener('shopify:section:load', initAmShopFilters);
