const EVENT_START = Date.UTC(2026, 9, 20, 12, 0, 0); // 20 Oct 2026, 14:00 CEST
const EVENT_END = Date.UTC(2026, 9, 20, 16, 0, 0);   // 20 Oct 2026, 18:00 CEST

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;

// ---------------------------------------------------------------------------
// Drone sound, synthesised with the Web Audio API (no audio files).
// It starts when the visitor presses "Take off" (browsers only allow audio
// after a user interaction) and winds down when the drone lands.
// ---------------------------------------------------------------------------
const droneSound = (function () {
  const VOLUME = 0.2;
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx, master, filter, pitch, playing = false, near = true, lastThrottle = 0;

  function build() {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1500; filter.Q.value = 1.2;
    filter.connect(master);

    // Shared pitch offset (in cents) for all four motors: spool-up and throttle.
    pitch = ctx.createConstantSource();
    pitch.offset.value = -2400;
    pitch.start();

    // Slow wobble in sync with the hover, plus a faster jitter.
    const wobble = ctx.createOscillator(); wobble.frequency.value = 0.25;
    const wobbleAmt = ctx.createGain(); wobbleAmt.gain.value = 30;
    wobble.connect(wobbleAmt); wobble.start();
    const jitter = ctx.createOscillator(); jitter.frequency.value = 1.7;
    const jitterAmt = ctx.createGain(); jitterAmt.gain.value = 12;
    jitter.connect(jitterAmt); jitter.start();

    // Four slightly detuned motors: their beating gives the typical quadcopter buzz.
    [1, 1.013, 0.991, 1.022].forEach((ratio) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 170 * ratio;
      pitch.connect(o.detune); wobbleAmt.connect(o.detune); jitterAmt.connect(o.detune);
      const g = ctx.createGain(); g.gain.value = 0.11;
      o.connect(g).connect(filter);
      o.start();
    });

    // Propeller wash: band-passed noise.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.22;
    noise.connect(bp).connect(ng).connect(master);
    noise.start();
  }

  const level = () => VOLUME * (near ? 1 : 0.5);

  function start() {
    if (!AC) return;
    if (!ctx) build();
    ctx.resume();
    const t = ctx.currentTime;
    // Spool the motors up from low revs.
    pitch.offset.cancelScheduledValues(t);
    pitch.offset.setValueAtTime(pitch.offset.value, t); // from current revs (-2400 when parked)
    pitch.offset.setTargetAtTime(0, t, 0.45);
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(level(), t + 1.2);
    playing = true;
  }

  // Ease the motors off during the descent, then cut them at touchdown.
  function land(descent) {
    if (!ctx || !playing) return;
    playing = false;
    const t = ctx.currentTime;
    pitch.offset.cancelScheduledValues(t);
    pitch.offset.setValueAtTime(pitch.offset.value, t);
    pitch.offset.setTargetAtTime(-450, t, descent / 3);
    pitch.offset.setTargetAtTime(-2400, t + descent, 0.35);
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.setValueAtTime(master.gain.value, t + descent);
    master.gain.linearRampToValueAtTime(0, t + descent + 0.9);
    setTimeout(() => { if (!playing) ctx.suspend(); }, (descent + 1.2) * 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !playing) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return {
    start,
    land,
    // Scout drone speed (px/frame) -> motor revs.
    throttle(v) {
      if (!playing) return;
      const cents = Math.min(700, v * 25);
      if (cents !== 0 && Math.abs(cents - lastThrottle) < 15) return;
      lastThrottle = cents;
      const t = ctx.currentTime;
      pitch.offset.setTargetAtTime(cents, t, 0.15);
      filter.frequency.setTargetAtTime(1500 + cents * 2, t, 0.15);
    },
    // Barrel roll: quick burst of revs.
    boost() {
      if (!playing) return;
      const t = ctx.currentTime;
      pitch.offset.setTargetAtTime(900, t, 0.08);
      pitch.offset.setTargetAtTime(0, t + 0.5, 0.3);
    },
    // Louder when the big drone is on screen.
    setNear(v) {
      near = v;
      if (playing) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);
    },
  };
})();

