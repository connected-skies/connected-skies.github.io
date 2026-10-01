// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// Put the registration form link here (e.g. a Google/Microsoft Form).
// While empty, the button shows "Registration opening soon".
const REGISTRATION_URL = '';

const EVENT_START = Date.UTC(2026, 9, 20, 12, 0, 0); // 20 Oct 2026, 14:00 CEST
const EVENT_END = Date.UTC(2026, 9, 20, 16, 0, 0);   // 20 Oct 2026, 18:00 CEST

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Registration button
// ---------------------------------------------------------------------------
(function setupRegistration() {
  const link = document.getElementById('register-link');
  if (REGISTRATION_URL) {
    link.href = REGISTRATION_URL;
    link.target = '_blank';
    link.rel = 'noopener';
  } else {
    link.innerHTML = 'Registration opening soon';
    link.setAttribute('aria-disabled', 'true');
    link.style.opacity = '.7';
    link.style.pointerEvents = 'none';
  }
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

  wrap.addEventListener('click', () => {
    wrap.classList.remove('roll');
    void wrap.offsetWidth; // restart the animation
    wrap.classList.add('roll');
  });
  wrap.addEventListener('animationend', (e) => {
    if (e.animationName === 'roll') wrap.classList.remove('roll');
  });

  const alt = document.getElementById('hud-alt');
  const blocked = document.getElementById('hud-threat');
  let count = 0;
  setInterval(() => {
    const t = performance.now() / 1000;
    alt.textContent = (42 + Math.sin(t * 1.57) * 1.6 + Math.sin(t * 3.1) * 0.3).toFixed(1);
  }, 200);
  (function blockLoop() {
    setTimeout(() => {
      count += 1;
      blocked.textContent = count;
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
  const LINK = 150;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(130, Math.round((w * h) / 13000));
    nodes = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.6,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of nodes) {
      p.x += p.vx; p.y += p.vy;
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
    if (!reduceMotion) requestAnimationFrame(draw);
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
  let current = 0, angle = 90, size = 1;

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
    trail.style.strokeDasharray = `0 ${total}`;
  }

  function target() {
    const center = window.scrollY + window.innerHeight * 0.55;
    const p = (center - (main.offsetTop + layerTop)) / layerH;
    return Math.max(0, Math.min(1, p)) * total;
  }

  function frame(t) {
    const goal = target();
    const prev = current;
    current += (goal - current) * (reduceMotion ? 1 : 0.07);
    const v = current - prev;

    const pt = guide.getPointAtLength(current);
    const a = guide.getPointAtLength(Math.max(0, current - 1));
    const b = guide.getPointAtLength(Math.min(total, current + 1));
    let heading = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    if (v < -0.05) heading += 180;
    if (Math.abs(v) > 0.05) {
      let diff = ((heading - angle + 540) % 360) - 180;
      angle += diff * 0.12;
    }
    const bob = reduceMotion ? 0 : Math.sin(t / 380) * 3;
    const scale = size * (1 + Math.min(0.25, Math.abs(v) / 60));
    scout.setAttribute('transform', `translate(${pt.x} ${pt.y + bob}) rotate(${angle}) scale(${scale})`);
    trail.style.strokeDasharray = `${current} ${total}`;
    requestAnimationFrame(frame);
  }

  build();
  current = target();
  window.addEventListener('resize', () => { build(); });
  window.addEventListener('load', build);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  requestAnimationFrame(frame);
})();
