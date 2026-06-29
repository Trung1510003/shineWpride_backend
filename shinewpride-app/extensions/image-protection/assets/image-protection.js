(function () {
  "use strict";

  var PRODUCT_IMAGE_SELECTORS = [
    ".am-product-card__img",
    ".product-media__image",
    "img.product-media__image",
  ].join(",");

  var BLUR_CLASS = "is-protected-blur";
  var APPLIED_FLAG = "data-image-protection-applied";
  var SRC_BACKUP_ATTR = "data-image-protection-src";
  var SRCSET_BACKUP_ATTR = "data-image-protection-srcset";
  var PLACEHOLDER_SRC =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  var observer = null;
  var blurState = {
    focusHidden: false,
    devtoolsOpen: false,
  };

  function readBoolean(value) {
    return value === "true" || value === true;
  }

  function isProtectedImage(node) {
    if (!(node instanceof HTMLImageElement)) {
      return false;
    }

    return (
      node.matches(PRODUCT_IMAGE_SELECTORS) || node.classList.contains("no-save")
    );
  }

  function getProtectedImages() {
    return Array.prototype.slice.call(
      document.querySelectorAll(PRODUCT_IMAGE_SELECTORS),
    );
  }

  function getConfig(root) {
    return {
      disableContextMenu: readBoolean(root.dataset.disableContextMenu),
      disableDrag: readBoolean(root.dataset.disableDrag),
      blurOnBlur: readBoolean(root.dataset.blurOnBlur),
      detectDevtools: readBoolean(root.dataset.detectDevtools),
    };
  }

  function ensureGuardWrap(image) {
    var parent = image.parentElement;

    if (!parent) {
      return null;
    }

    if (parent.classList.contains("img-guard-wrap")) {
      return parent;
    }

    var wrap = document.createElement("span");
    wrap.className = "img-guard-wrap";
    parent.insertBefore(wrap, image);
    wrap.appendChild(image);

    return wrap;
  }

  function ensureOverlay(wrap) {
    if (!wrap || wrap.querySelector(".img-guard")) {
      return;
    }

    var guard = document.createElement("span");
    guard.className = "img-guard";
    guard.setAttribute("aria-hidden", "true");
    wrap.appendChild(guard);
  }

  function backupImageSource(image) {
    if (!image.getAttribute(SRC_BACKUP_ATTR)) {
      var currentSource = image.currentSrc || image.src;
      if (currentSource && currentSource !== PLACEHOLDER_SRC) {
        image.setAttribute(SRC_BACKUP_ATTR, currentSource);
      }
    }

    if (image.srcset && !image.getAttribute(SRCSET_BACKUP_ATTR)) {
      image.setAttribute(SRCSET_BACKUP_ATTR, image.srcset);
    }
  }

  function stripImageSource(image) {
    if (!isProtectedImage(image)) {
      return;
    }

    backupImageSource(image);
    image.removeAttribute("srcset");
    image.src = PLACEHOLDER_SRC;
  }

  function restoreImageSource(image) {
    var originalSrc = image.getAttribute(SRC_BACKUP_ATTR);
    var originalSrcset = image.getAttribute(SRCSET_BACKUP_ATTR);

    if (originalSrcset) {
      image.srcset = originalSrcset;
      image.removeAttribute(SRCSET_BACKUP_ATTR);
    }

    if (originalSrc) {
      image.src = originalSrc;
      image.removeAttribute(SRC_BACKUP_ATTR);
    }
  }

  function stripHighResSources() {
    getProtectedImages().forEach(stripImageSource);
  }

  function restoreHighResSources() {
    getProtectedImages().forEach(restoreImageSource);
  }

  function updateBlurPresentation() {
    var shouldBlur = blurState.focusHidden || blurState.devtoolsOpen;
    document.documentElement.classList.toggle(BLUR_CLASS, shouldBlur);

    if (blurState.devtoolsOpen) {
      stripHighResSources();
      return;
    }

    restoreHighResSources();
  }

  function syncFocusBlurState() {
    blurState.focusHidden = document.hidden || !document.hasFocus();
    updateBlurPresentation();
  }

  function isDevToolsOpen() {
    var threshold = 160;
    var widthGap = window.outerWidth - window.innerWidth;
    var heightGap = window.outerHeight - window.innerHeight;
    return widthGap > threshold || heightGap > threshold;
  }

  function protectImage(image) {
    if (image.getAttribute(APPLIED_FLAG) === "true") {
      if (blurState.devtoolsOpen) {
        stripImageSource(image);
      }
      return;
    }

    image.setAttribute(APPLIED_FLAG, "true");
    image.classList.add("no-save");
    image.setAttribute("draggable", "false");

    var wrap = ensureGuardWrap(image);
    ensureOverlay(wrap);

    if (blurState.devtoolsOpen) {
      stripImageSource(image);
    }
  }

  function protectImages() {
    getProtectedImages().forEach(protectImage);
  }

  function bindContextMenu(config) {
    if (!config.disableContextMenu) {
      return;
    }

    document.addEventListener(
      "contextmenu",
      function (event) {
        if (isProtectedImage(event.target)) {
          event.preventDefault();
        }
      },
      true,
    );
  }

  function bindDrag(config) {
    if (!config.disableDrag) {
      return;
    }

    document.addEventListener(
      "dragstart",
      function (event) {
        if (isProtectedImage(event.target)) {
          event.preventDefault();
        }
      },
      true,
    );
  }

  function bindKeyboardShortcuts() {
    document.addEventListener(
      "keydown",
      function (event) {
        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }

        var key = event.key.toLowerCase();
        if (key === "s" || key === "p") {
          event.preventDefault();
        }
      },
      true,
    );
  }

  function bindBlurOnTabBlur(config) {
    if (!config.blurOnBlur) {
      return;
    }

    window.addEventListener("blur", syncFocusBlurState);
    window.addEventListener("focus", syncFocusBlurState);
    document.addEventListener("visibilitychange", syncFocusBlurState);
    syncFocusBlurState();
  }

  function bindDevToolsDetection(config) {
    if (!config.detectDevtools) {
      return;
    }

    function checkDevTools() {
      blurState.devtoolsOpen = isDevToolsOpen();
      updateBlurPresentation();
    }

    window.addEventListener("resize", checkDevTools);
    window.setInterval(checkDevTools, 1000);
    checkDevTools();
  }

  function observeNewImages() {
    if (observer || !document.body) {
      return;
    }

    observer = new MutationObserver(function () {
      protectImages();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function initImageProtection() {
    var root = document.querySelector("[data-image-protection]");

    if (!root || root.dataset.imageProtectionReady === "true") {
      return;
    }

    var config = getConfig(root);

    root.dataset.imageProtectionConfig = JSON.stringify(config);
    root.dataset.imageProtectionReady = "true";
    document.documentElement.classList.add("shinewpride-image-protection-enabled");

    protectImages();
    bindContextMenu(config);
    bindDrag(config);
    bindKeyboardShortcuts();
    bindBlurOnTabBlur(config);
    bindDevToolsDetection(config);
    observeNewImages();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImageProtection);
  } else {
    initImageProtection();
  }
})();
