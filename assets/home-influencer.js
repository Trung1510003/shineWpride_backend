function loadYouTubeEmbed(panel) {
  const embed = panel.querySelector('[data-yt-id]');
  if (!embed || embed.querySelector('iframe')) return;

  const id = embed.dataset.ytId;
  if (!id) return;

  const iframe = document.createElement('iframe');
  iframe.className = 'influencer-modal__iframe';
  iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.title = embed.dataset.ytTitle || 'Video review';
  embed.appendChild(iframe);
}

function initInfluencerModal(sectionRoot) {
  if (sectionRoot.dataset.influencerModalInit === 'true') return;
  sectionRoot.dataset.influencerModalInit = 'true';

  const modal = sectionRoot.querySelector('dialog.influencer-modal');
  if (!modal) return;

  const panels = modal.querySelectorAll('[data-influencer-panel]');
  const closeBtn = modal.querySelector('[data-influencer-close]');

  function stopMedia() {
    panels.forEach((panel) => {
      panel.querySelectorAll('video').forEach((video) => {
        video.pause();
        video.currentTime = 0;
      });
      panel.querySelectorAll('.influencer-modal__embed').forEach((embed) => {
        embed.innerHTML = '';
      });
      panel.hidden = true;
    });
  }

  function openPanel(id) {
    stopMedia();
    const panel = modal.querySelector(`[data-influencer-panel="${id}"]`);
    if (!panel) return;

    panel.hidden = false;
    loadYouTubeEmbed(panel);

    const video = panel.querySelector('video.influencer-modal__video');
    if (video) {
      video.play().catch(() => {});
    }

    modal.showModal();
  }

  sectionRoot.querySelectorAll('[data-influencer-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => openPanel(trigger.dataset.influencerOpen));
  });

  closeBtn?.addEventListener('click', () => {
    stopMedia();
    modal.close();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      stopMedia();
      modal.close();
    }
  });

  modal.addEventListener('close', stopMedia);
}

document.querySelectorAll('[data-influencer-section]').forEach(initInfluencerModal);

document.addEventListener('shopify:section:load', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches('[data-influencer-section]')) {
    initInfluencerModal(target);
    return;
  }

  target.querySelectorAll('[data-influencer-section]').forEach(initInfluencerModal);
});
