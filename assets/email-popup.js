const STORAGE_SUBSCRIBED = 'swp_email_popup_subscribed';
const STORAGE_DISMISSED = 'swp_email_popup_dismissed_at';

class EmailDiscountPopup extends HTMLElement {
  #overlay;
  #dialog;
  #form;
  #formWrap;
  #success;
  #message;
  #delayTimer;

  connectedCallback() {
    this.#overlay = this.querySelector('[data-email-popup-overlay]');
    this.#dialog = this.querySelector('[data-email-popup-dialog]');
    this.#form = this.querySelector('[data-email-popup-form]');
    this.#formWrap = this.querySelector('[data-email-popup-form-wrap]');
    this.#success = this.querySelector('[data-email-popup-success]');
    this.#message = this.querySelector('[data-email-popup-message]');

    if (!this.#overlay || this.#shouldSkip()) return;

    this.querySelector('[data-email-popup-close]')?.addEventListener('click', () => this.close(false));
    this.querySelector('[data-email-popup-decline]')?.addEventListener('click', () => this.close(false));
    this.#overlay.addEventListener('click', (event) => {
      if (event.target === this.#overlay) this.close(false);
    });

    this.#form?.addEventListener('submit', (event) => this.#handleSubmit(event));

    this.querySelector('[data-email-popup-copy]')?.addEventListener('click', () => {
      const code = this.dataset.discountCode;
      if (!code) return;
      navigator.clipboard?.writeText(code).then(() => {
        const button = this.querySelector('[data-email-popup-copy]');
        if (button) button.textContent = button.dataset.copiedLabel || 'Copied!';
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#overlay.classList.contains('is-open')) {
        this.close(false);
      }
    });

    const delay = Number.parseInt(this.dataset.delay, 10) || 2000;
    const showOnLoad = () => {
      this.#delayTimer = window.setTimeout(() => this.open(), delay);
    };

    if (document.readyState === 'complete') {
      showOnLoad();
    } else {
      window.addEventListener('load', showOnLoad, { once: true });
    }
  }

  disconnectedCallback() {
    if (this.#delayTimer) window.clearTimeout(this.#delayTimer);
  }

  #shouldSkip() {
    if (this.dataset.enabled !== 'true') return true;
    if (localStorage.getItem(STORAGE_SUBSCRIBED) === '1') return true;

    const dismissedAt = localStorage.getItem(STORAGE_DISMISSED);
    const frequencyDays = Number.parseInt(this.dataset.frequencyDays, 10) || 7;
    if (dismissedAt) {
      const elapsed = Date.now() - Number.parseInt(dismissedAt, 10);
      if (elapsed < frequencyDays * 86400000) return true;
    }

    return false;
  }

  open() {
    this.#overlay?.classList.add('is-open');
    this.#overlay?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.querySelector('.email-popup__input')?.focus();
  }

  close(subscribed = false) {
    if (this.#success && !this.#success.hasAttribute('hidden')) {
      subscribed = true;
    }

    this.#overlay?.classList.remove('is-open');
    this.#overlay?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (subscribed) {
      localStorage.setItem(STORAGE_SUBSCRIBED, '1');
    } else {
      localStorage.setItem(STORAGE_DISMISSED, String(Date.now()));
    }
  }

  async #handleSubmit(event) {
    event.preventDefault();
    if (!this.#form) return;

    const submit = this.#form.querySelector('[type="submit"]');
    submit?.setAttribute('disabled', 'disabled');
    this.#setMessage('');

    const email = this.#form.querySelector('[name="contact[email]"]')?.value?.trim();
    if (!email) {
      this.#setMessage(this.dataset.errorMessage || 'Something went wrong. Please try again.');
      submit?.removeAttribute('disabled');
      return;
    }

    const subscribedViaProxy = await this.#subscribeViaAppProxy(email);
    if (subscribedViaProxy) {
      submit?.removeAttribute('disabled');
      return;
    }

    await this.#subscribeViaContactForm(submit);
  }

  async #subscribeViaAppProxy(email) {
    const subscribeUrl = '/apps/shinewpride/subscribe';

    try {
      const response = await fetch(subscribeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok) {
        this.#showSuccess(data.code);
        return true;
      }
    } catch {
      // Fall back to the native Shopify contact form.
    }

    return false;
  }

  async #subscribeViaContactForm(submit) {
    const formData = new FormData(this.#form);

    try {
      const response = await fetch(this.#form.action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'text/html' },
      });

      if (response.ok) {
        this.#showSuccess();
        return;
      }

      this.#setMessage(this.dataset.errorMessage || 'Something went wrong. Please try again.');
    } catch {
      this.#setMessage(this.dataset.errorMessage || 'Something went wrong. Please try again.');
    } finally {
      submit?.removeAttribute('disabled');
    }
  }

  #showSuccess(code) {
    const discountCode = code || this.dataset.discountCode;
    if (discountCode) {
      this.dataset.discountCode = discountCode;
      const codeEl = this.querySelector('.email-popup__code');
      if (codeEl) codeEl.textContent = discountCode;
    }

    this.#formWrap?.setAttribute('hidden', '');
    this.#success?.removeAttribute('hidden');
    localStorage.setItem(STORAGE_SUBSCRIBED, '1');
  }

  #setMessage(text) {
    if (!this.#message) return;
    this.#message.textContent = text;
    this.#message.hidden = text === '';
  }
}

if (!customElements.get('email-discount-popup')) {
  customElements.define('email-discount-popup', EmailDiscountPopup);
}
