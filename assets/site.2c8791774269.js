(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.querySelector('.motion-toggle');
  let storedMotion = null;
  try { storedMotion = localStorage.getItem('cv-portfolio-v6-motion'); } catch { /* Private browsing still works. */ }
  const motionEnabled = () => root.dataset.motion !== 'off' && !reduceMotion.matches;
  const applyMotion = (enabled) => {
    const on = enabled && !reduceMotion.matches;
    root.dataset.motion = on ? 'on' : 'off';
    motionButton?.setAttribute('aria-pressed', String(on));
    motionButton?.setAttribute('aria-label', reduceMotion.matches ? 'Animations disabled by your reduced-motion setting' : on ? 'Pause animations' : 'Resume animations');
    if (motionButton) motionButton.disabled = reduceMotion.matches;
    const state = document.querySelector('.motion-state');
    if (state) state.textContent = on ? 'on' : 'off';
    document.dispatchEvent(new CustomEvent("portfolio:motion", {detail: {on}}));
  };
  applyMotion(storedMotion !== 'off');
  motionButton?.addEventListener('click', () => {
    const next = !motionEnabled();
    applyMotion(next);
    storedMotion = next ? 'on' : 'off';
    try { localStorage.setItem('cv-portfolio-v6-motion', storedMotion); } catch { /* Controls still work without storage. */ }
  });
  reduceMotion.addEventListener('change', () => applyMotion(!reduceMotion.matches && storedMotion !== 'off'));

  const aura = document.querySelector('.cursor-aura');
  if (aura) {
    const mouseHover = matchMedia('(any-hover: hover) and (any-pointer: fine)');
    let auraFrame = 0, x = 0, y = 0;
    const hideAura = () => {
      if (auraFrame) cancelAnimationFrame(auraFrame);
      auraFrame = 0;
      aura.removeAttribute('data-active');
    };
    window.addEventListener('pointermove', event => {
      if (root.dataset.gate || event.pointerType !== 'mouse' || !mouseHover.matches || !motionEnabled()) {
        hideAura();
        return;
      }
      x = event.clientX;
      y = event.clientY;
      if (auraFrame) return;
      auraFrame = requestAnimationFrame(() => {
        auraFrame = 0;
        aura.style.setProperty('--cursor-x', x + 'px');
        aura.style.setProperty('--cursor-y', y + 'px');
        aura.dataset.active = '';
      });
    }, {passive: true});
    window.addEventListener('pointerout', event => {
      if (!event.relatedTarget) hideAura();
    }, {passive: true});
    window.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse') hideAura();
    }, {passive: true});
    window.addEventListener('blur', hideAura);
    window.addEventListener('pagehide', hideAura);
    window.addEventListener('keydown', hideAura);
    mouseHover.addEventListener('change', hideAura);
    document.addEventListener('visibilitychange', hideAura);
    document.addEventListener('portfolio:awaken', hideAura);
    document.addEventListener('portfolio:motion', event => {
      if (!event.detail.on) hideAura();
    });
  }

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  const setMenu = (open, returnFocus = false) => {
    toggle?.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('is-open', open);
    if (open) nav?.querySelector('a')?.focus();
    if (returnFocus) toggle?.focus();
  };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false, mobileQuery.matches); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) setMenu(false);
  });
  const mobileQuery = window.matchMedia('(max-width: 760px)');
  mobileQuery.addEventListener('change', () => setMenu(false));

  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const filterRows = [...document.querySelectorAll('[data-category]')];
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    let count = 0;
    filterRows.forEach((row) => {
      const match = filter === 'all' || row.dataset.category.split(' ').includes(filter);
      row.hidden = !match;
      row.classList.remove('reveal-pending');
      if (match) count++;
    });
    const status = document.querySelector('.filter-status');
    if (status) status.textContent = `${count} project${count === 1 ? '' : 's'} shown`;
  }));

  const toast = document.querySelector('.toast');
  const toastMessage = toast?.querySelector('.toast-message');
  let toastTimer;
  const notify = (message) => {
    if (!toastMessage) return;
    clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
  };
  document.querySelectorAll('[data-email]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.email);
      notify('Email address copied.');
    } catch {
      notify('Copy unavailable here. Use the email link above.');
    }
  }));

  document.querySelectorAll('img').forEach((img) => {
    const onError = () => {
      const fallback = img.parentElement.querySelector('.portrait-fallback');
      if (fallback) { img.hidden = true; fallback.hidden = false; }
    };
    img.addEventListener('error', onError);
    if (img.complete && img.naturalWidth === 0) onError();
  });

  // Reveal the decoration and linework; content is never hidden by the observer.
  if ('IntersectionObserver' in window) {
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (motionEnabled()) entry.target.classList.add('ink-reveal');
        reveals.unobserve(entry.target);
      });
    }, {threshold: .08});
    document.querySelectorAll('[data-reveal]').forEach(el => {
      if (el.getBoundingClientRect().top >= innerHeight * .82) reveals.observe(el);
    });
    const stamps = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('mark-live', entry.isIntersecting));
    }, {rootMargin: '45px'});
    document.querySelectorAll('.skill-mark').forEach(el => stamps.observe(el));
  }

  // Motion and sound are separate. The welcome always starts on a user gesture,
  // and the soundtrack waits for the local welcome cue to finish.
  const soundKey = 'cv-portfolio-transition-sound';
  const soundToggles = document.querySelectorAll('.effects-toggle,.gate-sound');
  const replay = document.querySelector('.welcome-replay');
  const welcomeFeedback = document.querySelector('.welcome-feedback');
  let soundOn = true, cutAudio, awakenAudio;
  let welcomeActive = false, welcomeRun = 0;
  try { soundOn = localStorage.getItem(soundKey) !== 'off'; } catch { /* Sound is still optional. */ }
  function prepareCue(source, className, volume) {
    if (!source) return;
    const cue = new Audio();
    cue.hidden = true;
    cue.className = className;
    cue.preload = 'auto';
    cue.volume = volume;
    cue.src = source;
    return cue;
  }
  function warmCut() {
    if (!soundOn || !motionEnabled()) return;
    cutAudio ??= prepareCue(document.body.dataset.cutSound,'cut-audio',.58);
    if (cutAudio && !cutAudio.isConnected) document.body.append(cutAudio);
  }
  function warmAwaken() {
    if (!soundOn || awakenAudio) return;
    awakenAudio = prepareCue(document.body.dataset.awakenSound,'awaken-audio',1);
    awakenAudio?.addEventListener('ended',() => announceWelcome(false));
    awakenAudio?.addEventListener('error',() => { if (welcomeActive) failWelcome(); });
  }
  function announceWelcome(active) {
    root.toggleAttribute('data-welcome-playing',active);
    if (active === welcomeActive) return;
    welcomeActive = active;
    document.dispatchEvent(new CustomEvent('portfolio:welcome',{detail:{active}}));
  }
  function startWelcome() {
    if (!soundOn || document.hidden) return;
    if (welcomeFeedback) { welcomeFeedback.hidden = true; welcomeFeedback.textContent = ''; }
    warmAwaken();
    if (!awakenAudio) return;
    if (!awakenAudio.isConnected) document.body.append(awakenAudio);
    const current = ++welcomeRun;
    announceWelcome(true);
    try {
      if (awakenAudio.error) awakenAudio.load();
      if (awakenAudio.readyState > 0) awakenAudio.currentTime = 0;
      awakenAudio.play()?.catch(() => { if (current === welcomeRun) failWelcome(); });
    } catch { if (current === welcomeRun) failWelcome(); }
  }
  function failWelcome() {
    stopAwaken();
    if (!welcomeFeedback) return;
    welcomeFeedback.textContent = 'The welcome couldn’t play. Try Play welcome again.';
    welcomeFeedback.hidden = false;
  }
  function stopAwaken() {
    welcomeRun++;
    if (awakenAudio) {
      awakenAudio.pause();
      if (awakenAudio.readyState > 0) awakenAudio.currentTime = 0;
    }
    announceWelcome(false);
  }
  function updateSound() {
    for (const toggle of soundToggles) {
      toggle.setAttribute('aria-pressed',String(soundOn));
      const state = toggle.querySelector('.sound-state');
      if (state) state.textContent = soundOn ? 'On' : 'Off';
    }
    if (replay) replay.disabled = !soundOn;
    if (!soundOn && welcomeFeedback) welcomeFeedback.hidden = true;
    if (!soundOn) { cutAudio?.pause(); stopAwaken(); }
  }
  function playCut() {
    if (!soundOn || !motionEnabled() || document.hidden) return;
    warmCut();
    if (!cutAudio) return;
    try {
      if (cutAudio.readyState > 0) cutAudio.currentTime = 0;
      cutAudio.play()?.catch(() => {});
    } catch { /* The visual transition does not depend on audio. */ }
  }
  updateSound();
  if (root.dataset.gate === 'closed') warmAwaken();
  else warmCut();
  document.addEventListener('portfolio:awaken',startWelcome);
  document.addEventListener('portfolio:sealed',stopAwaken);
  document.addEventListener('chakra:change',event => { if (event.detail.on) warmCut(); });
  document.addEventListener('visibilitychange',() => { if (document.hidden) stopAwaken(); });
  replay?.addEventListener('click',startWelcome);
  for (const toggle of soundToggles) toggle.addEventListener('click',() => {
    if (toggle.getAttribute('aria-disabled') === 'true') return;
    soundOn = !soundOn;
    updateSound();
    if (soundOn) {
      warmAwaken();
      if (!root.dataset.gate) warmCut();
    }
    try { localStorage.setItem(soundKey,soundOn ? 'on' : 'off'); } catch { /* Keep the choice for this page. */ }
  });

  // Cover the old page, then expose the destination under its own arrival cut.
  let pendingURL, wipeTimer, arrivalTimer;
  if (root.dataset.ink === 'arrive') {
    if (motionEnabled()) arrivalTimer = setTimeout(() => delete root.dataset.ink,350);
    else delete root.dataset.ink;
  }
  const navigate = (cut = false) => {
    if (!pendingURL) return;
    const url = pendingURL;
    pendingURL = null;
    document.dispatchEvent(new CustomEvent('portfolio:route',{detail:{target:url.pathname+url.search,cut}}));
    location.assign(url.href);
  };
  document.addEventListener('click', event => {
    if (root.dataset.gate || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || !url.pathname.endsWith('/')) return;
    event.preventDefault();
    if (pendingURL) return;
    if (welcomeActive) stopAwaken();
    clearTimeout(arrivalTimer);
    pendingURL = url;
    if (!motionEnabled() || document.hidden) { navigate(); return; }
    root.dataset.ink = 'depart';
    playCut();
    wipeTimer = setTimeout(() => navigate(true),215);
  });
  window.addEventListener('pagehide', () => {
    stopAwaken();
    clearTimeout(wipeTimer);
    clearTimeout(arrivalTimer);
    pendingURL = null;
    delete root.dataset.ink;
  });

  // Tiny pointer offsets on the art and button glyphs. Touch keeps still.
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const resetters = [];
  function follow(el, target, strengthX, strengthY, xProp, yProp, units) {
    let queued = 0, x = 0, y = 0;
    const reset = () => {
      if (queued) cancelAnimationFrame(queued);
      queued = 0;
      target.style.removeProperty(xProp);
      target.style.removeProperty(yProp);
    };
    resetters.push(reset);
    el.addEventListener('pointermove', event => {
      if (!motionEnabled() || !fine.matches || event.pointerType !== 'mouse') return;
      x = event.clientX; y = event.clientY;
      if (!queued) queued = requestAnimationFrame(() => {
        queued = 0;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        const clamp = v => Math.max(-1, Math.min(1, v));
        target.style.setProperty(xProp, clamp((x - b.left) * 2 / b.width - 1) * strengthX + units);
        target.style.setProperty(yProp, clamp((y - b.top) * 2 / b.height - 1) * strengthY + units);
      });
    }, {passive: true});
    el.addEventListener('pointerleave', reset);
    el.addEventListener('pointercancel', reset);
  }
  document.querySelectorAll('.project-art').forEach(el => follow(el, el, 6, -5, '--art-y', '--art-x', 'deg'));
  document.querySelectorAll('.button').forEach(el => follow(el, el, 4, 3, '--pull-x', '--pull-y', 'px'));
  document.addEventListener('portfolio:motion', event => {
    if (event.detail.on) return;
    cutAudio?.pause();
    delete root.dataset.ink;
    clearTimeout(wipeTimer);
    if (pendingURL) navigate();
    resetters.forEach(reset => reset());
  });

  let scrollQueued = false;
  const updateProgress = () => {
    const height = root.scrollHeight - window.innerHeight;
    root.style.setProperty('--reading-progress', height > 0 ? Math.min(window.scrollY / height, 1) : 0);
    scrollQueued = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateProgress); }
  }, {passive: true});
  window.addEventListener('resize', updateProgress, {passive: true});
  updateProgress();

  const sections = document.querySelectorAll('.case-prose section[id]');
  if (sections.length && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) document.querySelectorAll('.case-toc a').forEach(link => {
          if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, {rootMargin: '-15% 0px -60% 0px'});
    sections.forEach(section => sectionObserver.observe(section));
  }
})();
