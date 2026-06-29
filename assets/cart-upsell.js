import { fetchConfig } from '@theme/utilities';
import { CartAddEvent } from '@theme/events';

class CartUpsell extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
  }

  /** @param {MouseEvent} event */
  #onClick = async (event) => {
    const button = event.target.closest('[data-cart-upsell-add]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const variantId = button.dataset.variantId;
    if (!variantId) return;

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    const sectionIds = [];
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.sectionId) {
        sectionIds.push(item.dataset.sectionId);
      }
    });

    const body = new FormData();
    body.set('id', variantId);
    body.set('quantity', '1');
    if (sectionIds.length) {
      body.set('sections', sectionIds.join(','));
    }

    try {
      const response = await fetch(Theme.routes.cart_add_url, {
        ...fetchConfig('javascript', { body }),
        headers: {
          ...fetchConfig('javascript', { body }).headers,
          Accept: 'text/html',
        },
      });
      const data = await response.json();

      if (data.status) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        return;
      }

      document.dispatchEvent(
        new CartAddEvent(data, variantId, {
          source: 'cart-upsell',
          itemCount: 1,
          variantId,
          sections: data.sections,
        })
      );
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  };
}

if (!customElements.get('cart-upsell')) {
  customElements.define('cart-upsell', CartUpsell);
}
