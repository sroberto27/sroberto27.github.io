/* ===================== INSTALL / OFFLINE READINESS =====================
   Registers the service worker, drives the Install button, and reports
   whether the app is genuinely ready to be used with no signal.

   Three things this has to get right, all of which are places PWAs
   usually get it wrong:

   1. ANDROID AND iOS INSTALL DIFFERENTLY. Chrome fires
      `beforeinstallprompt` and hands over a prompt() we can call from a
      click. Safari fires nothing and has no API at all -- the user has to
      go through Share > Add to Home Screen -- so on iOS the same button
      opens instructions rather than pretending it can do something it
      cannot. Getting this wrong means an inert button on every iPhone.

   2. "INSTALLED" IS NOT "OFFLINE-READY". Adding an icon to the home
      screen caches nothing by itself. The 17 MB of onnxruntime and XFeat
      that the Enhance stage needs are fetched in the background by sw.js,
      and until that finishes a capture taken with no signal will still
      stitch -- capture360.js treats refinement as advisory -- but it will
      stitch from raw sensor pose. So the button reports the download, and
      says plainly when the app is fully ready.

   3. A CACHED APP CAN GO STALE. sw.js revalidates text assets in the
      background and tells us when a deployed file actually changed; this
      surfaces that as a reload prompt instead of leaving someone on an
      old build wondering why a fix did not arrive. That confusion has
      already happened once on this project, with the browser's ordinary
      HTTP cache rather than a service worker, which is exactly why it is
      worth handling deliberately.
*/
(function (global) {
  'use strict';

  const SW_URL = 'sw.js';
  const DISMISS_KEY = 'lsc2_install_dismissed';

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = global.matchMedia('(display-mode: standalone)').matches ||
    global.navigator.standalone === true;

  let deferredPrompt = null;
  let mlStatus = null;
  let btn = null;
  let labelEl = null;

  function toast(msg, kind) {
    if (global.LSCToast) { global.LSCToast(msg, kind); return; }
    // app.js owns the real toast; before it loads, say nothing rather than
    // popping an alert() over a page the user has not seen yet.
    if (global.console) console.log('[install] ' + msg);
  }

  function dismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }

  function setLabel(text, title) {
    if (labelEl) labelEl.textContent = text;
    if (btn && title) btn.title = title;
  }

  /* What the button says depends on three independent facts: whether the
     app is already installed, whether a prompt is available, and how much
     of the offline AI pack has arrived. */
  function refresh() {
    if (!btn) return;
    const packReady = mlStatus && mlStatus.complete;

    if (isStandalone) {
      if (packReady) {
        // Fully offline-capable and already installed: nothing left to ask.
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.classList.add('tbtn--ghost');
      setLabel(mlStatus ? 'Offline ' + mlStatus.have + '/' + mlStatus.total : 'Offline',
        'Downloading the on-device AI so 360 refinement works with no signal');
      return;
    }

    if (dismissed() && !deferredPrompt) { btn.hidden = true; return; }

    btn.hidden = false;
    btn.classList.remove('tbtn--ghost');
    if (isIOS) {
      setLabel('Install', 'Add this app to your Home Screen to use it offline');
    } else if (deferredPrompt) {
      setLabel('Install', 'Install the app so it works with no signal');
    } else {
      // No prompt and not iOS: either already installed in another window,
      // or the browser has not decided we qualify yet.
      btn.hidden = true;
    }
  }

  function iosInstructions() {
    toast('To install: tap the Share button in Safari, then "Add to Home Screen". ' +
      'The app then opens full screen and works with no signal.', 'info');
  }

  async function doInstall() {
    if (isIOS && !deferredPrompt) { iosInstructions(); return; }
    if (!deferredPrompt) { toast('This browser has not offered installation yet.', 'info'); return; }
    const prompt = deferredPrompt;
    deferredPrompt = null;                 // a prompt can only be used once
    try {
      prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        toast('Installed. The app now works with no signal.', 'success');
      } else {
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      toast('Could not open the install prompt.', 'error');
    }
    refresh();
  }

  // ---- service worker ----------------------------------------------------

  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    /* file:// has no service worker support and never will; saying so once
       beats a console error nobody reads. */
    if (location.protocol === 'file:') {
      console.log('[install] offline support needs http(s), not file://');
      return;
    }
    navigator.serviceWorker.register(SW_URL).then(reg => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          /* A new worker reaching 'installed' while one already controls
             the page means a genuinely new build is sitting ready. */
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            offerReload(reg);
          }
        });
      });
      askMlStatus();
    }).catch(err => {
      console.log('[install] service worker registration failed: ' + err.message);
    });

    navigator.serviceWorker.addEventListener('message', (e) => {
      const msg = e.data || {};
      if (msg.type === 'ml-cache-status') {
        mlStatus = msg.status;
        refresh();
        return;
      }
      if (msg.type === 'update-ready') offerReload(null);
    });

    // The controller changing means the new worker took over; reload once
    // so the page is running the code the new worker will serve.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      if (global.__lscReloadOnSwChange) location.reload();
    });
  }

  let reloadOffered = false;
  function offerReload(reg) {
    if (reloadOffered) return;
    reloadOffered = true;
    /* Deliberately not automatic. This app holds unsaved-looking state in
       forms and can be mid-capture; yanking the page out from under a
       360 session to apply a CSS change would be its own bug. */
    toast('A new version is ready — reload to use it.', 'info');
    const apply = () => {
      global.__lscReloadOnSwChange = true;
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'skip-waiting' });
      else location.reload();
    };
    global.LSCApplyUpdate = apply;
  }

  function askMlStatus() {
    const sw = navigator.serviceWorker;
    if (!sw || !sw.controller) return;
    sw.controller.postMessage({ type: 'ml-cache-query' });
  }

  function startMlDownload() {
    const sw = navigator.serviceWorker;
    if (sw && sw.controller) sw.controller.postMessage({ type: 'ml-cache-start' });
  }

  // ---- wiring ------------------------------------------------------------

  global.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                    // keep the mini-infobar away
    deferredPrompt = e;
    try { localStorage.removeItem(DISMISS_KEY); } catch (err) { /* ignore */ }
    refresh();
  });

  global.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toast('Installed. Open it from your home screen to use it offline.', 'success');
    refresh();
  });

  function init() {
    btn = document.getElementById('installBtn');
    if (!btn) return;
    labelEl = btn.querySelector('.install-label');
    btn.addEventListener('click', () => {
      if (isStandalone) {
        if (mlStatus && !mlStatus.complete) {
          startMlDownload();
          toast('Downloading the on-device AI (about 17 MB) so 360 refinement ' +
            'works with no signal.', 'info');
        }
        return;
      }
      doInstall();
    });
    refresh();
    registerWorker();
    // The controller can arrive a moment after load on a first visit.
    navigator.serviceWorker && navigator.serviceWorker.ready.then(askMlStatus).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.LSCInstall = {
    isStandalone: function () { return isStandalone; },
    mlStatus: function () { return mlStatus; },
    cacheMl: startMlDownload
  };
})(window);
