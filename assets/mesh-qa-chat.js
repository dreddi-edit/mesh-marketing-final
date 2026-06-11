(() => {
  if (window.__meshQaChatLoaded) return;
  window.__meshQaChatLoaded = true;

  const SUGGESTIONS = [
    'How do I install Mesh CLI?',
    'What is the MCP server?',
    'Which models does Mesh support?',
  ];

  const style = document.createElement('style');
  style.textContent = `
    #mesh-qa-root {
      --mq-cyan: var(--cyan, oklch(0.74 0.14 200));
      --mq-petrol: var(--petrol, oklch(0.38 0.09 198));
      --mq-dark: var(--dark, oklch(0.08 0.04 200));
      --mq-dark2: var(--dark2, oklch(0.13 0.05 200));
      --mq-muted: oklch(0.62 0.04 200);
      --mq-sans: var(--sans, 'DM Sans', system-ui, sans-serif);
      --mq-mono: var(--mono, 'Geist Mono', ui-monospace, monospace);
      --mq-display: var(--display, 'Barlow Condensed', sans-serif);
      font-family: var(--mq-sans);
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 99990;
    }
    #mesh-qa-toggle {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      border: 1px solid oklch(0.74 0.14 200 / 0.35);
      background: linear-gradient(145deg, oklch(0.14 0.05 200), oklch(0.1 0.04 200));
      color: var(--mq-cyan);
      cursor: pointer;
      box-shadow: 0 16px 48px oklch(0 0 0 / 0.45);
      font-family: var(--mq-display);
      font-size: 22px;
      font-weight: 800;
      line-height: 1;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    #mesh-qa-toggle:hover {
      transform: translateY(-2px);
      border-color: var(--mq-cyan);
      box-shadow: 0 20px 56px oklch(0.74 0.14 200 / 0.18);
    }
    #mesh-qa-panel {
      display: none;
      width: min(400px, calc(100vw - 32px));
      height: min(540px, calc(100vh - 108px));
      margin-bottom: 14px;
      border-radius: 18px;
      border: 1px solid oklch(1 0 0 / 0.08);
      background: linear-gradient(165deg, oklch(0.12 0.045 200 / 0.98), oklch(0.09 0.04 200 / 0.98));
      backdrop-filter: blur(20px);
      box-shadow: 0 28px 80px oklch(0 0 0 / 0.55);
      overflow: hidden;
      flex-direction: column;
    }
    #mesh-qa-root[data-open="true"] #mesh-qa-panel { display: flex; }
    #mesh-qa-head {
      padding: 16px 18px 14px;
      border-bottom: 1px solid oklch(1 0 0 / 0.06);
    }
    #mesh-qa-head strong {
      display: block;
      font-family: var(--mq-display);
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: oklch(0.99 0.004 195);
    }
    #mesh-qa-head span {
      display: block;
      margin-top: 4px;
      font-family: var(--mq-mono);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--mq-muted);
    }
    #mesh-qa-log {
      flex: 1;
      overflow-y: auto;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      scrollbar-width: thin;
      scrollbar-color: oklch(0.74 0.14 200 / 0.25) transparent;
    }
    .mq-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 100%;
    }
    .mq-row.user { align-items: flex-end; }
    .mq-row.bot { align-items: flex-start; }
    .mq-bubble {
      max-width: 92%;
      padding: 11px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.55;
      word-break: break-word;
    }
    .mq-bubble.user {
      background: oklch(0.74 0.14 200 / 0.12);
      color: oklch(0.96 0.02 200);
      border: 1px solid oklch(0.74 0.14 200 / 0.22);
    }
    .mq-bubble.bot {
      background: oklch(1 0 0 / 0.04);
      color: oklch(0.94 0.01 200);
      border: 1px solid oklch(1 0 0 / 0.07);
    }
    .mq-bubble.bot code {
      font-family: var(--mq-mono);
      font-size: 12px;
      color: var(--mq-cyan);
      background: oklch(0 0 0 / 0.28);
      padding: 1px 6px;
      border-radius: 6px;
    }
    .mq-thinking {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--mq-muted);
      font-size: 13px;
    }
    .mq-thinking-dots {
      display: inline-flex;
      gap: 4px;
    }
    .mq-thinking-dots i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--mq-cyan);
      opacity: 0.35;
      animation: mq-pulse 1.2s ease-in-out infinite;
    }
    .mq-thinking-dots i:nth-child(2) { animation-delay: 0.15s; }
    .mq-thinking-dots i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes mq-pulse {
      0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-2px); }
    }
    .mq-sources {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding-left: 2px;
    }
    .mq-sources a {
      font-family: var(--mq-mono);
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--mq-muted);
      text-decoration: none;
      padding: 4px 0;
      border-bottom: 1px solid oklch(0.74 0.14 200 / 0.25);
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .mq-sources a:hover {
      color: var(--mq-cyan);
      border-color: var(--mq-cyan);
    }
    .mq-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding-left: 2px;
    }
    .mq-chips-label {
      width: 100%;
      font-family: var(--mq-mono);
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--mq-muted);
      margin-bottom: -2px;
    }
    .mq-chips button {
      font-family: var(--mq-sans);
      font-size: 12px;
      border-radius: 999px;
      border: 1px solid oklch(0.74 0.14 200 / 0.28);
      background: oklch(0.74 0.14 200 / 0.06);
      color: oklch(0.9 0.03 200);
      padding: 7px 12px;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .mq-chips button:hover:not(:disabled) {
      background: oklch(0.74 0.14 200 / 0.14);
      border-color: var(--mq-cyan);
      color: var(--mq-cyan);
    }
    .mq-chips button:disabled { opacity: 0.45; cursor: not-allowed; }
    #mesh-qa-suggestions {
      padding: 0 18px 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    #mesh-qa-suggestions button {
      font-size: 12px;
      border-radius: 999px;
      border: 1px solid oklch(1 0 0 / 0.1);
      background: oklch(1 0 0 / 0.03);
      color: oklch(0.78 0.02 200);
      padding: 6px 11px;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }
    #mesh-qa-suggestions button:hover {
      border-color: oklch(0.74 0.14 200 / 0.4);
      color: var(--mq-cyan);
    }
    #mesh-qa-form {
      display: flex;
      gap: 8px;
      padding: 14px 18px 16px;
      border-top: 1px solid oklch(1 0 0 / 0.06);
      background: oklch(0 0 0 / 0.15);
    }
    #mesh-qa-input {
      flex: 1;
      border-radius: 12px;
      border: 1px solid oklch(1 0 0 / 0.1);
      background: oklch(0 0 0 / 0.35);
      color: oklch(0.98 0.01 200);
      padding: 11px 13px;
      font-size: 14px;
      font-family: var(--mq-sans);
      outline: none;
      transition: border-color 0.15s ease;
    }
    #mesh-qa-input::placeholder { color: oklch(0.55 0.04 200); }
    #mesh-qa-input:focus { border-color: oklch(0.74 0.14 200 / 0.45); }
    #mesh-qa-send {
      border-radius: 12px;
      border: none;
      background: var(--mq-cyan);
      color: oklch(0.12 0.04 200);
      padding: 0 16px;
      cursor: pointer;
      font-family: var(--mq-mono);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.04em;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    #mesh-qa-send:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
    #mesh-qa-send:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 480px) {
      #mesh-qa-root { right: 14px; bottom: 14px; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'mesh-qa-root';
  root.innerHTML = `
    <div id="mesh-qa-panel" role="dialog" aria-label="Mesh docs assistant">
      <div id="mesh-qa-head">
        <strong>Ask Mesh</strong>
        <span>Grounded in try-mesh.com docs</span>
      </div>
      <div id="mesh-qa-log"></div>
      <div id="mesh-qa-suggestions"></div>
      <form id="mesh-qa-form">
        <input id="mesh-qa-input" type="text" placeholder="Install, MCP, models…" maxlength="500" autocomplete="off" />
        <button id="mesh-qa-send" type="submit">Send</button>
      </form>
    </div>
    <button id="mesh-qa-toggle" type="button" aria-expanded="false" aria-controls="mesh-qa-panel" title="Ask Mesh">?</button>
  `;
  document.body.appendChild(root);

  const toggle = root.querySelector('#mesh-qa-toggle');
  const log = root.querySelector('#mesh-qa-log');
  const form = root.querySelector('#mesh-qa-form');
  const input = root.querySelector('#mesh-qa-input');
  const send = root.querySelector('#mesh-qa-send');
  const suggestions = root.querySelector('#mesh-qa-suggestions');

  let busy = false;
  let activeChips = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatAnswerHtml(text) {
    const safe = escapeHtml(text);
    return safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function clearChips() {
    if (activeChips?.parentNode) activeChips.parentNode.remove();
    activeChips = null;
  }

  function setChips(options, { disabled = false } = {}) {
    clearChips();
    if (!options?.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'mq-row bot';
    const chips = document.createElement('div');
    chips.className = 'mq-chips';
    const label = document.createElement('div');
    label.className = 'mq-chips-label';
    label.textContent = 'Follow up';
    chips.appendChild(label);
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.disabled = disabled;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        ask(opt.query);
      });
      chips.appendChild(btn);
    }
    wrap.appendChild(chips);
    log.appendChild(wrap);
    activeChips = wrap;
    log.scrollTop = log.scrollHeight;
  }

  function addUserBubble(text) {
    const row = document.createElement('div');
    row.className = 'mq-row user';
    const bubble = document.createElement('div');
    bubble.className = 'mq-bubble user';
    bubble.textContent = text;
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function addBotRow() {
    const row = document.createElement('div');
    row.className = 'mq-row bot';
    const bubble = document.createElement('div');
    bubble.className = 'mq-bubble bot';
    bubble.innerHTML = `
      <span class="mq-thinking">
        Searching docs
        <span class="mq-thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      </span>`;
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return { row, bubble };
  }

  function attachSources(row, sources) {
    const old = row.querySelector('.mq-sources');
    if (old) old.remove();
    if (!sources?.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'mq-sources';
    for (const s of sources) {
      const a = document.createElement('a');
      a.href = s.uri || '/docs';
      a.target = '_blank';
      a.rel = 'noopener';
      const label = (s.title || 'Docs').replace(/\s*-\s*Mesh.*$/i, '').trim() || 'Docs';
      a.textContent = label;
      wrap.appendChild(a);
    }
    row.appendChild(wrap);
  }

  function addBotBubble(text, sources) {
    const row = document.createElement('div');
    row.className = 'mq-row bot';
    const bubble = document.createElement('div');
    bubble.className = 'mq-bubble bot';
    bubble.innerHTML = formatAnswerHtml(text);
    row.appendChild(bubble);
    attachSources(row, sources);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  async function revealText(el, text, { msPerChar = 10 } = {}) {
    const target = formatAnswerHtml(text);
    el.innerHTML = '';
    let i = 0;
    const plain = text;
    return new Promise((resolve) => {
      const tick = () => {
        i += 1;
        const slice = plain.slice(0, i);
        el.innerHTML = formatAnswerHtml(slice);
        log.scrollTop = log.scrollHeight;
        if (i < plain.length) {
          window.setTimeout(tick, msPerChar);
        } else {
          el.innerHTML = target;
          resolve();
        }
      };
      if (!plain.length) {
        resolve();
        return;
      }
      tick();
    });
  }

  function parseSseBlock(block) {
    let event = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return null;
    try {
      return { event, data: JSON.parse(dataLines.join('\n')) };
    } catch {
      return null;
    }
  }

  async function consumeSse(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const parsed = parseSseBlock(part);
        if (parsed) onEvent(parsed.event, parsed.data);
      }
    }
    if (buffer.trim()) {
      const parsed = parseSseBlock(buffer);
      if (parsed) onEvent(parsed.event, parsed.data);
    }
  }

  function renderSuggestions() {
    suggestions.innerHTML = '';
    for (const q of SUGGESTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = q;
      btn.addEventListener('click', () => {
        if (busy) return;
        ask(q);
      });
      suggestions.appendChild(btn);
    }
  }

  async function ask(message) {
    const text = String(message || '').trim();
    if (!text || busy) return;

    busy = true;
    send.disabled = true;
    suggestions.innerHTML = '';
    clearChips();

    addUserBubble(text);
    const { row: botRow, bubble: botBubble } = addBotRow();

    let sources = [];
    let answer = '';
    let followups = [];
    let errored = false;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ message: text }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json().catch(() => ({}));
        answer = data.message || 'Something went wrong. Try /docs.';
        errored = true;
      } else {
        await consumeSse(res, (event, data) => {
          if (event === 'meta' && data.sources) sources = data.sources;
          if (event === 'answer' && data.text) answer = data.text;
          if (event === 'options' && data.items) followups = data.items;
          if (event === 'error') {
            answer = data.message || 'Error. Try /docs.';
            errored = true;
          }
        });
      }

      if (!answer.trim()) {
        answer = 'No answer found. Try /docs or /quickstart.';
        errored = true;
      }

      const speed = answer.length > 180 ? 6 : 10;
      await revealText(botBubble, answer, { msPerChar: errored ? 0 : speed });
      attachSources(botRow, sources);
      setChips(followups);
      log.scrollTop = log.scrollHeight;
    } catch {
      botBubble.innerHTML = formatAnswerHtml('Network error. Check /docs or /quickstart.');
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  toggle.addEventListener('click', () => {
    const open = root.dataset.open === 'true';
    root.dataset.open = open ? 'false' : 'true';
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    if (!open) {
      if (!log.childElementCount) {
        addBotBubble('Short answers about install, CLI, MCP, and models — grounded in our docs.', []);
        renderSuggestions();
      }
      input.focus();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = input.value.trim();
    input.value = '';
    ask(message);
  });
})();
