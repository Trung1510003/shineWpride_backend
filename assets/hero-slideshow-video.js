import { SlideshowSelectEvent } from '@theme/events';

/**
 * Pause videos in hidden slides and play the active slide's video.
 */
function syncSlideVideos(slide) {
  document.querySelectorAll('slideshow-slide .slide__video').forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;
    video.pause();
  });

  if (!slide) return;

  slide.querySelectorAll('.slide__video').forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;
    video.play().catch(() => {});
  });
}

function resetKenBurns(slide) {
  slide?.querySelectorAll('.slide__image').forEach((image) => {
    if (!(image instanceof HTMLImageElement)) return;
    image.style.animation = 'none';
    void image.offsetWidth;
    image.style.animation = '';
  });
}

function boot() {
  const activeSlide = document.querySelector('slideshow-slide:not([aria-hidden="true"])');
  syncSlideVideos(activeSlide);
}

document.addEventListener(SlideshowSelectEvent.eventName, (event) => {
  if (!(event instanceof SlideshowSelectEvent)) return;
  syncSlideVideos(event.detail.slide);
  if (event.detail.slide?.closest('.home-hero-slideshow')) {
    resetKenBurns(event.detail.slide);
  }
});

document.addEventListener('DOMContentLoaded', boot);
document.addEventListener('shopify:section:load', boot);