// ---------------------------------------------------------------------------
// Top bar background on scroll
// ---------------------------------------------------------------------------
const topbar = document.querySelector('.topbar');
const onScrollBar = () => topbar.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScrollBar, { passive: true });
onScrollBar();

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------
(function countdown() {
  const box = document.getElementById('countdown');
  const el = (k) => box.querySelector(`[data-cd="${k}"]`);
  const pad = (n) => String(n).padStart(2, '0');

  function tick() {
    const now = Date.now();
    if (now >= EVENT_END) {
      box.innerHTML = '<div style="flex:1"><b>Thank you!</b><span>See you at the next edition</span></div>';
      return;
    }
    if (now >= EVENT_START) {
      box.innerHTML = '<div style="flex:1"><b class="accent">Live now</b><span>Sala Seminari Ovest</span></div>';
      return;
    }
    let s = Math.floor((EVENT_START - now) / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    el('d').textContent = d;
    el('h').textContent = pad(h);
    el('m').textContent = pad(m);
    el('s').textContent = pad(s);
    setTimeout(tick, 1000);
  }
  tick();
})();

// ---------------------------------------------------------------------------
// Reveal-on-scroll
// ---------------------------------------------------------------------------
(function reveal() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((i) => i.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  items.forEach((i) => io.observe(i));
})();

// ---------------------------------------------------------------------------
// Hero drone: tilt towards the pointer, barrel roll on click, live HUD
// ---------------------------------------------------------------------------
(function heroDrone() {
  const visual = document.getElementById('hero-visual');
  const wrap = document.getElementById('hero-drone');

  if (!reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      const tx = (e.clientX / window.innerWidth) * 2 - 1;
      const ty = (e.clientY / window.innerHeight) * 2 - 1;
      visual.style.setProperty('--tx', tx.toFixed(3));
      visual.style.setProperty('--ty', ty.toFixed(3));
    }, { passive: true });
  }

  const hero = document.querySelector('.hero');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      hero.classList.toggle('paused', !e.isIntersecting);
      droneSound.setNear(e.isIntersecting);
    }).observe(hero);
  }

  function roll() {
    droneSound.boost();
    wrap.classList.remove('roll');
    void wrap.offsetWidth; // restart the animation
    wrap.classList.add('roll');
  }
  wrap.addEventListener('animationend', (e) => {
    if (e.animationName === 'roll') wrap.classList.remove('roll');
  });

  // --- Take off / land ---------------------------------------------------
  const btn = document.getElementById('takeoff-btn');
  const label = btn.querySelector('.takeoff-label');
  const DESCENT = 2.2; // seconds, matches the .landed transition in style.css
  let flying = false, timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function setFlying(v) {
    flying = v;
    timers.forEach(clearTimeout); timers = [];
    btn.classList.remove('hint');
    btn.setAttribute('aria-pressed', String(v));
    label.textContent = v ? 'Land' : 'Take off';
    btn.title = v ? 'Land the drone' : 'Take off (with sound)';
    wrap.title = v ? 'Click for a barrel roll' : 'Click to take off';
  }

  function takeOff() {
    setFlying(true);
    droneSound.start();
    visual.classList.remove('landed', 'landing');
    visual.classList.add('spooling');            // props spin up while still on the pad
    later(() => visual.classList.remove('spooling'), 700);
    if (!reduceMotion) {                          // show off once airborne
      later(() => { if (!hero.classList.contains('paused')) roll(); }, 3000);
    }
  }

  function land() {
    setFlying(false);
    droneSound.land(DESCENT);
    wrap.classList.remove('roll');
    visual.classList.remove('spooling');
    visual.classList.add('landed', 'landing');   // props keep turning on the way down
    later(() => visual.classList.remove('landing'), DESCENT * 1000);
  }

  btn.addEventListener('click', () => (flying ? land() : takeOff()));
  wrap.addEventListener('click', () => (flying ? roll() : takeOff()));

  // --- HUD -----------------------------------------------------------------
  const alt = document.getElementById('hud-alt');
  const link = document.getElementById('hud-link');
  const blocked = document.getElementById('hud-threat');
  let count = 0, altitude = 0;
  setInterval(() => {
    if (hero.classList.contains('paused')) return;
    const t = performance.now() / 1000;
    const goal = flying ? 42 + Math.sin(t * 1.57) * 1.6 + Math.sin(t * 3.1) * 0.3 : 0;
    altitude += (goal - altitude) * 0.12;
    alt.textContent = altitude.toFixed(1);
    link.textContent = flying ? 'SECURE' : 'STANDBY';
  }, 200);
  (function blockLoop() {
    setTimeout(() => {
      if (flying) blocked.textContent = ++count;
      blockLoop();
    }, 1500 + Math.random() * 3500);
  })();
})();

