function activateCatalogTab(root, tabName) {
  root.querySelectorAll('[data-catalog-tab]').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.catalogTab === tabName);
  });
  root.querySelectorAll('[data-catalog-panel]').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.catalogPanel === tabName);
  });
}

function initHomeCatalog(root) {
  root.querySelectorAll('[data-catalog-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activateCatalogTab(root, tab.dataset.catalogTab);
    });
  });

  const hash = window.location.hash;
  if (hash === '#catalog-all') activateCatalogTab(root, 'all');
  if (hash === '#catalog-collections') activateCatalogTab(root, 'collections');
  if (hash === '#catalog-groups') activateCatalogTab(root, 'groups');
}

function initCatalogJumpLinks() {
  const root = document.querySelector('[data-home-catalog]');
  if (!root) return;

  document.querySelectorAll('[data-catalog-jump]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const tab = link.dataset.catalogJump;
      const targetId = link.getAttribute('href')?.replace('#', '');

      if (tab) {
        event.preventDefault();
        activateCatalogTab(root, tab);
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (targetId) {
          requestAnimationFrame(() => {
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      }
    });
  });
}

document.querySelectorAll('[data-home-catalog]').forEach(initHomeCatalog);
initCatalogJumpLinks();
