/* ==========================================================================
   CDG Designs - Portfolio Script
   Pure vanilla JS. No libraries. Award-winning interactions.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. CONFIG & STATE
   -------------------------------------------------------------------------- */

const STATE = {
  scrollY: 0,
  targetScrollY: 0,
  loaderDone: false,
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const isFineCursor = window.matchMedia('(pointer: fine)').matches;

/* --------------------------------------------------------------------------
   2. UTILITIES
   -------------------------------------------------------------------------- */

/** Linear interpolation between a and b by factor t */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Clamp val between min and max */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Split an element's text into individually wrapped spans.
 * @param {HTMLElement} element - Target element
 * @param {'chars'|'words'} type - Split granularity
 */
function splitText(element, type) {
  const original = element.textContent.trim();
  element.setAttribute('aria-label', original);

  if (type === 'words') {
    const words = original.split(/\s+/).filter(Boolean);
    element.innerHTML = words
      .map((word, i) => `<span class="split-unit" style="--i:${i}">${word}</span>`)
      .join(' ');
    return words.length;
  }

  // chars mode: wrap characters inside word containers to preserve word-wrap
  const words = original.split(/\s+/).filter(Boolean);
  let idx = 0;
  element.innerHTML = words
    .map((word) => {
      const chars = word.split('').map((ch) => {
        return `<span class="split-char" style="--i:${idx++}">${ch}</span>`;
      }).join('');
      return `<span class="split-word">${chars}</span>`;
    })
    .join(' ');

  return idx;
}

/** Debounce: delays execution until fn hasn't been called for ms */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Throttle: ensures fn runs at most once per ms interval */
function throttle(fn, ms) {
  let last = 0;
  return function (...args) {
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    }
  };
}

/* --------------------------------------------------------------------------
   3. LOADING SCREEN
   -------------------------------------------------------------------------- */

function initLoader() {
  return new Promise((resolve) => {
    const loader = document.querySelector('.loader');
    if (!loader) {
      resolve();
      return;
    }

    const counter = loader.querySelector('#loader-percent');
    let progress = 0;
    const start = performance.now();
    const duration = 1800;

    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic for natural deceleration
      progress = Math.round(t * t * (3 - 2 * t) * 100);

      if (counter) counter.textContent = progress + '%';

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Counter reached 100 -- wait, then dismiss
        setTimeout(() => {
          loader.classList.add('is-done');

          const onEnd = () => {
            loader.removeEventListener('transitionend', onEnd);
            loader.remove();
            resolve();
          };
          loader.addEventListener('transitionend', onEnd);

          // Safety timeout in case transitionend never fires
          setTimeout(() => {
            if (document.contains(loader)) {
              loader.remove();
              resolve();
            }
          }, 1200);
        }, 300);
      }
    }

    requestAnimationFrame(tick);
  });
}

/** Stagger hero entrance after loader finishes */
function revealHero() {
  const heroEls = document.querySelectorAll(
    '.hero .reveal-up, .hero .reveal-left, .hero .reveal-right, .hero .reveal-scale, .hero .reveal-clip, .hero .reveal'
  );
  heroEls.forEach((el, i) => {
    setTimeout(() => el.classList.add('is-visible'), 120 * i);
  });
}

/* --------------------------------------------------------------------------
   4. CUSTOM CURSOR
   -------------------------------------------------------------------------- */

