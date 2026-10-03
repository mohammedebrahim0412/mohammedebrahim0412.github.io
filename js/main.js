(() => {
  'use strict';
  window.__meBooted = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- smooth scroll ---------------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = t => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  /* ---------------- nav: hide on scroll down, show on scroll up ---------------- */
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const menu = $('#mmenu');
  const menuClose = $('#mmenuClose');
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    if (!menu.classList.contains('is-open')) {
      if (y > 160 && y > lastY + 4) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 160) nav.classList.remove('is-hidden');
    }
    nav.classList.toggle('is-scrolled', y > 24);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- theme toggle ---------------- */
  const themeBtn = $('#themeToggle');
  const themeMeta = $('meta[name="theme-color"]');
  const syncThemeUI = () => {
    const t = root.getAttribute('data-theme');
    themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    if (themeMeta) themeMeta.setAttribute('content', t === 'light' ? '#F7F7F5' : '#030304');
  };
  const applyTheme = t => {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('me-theme', t); } catch (e) {}
    syncThemeUI();
  };
  syncThemeUI();
  themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    if (!document.startViewTransition || reduce) { applyTheme(next); return; }
    // circular reveal growing out of the toggle
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => applyTheme(next));
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(.16, 1, .3, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  });
  /* ---------------- mobile menu ---------------- */
  const isMenuOpen = () => menu.classList.contains('is-open');
  const openMenu = () => {
    menu.classList.add('is-open');
    menu.inert = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    setTimeout(() => menuClose.focus(), 60);
  };
  const closeMenu = () => {
    if (!isMenuOpen()) return;
    const hadFocus = menu.contains(document.activeElement);
    menu.classList.remove('is-open');
    menu.inert = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
    if (hadFocus) toggle.focus({ preventScroll: true });
  };
  toggle.addEventListener('click', openMenu);
  menuClose.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  matchMedia('(min-width: 768px)').addEventListener('change', e => { if (e.matches) closeMenu(); });

  /* ---------------- anchors + deep links ---------------- */
  function scrollToEl(el, instant) {
    const offset = el.id === 'hero' ? 0 : -8;
    if (lenis && lenis.resize) lenis.resize(); // pinning changes page height; refresh Lenis' scroll limit first
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.4, immediate: instant, force: true });
    else el.scrollIntoView({ behavior: instant || reduce ? 'auto' : 'smooth' });
  }
  function scrollToHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (el && el.id !== 'hero') scrollToEl(el, true);
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || id[0] !== '#' || id.length < 2) return;      // e.g. the email link becomes mailto: at runtime
    const el = document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(el, false);
    try { history.replaceState(null, '', id === '#hero' ? location.pathname : id); } catch (err) {}
  }));

  const navLinks = $$('.nav-links a');
  const secIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      navLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['hero', 'about', 'journey', 'framework', 'skills', 'leadership', 'contact'].forEach(id => { const s = $('#' + id); if (s) secIO.observe(s); });

  /* ---------------- split headings into words ---------------- */
  $$('[data-split]').forEach(el => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span');
            inner.className = 'w-in';
            inner.style.setProperty('--wi', i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
  });

  /* ---------------- reveal on scroll ---------------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  $$('[data-reveal], [data-split]').forEach(el => revealIO.observe(el));

  /* =====================================================
     LOADER
     ===================================================== */
  function runLoader() {
    return new Promise(resolve => {
      const loader = $('#loader');
      if (!root.classList.contains('is-loading') || !loader) { loader && loader.remove(); return resolve(); }
      if (lenis) lenis.stop();

      let done = false;
      const timers = [];
      const at = (fn, ms) => timers.push(setTimeout(fn, ms));
      const finish = () => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        try { sessionStorage.setItem('me-loader-seen', '1'); } catch (e) {}
        loader.classList.add('is-done');
        root.classList.remove('is-loading');
        if (lenis) lenis.start();
        setTimeout(() => loader.remove(), 1200);
        resolve();
      };
      loader.addEventListener('click', finish);
      window.addEventListener('keydown', finish, { once: true });

      if (reduce) return finish();

      const typed = $('.t-typed', loader);
      const cmd = typed.dataset.text;
      [...cmd].forEach((_, i) => at(() => { typed.textContent = cmd.slice(0, i + 1); }, 100 + i * 24));
      const start = 100 + cmd.length * 24 + 140;
      $$('.term-line', loader).forEach((line, i) => at(() => line.classList.add('on'), start + i * 105));
      at(finish, start + 8 * 105 + 320);
    });
  }

  /* =====================================================
     HERO — scroll-out parallax
     ===================================================== */
  function initHeroScroll() {
    if (!hasGsap || reduce) return;
    const st = { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.orb-float', { yPercent: 14, scale: .92, ease: 'none', scrollTrigger: st });
    gsap.to('.hero-head, .hero-copy, .hero-side, .hero-ticker', { yPercent: -10, opacity: 0.15, ease: 'none', scrollTrigger: { ...st, start: 'top+=10% top' } });
  }

  /* =====================================================
     ABOUT — statement lights up word by word while scrolling
     ===================================================== */
  function initStatement() {
    $$('[data-scrub]').forEach(p => {
      if (!hasGsap || reduce) return;
      const words = p.textContent.trim().split(/\s+/);
      p.textContent = '';
      words.forEach((w, i) => {
        const s = document.createElement('span');
        s.className = 'sw';
        s.textContent = w;
        p.appendChild(s);
        if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
      });
      gsap.fromTo($$('.sw', p), { opacity: 0.16 }, {
        opacity: 1, stagger: 0.08, ease: 'none',
        scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 48%', scrub: true }
      });
    });
    if (hasGsap && !reduce) {
      gsap.fromTo('.about-photo-in img', { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: '.about-photo', start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }
  }

  /* =====================================================
     JOURNEY — CI pipeline
     ===================================================== */
  function initJourney() {
    const section = $('#journey');
    const stages = $$('.stage', section);
    const markStage = (s, on) => {
      s.classList.toggle('reached', on);
      s.classList.toggle('running', on && s.dataset.status === 'RUNNING');
      $('.stage-status', s).textContent = on ? s.dataset.status : 'QUEUED';
    };

    const vertical = () => {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { markStage(en.target, true); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -35% 0px' });
      stages.forEach(s => io.observe(s));
      return () => io.disconnect();
    };

    if (!hasGsap || reduce) { vertical(); return; }

    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      section.classList.add('is-horizontal');
      const track = $('.journey-track', section);
      const fill = $('.journey-fill', section);
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const n = stages.length;

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => '+=' + (distance() + window.innerHeight * 0.6),
          pin: true,
          scrub: 0.7,
          invalidateOnRefresh: true,
          onUpdate: self => {
            const p = self.progress;
            fill.style.transform = `scaleX(${p})`;
            stages.forEach((s, i) => markStage(s, p >= (i / (n - 1)) * 0.92 - 0.001 || (i === 0 && p > 0.01)));
          }
        }
      });
      return () => {
        tween.scrollTrigger && tween.scrollTrigger.kill();
        tween.kill();
        gsap.set(track, { clearProps: 'transform' });
        section.classList.remove('is-horizontal');
      };
    });
    mm.add('(max-width: 899px)', () => vertical());
  }

  /* =====================================================
     FRAMEWORK — layers + typed code
     ===================================================== */
  function initFramework() {
    const layers = $$('#fwLayers li');
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -18% 0px' });
    layers.forEach((l, i) => { l.style.transitionDelay = (i * 0.06) + 's'; io.observe(l); });

    const win = $('#codeWin');
    const lines = $$('.cl', win);
    const runs = $$('.code-run p', win);
    if (reduce || !hasGsap) { runs.forEach(p => p.classList.add('on')); return; }

    lines.forEach(l => { l.dataset.len = l.textContent.length; l.style.width = '0ch'; });
    const tl = gsap.timeline({ paused: true });
    lines.forEach(l => {
      const len = +l.dataset.len;
      tl.to(l, { width: len + 'ch', duration: Math.max(0.08, len * 0.018), ease: `steps(${len})` });
    });
    tl.add(() => runs[0].classList.add('on'), '+=0.2');
    tl.add(() => runs[1].classList.add('on'), '+=0.7');
    tl.eventCallback('onComplete', () => lines.forEach(l => { l.style.width = 'auto'; }));

    ScrollTrigger.create({ trigger: win, start: 'top 75%', once: true, onEnter: () => tl.play() });
  }

  /* =====================================================
     POINTER — spotlight cards, glass highlight, magnetic buttons
     ===================================================== */
  function initPointerFx() {
    if (!canHover || reduce) return;

    $$('.spot, .btn').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });

    $$('.magnetic').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        btn.style.transition = 'transform .2s ease-out, box-shadow .3s';
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px) scale(1.03)`;
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.transition = 'transform .7s cubic-bezier(.34,1.56,.64,1), box-shadow .3s';
        btn.style.transform = '';
      });
    });
  }

  /* =====================================================
     BUG HUNT — ladybugs wander in; click (or tap) to fix them
     ===================================================== */
  function initBugHunt() {
    const layer = $('#bugLayer');
    const pill = $('#bugCount');
    const pillText = $('#bugCountText');
    const pillLabel = $('#bugCountLabel');
    if (!layer || reduce) return { start() {} };

    const BUG_SVG = `
      <svg class="bug-svg" viewBox="0 0 40 40" aria-hidden="true">
        <g class="legs-l" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"><path d="M14 16 7 12"/><path d="M13 21H6"/><path d="M14 26 7 30"/></g>
        <g class="legs-r" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"><path d="M26 16l7-4"/><path d="M27 21h7"/><path d="M26 26l7 4"/></g>
        <path d="M17.5 8.5Q15.5 5 12 4M22.5 8.5Q24.5 5 28 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>
        <circle cx="20" cy="11" r="4.5" fill="currentColor"/>
        <ellipse cx="20" cy="22" rx="8.5" ry="10.5" fill="#EF4444"/>
        <path d="M20 12v20.5" stroke="#111" stroke-width="1.4"/>
        <circle cx="16.4" cy="18.6" r="1.7" fill="#111"/><circle cx="23.6" cy="18.6" r="1.7" fill="#111"/>
        <circle cx="15.8" cy="25.4" r="1.9" fill="#111"/><circle cx="24.2" cy="25.4" r="1.9" fill="#111"/>
        <ellipse cx="16.8" cy="15.6" rx="2" ry="2.8" fill="#fff" opacity=".35"/>
      </svg>
      <span class="bug-check"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;

    const small = matchMedia('(max-width: 767px)').matches;
    const maxBugs = small ? 1 : 2;
    const bugs = new Set();
    const mouse = { x: -9999, y: -9999 };
    let fixed = 0, raf = 0, last = 0, started = false;
    try { fixed = +sessionStorage.getItem('me-bugs') || 0; } catch (e) {}

    const setPill = (label, text, isFixed, bump) => {
      pillLabel.textContent = label;
      pillText.textContent = text;
      pill.classList.toggle('is-fixed', !!isFixed);
      pill.hidden = false;
      if (bump) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
    };
    const fixedLabel = () => `Bugs fixed: ${fixed}`;
    if (fixed) setPill(fixedLabel(), 'Nice catch. 0 escaped to prod.', true);
    // clicking the card releases a bug to hunt (or nudges the one on screen)
    pill.addEventListener('click', () => {
      if (!bugs.size) spawn(true);
      else bugs.forEach(b => { b.pauseUntil = 0; b.v = Math.min(b.v * 1.15, 120); });
    });
    // keep the card off the hero content (copy, CTAs, stats) and off the footer text
    const away = new Set();
    const watchAway = (el, key, opts) => el && new IntersectionObserver(([en]) => {
      if (en.isIntersecting) away.add(key); else away.delete(key);
      pill.classList.toggle('is-away', away.size > 0);
    }, opts).observe(el);
    watchAway($('.hero-copy'), 'hero', { rootMargin: '0px 0px -12% 0px' });
    watchAway($('.footer'), 'footer');

    window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; } }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });

    const pickTarget = (b, t) => {
      b.tx = innerWidth * (0.12 + Math.random() * 0.76);
      b.ty = innerHeight * (0.18 + Math.random() * 0.68);
      b.retarget = t + 1600 + Math.random() * 2000;
    };

    function spawn(force) {
      if ((!force && document.hidden) || bugs.size >= maxBugs || isMenuOpen()) return;
      const W = innerWidth, H = innerHeight, m = 40, edge = Math.floor(Math.random() * 4);
      const x = edge === 1 ? W + m : edge === 3 ? -m : Math.random() * W;
      const y = edge === 0 ? -m : edge === 2 ? H + m : Math.random() * H;
      const el = document.createElement('div');
      el.className = 'bug';
      el.innerHTML = BUG_SVG;
      layer.appendChild(el);
      const t = performance.now();
      const b = { el, svg: el.firstElementChild, x, y, a: Math.atan2(H / 2 - y, W / 2 - x), v: 62 + Math.random() * 30,
                  born: t, life: 12000 + Math.random() * 7000, pauseUntil: 0, caught: false, leaving: false, seed: Math.random() * 100 };
      pickTarget(b, t);
      el.addEventListener('pointerdown', e => { e.preventDefault(); catchBug(b); });
      bugs.add(b);
      if (!fixed && !pill.dataset.hinted) { pill.dataset.hinted = '1'; setPill('Bug detected', 'Something slipped through. Think you can find it?', false, true); }
      if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
    }

    function tick(t) {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
      last = t;
      const W = innerWidth, H = innerHeight;
      bugs.forEach(b => {
        if (b.caught) return;
        if (!b.leaving && t - b.born > b.life) {
          b.leaving = true;
          b.tx = b.x < W / 2 ? -160 : W + 160;
          b.ty = b.y + (Math.random() - 0.5) * 240;
        } else if (!b.leaving && t > b.retarget) pickTarget(b, t);

        const dx = b.x - mouse.x, dy = b.y - mouse.y, dist = Math.hypot(dx, dy);
        // when the cursor gets close the bug decides once: freeze in fear (usually) or scurry off
        if (dist < 110 && !b.spooked) {
          b.spooked = true;
          if (Math.random() < 0.65) { b.freeze = true; b.pauseUntil = t + 900 + Math.random() * 600; }
        } else if (dist > 170 && b.spooked) { b.spooked = false; b.freeze = false; }
        const fleeing = b.spooked && !b.freeze && dist < 140;
        if (fleeing) b.chased = (b.chased || 0) + dt;                      // it gets tired of running
        const tired = (b.chased || 0) > 2.2;
        let desired = fleeing ? Math.atan2(dy, dx) : Math.atan2(b.ty - b.y, b.tx - b.x);
        desired += Math.sin(t / 240 + b.seed) * 0.4;                       // wobbly walk

        // stop-and-go like a real bug
        if (!fleeing && !b.leaving && t > b.pauseUntil && Math.random() < dt * 0.35) b.pauseUntil = t + 350 + Math.random() * 700;
        const paused = !fleeing && t < b.pauseUntil;
        if (b.freeze && t >= b.pauseUntil) b.freeze = false;
        b.el.classList.toggle('is-still', paused);
        const speed = paused ? 0 : b.v * (fleeing ? (tired ? 0.7 : 1.5) : b.leaving ? 1.3 : tired ? 0.8 : 1);

        const diff = Math.atan2(Math.sin(desired - b.a), Math.cos(desired - b.a));
        b.a += diff * Math.min(1, dt * (fleeing ? 7 : 3.5));
        b.x += Math.cos(b.a) * speed * dt;
        b.y += Math.sin(b.a) * speed * dt;

        b.el.style.transform = `translate3d(${(b.x - 19).toFixed(1)}px, ${(b.y - 19).toFixed(1)}px, 0)`;
        b.svg.style.transform = `rotate(${(b.a + Math.PI / 2).toFixed(3)}rad)`;

        const off = b.x < -200 || b.x > W + 200 || b.y < -200 || b.y > H + 200;
        if (off) { b.el.remove(); bugs.delete(b); }
      });
      raf = bugs.size ? requestAnimationFrame(tick) : 0;
    }

    // forgiving hit test: a click/tap near the bug counts, not just a pixel-perfect hit
    const HIT = small ? 50 : 44;
    const nearest = (x, y) => {
      let best = null, bd = Infinity;
      bugs.forEach(b => { if (b.caught) return; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } });
      return bd <= HIT ? best : null;
    };
    document.addEventListener('pointerdown', e => {
      if (e.target.closest('a, button, input, textarea, select, [role="button"]') && !e.target.closest('.bug')) return;
      const b = nearest(e.clientX, e.clientY);
      if (b) { e.preventDefault(); catchBug(b); }
    }, true);
    window.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') document.body.classList.toggle('is-aiming', !!nearest(e.clientX, e.clientY));
    }, { passive: true });

    // 💥 blast: shockwave, flash, flying bits, "SQUASHED!"
    const BITS = ['#EF4444', '#EF4444', '#111827', '#22C55E', '#4ADE80', '#F59E0B'];
    function blast(x, y) {
      const put = (cls, css) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css); layer.appendChild(d); return d; };
      const ring = put('bug-ring', { left: x + 'px', top: y + 'px' });
      const flash = put('bug-flash', { left: x + 'px', top: y + 'px' });
      setTimeout(() => { ring.remove(); flash.remove(); }, 800);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
        const r = 50 + Math.random() * 80;
        const size = 4 + Math.random() * 7;
        const bit = put('bug-bit', { left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px', background: BITS[i % BITS.length], borderRadius: Math.random() < 0.5 ? '50%' : '2px' });
        bit.animate([
          { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r + 30}px)) scale(.2) rotate(${Math.random() * 540}deg)`, opacity: 0 }
        ], { duration: 650 + Math.random() * 350, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'forwards' }).onfinish = () => bit.remove();
      }
      const word = put('bug-word', { left: x + 'px', top: (y - 26) + 'px' });
      word.textContent = 'SQUASHED!';
      setTimeout(() => word.remove(), 1200);
      pill.classList.remove('shake'); void pill.offsetWidth; pill.classList.add('shake');
    }

    const MILESTONES = { 5: '5 caught · 0 escaped to prod', 10: '10 bugs — you should be in QA', 25: 'Okay, you\'re hired ✓' };
    function catchBug(b) {
      if (b.caught) return;
      b.caught = true;
      b.el.classList.remove('is-still');
      b.el.classList.add('is-caught');
      document.body.classList.remove('is-aiming');
      fixed++;
      try { sessionStorage.setItem('me-bugs', String(fixed)); } catch (e) {}
      blast(b.x, b.y);
      const id = 'BUG-' + String(fixed).padStart(3, '0');
      setPill(`${id} · Fixed ✓`, MILESTONES[fixed] || 'Severity: low · 0 escaped to prod', true, true);

      setTimeout(() => b.el.classList.add('is-gone'), 700);
      setTimeout(() => { b.el.remove(); bugs.delete(b); }, 1100);
    }

    const loop = ms => setTimeout(() => { spawn(); loop(11000 + Math.random() * 10000); }, ms);
    return {
      start() { if (started) return; started = true; loop(3500); }
    };
  }

  /* =====================================================
     HERO VIDEO — the character looks at the cursor (left, right and up)
       • every frame of the clip has a gaze label (x: -1 left … +1 right, y: 0 level … 1 up),
         anchored on the reference stills (0s/1s front · 2s left · 3s right · 4s up-right ·
         5s up · 6s/7s front) and interpolated between them
       • the cursor position relative to the orb gives a target gaze; it is eased every frame
         (exponential lerp) and the frame whose label is closest is drawn
       • frames with nearly the same pose are linked in a graph; the head walks the shortest
         route to the target frame at head-turn speed (SPEED), so it never teleports between
         poses and can always find its way back (e.g. up-right → front goes through "up");
         mid-turn frames whose eyes are off-camera never win at rest
       • frame bank: WebCodecs decode → square WebP blobs → LRU of ImageBitmaps on a canvas;
         video.currentTime seeking until the bank is live (and as the fallback)
       • touch screens play the clip as a loop; reduced motion holds the front pose
     ===================================================== */
  function initCursorVideo() {
    const hero = $('#hero');
    const wrap = $('.hero-photo', hero);
    const video = $('.hero-video', hero);
    const canvas = $('.hero-canvas', hero);
    if (!video || !canvas) return { start() {} };
    const ctx = canvas.getContext('2d');

    const T_FRONT = 0.5;                                   // start (and rest) on a camera-facing frame
    const FPS = 24, DURATION = 8;
    const LERP_TAU = 9, LRU_MAX = 24, LEAD = 24, WATCHDOG = 60000;
    const TIME_W = 0.004;                                  // cost per second of clip distance (hysteresis)
    const SPEED = 4.5;                                     // head-turn speed in pose units per second (full left→right ≈ 0.45s)
    const LINK = 0.13;                                     // frames this close in pose are neighbours in the route graph
    const MP4BOX_URL = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';
    const pointerFine = matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* gaze keys: [time, x, y, penalty]  (penalty -1 = never pick) */
    const KEYS = [
      [0.00, 0, 0], [1.10, 0, 0],                                          // front
      [1.20, -.2, 0], [1.30, -.35, .02], [1.40, -.5, .04], [1.50, -.7, .05], [1.60, -.85, .05], [1.70, -.95, .05],
      [1.80, -1, .05], [2.10, -1, .05],                                     // left (still 10)
      [2.15, -.95, .04, -1], [2.55, -.1, 0, -1],                            // turning back: duplicate of 1.2–1.8
      [2.60, 0, 0, .1], [2.70, .1, 0, .06], [2.80, .25, 0, .02], [2.90, .45, 0],
      [3.00, .65, .02], [3.10, .8, .03], [3.20, .9, .05], [3.30, 1, .08], [3.50, 1, .08],   // right (still 11)
      [3.60, .95, .15], [3.70, .9, .25], [3.80, .85, .35], [3.90, .85, .45],
      [4.00, .8, .55], [4.30, .8, .55],                                     // up-right (still 12)
      [4.40, .75, .6], [4.50, .65, .65], [4.60, .55, .7], [4.70, .5, .7], [4.80, .4, .75], [4.90, .25, .8],
      [5.00, .1, .85], [5.10, .03, .9], [5.20, 0, .95], [5.40, 0, .95],     // up (still 13)
      [5.50, 0, .85], [5.60, 0, .75], [5.70, 0, .6], [5.80, 0, .45], [5.90, 0, .3],
      [6.00, 0, .15], [6.20, 0, .08], [6.30, 0, 0], [8.00, 0, 0]            // front (stills 14, 15)
    ];
    const labelAt = t => {
      let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
      const a = KEYS[i], b = KEYS[i + 1], k = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
      const pa = a[3] || 0, pb = b[3] || 0;
      return { t, x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, pen: (pa < 0 || pb < 0) ? -1 : pa + (pb - pa) * k };
    };
    // candidate frames: the clip's 24fps grid until the decoded bank replaces it
    let cands = [];
    for (let f = 0; f < DURATION * FPS; f++) cands.push(labelAt(f / FPS));
    // the frame that best matches a gaze (where the head should come to rest)
    const pick = (gx, gy, now) => {
      let best = 0, bestCost = Infinity;
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        if (c.pen < 0) continue;
        const cost = (c.x - gx) ** 2 + (c.y - gy) ** 2 + c.pen + TIME_W * Math.abs(c.t - now.t);
        if (cost < bestCost) { bestCost = cost; best = i; }
      }
      return best;
    };
    // route graph: neighbours are frames with nearly the same pose, so any route is a smooth head turn
    let graph = [];
    const poseDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const buildGraph = () => {
      graph = cands.map((a, i) => {
        const n = [];
        if (a.pen < 0) return n;
        for (let j = 0; j < cands.length; j++) {
          const b = cands[j];
          if (j === i || b.pen < 0) continue;
          const d = poseDist(a, b);
          if (d <= LINK) n.push([j, d + 0.002 + 0.0005 * Math.abs(a.t - b.t)]);
        }
        return n;
      });
    };
    // shortest route between two frames (Dijkstra; ~200 nodes, cheap enough per paint)
    const route = (from, to) => {
      const n = cands.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
      dist[from] = 0;
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
        if (u < 0 || u === to) break;
        done[u] = 1;
        for (const [v, w] of graph[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
      }
      if (!isFinite(dist[to])) return null;
      const path = []; for (let v = to; v !== from; v = prev[v]) path.push(v);
      return path.reverse();                               // excludes `from`
    };
    buildGraph();

    /* touch screens & reduced motion: no cursor, so loop the clip (or hold the front pose) */
    if (!pointerFine || reduce) {
      video.loop = !reduce;
      const go = () => { if (reduce) video.currentTime = T_FRONT; else video.play().catch(() => {}); };
      if (video.readyState >= 1) go(); else video.addEventListener('loadedmetadata', go, { once: true });
      if (!reduce) {
        ['touchstart', 'scroll', 'pointerdown'].forEach(ev => window.addEventListener(ev, () => video.paused && video.play().catch(() => {}), { once: true, passive: true }));
        new IntersectionObserver(([en]) => { if (en.isIntersecting) { if (video.paused) video.play().catch(() => {}); } else video.pause(); }).observe(hero);
      }
      return { start() {} };
    }

    const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
    let shown = pick(0, 0, labelAt(T_FRONT));             // index into cands
    let bank = [], ready = false, painted = false, lastDrawn = -1, building = false;
    const lru = new Map();
    let raf = 0, last = 0, visible = true, budget = 0;

    /* cursor → target gaze, measured from the orb's centre so "on the face" means "look at me" */
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const ease = v => Math.sign(v) * Math.min(1, Math.abs(v)) ** 0.85;
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = wrap.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dead = r.width * 0.12;
      const dx = e.clientX - cx, dy = cy - e.clientY;      // dy > 0 = above the orb
      const sx = Math.max(cx, innerWidth - cx) * 0.8, sy = Math.max(cy, 160) * 0.85;
      const px = Math.abs(dx) <= dead ? 0 : (dx - Math.sign(dx) * dead) / (sx - dead);
      const py = dy <= dead ? 0 : (dy - dead) / (sy - dead);  // no "look down" frames: below → level
      gaze.tx = ease(clamp(px, -1, 1)); gaze.ty = ease(clamp(py, 0, 1));
    }, { passive: true });
    // mouse left the window → ease back to facing the camera
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) gaze.tx = gaze.ty = 0; });

    /* ---------- frame bank paint ---------- */
    const warmLRU = i => {
      for (let k = i; k <= i + 1; k++) {
        if (k < 0 || k >= bank.length || lru.has(k)) continue;
        lru.set(k, null);
        createImageBitmap(bank[k].blob).then(b => { if (lru.has(k)) lru.set(k, b); else b.close(); }).catch(() => lru.delete(k));
      }
      while (lru.size > LRU_MAX) { const [k, b] = lru.entries().next().value; if (b) b.close(); lru.delete(k); }
    };
    const draw = i => {
      const b = lru.get(i);
      if (!b) return false;
      lru.delete(i); lru.set(i, b);                       // refresh recency
      ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
      lastDrawn = i;
      if (!painted) { painted = true; canvas.classList.add('is-live'); }
      return true;
    };

    /* ---------- rAF loop: runs every frame while the hero is on screen ---------- */
    function tick(t) {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
      last = t;
      const k = 1 - Math.exp(-dt * LERP_TAU);
      gaze.x += (gaze.tx - gaze.x) * k; gaze.y += (gaze.ty - gaze.y) * k;
      if (Math.abs(gaze.tx - gaze.x) < 0.002) gaze.x = gaze.tx;
      if (Math.abs(gaze.ty - gaze.y) < 0.002) gaze.y = gaze.ty;
      wrap.style.setProperty('--ry', (gaze.x * 4).toFixed(3) + 'deg');
      wrap.style.setProperty('--rx', (gaze.y * 3).toFixed(3) + 'deg');
      wrap.style.setProperty('--tx', (gaze.x * 6).toFixed(2) + 'px');
      wrap.style.setProperty('--ty', (-gaze.y * 5).toFixed(2) + 'px');

      // walk toward the best-matching frame along the route, at head-turn speed
      const goal = pick(gaze.x, gaze.y, cands[shown]);
      let ahead = [];
      if (goal === shown) budget = 0;
      else {
        const path = route(shown, goal);
        if (!path) { shown = goal; budget = 0; }
        else {
          budget = Math.min(budget + SPEED * dt, 1);
          let i = 0;
          while (i < path.length && budget >= poseDist(cands[shown], cands[path[i]])) { budget -= poseDist(cands[shown], cands[path[i]]); shown = path[i++]; }
          ahead = path.slice(i, i + 3);
        }
      }
      if (ready) {
        warmLRU(shown); ahead.forEach(warmLRU);
        if (shown !== lastDrawn) draw(shown);
      } else if (video.readyState >= 1 && !video.seeking && Math.abs(video.currentTime - cands[shown].t) > 0.02) {
        video.currentTime = cands[shown].t;               // fallback until the bank is live
      }
      raf = visible ? requestAnimationFrame(tick) : 0;
    }
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    }).observe(hero);
    if (video.readyState >= 1) video.currentTime = T_FRONT;
    else video.addEventListener('loadedmetadata', () => { video.currentTime = T_FRONT; }, { once: true });

    /* ---------- frame bank build (WebCodecs) ---------- */
    const loadScript = src => new Promise((res, rej) => {
      if (window.MP4Box) return res();
      const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    async function decodeAll(buf, accel) {
      const file = MP4Box.createFile();
      const info = await new Promise((res, rej) => { file.onReady = res; file.onError = rej; buf.fileStart = 0; file.appendBuffer(buf); file.flush(); });
      const track = info.videoTracks[0];
      if (!track) throw new Error('no video track');
      const samples = [];
      file.onSamples = (_i, _u, s) => samples.push(...s);
      file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
      file.start();
      let description;
      for (const e of file.getTrackById(track.id).mdia.minf.stbl.stsd.entries) {
        const box = e.avcC || e.hvcC || e.vpcC || e.av1C;
        if (box) { const st = new DataStream(undefined, 0, DataStream.BIG_ENDIAN); box.write(st); description = new Uint8Array(st.buffer, 8); break; }
      }
      const config = { codec: track.codec, codedWidth: track.video.width, codedHeight: track.video.height, description, hardwareAcceleration: accel };
      if (!(await VideoDecoder.isConfigSupported(config)).supported) throw new Error('codec not supported');

      const work = document.createElement('canvas'); work.width = canvas.width; work.height = canvas.height;
      const wctx = work.getContext('2d');
      const out = []; let encoding = 0, failed = null;
      const dec = new VideoDecoder({
        output: f => {
          const ts = f.timestamp, w = f.displayWidth, h = f.displayHeight, side = Math.min(w, h);
          // the orb shows the centre square of the frame, so only keep that
          wctx.drawImage(f, (w - side) / 2, (h - side) / 2, side, side, 0, 0, work.width, work.height); encoding++;
          work.toBlob(b => { encoding--; if (b) out.push({ ts, blob: b }); }, 'image/webp', 0.85);
          f.close();
        },
        error: e => { failed = e; }
      });
      dec.configure(config);
      for (const s of samples) {
        if (failed) throw failed;
        while (encoding > LEAD || dec.decodeQueueSize > LEAD) await new Promise(r => setTimeout(r, 4));
        dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: Math.round(1e6 * s.cts / s.timescale), duration: Math.round(1e6 * s.duration / s.timescale), data: s.data }));
      }
      await dec.flush(); dec.close();
      while (encoding > 0) await new Promise(r => setTimeout(r, 10));
      if (failed || !out.length) throw failed || new Error('no frames');
      return out.sort((a, b) => a.ts - b.ts);
    }
    async function buildBank() {
      if (building || !('VideoDecoder' in window)) return;
      building = true;
      let reverted = false;
      const dog = setTimeout(() => { reverted = true; ready = false; canvas.classList.remove('is-live'); }, WATCHDOG);
      try {
        await loadScript(MP4BOX_URL);
        const buf = await (await fetch(video.currentSrc || video.getAttribute('src'))).arrayBuffer();
        let frames;
        try { frames = await decodeAll(buf.slice(0), 'prefer-hardware'); }
        catch (e) { frames = await decodeAll(buf.slice(0), 'prefer-software'); }   // one software retry
        if (reverted) return;
        const now = cands[shown];
        bank = frames;
        cands = frames.map(f => labelAt(f.ts / 1e6));     // labels for the real decoded timestamps
        buildGraph();
        shown = pick(now.x, now.y, now);
        lastDrawn = -1; ready = true;
        warmLRU(shown);
      } catch (e) {
        ready = false;                                     // stay on video seeking
      } finally { clearTimeout(dog); }
    }
    // start decoding right away (not after the loader) so tracking is smooth sooner
    (window.requestIdleCallback || (fn => setTimeout(fn, 200)))(buildBank);

    // test hook: lets QA read the current pose without a debugger
    window.__heroGaze = () => ({ gx: +gaze.x.toFixed(3), gy: +gaze.y.toFixed(3), t: cands[shown].t, live: ready, frames: bank.length });
    return { start() {} };
  }

  /* ---------------- boot ---------------- */
  $$('.js-mail').forEach(a => {
    const addr = `${a.dataset.u}@${a.dataset.d}`;
    a.href = `mailto:${addr}`;
    const full = $('.mail-full', a);
    if (full) full.textContent = addr;
    a.setAttribute('aria-label', `Email ${addr}`);
  });

  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();

  initHeroScroll();
  initStatement();
  initJourney();
  initFramework();
  initPointerFx();

  const bugHunt = initBugHunt();
  const cursorVideo = initCursorVideo();

  runLoader().then(() => {
    setTimeout(() => $('#hero').classList.add('is-ready'), 120);
    bugHunt.start();
    cursorVideo.start();
    setTimeout(() => { if (hasGsap) ScrollTrigger.refresh(); scrollToHash(); }, 400);
  });
  window.addEventListener('load', () => { if (hasGsap) ScrollTrigger.refresh(); });
})();
