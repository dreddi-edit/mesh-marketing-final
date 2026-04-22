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

// Word cycler for products hero H1
const words = ['One context engine.', 'Shared knowledge.', 'Zero context limits.', 'A universal graph.'];
const wordCycle = document.querySelector('.word-cycle');
let wordIndex = 0;
if (wordCycle) {
  setInterval(() => {
    wordIndex = (wordIndex + 1) % words.length;
    wordCycle.textContent = words[wordIndex];
  }, 1650);
}

// Typing effect for the terminal mockup
const terminalEl = document.getElementById('typing-terminal');
if (terminalEl && !prefersReducedMotion) {
  const codeLines = [
    { type: 'cmd',   prompt: '~ mesh-cli', text: 'mcp start --port 3000' },
    { type: 'delay', time: 400 },
    { type: 'log',   text: '[<span class="log-info">INFO</span>] MCP server listening on :3000' },
    { type: 'delay', time: 100 },
    { type: 'log',   text: '[<span class="log-info">INFO</span>] Indexing workspace graph...' },
    { type: 'delay', time: 800 },
    { type: 'log',   text: '[<span class="log-info">INFO</span>] Registered 14 context tools' },
    { type: 'delay', time: 150 },
    { type: 'log',   text: '[<span class="tok-fn">SUCCESS</span>] Attached to /project' }
  ];

  let lineIdx = 0;
  let charIdx = 0;
  let outputHtml = '';
  let currentCmdText = '';
  let isTyping = false;

  const runTypingSequence = () => {
    if (lineIdx >= codeLines.length) {
      setTimeout(() => {
        // Reset loop
        terminalEl.innerHTML = '';
        outputHtml = '';
        lineIdx = 0;
        charIdx = 0;
        runTypingSequence();
      }, 5000);
      return;
    }

    const currentItem = codeLines[lineIdx];

    if (currentItem.type === 'delay') {
      lineIdx++;
      setTimeout(runTypingSequence, currentItem.time);
      return;
    }

    if (currentItem.type === 'cmd') {
      if (charIdx === 0) {
        currentCmdText = `<span class="prompt">${currentItem.prompt}</span> `;
      }
      
      currentCmdText += currentItem.text[charIdx];
      terminalEl.innerHTML = outputHtml + currentCmdText + '<span class="cursor">_</span>';
      charIdx++;

      if (charIdx < currentItem.text.length) {
        setTimeout(runTypingSequence, Math.random() * 50 + 20); // typing speed
      } else {
        // finished cmd
        outputHtml += currentCmdText + '<br/>';
        terminalEl.innerHTML = outputHtml;
        charIdx = 0;
        lineIdx++;
        runTypingSequence();
      }
    } else if (currentItem.type === 'log') {
      outputHtml += currentItem.text + '<br/>';
      terminalEl.innerHTML = outputHtml;
      charIdx = 0;
      lineIdx++;
      runTypingSequence();
    }
  };

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isTyping) {
      isTyping = true;
      runTypingSequence();
    }
  }, { threshold: 0.2 });
  
  observer.observe(terminalEl);
} else if (terminalEl) {
  terminalEl.innerHTML = '<span class="prompt">~ mesh-cli</span> mcp start --port 3000<br/>[<span class="log-info">INFO</span>] MCP server listening<br/>[<span class="log-info">INFO</span>] Registered 12 tools<br/>[<span class="log-info">INFO</span>] Attached to /project';
}


// Typing effect for the IDE mockup
const ideEl = document.getElementById('typing-ide');
if (ideEl && !prefersReducedMotion) {
  const ideLines = [
    { type: 'code', text: '<span class="tok-key">import</span> { <span class="tok-fn">Workspace</span> } <span class="tok-key">from</span> <span class="tok-str">"@mesh/core"</span>;' },
    { type: 'delay', time: 600 },
    { type: 'code', text: '<span class="tok-key">const</span> <span class="tok-fn">meshIDE</span> = <span class="tok-key">new</span> <span class="tok-fn">Workspace</span>({ root: <span class="tok-str">"./dir"</span> });' },
    { type: 'delay', time: 500 },
    { type: 'code', text: '<span class="tok-key">await</span> meshIDE.<span class="tok-fn">attachSession</span>();' },
    { type: 'delay', time: 300 },
    { type: 'code', text: 'console.<span class="tok-fn">log</span>(<span class="tok-str">"Ready to build."</span>);' }
  ];

  let lineIdx = 0;
  let charIdx = 0;
  let outputHtml = '';
  let currentText = '';
  let isTyping = false;

  const runIdeSequence = () => {
    if (lineIdx >= ideLines.length) {
      setTimeout(() => {
        ideEl.innerHTML = '';
        outputHtml = '';
        lineIdx = 0;
        charIdx = 0;
        runIdeSequence();
      }, 5000);
      return;
    }

    const currentItem = ideLines[lineIdx];

    if (currentItem.type === 'delay') {
      lineIdx++;
      setTimeout(runIdeSequence, currentItem.time);
      return;
    }

    if (currentItem.type === 'code') {
      outputHtml += currentItem.text + '<br/>';
      ideEl.innerHTML = outputHtml + '<span class="cursor">_</span>';
      charIdx = 0;
      lineIdx++;
      setTimeout(runIdeSequence, 250);
    }
  };

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isTyping) {
      isTyping = true;
      runIdeSequence();
    }
  }, { threshold: 0.2 });
  
  observer.observe(ideEl);
}

// Typing effect for the API mockup
const apiEl = document.getElementById('typing-api');
if (apiEl && !prefersReducedMotion) {
  const apiLines = [
    { type: 'req', text: 'POST /api/v1/context<br/>Authorization: Bearer mesh_...' },
    { type: 'delay', time: 600 },
    { type: 'req', text: '{<br/>  "query": "routing logic",<br/>  "budget": 2000<br/>}' },
    { type: 'delay', time: 800 },
    { type: 'res', text: '<span class="tok-fn">HTTP</span> 200 OK<br/>{<br/>  "capsules": [ ... ],<br/>  "cost": 1845<br/>}' }
  ];

  let lineIdx = 0;
  let outputHtml = '';
  let isTyping = false;

  const runApiSequence = () => {
    if (lineIdx >= apiLines.length) {
      setTimeout(() => {
        apiEl.innerHTML = '';
        outputHtml = '';
        lineIdx = 0;
        runApiSequence();
      }, 6000);
      return;
    }

    const currentItem = apiLines[lineIdx];

    if (currentItem.type === 'delay') {
      lineIdx++;
      setTimeout(runApiSequence, currentItem.time);
      return;
    }

    outputHtml += currentItem.text + '<br/><br/>';
    apiEl.innerHTML = outputHtml;
    lineIdx++;
    setTimeout(runApiSequence, 100);
  };

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isTyping) {
      isTyping = true;
      runApiSequence();
    }
  }, { threshold: 0.2 });
  
  observer.observe(apiEl);
}
