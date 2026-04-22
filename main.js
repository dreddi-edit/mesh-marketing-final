document.documentElement.classList.add('js-motion');

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const words = ['IDE', 'MCP', 'API'];
const wordCycle = document.querySelector('.word-cycle');
let wordIndex = 0;
if (wordCycle) {
  setInterval(() => {
    wordIndex = (wordIndex + 1) % words.length;
    wordCycle.textContent = words[wordIndex];
  }, 1650);
}

const prefersReducedMotion = false;

const revealEls = document.querySelectorAll('.reveal');
revealEls.forEach((el) => {
  const stagger = Number(el.getAttribute('data-stagger') || 0);
  el.style.setProperty('--stagger', String(stagger));
});

if (!prefersReducedMotion) {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  window.setTimeout(() => {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }, 1200);
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}

const waitlistForms = document.querySelectorAll('form.email-capture');
waitlistForms.forEach((form) => {
  const container = form.closest('section') || form.parentElement;
  const message = container ? container.querySelector('.form-message') : null;
  if (!message) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      message.textContent = 'Please enter a valid email address.';
      return;
    }
    message.textContent = `Perfect. ${email} is registered.`;
    form.reset();
  });
});

const tiltCards = document.querySelectorAll('.tilt');
tiltCards.forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    if (prefersReducedMotion) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const depth = Number(card.getAttribute('data-depth') || 1);
    const rotateY = (x - 0.5) * 6 * depth;
    const rotateX = (0.5 - y) * 4 * depth;
    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  card.addEventListener('pointerleave', () => {
    card.style.transform = 'none';
  });
});

const statEls = document.querySelectorAll('.hero-metrics b[data-count]');
const animateStats = () => {
  statEls.forEach((el) => {
    const initial = el.textContent || '';
    const target = Number(el.getAttribute('data-count'));
    if (!Number.isFinite(target)) return;

    const hasPercent = initial.includes('%');
    const hasX = initial.toLowerCase().includes('x');
    const decimals = target % 1 === 0 ? 0 : 1;

    const duration = 850;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = (target * eased).toFixed(decimals);
      el.textContent = hasPercent ? `${value}%` : hasX ? `${value}x` : value;
      if (t < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
};

if (!prefersReducedMotion && statEls.length) {
  const statBlock = document.querySelector('.hero-metrics');
  if (statBlock) {
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateStats();
          statObserver.disconnect();
        }
      });
    }, { threshold: 0.45 });
    statObserver.observe(statBlock);
  }
}

if (!prefersReducedMotion) {
  const root = document.documentElement;
  let ticking = false;
  const onScroll = () => {
    const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    root.style.setProperty('--scroll', progress.toFixed(4));
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
  onScroll();

  const dot = document.querySelector('.cursor-dot');
  const beam = document.querySelector('.cursor-beam');
  if (dot && beam) {
    let x = window.innerWidth / 2;
    let bx = x;

    const show = () => {
      dot.style.opacity = '1';
      beam.style.opacity = '1';
    };

    const hide = () => {
      dot.style.opacity = '0';
      beam.style.opacity = '0';
    };

    window.addEventListener('pointermove', (event) => {
      x = event.clientX;
      dot.style.left = `${x}px`;
      dot.style.top = `${event.clientY}px`;
      show();
    });

    window.addEventListener('pointerleave', hide);

    const raf = () => {
      bx += (x - bx) * 0.16;
      beam.style.left = `${bx}px`;
      window.requestAnimationFrame(raf);
    };
    raf();
  }
}
