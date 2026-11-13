/* A fixed pool of small effects follows real, measured edges. No per-frame JS. */
(() => {
  'use strict';
  if (!CSS.supports('offset-path', 'path("M0 0L1 1")') || !('IntersectionObserver' in window)) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 760px)');
  const stackedStats = matchMedia('(max-width: 580px)');
  const particleTypes = ['wisp','coal','echo','lead'];
  const items = [...document.querySelectorAll('[data-ember]')].flatMap((el,index) => {
    const layer = el.lastElementChild;
    return layer?.classList.contains('ember-edge')
      ? [{el,layer,index,kind:el.dataset.ember,quiet:el.matches('.toast'),key:''}] : [];
  });
  const byElement = new Map(items.map(item => [item.el,item]));
  const visible = new Set();
  const running = new Set();
  const gate = items.find(item => item.el.matches('.gate-toggle'));
  let state = '', queued = 0, pointed = null, focused = null, struck = null, strikeTimer = 0;

  // CSS motion paths use local pixels, so the bright part is the same size on
  // every box and does not stretch when a rectangle gets wider or taller.
  function contour(item) {
    const {el,layer,kind} = item;
    const w = layer.clientWidth, h = layer.clientHeight;
    if (w < 5 || h < 5 || item.quiet) return null;
    const right = w - 1, bottom = h - 1;
    const radius = Math.min(parseFloat(getComputedStyle(layer).borderTopLeftRadius) || 0,w/2,h/2);
    let edge = kind;
    if (kind === 'band') edge = item.band === 'bottom' ? 'bottom' : 'top';
    if (kind === 'column' && (
      (narrow.matches && el.parentElement.matches('.approach-grid')) ||
      (stackedStats.matches && el.parentElement.matches('.case-stats,.evidence-inner'))
    )) edge = 'top';
    const full = ['frame','control','detail'].includes(edge);
    if (!full) {
      if (edge === 'top' || edge === 'bottom') {
        const y = edge === 'bottom' ? bottom : 1;
        return {path:'M 1 '+y+' H '+right,length:w-2,full};
      }
      return {path:'M 1 1 V '+bottom,length:h-2,full};
    }
    const r = Math.max(0,radius - 2);
    const path = r > .25
      ? `M ${1+r} 1 H ${right-r} A ${r} ${r} 0 0 1 ${right} ${1+r} V ${bottom-r} A ${r} ${r} 0 0 1 ${right-r} ${bottom} H ${1+r} A ${r} ${r} 0 0 1 1 ${bottom-r} V ${1+r} A ${r} ${r} 0 0 1 ${1+r} 1 Z`
      : `M 1 1 H ${right} V ${bottom} H 1 Z`;
    return {path,length:2*(w+h-4)-(8-2*Math.PI)*r,full};
  }

  function activate(item) {
    const box = contour(item);
    if (!box) return false;
    const fps = Number(root.dataset.frameLimit);
    const duration = Math.min(box.full ? 9 : 6.5,Math.max(1.85,box.length / (box.full ? 205 : 270)));
    const direction = box.full ? 1 : .5;
    const band = item.band || '';
    const key = [box.path,band,fps].join('|');
    if (item.key !== key) {
      item.key = key;
      const {el} = item;
      el.style.setProperty('--ember-path','path("'+box.path+'")');
      el.style.setProperty('--ember-time',duration.toFixed(3)+'s');
      el.style.setProperty('--ember-start',(-duration * (direction * (((item.index * .381966) % 1) * .78 + .1))).toFixed(3)+'s');
      const wake = Math.min(1.35,Math.max(.66,box.length / 260));
      el.style.setProperty('--ember-wake',wake.toFixed(3)+'s');
      el.style.setProperty('--ember-wake-pace',fps ? 'steps('+Math.round(wake*fps)+',end)' : 'linear');
      el.style.setProperty('--ember-pace',fps ? 'steps('+Math.round(duration*fps)+',end)' : 'linear');
      el.toggleAttribute('data-ember-open',!box.full);
    }
    if (!running.has(item)) {
      item.layer.append(...particleTypes.map(type => {
        const part = document.createElement('span');
        part.className = 'ember-'+type;
        return part;
      }));
      running.add(item);
      item.el.dataset.emberLive = '';
    }
    return true;
  }

  function stop(item) {
    delete item.el.dataset.emberLive;
    item.layer.replaceChildren();
    delete item.el.dataset.emberWake;
    running.delete(item);
  }

  function spark(el) {
    if (state !== 'open' || !el || el.matches(':disabled,[aria-disabled=true]')) return;
    struck = el;
    clearTimeout(strikeTimer);
    const item = byElement.get(el);
    if (item && running.has(item)) stop(item);
    strikeTimer = setTimeout(() => {
      if (item) delete item.el.dataset.emberWake;
      struck = null;
      schedule();
    },1440);
    schedule();
  }

  function bounds(item) {
    const {el,layer,kind} = item;
    const rect = layer.getBoundingClientRect();
    if (rect.width < 5 || rect.height < 5 || rect.bottom <= 0 || rect.top >= innerHeight ||
        rect.right <= 0 || rect.left >= innerWidth || item.quiet || el.matches(':disabled,[aria-disabled=true]')) return null;
    const center = innerHeight * .49;
    const inView = y => y >= 0 && y < innerHeight;
    const horizontal = kind === 'top' || kind === 'bottom' || kind === 'band';
    if (kind === 'band') {
      const useBottom = inView(rect.bottom) && (!inView(rect.top) || Math.abs(center - rect.bottom) < Math.abs(center - rect.top));
      item.band = useBottom ? 'bottom' : 'top';
    }
    const y = kind === 'bottom' || item.band === 'bottom' ? rect.bottom : rect.top;
    if (horizontal && !inView(y)) return null;
    return {center,y,rect};
  }

  function schedule() {
    if (state && !queued) queued = requestAnimationFrame(refresh);
  }

  function refresh() {
    queued = 0;
    if (!state) return;
    if (state === 'gate') {
      if (gate) activate(gate);
      return;
    }
    const candidates = [];
    const attention = struck || pointed || focused;
    for (const item of visible) {
      const area = bounds(item);
      if (!area) continue;
      const {el,kind} = item;
      const focus = el === attention;
      const important = kind === 'frame' && !el.matches('.resume-preview');
      const row = ['top','bottom','band','left','column'].includes(kind);
      const selected = el.matches('.button-primary,.project-filter [aria-pressed=true]');
      // Section dividers can spark, but never compete with the panel they separate.
      const priority = focus ? 650 : important ? 260 : selected ? 150 : kind === 'control' ? 115 : row ? 75 : 32;
      const position = row ? area.y : Math.min(area.rect.bottom,Math.max(area.center,area.rect.top));
      candidates.push({item,score:priority - Math.abs(position-area.center)*.135 + (running.has(item) ? 16 : 0),row,focus,selected});
    }
    candidates.sort((a,b) => b.score - a.score || a.item.index - b.item.index);
    const maximum = narrow.matches ? 4 : 6;
    const chosen = new Set();
    let rowCount = 0;
    let buttonCount = 0;
    // Limit separators and keep detail frames quiet while their parent is lit.
    for (const {item,row,focus,selected} of candidates) {
      if (chosen.size >= maximum) break;
      if (row && rowCount >= 1) continue;
      const button = item.kind === 'control';
      if (button && !focus && (!selected || buttonCount >= (attention ? 2 : 1))) continue;
      if (!focus && (item.kind === 'detail' || item.el.matches('.resume-preview'))) continue;
      chosen.add(item);
      if (button) buttonCount++;
      if (row) rowCount++;
    }
    for (const item of running) if (!chosen.has(item)) stop(item);
    for (const item of chosen) {
      if (item.el === struck) item.el.dataset.emberWake = '';
      activate(item);
    }
  }

  const observer = new IntersectionObserver(entries => {
    if (state !== 'open') return;
    for (const entry of entries) {
      const item = byElement.get(entry.target);
      if (entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0) visible.add(item);
      else visible.delete(item);
    }
    schedule();
  });

  function modeChanged() {
    const next = document.hidden || reduced.matches || root.dataset.motion !== 'on' || root.dataset.ink
      ? '' : root.dataset.gate === 'closed' && !root.dataset.awakening ? 'gate'
        : !root.dataset.gate && root.dataset.chakra === 'on' ? 'open' : '';
    if (state === next) {
      schedule(); // Frame limit changes reuse the same elements.
      return;
    }
    state = next;
    observer.disconnect();
    visible.clear();
    cancelAnimationFrame(queued);
    queued = 0;
    for (const item of running) stop(item);
    pointed = focused = struck = null;
    clearTimeout(strikeTimer);
    if (state === 'open') for (const item of items) if (item !== gate && !item.quiet) observer.observe(item.el);
    schedule();
  }

  const control = target => target?.closest?.('[data-ember="control"]') || null;
  const hoverTarget = target => control(target) ||
    target?.closest?.('[data-ember="detail"],.resume-preview') || null;
  document.addEventListener('pointerover',event => {
    if (event.pointerType === 'touch') return;
    const el = hoverTarget(event.target);
    if (pointed !== el) {
      pointed = el;
      if (el) spark(el);
      else schedule();
    }
  },{passive:true});
  document.addEventListener('pointerout',event => {
    if (pointed && hoverTarget(event.relatedTarget) !== pointed) { pointed = null; schedule(); }
  },{passive:true});
  document.addEventListener('focusin',event => {
    focused = control(event.target);
    if (focused) spark(focused);
    else schedule();
  });
  document.addEventListener('focusout',event => {
    if (focused && control(event.relatedTarget) !== focused) { focused = null; schedule(); }
  });
  document.addEventListener('click',event => {
    const el = control(event.target);
    if (el) spark(el);
  });
  new MutationObserver(modeChanged).observe(root,{attributes:true,attributeFilter:[
    'data-gate','data-awakening','data-chakra','data-motion','data-ink','data-frame-limit'
  ]});
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',modeChanged);
  window.addEventListener('pageshow',modeChanged);
  reduced.addEventListener('change',modeChanged);
  narrow.addEventListener('change',schedule);
  stackedStats.addEventListener('change',schedule);
  modeChanged();
})();
