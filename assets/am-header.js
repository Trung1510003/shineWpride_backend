/**
 * Mobile search toggle and header height sync for the Artistry header.
 */

function syncAmHeaderHeight() {
  const headerSection = document.querySelector('.am-header-section');
  const headerGroup = document.querySelector('#header-group');
  if (!headerSection) return;

  const headerHeight = headerSection.offsetHeight;
  document.body.style.setProperty('--header-height', `${headerHeight}px`);

  let headerGroupHeight = 0;
  if (headerGroup) {
    for (const child of headerGroup.children) {
      if (child instanceof HTMLElement) {
        headerGroupHeight += child.offsetHeight;
      }
    }
  }

  document.body.style.setProperty('--header-group-height', `${headerGroupHeight}px`);
}

function initAmHeader() {
  document.querySelectorAll('[data-am-header]').forEach((header) => {
    if (header.dataset.amHeaderInit === 'true') return;
    header.dataset.amHeaderInit = 'true';

    const toggle = header.querySelector('[data-am-header-search-open]');
    const panel = header.querySelector('[data-am-header-search-panel]');
    if (!toggle || !panel) return;

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      header.classList.toggle('am-header--search-open', open);

      if (open) {
        const input = panel.querySelector('input[type="search"]');
        input?.focus();
      }

      syncAmHeaderHeight();
    };

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      setOpen(!isOpen);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
      }
    });
  });

  syncAmHeaderHeight();
}

document.addEventListener('DOMContentLoaded', initAmHeader);
document.addEventListener('shopify:section:load', initAmHeader);
window.addEventListener('resize', syncAmHeaderHeight);

if (typeof ResizeObserver !== 'undefined') {
  const observeHeader = () => {
    const headerSection = document.querySelector('.am-header-section');
    if (!headerSection || headerSection.dataset.amHeaderObserved === 'true') return;

    headerSection.dataset.amHeaderObserved = 'true';
    const observer = new ResizeObserver(syncAmHeaderHeight);
    observer.observe(headerSection);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeHeader);
  } else {
    observeHeader();
  }

  document.addEventListener('shopify:section:load', observeHeader);
}