// ---------------------------------------------------------------------------
// Network constellation background
// ---------------------------------------------------------------------------
(function sky() {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  let w, h, dpr, nodes = [];
  const mouse = { x: -9999, y: -9999 };
  const LINK = lowPower ? 120 : 150;
  const FRAME_MS = lowPower ? 1000 / 30 : 0; // 30 fps is plenty for a slow background
  const STEP = lowPower ? 2 : 1; // same apparent speed at half the frame rate
  let lastW = 0, lastFrame = -Infinity;

  function resize() {
    // Mobile browsers fire resize when the URL bar shows/hides: ignore height-only changes.
    if (lowPower && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    dpr = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = lowPower ? screen.height || window.innerHeight : window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    if (lowPower) canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(130, Math.round((w * h) / (lowPower ? 20000 : 13000)));
    nodes = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.6,
    }));
  }

  function draw(t = 0) {
    if (!reduceMotion) requestAnimationFrame(draw);
    if (FRAME_MS && t - lastFrame < FRAME_MS) return;
    lastFrame = t;
    ctx.clearRect(0, 0, w, h);
    for (const p of nodes) {
      p.x += p.vx * STEP; p.y += p.vy * STEP;
      if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          const o = 1 - Math.sqrt(d2) / LINK;
          ctx.strokeStyle = `rgba(120, 200, 255, ${o * 0.22})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const mx = a.x - mouse.x, my = a.y - mouse.y;
      const md = Math.sqrt(mx * mx + my * my);
      if (md < 200) {
        ctx.strokeStyle = `rgba(63, 208, 255, ${(1 - md / 200) * 0.55})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    for (const p of nodes) {
      ctx.fillStyle = 'rgba(170, 225, 255, .8)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) mouse.x = mouse.y = -9999; });
  resize();
  draw();
})();

// ---------------------------------------------------------------------------
// Scout drone that flies along a path through the page as you scroll
// ---------------------------------------------------------------------------
(function flightPath() {
  const main = document.querySelector('main');
  const hero = document.querySelector('.hero');
  const layer = document.querySelector('.flight-layer');
  const svg = document.getElementById('flight');
  const guide = document.getElementById('flight-guide');
  const trail = document.getElementById('flight-trail');
  const scout = document.getElementById('scout');
  const sections = [...document.querySelectorAll('main > .section')];
  const last = sections[sections.length - 1];

  let total = 0, layerTop = 0, layerH = 0;
  let current = 0, angle = 90, size = 1, running = false, lastDrawn = -1;

  function build() {
    const W = document.documentElement.clientWidth;
    layerTop = hero.offsetTop + hero.offsetHeight - 40;
    layerH = main.offsetHeight - layerTop;
    layer.style.top = layerTop + 'px';
    layer.style.height = layerH + 'px';
    svg.setAttribute('viewBox', `0 0 ${W} ${layerH}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', layerH);

    // Fly along the page margins, crossing sides in the gaps between sections.
    const contentLeft = Math.max(16, (W - 1180) / 2 + Math.min(40, Math.max(16, W * 0.04)));
    size = W < 640 ? 0.6 : 1;
    const gutter = Math.max(22 * size, contentLeft / 2);
    const sideX = [gutter, W - gutter];

    let d = `M ${W / 2} 0`;
    let x = W / 2, y = 0;
    const cross = (nx, ny) => {
      const k = (ny - y) * 0.75;
      d += ` C ${x} ${y + k} ${nx} ${ny - k} ${nx} ${ny}`;
      x = nx; y = ny;
    };
    sections.forEach((s, i) => {
      const top = s.offsetTop - layerTop;
      const bottom = top + s.offsetHeight;
      if (s === last) {
        cross(W / 2, top + s.offsetHeight / 2 - 20);
        return;
      }
      cross(sideX[i % 2], top + 60);
      d += ` L ${sideX[i % 2]} ${bottom - 50}`;
      y = bottom - 50;
    });

    guide.setAttribute('d', d);
    trail.setAttribute('d', d);
    total = guide.getTotalLength();
    lastDrawn = -1;
    wake();
  }

  function target() {
    const center = window.scrollY + window.innerHeight * 0.55;
    const p = (center - (main.offsetTop + layerTop)) / layerH;
    return Math.max(0, Math.min(1, p)) * total;
  }

  function frame() {
    const goal = target();
    const prev = current;
    current += (goal - current) * (reduceMotion ? 1 : 0.08);
    if (Math.abs(goal - current) < 0.3) current = goal;
    const v = current - prev;
    droneSound.throttle(Math.abs(v));

    if (current !== lastDrawn) {
      const pt = guide.getPointAtLength(current);
      const a = guide.getPointAtLength(Math.max(0, current - 1));
      const b = guide.getPointAtLength(Math.min(total, current + 1));
      let heading = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      if (v < 0) heading += 180;
      if (Math.abs(v) > 0.05) angle += ((((heading - angle) % 360) + 540) % 360 - 180) * 0.15;
      const scale = size * (1 + Math.min(0.25, Math.abs(v) / 60));
      scout.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) rotate(${angle}deg) scale(${scale})`;
      trail.style.strokeDasharray = `${current} ${total}`;
      lastDrawn = current;
    }

    if (current === goal) { running = false; droneSound.throttle(0); return; } // sleep until the next scroll
    requestAnimationFrame(frame);
  }

  function wake() {
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  let lastW = 0;
  build();
  current = target();
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => {
    // Ignore height-only resizes (mobile URL bar) to avoid rebuilding while scrolling.
    if (window.innerWidth === lastW) return wake();
    lastW = window.innerWidth;
    build();
  });
  lastW = window.innerWidth;
  window.addEventListener('load', build);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
})();
