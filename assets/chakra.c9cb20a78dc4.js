/* The palette, gate, and selected frame limit are set before the first paint. */
(() => {
  'use strict';
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const flowKey = 'cv-chakra-current-flow';
  const routeKey = 'cv-chakra-route-handoff';
  const frameKey = 'cv-portfolio-frame-limit';
  const limits = new Set(['auto','60','120']);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const canMove = () => root.dataset.motion === 'on' && !reduce.matches && !document.hidden;
  const get = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const put = (key, value) => { try { localStorage.setItem(key,value); } catch { /* The page still works. */ } };
  let content, gateButton, gateSound, headerButton, headerLabel, main, timer, warmTimer, dissolveTimer, lit = [];
  let flow = null;

  function markEntry() {
    try { history.replaceState({...history.state, cvChakraFlow:flow},''); } catch { /* Private browsing can still open the seal. */ }
  }

  function startFlow() {
    flow = Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    try { sessionStorage.setItem(flowKey,flow); } catch { /* Unlock is local to this page. */ }
    markEntry();
  }

  function endFlow() {
    flow = null;
    try { sessionStorage.removeItem(flowKey); sessionStorage.removeItem(routeKey); } catch { /* Storage is optional. */ }
  }

  function carryRoute(event) {
    if (!flow || root.dataset.gate) return;
    const {target, cut} = event.detail;
    try { sessionStorage.setItem(routeKey, JSON.stringify({flow,target,cut,at:Date.now()})); }
    catch { /* Direct navigation still works. */ }
  }

  function enterRoute() {
    try {
      const token = sessionStorage.getItem(flowKey);
      const stamp = JSON.parse(sessionStorage.getItem(routeKey) || 'null');
      sessionStorage.removeItem(routeKey);
      const type = performance.getEntriesByType('navigation')[0]?.type;
      if (token && type === 'back_forward' && history.state?.cvChakraFlow === token) {
        flow = token;
        return true;
      }
      const fromSameSite = document.referrer && new URL(document.referrer).origin === location.origin;
      const age = Date.now() - (stamp?.at ?? 0);
      if (token && type !== 'reload' && fromSameSite && stamp?.flow === token &&
          stamp.target === location.pathname+location.search && age >= 0 && age < 10000) {
        flow = token;
        markEntry();
        if (stamp.cut && !reduce.matches && get('cv-portfolio-v6-motion') !== 'off') root.dataset.ink = 'arrive';
        return true;
      }
    } catch { /* Fresh visits always have an accessible seal. */ }
    endFlow();
    return false;
  }

  function palette(on) {
    const next = on ? 'on' : 'off';
    const changed = root.dataset.chakra !== next;
    root.dataset.chakra = next;
    themeColor?.setAttribute('content', on ? '#0e0b0b' : '#050405');
    if (headerButton?.getAttribute('aria-pressed') !== String(on)) headerButton?.setAttribute('aria-pressed',String(on));
    if (headerLabel && headerLabel.textContent !== (on ? 'On' : 'Off')) headerLabel.textContent = on ? 'On' : 'Off';
    if (changed) document.dispatchEvent(new CustomEvent('chakra:change', {detail:{on}}));
  }

  function showGate(state) {
    if (state) root.dataset.gate = state;
    else delete root.dataset.gate;
    if (content) {
      content.inert = !!state;
      if (state) content.setAttribute('aria-hidden','true');
      else content.removeAttribute('aria-hidden');
    }
  }

  function clearEffect() {
    clearTimeout(timer);
    clearTimeout(warmTimer);
    clearTimeout(dissolveTimer);
    delete root.dataset.awakening;
    delete root.dataset.release;
    for (const item of lit) {
      item.classList.remove('ignite');
      item.style.removeProperty('--ignite-delay');
    }
    lit = [];
    setGateBusy(false);
  }

  function setGateBusy(busy) {
    for (const control of [gateButton, gateSound]) {
      if (busy) control?.setAttribute('aria-disabled','true');
      else control?.removeAttribute('aria-disabled');
    }
  }

  function finish(on, {focus = false} = {}) {
    clearEffect();
    if (on && !flow) startFlow();
    if (!on) {
      endFlow();
      document.dispatchEvent(new Event('portfolio:sealed'));
    }
    palette(on);
    showGate(on ? '' : 'closed');
    if (focus) (on ? main : gateButton)?.focus({preventScroll:true});
  }

  function lineUpEvidence() {
    // Read visible positions together, then write. Offscreen sections use their normal scroll reveal.
    const items = [...document.querySelectorAll(
      '.profile-evidence strong, .evidence-inner strong, .case-stats strong, .project-result strong, .page-intro h1, .case-intro h1, .hero-discipline, .project-kicker .forge-mark'
    )].flatMap(item => {
      const r = item.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return [];
      return [{item,delay:Math.round(525+170*Math.min((r.left+r.width/2)/innerWidth,1))}];
    });
    lit = items.map(({item,delay}) => {
      item.style.setProperty('--ignite-delay',delay+'ms');
      item.classList.add('ignite');
      return item;
    });
  }

  function awaken() {
    if (root.dataset.gate !== 'closed' || root.dataset.awakening) return;
    const animated = canMove();
    // Dispatch on the click stack so user-gesture audio also works on phones.
    document.dispatchEvent(new CustomEvent('portfolio:awaken',{detail:{animated}}));
    if (!animated) { finish(true,{focus:true}); return; }
    root.dataset.awakening = 'charge';
    setGateBusy(true);
    warmTimer = setTimeout(() => {
      // Compute the warm layout behind the opaque chamber without painting it.
      palette(true);
      lineUpEvidence();
    },100);
    timer = setTimeout(() => {
      if (!canMove()) { finish(true,{focus:true}); return; }
      root.dataset.awakening = 'surge';
      showGate('opening');
      dissolveTimer = setTimeout(() => { root.dataset.release = ''; },850);
      // The dissolve normally hands off on animationend; keep an escape hatch
      // for browsers that drop the event while changing display state.
      timer = setTimeout(() => finish(true,{focus:true}),1580);
    },300);
  }

  function seal() {
    if (root.dataset.gate || root.dataset.chakra !== 'on') return;
    endFlow();
    document.querySelector('.frame-settings')?.removeAttribute('open');
    if (!canMove()) { finish(false,{focus:true}); return; }
    document.dispatchEvent(new Event('portfolio:sealed'));
    setGateBusy(true);
    root.dataset.awakening = 'quench';
    showGate('closing');
    gateButton.focus({preventScroll:true});
    timer = setTimeout(() => finish(false,{focus:true}),400);
  }

  function motionChanged() {
    if (canMove()) return;
    const phase = root.dataset.awakening;
    if (phase) finish(phase !== 'quench',{focus:!document.hidden});
  }

  function setUpFrameSettings() {
    const settings = document.querySelector('.frame-settings');
    if (!settings) return;
    const options = [...settings.querySelectorAll('[data-frame-choice]')];
    const feedback = settings.querySelector('.frame-feedback');
    let measured, sampleFrame = 0;
    function describe() {
      const value = root.dataset.frameLimit;
      const chosen = value === 'auto' ? 'Auto follows your browser’s refresh rate.' : 'Transitions limited to '+value+' fps.';
      if (!measured) { feedback.textContent = chosen; return; }
      const rate = 'This tab is running at about '+measured+' Hz.';
      feedback.textContent = value === '120' && measured < 110
        ? '120 fps selected. '+rate+' Transitions use the available refresh rate.'
        : chosen+' '+rate;
    }
    function choose(value) {
      const next = limits.has(value) ? value : 'auto';
      root.dataset.frameLimit = next;
      options.forEach(option => option.setAttribute('aria-pressed',String(option.dataset.frameChoice === next)));
      describe();
    }
    choose(root.dataset.frameLimit);
    for (const option of options) option.addEventListener('click',() => {
      choose(option.dataset.frameChoice);
      put(frameKey,root.dataset.frameLimit);
    });
    settings.addEventListener('toggle',() => {
      cancelAnimationFrame(sampleFrame);
      if (!settings.open || document.hidden) return;
      const times = [];
      let last;
      const tick = now => {
        if (!settings.open || document.hidden) return;
        if (last !== undefined) times.push(now-last);
        last = now;
        if (times.length < 36) { sampleFrame = requestAnimationFrame(tick); return; }
        const stable = times.slice(4).sort((a,b) => a-b);
        const interval = stable[Math.floor(stable.length/2)];
        if (interval >= 2 && interval <= 50) {
          measured = Math.round(1000/interval);
          describe();
        }
      };
      sampleFrame = requestAnimationFrame(tick);
    });
    settings.addEventListener('keydown',event => {
      if (event.key !== 'Escape' || !settings.open) return;
      event.preventDefault();
      settings.open = false;
      settings.querySelector('summary')?.focus();
    });
    document.addEventListener('click',event => {
      if (!settings.contains(event.target)) settings.open = false;
    });
    window.addEventListener('storage',event => {
      if (event.key === frameKey || event.key === null) choose(get(frameKey));
    });
  }

  enterRoute(); const initial = true;
  const limit = get(frameKey);
  root.dataset.frameLimit = limits.has(limit) ? limit : 'auto';
  palette(initial);
  showGate(initial ? '' : 'closed');
  window.addEventListener('DOMContentLoaded',() => {
    content = document.querySelector('.portfolio-content');
    gateButton = document.querySelector('.gate-toggle');
    gateSound = document.querySelector('.gate-sound');
    headerButton = document.querySelector('.chakra-toggle');
    headerLabel = headerButton?.querySelector('.chakra-state');
    main = document.querySelector('main');
    showGate(root.dataset.gate);
    palette(root.dataset.chakra === 'on');
    root.dataset.chakraReady = '';
    gateButton?.addEventListener('click',awaken);
    headerButton?.addEventListener('click',seal);
    document.querySelector('.gate-shot')?.addEventListener('animationend', event => {
      if (event.target === event.currentTarget && event.animationName === 'gate-dissolve' &&
          root.dataset.gate === 'opening') finish(true,{focus:true});
    });
    setUpFrameSettings();
    if (root.dataset.gate === 'closed') gateButton?.focus({preventScroll:true});
    document.addEventListener('keydown',event => {
      if (!root.dataset.gate) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        const next = !root.dataset.awakening && document.activeElement === gateButton ? gateSound : gateButton;
        next?.focus({preventScroll:true});
      }
      if (event.key === 'Escape' && ['charge','surge'].includes(root.dataset.awakening)) finish(false,{focus:true});
    });
  },{once:true});

  document.addEventListener('portfolio:motion',motionChanged);
  document.addEventListener('visibilitychange',motionChanged);
  document.addEventListener('portfolio:route',carryRoute);
  window.addEventListener('pageshow',event => {
    if (!event.persisted) return;
    let stillOpen = false;
    try { stillOpen = !!flow && sessionStorage.getItem(flowKey) === flow; } catch { /* Reopen the seal if needed. */ }
    finish(true,{focus:false});
  });
})();