function initCursor() {
  if (!isFineCursor || isTouchDevice) return;

  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot && !ring) return;

  let mouseX = -100;
  let mouseY = -100;
  let ringX = -100;
  let ringY = -100;

  // Track mouse position
  document.addEventListener(
    'pointermove',
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    },
    { passive: true }
  );

  // rAF loop: dot follows instantly, ring lerps behind
  function cursorTick() {
    // Dot follows mouse directly via transform (GPU-accelerated)
    if (dot) {
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    }

    // Ring lerps for smooth trailing
    if (ring) {
      ringX = lerp(ringX, mouseX, 0.15);
      ringY = lerp(ringY, mouseY, 0.15);
      ring.style.transform = `translate3d(${ringX.toFixed(1)}px, ${ringY.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }

    requestAnimationFrame(cursorTick);
  }
  requestAnimationFrame(cursorTick);

  // Hover targets expand the ring
  const hoverTargets = 'a, button, [data-magnetic], .project-card';

  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.target.closest(hoverTargets) && ring) {
        ring.classList.add('is-hovering');
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'pointerout',
    (e) => {
      if (e.target.closest(hoverTargets) && ring) {
        ring.classList.remove('is-hovering');
      }
    },
    { passive: true }
  );

  // Click feedback
  document.addEventListener('pointerdown', () => {
    if (ring) ring.classList.add('is-clicking');
  }, { passive: true });

  document.addEventListener('pointerup', () => {
    if (ring) ring.classList.remove('is-clicking');
  }, { passive: true });

  // Hide when cursor leaves the window
  document.addEventListener('mouseleave', () => {
    if (dot) dot.style.opacity = '0';
    if (ring) ring.style.opacity = '0';
  }, { passive: true });

  document.addEventListener('mouseenter', () => {
    if (dot) dot.style.opacity = '1';
    if (ring) ring.style.opacity = '1';
  }, { passive: true });
}

/* --------------------------------------------------------------------------
   5. SMOOTH SCROLL & PARALLAX ENGINE
   -------------------------------------------------------------------------- */

function initScrollEngine() {
  const root = document.documentElement;
  const parallaxEls = document.querySelectorAll('[data-parallax]');
  const timelineLine = document.querySelector('.timeline-line');
  const processSection = document.getElementById('proceso');
  let ticking = false;

  // Capture target scroll on every scroll event (passive)
  window.addEventListener(
    'scroll',
    () => {
      STATE.targetScrollY = window.scrollY;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(tick);
      }
    },
    { passive: true }
  );

  // Initialise to current position
  STATE.scrollY = window.scrollY;
  STATE.targetScrollY = window.scrollY;

  function tick() {
    // Lerp toward target
    STATE.scrollY = lerp(STATE.scrollY, STATE.targetScrollY, 0.1);

    // Snap when close enough
    if (Math.abs(STATE.scrollY - STATE.targetScrollY) < 0.5) {
      STATE.scrollY = STATE.targetScrollY;
    }

    // --- Parallax ---
    parallaxEls.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.15;
      const y = -(STATE.scrollY * speed);
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });

    // --- Scroll progress custom property (0-100) ---
    const docHeight = root.scrollHeight - root.clientHeight;
    const pct = docHeight > 0 ? (STATE.scrollY / docHeight) * 100 : 0;
    root.style.setProperty('--scroll-pct', pct.toFixed(2));

    // --- Timeline line scale ---
    if (timelineLine && processSection) {
      const rect = processSection.getBoundingClientRect();
      const winH = window.innerHeight;
      const sectionProgress = clamp((winH - rect.top) / (rect.height + winH), 0, 1);
      timelineLine.style.transform = `scaleY(${sectionProgress.toFixed(3)})`;
    }

    // Keep looping only while still interpolating
    if (Math.abs(STATE.scrollY - STATE.targetScrollY) > 0.5) {
      requestAnimationFrame(tick);
    } else {
      ticking = false;
    }
  }
}

/* --------------------------------------------------------------------------
   6. REVEAL OBSERVER
   -------------------------------------------------------------------------- */

let revealObserver;

function initRevealObserver() {
  if (prefersReducedMotion.matches) {
    // Make everything visible immediately
    document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-clip, .reveal').forEach((el) => {
      el.classList.add('is-visible');
    });
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const target = entry.target;

        // If this is a stagger parent, reveal children with delay
        if (target.hasAttribute('data-stagger')) {
          const children = target.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-clip, .reveal');
          children.forEach((child, i) => {
            child.style.transitionDelay = `${(0.08 * i).toFixed(2)}s`;
            child.classList.add('is-visible');
          });
        } else {
          target.classList.add('is-visible');
        }

        observer.unobserve(target);
      });
    },
    {
      rootMargin: '-10% 0px -10% 0px',
      threshold: 0.15,
    }
  );

  // Observe section dividers
  document.querySelectorAll('.section-divider').forEach((el) => {
    revealObserver.observe(el);
  });

  observeRevealElements();
}

/** Observe any not-yet-visible reveal elements in the DOM */
function observeRevealElements() {
  if (!revealObserver) return;

  // Standard reveal elements
  const revealEls = document.querySelectorAll(
    '.reveal-up:not(.is-visible), .reveal-left:not(.is-visible), .reveal-right:not(.is-visible), .reveal-scale:not(.is-visible), .reveal-clip:not(.is-visible), .reveal:not(.is-visible)'
  );
  revealEls.forEach((el) => revealObserver.observe(el));

  // Stagger parents
  const staggerParents = document.querySelectorAll('[data-stagger]:not(.is-visible)');
  staggerParents.forEach((parent) => revealObserver.observe(parent));
}

/* --------------------------------------------------------------------------
   7. TEXT ANIMATIONS
   -------------------------------------------------------------------------- */

function initTextAnimations() {
  if (prefersReducedMotion.matches) return;

  // --- Split text elements ---
  const splitEls = document.querySelectorAll('[data-split]');
  splitEls.forEach((el) => {
    const type = el.dataset.split || 'chars';
    splitText(el, type);
  });

  // Observe split elements for reveal
  if (revealObserver) {
    splitEls.forEach((el) => {
      if (!el.classList.contains('is-visible')) {
        revealObserver.observe(el);
      }
    });
  }

  // --- Typing effect ---
  const typingEls = document.querySelectorAll('[data-typing]');
  if (!typingEls.length) return;

  const typingObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        typeElement(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.3 }
  );

  typingEls.forEach((el) => {
    // Store original text and clear
    el.dataset.typingText = el.textContent;
    el.textContent = '';
    typingObserver.observe(el);
  });
}

/** Typing animation for a single element */
function typeElement(el) {
  const text = el.dataset.typingText || '';
  let idx = 0;

  // Add blinking cursor
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  cursor.textContent = '|';
  el.appendChild(cursor);

  const interval = setInterval(() => {
    if (idx < text.length) {
      // Insert character before the cursor
      el.insertBefore(document.createTextNode(text[idx]), cursor);
      idx++;
    } else {
      clearInterval(interval);
      // Cursor keeps blinking via CSS animation
    }
  }, 50);
}

/* --------------------------------------------------------------------------
   8. 3D CARD TILT
   -------------------------------------------------------------------------- */

function initCardTilt() {
  if (isTouchDevice || prefersReducedMotion.matches) return;

  const tiltCards = document.querySelectorAll('[data-tilt]');
  if (!tiltCards.length) return;

  tiltCards.forEach((card) => {
    card.addEventListener(
      'pointermove',
      (e) => {
        const rect = card.getBoundingClientRect();
        // Normalised position: -0.5 to 0.5
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        card.style.transform =
          `perspective(1000px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(y * -8).toFixed(2)}deg) scale3d(1.02,1.02,1.02)`;

        // Update glare position
        const glare = card.querySelector('.card-glare');
        if (glare) {
          glare.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
          glare.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
        }
      },
      { passive: true }
    );

    card.addEventListener(
      'pointerleave',
      () => {
        // Reset -- CSS transition handles smooth return
        card.style.transform = '';
        const glare = card.querySelector('.card-glare');
        if (glare) {
          glare.style.setProperty('--gx', '50%');
          glare.style.setProperty('--gy', '50%');
        }
      },
      { passive: true }
    );
  });
}

/* --------------------------------------------------------------------------
   9. MAGNETIC BUTTONS
   -------------------------------------------------------------------------- */

function initMagneticButtons() {
  if (isTouchDevice || prefersReducedMotion.matches) return;

  const magneticEls = document.querySelectorAll('[data-magnetic]');
  if (!magneticEls.length) return;

  magneticEls.forEach((el) => {
    const maxDist = 14; // max displacement in px
    const proximity = 80; // activation radius from center in px

    el.addEventListener(
      'pointermove',
      (e) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distX = e.clientX - centerX;
        const distY = e.clientY - centerY;
        const dist = Math.sqrt(distX * distX + distY * distY);

        if (dist < proximity) {
          const factor = 1 - dist / proximity; // 1 at center, 0 at edge
          const moveX = clamp(distX * factor * 0.35, -maxDist, maxDist);
          const moveY = clamp(distY * factor * 0.35, -maxDist, maxDist);

          el.style.transform = `translate3d(${moveX.toFixed(2)}px, ${moveY.toFixed(2)}px, 0)`;

          // Radial gradient blob position for inner glow
          const bx = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
          const by = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
          el.style.setProperty('--bx', bx + '%');
          el.style.setProperty('--by', by + '%');
        }
      },
      { passive: true }
    );

    el.addEventListener(
      'pointerleave',
      () => {
        // CSS elastic transition handles the snap-back
        el.style.transform = '';
        el.style.setProperty('--bx', '50%');
        el.style.setProperty('--by', '50%');
      },
      { passive: true }
    );
  });
}

/* --------------------------------------------------------------------------
   10. COUNTERS
   -------------------------------------------------------------------------- */

function initCounters() {
  const counters = document.querySelectorAll('.countup');
  if (!counters.length) return;

  const counterObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach((node) => counterObserver.observe(node));
}

/** Animate a single counter element from 0 to data-target */
function animateCounter(node) {
  const target = Number(node.dataset.target || 0);
  if (!Number.isFinite(target) || target <= 0) {
    node.textContent = '0';
    return;
  }

  const prefix = node.dataset.prefix || '';
  const suffix = node.dataset.suffix || '';
  const duration = 2000;
  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    // easeOutExpo: 1 - 2^(-10t)
    const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const value = Math.round(target * eased);
    const formatted = value.toLocaleString('es-ES');
    node.textContent = prefix + formatted + suffix;

    if (t < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

/* --------------------------------------------------------------------------
   11. MARQUEE
   -------------------------------------------------------------------------- */

function initMarquee() {
  const tracks = document.querySelectorAll('.marquee-track');
  if (!tracks.length) return;

  tracks.forEach((track) => {
    // Duplicate content for seamless looping
    track.innerHTML += track.innerHTML;
  });
  // CSS animation and hover-pause are handled in the stylesheet
}

/* --------------------------------------------------------------------------
   12. HEADER
   -------------------------------------------------------------------------- */

function initHeader() {
  const header = document.querySelector('.site-header');
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('site-nav');
  if (!header) return;

  let lastScrollY = 0;
  const root = document.documentElement;

  // --- Scroll progress bar (header always visible) ---
  window.addEventListener(
    'scroll',
    () => {
      const currentY = window.scrollY;

      // Update scroll progress for header bar
      const docHeight = root.scrollHeight - root.clientHeight;
      const pct = docHeight > 0 ? (currentY / docHeight) * 100 : 0;
      root.style.setProperty('--scroll-pct', pct.toFixed(2));

      lastScrollY = currentY;
    },
    { passive: true }
  );

  // --- Scroll spy ---
  const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (sections.length) {
    const updateSpy = () => {
      const marker = window.scrollY + 150;
      let activeId = sections[0].id;

      sections.forEach((section) => {
        if (section.offsetTop <= marker) activeId = section.id;
      });

      navLinks.forEach((link) => {
        const href = link.getAttribute('href');
        link.classList.toggle('is-active', href === '#' + activeId);
      });
    };

    updateSpy();
    window.addEventListener('scroll', updateSpy, { passive: true });
  }

  // --- Mobile menu toggle ---
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = header.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));

      // Scroll lock
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when a nav link is clicked
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        header.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        header.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }
}

/* --------------------------------------------------------------------------
   13. PROJECT FILTERS & RENDERING
   -------------------------------------------------------------------------- */

const PROJECTS = [
  {
    title: 'RC Automóviles',
    category: 'automocion',
    initials: 'RC',
    tags: ['Automoción', 'Web corporativa'],
    color: '#8b1a2b',
    url: 'https://rcautomoviles.com',
  },
  {
    title: 'CarCity Andalucía',
    category: 'automocion',
    initials: 'CC',
    tags: ['Automoción', 'Landing page'],
    color: '#f2c200',
    url: 'https://gray-ground-0ec303c03.6.azurestaticapps.net',
  },
  {
    title: 'Grade App',
    category: 'saas',
    initials: 'GA',
    tags: ['SaaS', 'Panel + Web'],
    color: '#7ad6ff',
    url: '#',
  },
  {
    title: 'Clínica Dental',
    category: 'salud',
    initials: 'CD',
    tags: ['Salud', 'Web corporativa'],
    color: '#80ffcb',
    url: '#',
  },
];

/** Build a single project card DOM element */
function buildProjectCard(project) {
  const card = document.createElement('article');
  card.className = 'project-card reveal-scale';
  card.dataset.category = project.category;
  card.dataset.tilt = '';
  card.dataset.color = project.color;

  const tagsHtml = (project.tags || [])
    .map((t) => `<span>${t}</span>`)
    .join('');

  card.innerHTML = `
    <div class="project-thumb" style="--project-accent:${project.color}">
      <div class="project-thumb-inner">
        <span class="project-initials">${project.initials || ''}</span>
      </div>
      <div class="project-overlay"></div>
    </div>
    <div class="project-info">
      <h3>${project.title}</h3>
      <p class="project-tags">${tagsHtml}</p>
    </div>
  `;

  return card;
}

/** Render filter chips from project categories */
function renderProjectFilters() {
  const container = document.getElementById('project-filters');
  if (!container) return;

  const categories = ['Todos', ...new Set(PROJECTS.map((p) => p.category))];
  container.innerHTML = '';

  categories.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-chip' + (i === 0 ? ' is-active' : '');
    btn.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    btn.dataset.filter = label;
    container.appendChild(btn);
  });
}

/** Render project cards into the grid */
function renderProjects(filter) {
  const grid = document.getElementById('project-grid');
  if (!grid) return;

  const filtered =
    !filter || filter === 'Todos'
      ? PROJECTS
      : PROJECTS.filter((p) => p.category === filter);

  grid.innerHTML = '';
  filtered.forEach((project) => grid.appendChild(buildProjectCard(project)));

  // Re-observe and re-initialize effects on new cards
  observeRevealElements();
  initProjectOverlays();
  initCardTilt();
}

/** Setup filter chip click handling with FLIP animation */
function initProjectFilters() {
  const container = document.getElementById('project-filters');
  const grid = document.getElementById('project-grid');
  if (!container || !grid) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;

    const filter = btn.dataset.filter || 'Todos';

    // Update active chip
    container.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.classList.remove('is-active');
    });
    btn.classList.add('is-active');

    // --- FLIP Animation ---
    const oldCards = [...grid.querySelectorAll('.project-card')];

    // 1. Record current positions (First)
    const firstRects = new Map();
    oldCards.forEach((card) => {
      firstRects.set(card.dataset.category + '-' + card.querySelector('h3').textContent, card.getBoundingClientRect());
    });

    // 2. Apply filter (toggle visibility)
    renderProjects(filter);

    // 3. Record new positions (Last)
    const newCards = [...grid.querySelectorAll('.project-card')];

    newCards.forEach((card) => {
      const key = card.dataset.category + '-' + card.querySelector('h3').textContent;
      const firstRect = firstRects.get(key);

      if (firstRect) {
        const lastRect = card.getBoundingClientRect();

        // 4. Calculate deltas and apply inverse transforms (Invert)
        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
          card.style.transition = 'none';

          // 5. Remove transforms to trigger CSS transition (Play)
          requestAnimationFrame(() => {
            card.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            card.style.transform = '';
          });
        }
      } else {
        // New card entering -- fade in
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        requestAnimationFrame(() => {
          card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          card.style.opacity = '1';
          card.style.transform = '';
        });
      }
    });
  });
}

/* --------------------------------------------------------------------------
   14. GRAIN ANIMATION
   -------------------------------------------------------------------------- */

function initGrain() {
  if (prefersReducedMotion.matches) return;

  const turbulence = document.querySelector('feTurbulence');
  if (!turbulence) return;

  let seed = 0;

  setInterval(() => {
    seed = (seed + 1) % 999;
    turbulence.setAttribute('seed', String(seed));
  }, 333); // ~3fps — lighter on GPU while still visible
}

/* --------------------------------------------------------------------------
   15. PROJECT CARD OVERLAY
   -------------------------------------------------------------------------- */

function initProjectOverlays() {
  const cards = document.querySelectorAll('.project-card');
  if (!cards.length) return;

  cards.forEach((card) => {
    const overlay = card.querySelector('.project-overlay');
    if (!overlay) return;

    card.addEventListener(
      'pointerenter',
      (e) => {
        const rect = card.getBoundingClientRect();
        const ox = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        const oy = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        overlay.style.setProperty('--ox', ox + '%');
        overlay.style.setProperty('--oy', oy + '%');
      },
      { passive: true }
    );
  });
}

/* --------------------------------------------------------------------------
   16. YEAR FOOTER
   -------------------------------------------------------------------------- */

function setCurrentYear() {
  const node = document.getElementById('year-now');
  if (!node) return;
  node.textContent = new Date().getFullYear();
}

/* --------------------------------------------------------------------------
   17. HERO PANEL POINTER EFFECT
   -------------------------------------------------------------------------- */

function initHeroPointer() {
  const panel = document.querySelector('.hero-panel');
  if (!panel) return;

  panel.addEventListener(
    'pointermove',
    (e) => {
      const rect = panel.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(2);
      const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(2);
      panel.style.setProperty('--pointer-x', x + '%');
      panel.style.setProperty('--pointer-y', y + '%');
    },
    { passive: true }
  );
}

/* --------------------------------------------------------------------------
   18. THEME TOGGLE
   -------------------------------------------------------------------------- */

function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  if (!toggle) return;

  // Restore saved preference
  const saved = localStorage.getItem('cdg-theme');
  if (saved) {
    root.setAttribute('data-theme', saved);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    root.setAttribute('data-theme', 'light');
  }

  toggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';

    root.setAttribute('data-theme', next);
    localStorage.setItem('cdg-theme', next);

    // Pulse animation on toggle
    toggle.style.transform = 'scale(0.85)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toggle.style.transform = '';
      });
    });
  });
}

/* --------------------------------------------------------------------------
   19. RESIZE HANDLER
   -------------------------------------------------------------------------- */

function initResizeHandler() {
  const onResize = debounce(() => {
    STATE.targetScrollY = window.scrollY;
    STATE.scrollY = window.scrollY;
  }, 200);

  window.addEventListener('resize', onResize, { passive: true });
}

/* --------------------------------------------------------------------------
   20. INIT
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  // Always start at the very top
  window.scrollTo(0, 0);
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // Theme toggle -- always runs (before loader)
  initThemeToggle();

  // Footer year -- always runs
  setCurrentYear();

  // If reduced motion, skip all animation systems and just show content
  if (prefersReducedMotion.matches) {
    document.querySelectorAll(
      '.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-clip'
    ).forEach((el) => el.classList.add('is-visible'));

    renderProjectFilters();
    renderProjects();
    initProjectFilters();
    initHeader();
    initCounters();
    initHeroPointer();
    initMarquee();
    return;
  }

  // Full initialisation sequence: loader first, then everything else
  const boot = async () => {
    await initLoader();
    STATE.loaderDone = true;

    revealHero();

    // Core systems
    initCursor();
    initScrollEngine();
    initRevealObserver();
    initTextAnimations();
    initCardTilt();
    initMagneticButtons();
    initCounters();
    initMarquee();
    initHeader();
    initHeroPointer();
    initResizeHandler();
    initGrain();

    // Projects
    renderProjectFilters();
    renderProjects();
    initProjectFilters();
  };

  boot();
});
