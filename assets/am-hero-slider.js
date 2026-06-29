/**
 * Sync hero slider height to match the first (artistry) slide — same size as the original hero.
 */

function syncAmHeroSliderHeight(section) {
  const heroSlide = section.querySelector('.am-hero--slide');
  const heroInner = section.querySelector('.am-hero--slide .am-hero__inner');
  if (!heroSlide || !heroInner) return;

  const styles = getComputedStyle(heroSlide);
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const paddingBottom = parseFloat(styles.paddingBottom) || 0;
  const height = Math.ceil(paddingTop + heroInner.scrollHeight + paddingBottom);

  if (height > 0) {
    section.style.setProperty('--am-hero-slider-height', `${height}px`);
  }
}

function initAmHeroSlider(section) {
  if (section.dataset.amHeroSliderInit === 'true') return;
  section.dataset.amHeroSliderInit = 'true';

  const run = () => syncAmHeroSliderHeight(section);

  run();
  window.requestAnimationFrame(run);

  if (typeof ResizeObserver !== 'undefined') {
    const heroInner = section.querySelector('.am-hero--slide .am-hero__inner');
    if (heroInner) {
      const observer = new ResizeObserver(run);
      observer.observe(heroInner);
    }
  }
}

function boot() {
  document.querySelectorAll('.am-hero-slider-section').forEach(initAmHeroSlider);
}

boot();
document.addEventListener('DOMContentLoaded', boot);
document.addEventListener('shopify:section:load', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches('.am-hero-slider-section')) {
    target.dataset.amHeroSliderInit = 'false';
    initAmHeroSlider(target);
    return;
  }

  target.querySelectorAll('.am-hero-slider-section').forEach((section) => {
    section.dataset.amHeroSliderInit = 'false';
    initAmHeroSlider(section);
  });
});

window.addEventListener('resize', boot);
