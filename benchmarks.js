const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const form = document.getElementById('waitlist-form');
const message = document.getElementById('form-message');
if (form && message) {
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
}

const revealEls = document.querySelectorAll('.reveal');
revealEls.forEach((el) => {
  const stagger = Number(el.getAttribute('data-stagger') || 0);
  el.style.setProperty('--stagger', String(stagger));
});

if (!prefersReducedMotion) {
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

// Chart animations
if (!prefersReducedMotion) {
  const chartObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Horizontal bars
          const fills = entry.target.querySelectorAll('.bar-fill');
          fills.forEach(fill => {
            const target = fill.getAttribute('data-target');
            if (target) {
              setTimeout(() => {
                  fill.style.width = target + '%';
              }, 100);
            }
          });
          
          // Vertical bars
          const cores = entry.target.querySelectorAll('.sat-core');
          cores.forEach(core => {
             const h = core.getAttribute('data-target-height');
             if (h) {
                setTimeout(() => {
                    core.style.height = h + '%';
                }, 100);
             }
          });

          // Unobserve so it only animates once
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  
  document.querySelectorAll('.animated-chart-section').forEach(el => {
    chartObserver.observe(el);
  });
} else {
  document.querySelectorAll('.bar-fill').forEach(fill => {
    const target = fill.getAttribute('data-target');
    if (target) fill.style.width = target + '%';
  });
  document.querySelectorAll('.sat-core').forEach(core => {
    const h = core.getAttribute('data-target-height');
    if (h) core.style.height = h + '%';
  });
}

// Word cycler
const words = ['vs raw context', 'Cost multipliers', 'Accuracy dropoff'];
const wordCycle = document.querySelector('.word-cycle');
let wordIndex = 0;
if (wordCycle) {
  setInterval(() => {
    wordIndex = (wordIndex + 1) % words.length;
    wordCycle.textContent = words[wordIndex];
  }, 1650);
}

// Add cursor logic
if (!prefersReducedMotion) {
  const dot = document.querySelector('.cursor-dot');
  const beam = document.querySelector('.cursor-beam');
  if (dot && beam) {
    let x = window.innerWidth / 2;
    let bx = x;

    const show = () => {
      dot.style.opacity = '1';
      beam.style.opacity = '0.25';
    };

    const hide = () => {
      dot.style.opacity = '0';
      beam.style.opacity = '0';
    };

    window.addEventListener('pointermove', (event) => {
      x = event.clientX;
      dot.style.left = `${event.clientX}px`;
      dot.style.top = `${event.clientY}px`;
      show();
    });

    window.addEventListener('pointerleave', hide);

    const raf = () => {
      bx += (x - bx) * 0.14;
      beam.style.left = `${bx}px`;
      window.requestAnimationFrame(raf);
    };
    raf();
  }
}
