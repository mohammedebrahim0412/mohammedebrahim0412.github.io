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
    if (themeMeta) themeMeta.setAttribute('content', t === 'light' ? '#F4F5F8' : '#05070D');
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
  // follow the device setting live, unless the visitor picked one
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
    let saved = null;
    try { saved = localStorage.getItem('me-theme'); } catch (err) {}
    if (!saved) { root.setAttribute('data-theme', e.matches ? 'light' : 'dark'); syncThemeUI(); }
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
    const el = id.length > 1 && $(id);
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
      [...cmd].forEach((_, i) => at(() => { typed.textContent = cmd.slice(0, i + 1); }, 120 + i * 38));
      const start = 120 + cmd.length * 38 + 180;
      $$('.term-line', loader).forEach((line, i) => at(() => line.classList.add('on'), start + i * 150));
      at(finish, start + 8 * 150 + 520);
    });
  }

  /* =====================================================
     HERO — scroll-out parallax
     ===================================================== */
  function initHeroFloats() {
    const hero = $('#hero');
    const floats = $$('.float[data-depth]', hero);
    const rows = $$('.run-row', hero);
    let timers = [];
    const runOnce = () => {
      timers.forEach(clearTimeout); timers = [];
      rows.forEach(r => r.classList.remove('pass'));
      rows.forEach((r, i) => timers.push(setTimeout(() => r.classList.add('pass'), 700 + i * 520)));
    };
    const start = () => {
      if (reduce) { rows.forEach(r => r.classList.add('pass')); return; }
      setTimeout(runOnce, 900);
      setInterval(() => { if (!document.hidden) runOnce(); }, 11000);
    };

    if (reduce || !canHover) return { start };
    const cur = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
    let raf = 0;
    const tick = () => {
      cur.x += (tgt.x - cur.x) * 0.08; cur.y += (tgt.y - cur.y) * 0.08;
      floats.forEach(f => { const d = +f.dataset.depth; f.style.transform = `translate3d(${(cur.x * d).toFixed(2)}px, ${(cur.y * d).toFixed(2)}px, 0)`; });
      raf = Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    hero.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tgt.x = e.clientX / innerWidth - 0.5; tgt.y = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    hero.addEventListener('pointerleave', () => { tgt.x = tgt.y = 0; if (!raf) raf = requestAnimationFrame(tick); });
    return { start };
  }

  function initHeroScroll() {
    if (!hasGsap || reduce) return;
    const st = { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero-photo img', { yPercent: 12, scale: 1.08, ease: 'none', scrollTrigger: st });
    gsap.to('.landing-in, .hero-float', { yPercent: -10, opacity: 0.15, ease: 'none', scrollTrigger: { ...st, start: 'top+=10% top' } });
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

    $$('.spot, .glass-btn').forEach(el => {
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
    // keep the pill off the footer text at the very bottom of the page
    const footer = $('.footer');
    if (footer) new IntersectionObserver(([en]) => pill.classList.toggle('is-away', en.isIntersecting)).observe(footer);

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

  /* ---------------- boot ---------------- */
  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();

  initHeroScroll();
  initStatement();
  initJourney();
  initFramework();
  initPointerFx();

  const bugHunt = initBugHunt();
  const heroFloats = initHeroFloats();

  runLoader().then(() => {
    setTimeout(() => $('#hero').classList.add('is-ready'), 120);
    bugHunt.start();
    heroFloats.start();
    setTimeout(() => { if (hasGsap) ScrollTrigger.refresh(); scrollToHash(); }, 400);
  });
  window.addEventListener('load', () => { if (hasGsap) ScrollTrigger.refresh(); });
})();
