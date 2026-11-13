(() => {
  'use strict';
  const stage = document.querySelector('[data-shuriken]');
  const button = document.querySelector('.shuriken-spin');
  const canvas = stage?.querySelector('.shuriken-canvas');
  const face = stage?.querySelector('.shuriken-face');
  const context = canvas?.getContext('2d',{alpha:true});
  if (!context || !face || !button) return;
  const root = document.documentElement;
  const fine = matchMedia('(pointer:fine) and (hover:hover)');
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const radians = Math.PI/180, turn = 2*Math.PI, depth = 4.6;
  const restX = 17*radians, restY = -18*radians;
  const clamp = n => Math.min(1,Math.max(-1,n));
  const rings = JSON.parse(stage.dataset.rings);
  const walls = rings.flatMap((ring,group) => ring.map(([x,y],i) => {
    const [u,v] = ring[(i+1)%ring.length];
    return {group,points:[[x,y,-depth],[u,v,-depth],[u,v,depth],[x,y,depth]]};
  }));
  const tints = Array.from({length:128},(_,v) => 'rgb('+v+','+(v+9)+','+(v+18)+')');
  let onscreen = true, request = 0, lastDraw = 0, due = 0, rate = '', start = 0;
  const idle = 17*radians;
  let pitch = restX, yaw = restY, targetX = restX, targetY = restY;
  let pointer, pointerBox;

  const enabled = () => !root.dataset.gate && root.dataset.motion === 'on' && !reduce.matches && !document.hidden;
  const active = () => enabled() && onscreen;
  function paint(rx,ry,rz,zoom=1,lift=0) {
    if (!face.complete || !face.naturalWidth) return;
    const c = [Math.cos(rx),Math.cos(ry),Math.cos(rz)];
    const s = [Math.sin(rx),Math.sin(ry),Math.sin(rz)];
    const rotate = ([x,y,z]) => {
      const px = c[2]*x - s[2]*y, py = s[2]*x + c[2]*y;
      const xx = c[1]*px + s[1]*z, zz = -s[1]*px + c[1]*z;
      return [xx,c[0]*py-s[0]*zz,s[0]*py+c[0]*zz];
    };
    const side = rotate([0,0,1])[2] < 0 ? -depth : depth;
    const surfaces = walls.flatMap(({group,points}) => {
      const p = points.map(rotate);
      const [a,b,,e] = p;
      const facing = (b[0]-a[0])*(e[1]-a[1])-(b[1]-a[1])*(e[0]-a[0]);
      if ((group ? -facing : facing) <= .03) return [];
      return [{group,p,z:(p[0][2]+p[2][2])/2}];
    });
    const center = rotate([0,0,side]);
    surfaces.push({z:center[2],center});
    surfaces.sort((a,b) => a.z-b.z);
    const width = canvas.width, height = canvas.height, unit = Math.min(width,height)*.0047;
    context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,width,height);
    context.setTransform(unit*zoom,0,0,unit*zoom,width/2,height/2+lift*unit);
    for (const surface of surfaces) {
      if (surface.center) {
        const [ax,ay] = rotate([1,0,0]), [bx,by] = rotate([0,1,0]);
        context.save();
        context.transform(ax,ay,bx,by,center[0],center[1]);
        context.drawImage(face,-100,-100,200,200);
        context.restore();
      } else {
        const [a,b,d,e] = surface.p;
        const nx = (b[1]-a[1])*(e[2]-a[2])-(b[2]-a[2])*(e[1]-a[1]);
        const ny = (b[2]-a[2])*(e[0]-a[0])-(b[0]-a[0])*(e[2]-a[2]);
        const len = Math.hypot(nx,ny) || 1;
        const glow = Math.round((surface.group ? 35 : 70) + (nx-ny)/len*12);
        context.fillStyle = tints[glow];
        context.beginPath();
        context.moveTo(a[0],a[1]); context.lineTo(b[0],b[1]);
        context.lineTo(d[0],d[1]); context.lineTo(e[0],e[1]); context.closePath();
        context.fill();
      }
    }
    if (!stage.dataset.renderer) stage.dataset.renderer = 'canvas';
  }

  function fit() {
    pointerBox = undefined;
    const box = canvas.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio || 1,1.5);
    const pixels = Math.max(1,Math.round(box.width*scale));
    if (canvas.width !== pixels) canvas.width = canvas.height = pixels;
    if (!request) paint(pitch,yaw,idle);
  }

  function wake() {
    if (request || !active()) return;
    lastDraw = 0;
    rate = '';
    request = requestAnimationFrame(tick);
  }

  function tick(now) {
    request = 0;
    if (!active()) return;
    const preference = root.dataset.frameLimit;
    const gap = preference === '60' || preference === '120' ? 1000/Number(preference) : 0;
    if (rate !== preference) { rate = preference; due = now; }
    if (!gap || now+.25 >= due) {
      const dt = lastDraw ? Math.min(now-lastDraw,50) : 16.7;
      lastDraw = now;
      if (gap) due += (Math.floor(Math.max(0,now-due)/gap)+1)*gap;
      if (pointer) {
        pointerBox ||= stage.getBoundingClientRect();
        targetX = clamp(1-2*(pointer.y-pointerBox.top)/pointerBox.height)*50*radians;
        targetY = clamp(2*(pointer.x-pointerBox.left)/pointerBox.width-1)*61*radians;
      }
      const blend = 1-Math.exp(-dt/68);
      pitch += (targetX-pitch)*blend;
      yaw += (targetY-yaw)*blend;
      if (start) {
        const t = Math.min(Math.max((now-start)/950,0),1);
        const swing = Math.sin(Math.PI*t);
        const eased = 1-(1-t)**1.7;
        paint(pitch+58*radians*swing*Math.cos(Math.PI*t),yaw+turn*eased,idle+3*turn*eased,1+.105*swing,-9*swing);
        if (t === 1) { start = 0; stage.removeAttribute('data-flipping'); }
      } else paint(pitch,yaw,idle);
    }
    if (start || Math.abs(pitch-targetX)+Math.abs(yaw-targetY) > .001) {
      request = requestAnimationFrame(tick);
    }
  }

  function update() {
    const moves = active();
    stage.toggleAttribute('data-moving',moves);
    button.disabled = !enabled();
    if (moves) {
      if (!stage.dataset.renderer) paint(pitch,yaw,idle);
    } else {
      cancelAnimationFrame(request);
      request = 0;
      start = 0;
      stage.removeAttribute('data-flipping');
      pointer = undefined;
      targetX = restX;
      targetY = restY;
      paint(pitch,yaw,idle);
    }
  }

  button.hidden = false;
  face.addEventListener('load',fit);
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(canvas);
  else window.addEventListener('resize',fit,{passive:true});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      update();
    },{threshold:.06});
    observer.observe(stage);
  }
  new MutationObserver(update).observe(root,{attributes:true,attributeFilter:['data-gate','data-motion']});
  document.addEventListener('visibilitychange',update);
  reduce.addEventListener('change',update);
  stage.addEventListener('pointerenter',() => { pointerBox = undefined; });
  window.addEventListener('scroll',() => { pointerBox = undefined; },{passive:true});
  stage.addEventListener('pointermove',event => {
    if (active() && fine.matches && event.pointerType === 'mouse') {
      pointer = {x:event.clientX,y:event.clientY};
      wake();
    }
  },{passive:true});
  function releaseAim() { pointer = undefined; targetX = restX; targetY = restY; wake(); }
  stage.addEventListener('pointerleave',releaseAim);
  stage.addEventListener('pointercancel',releaseAim);
  function throwBlade() {
    if (!active() || !stage.dataset.renderer || start) return;
    start = performance.now();
    stage.setAttribute('data-flipping','');
    wake();
  }
  button.addEventListener('click',throwBlade);
  stage.addEventListener('click',throwBlade);
  fit();
  update();
})();
