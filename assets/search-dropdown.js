import { debounce } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';

const RECENT_KEY = 'rb-recent-searches';
const RECENT_MAX = 5;

/**
 * Redbubble-style header search dropdown.
 */
class RbSearchDropdown extends HTMLElement {
  /** @type {AbortController | null} */
  #abort = null;

  connectedCallback() {
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    this.input = this.querySelector('[data-search-input]');
    this.panel = this.querySelector('[data-search-panel]');
    this.empty = this.querySelector('[data-search-empty]');
    this.results = this.querySelector('[data-search-results]');
    this.form = this.querySelector('[data-search-form]');
    this.shell = this.querySelector('.rb-search-bar__shell');
    this.recentWrap = this.querySelector('[data-recent-wrap]');
    this.recentList = this.querySelector('[data-recent-list]');

    if (!this.input || !this.panel) return;

    this.shell?.addEventListener(
      'click',
      (event) => {
        if (event.target === this.input) return;
        this.input?.focus();
      },
      { signal }
    );

    this.input.addEventListener('focus', this.#open, { signal });
    this.input.addEventListener('click', this.#open, { signal });
    this.input.addEventListener('input', this.#onInput, { signal });
    this.input.addEventListener('keydown', this.#onKeydown, { signal });

    this.form?.addEventListener('submit', this.#onSubmit, { signal });
    this.addEventListener('click', this.#onTermClick, { signal });
    document.addEventListener('click', this.#onDocumentClick, { signal });
    document.addEventListener('keydown', this.#onDocumentKeydown, { signal });

    this.#renderRecent();
  }

  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = null;
  }

  #open = () => {
    this.classList.add('is-open');
    this.input?.setAttribute('aria-expanded', 'true');
    this.panel?.removeAttribute('hidden');
  };

  #close = () => {
    this.classList.remove('is-open');
    this.input?.setAttribute('aria-expanded', 'false');
    this.panel?.setAttribute('hidden', '');
  };

  #onDocumentClick = (event) => {
    if (!(event.target instanceof Node)) return;
    if (!this.contains(event.target)) this.#close();
  };

  #onDocumentKeydown = (event) => {
    if (event.key === 'Escape') {
      this.#close();
      this.input?.blur();
    }
  };

  #onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.#close();
      this.input?.blur();
    }
  };

  #onSubmit = (event) => {
    const term = this.input?.value.trim();
    if (!term) return;
    this.#saveRecent(term);
  };

  #onTermClick = (event) => {
    const link = event.target instanceof Element ? event.target.closest('[data-search-term]') : null;
    if (!(link instanceof HTMLAnchorElement)) return;
    const term = link.dataset.searchTerm;
    if (term) this.#saveRecent(term);
  };

  #onInput = debounce(() => {
    const term = this.input?.value.trim() ?? '';

    if (!term.length) {
      this.#showEmpty();
      return;
    }

    this.#fetchResults(term);
  }, 200);

  #showEmpty() {
    if (this.empty) this.empty.hidden = false;
    if (this.results) {
      this.results.hidden = true;
      this.results.innerHTML = '';
    }
  }

  async #fetchResults(term) {
    if (!this.results) return;

    const url = new URL(Theme.routes.predictive_search_url, location.origin);
    url.searchParams.set('q', term);
    url.searchParams.set('resources[limit_scope]', 'each');

    try {
      const markup = await sectionRenderer.getSectionHTML('predictive-search', false, url);
      if (!markup) return;

      const doc = new DOMParser().parseFromString(markup, 'text/html');
      const resultsRoot = doc.querySelector('#predictive-search-results');
      this.results.innerHTML = resultsRoot ? resultsRoot.innerHTML : markup;
      this.results.hidden = false;
      if (this.empty) this.empty.hidden = true;
    } catch {
      /* keep previous state */
    }
  }

  #saveRecent(term) {
    const items = this.#getRecent().filter((item) => item.toLowerCase() !== term.toLowerCase());
    items.unshift(term);
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, RECENT_MAX)));
    this.#renderRecent();
  }

  #getRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  #escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  #renderRecent() {
    if (!this.recentList || !this.recentWrap) return;

    const items = this.#getRecent();
    const searchUrl = this.form?.action ?? '/search';

    if (!items.length) {
      this.recentWrap.hidden = true;
      this.recentList.innerHTML = '';
      return;
    }

    this.recentWrap.hidden = false;
    this.recentList.innerHTML = items
      .map(
        (term) => `
        <li>
          <a class="rb-search-dropdown__term" href="${searchUrl}?q=${encodeURIComponent(term)}" data-search-term="${term.replace(/"/g, '&quot;')}">
            <span class="rb-search-dropdown__term-icon rb-search-dropdown__term-icon--clock" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2 1.5"/></svg>
            </span>
            <span class="rb-search-dropdown__term-text">${this.#escapeHtml(term)}</span>
          </a>
          <button type="button" class="rb-search-dropdown__term-remove button-unstyled" data-remove-term="${term.replace(/"/g, '&quot;')}" aria-label="Remove ${term}">×</button>
        </li>`
      )
      .join('');

    this.recentList.querySelectorAll('[data-remove-term]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const remove = btn.getAttribute('data-remove-term');
        const next = this.#getRecent().filter((t) => t !== remove);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        this.#renderRecent();
      });
    });
  }
}

if (!customElements.get('rb-search-dropdown')) {
  customElements.define('rb-search-dropdown', RbSearchDropdown);
}
