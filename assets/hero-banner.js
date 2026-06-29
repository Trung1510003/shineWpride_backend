import { SlideshowSelectEvent } from '@theme/events';

function syncSlideVideos(slide) {
  document.querySelectorAll('.hero-banner__video').forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;
    video.pause();
  });

  if (!slide) return;

  slide.querySelectorAll('.hero-banner__video').forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;
    video.play().catch(() => {});
  });
}

function resetKenBurns(slide) {
  slide?.querySelectorAll('.hero-banner__image').forEach((image) => {
    if (!(image instanceof HTMLImageElement)) return;
    image.style.animation = 'none';
    void image.offsetWidth;
    image.style.animation = '';
  });
}

function initHeroBanner(section) {
  const wrapper = section.closest('.hero-banner-wrapper');
  if (!wrapper || wrapper.dataset.heroInitialized) return;
  wrapper.dataset.heroInitialized = 'true';
  wrapper.dataset.heroHeight = section.dataset.heroHeight || 'large';
}

document.addEventListener(SlideshowSelectEvent.eventName, (event) => {
  if (!(event instanceof SlideshowSelectEvent)) return;
  if (!event.detail.slide?.closest('.hero-banner-section')) return;

  syncSlideVideos(event.detail.slide);
  resetKenBurns(event.detail.slide);
});

function boot() {
  document.querySelectorAll('.hero-banner-section').forEach((section) => {
    initHeroBanner(section);

    const activeSlide = section.querySelector('slideshow-slide:not([aria-hidden="true"])');
    syncSlideVideos(activeSlide);
  });
}

boot();
document.addEventListener('shopify:section:load', boot);
