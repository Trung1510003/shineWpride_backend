/**
 * Product detail page interactions — share button.
 */

function initProductShare() {
  document.querySelectorAll('[data-am-share]').forEach((button) => {
    if (button.dataset.amShareInit === 'true') return;
    button.dataset.amShareInit = 'true';

    button.addEventListener('click', async () => {
      const url = button.dataset.shareUrl;
      const title = button.dataset.shareTitle || document.title;

      if (!url) return;

      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        button.setAttribute('aria-label', 'Link copied');
      } catch {
        window.prompt('Copy this link:', url);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initProductShare);
document.addEventListener('shopify:section:load', initProductShare);
