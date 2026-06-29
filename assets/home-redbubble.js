class RbScrollNav extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-rb-scroll-track]');
    this.prevBtn = this.querySelector('[data-rb-scroll-prev]');
    this.nextBtn = this.querySelector('[data-rb-scroll-next]');

    if (!this.track) return;

    this.prevBtn?.addEventListener('click', () => this.scroll(-1));
    this.nextBtn?.addEventListener('click', () => this.scroll(1));
    this.track.addEventListener('scroll', () => this.updateButtons(), { passive: true });
    window.addEventListener('resize', () => this.updateButtons());

    this.updateButtons();
  }

  scroll(direction) {
    const amount = this.track.clientWidth * 0.75 * direction;
    this.track.scrollBy({ left: amount, behavior: 'smooth' });
  }

  updateButtons() {
    if (!this.prevBtn || !this.nextBtn) return;

    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    this.prevBtn.disabled = scrollLeft <= 1;
    this.nextBtn.disabled = scrollLeft + clientWidth >= scrollWidth - 1;
  }
}

customElements.define('rb-scroll-nav', RbScrollNav);

document.querySelectorAll('[data-rb-tabs]').forEach((tabsRoot) => {
  const tabs = tabsRoot.querySelectorAll('[data-rb-tab]');
  const panels = tabsRoot.querySelectorAll('[data-rb-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.rbTab;

      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.rbPanel === target));
    });
  });
});
