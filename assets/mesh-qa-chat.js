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
      --mq-cyan: #00d4e8;
      --mq-dark: #05080c;
      --mq-panel: rgba(8, 14, 22, 0.96);
      --mq-border: rgba(0, 212, 232, 0.22);
      font-family: 'DM Sans', system-ui, sans-serif;
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 99990;
    }
    #mesh-qa-toggle {
      width: 56px;
      height: 56px;
      border-radius: 999px;
      border: 1px solid var(--mq-border);
      background: linear-gradient(145deg, #0a121c, #061018);
      color: var(--mq-cyan);
      cursor: pointer;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
      font-size: 22px;
      line-height: 1;
    }
    #mesh-qa-toggle:hover { border-color: var(--mq-cyan); }
    #mesh-qa-panel {
      display: none;
      width: min(380px, calc(100vw - 32px));
      height: min(520px, calc(100vh - 100px));
      margin-bottom: 12px;
      border-radius: 16px;
      border: 1px solid var(--mq-border);
      background: var(--mq-panel);
      backdrop-filter: blur(16px);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
      overflow: hidden;
      flex-direction: column;
    }
    #mesh-qa-root[data-open="true"] #mesh-qa-panel { display: flex; }
    #mesh-qa-head {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      color: #fff;
      font-size: 14px;
      font-weight: 500;
    }
    #mesh-qa-head span {
      display: block;
      color: rgba(255,255,255,0.45);
      font-size: 11px;
      margin-top: 2px;
      font-weight: 400;
    }
    #mesh-qa-log {
      flex: 1;
      overflow-y: auto;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .mq-bubble {
      max-width: 92%;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .mq-bubble.user {
      align-self: flex-end;
      background: rgba(0, 212, 232, 0.14);
      color: #e8fbff;
      border: 1px solid rgba(0, 212, 232, 0.25);
    }
    .mq-bubble.bot {
      align-self: flex-start;
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.9);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .mq-bubble.bot.streaming::after {
      content: '▍';
      color: var(--mq-cyan);
      animation: mq-blink 0.9s step-end infinite;
    }
    @keyframes mq-blink { 50% { opacity: 0; } }
    .mq-sources {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .mq-sources a {
      font-size: 11px;
      color: var(--mq-cyan);
      text-decoration: none;
      border: 1px solid rgba(0,212,232,0.25);
      border-radius: 999px;
      padding: 2px 8px;
    }
    .mq-sources a:hover { background: rgba(0,212,232,0.1); }
    .mq-followups {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .mq-followups-label {
      font-size: 11px;
      color: rgba(255,255,255,0.45);
    }
    .mq-followups button {
      font-size: 11px;
      border-radius: 999px;
      border: 1px solid rgba(0,212,232,0.28);
      background: rgba(0,212,232,0.08);
      color: var(--mq-cyan);
      padding: 5px 11px;
      cursor: pointer;
      text-align: left;
    }
    .mq-followups button:hover {
      background: rgba(0,212,232,0.16);
    }
    #mesh-qa-suggestions {
      padding: 0 16px 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    #mesh-qa-suggestions button {
      font-size: 11px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: transparent;
      color: rgba(255,255,255,0.65);
      padding: 4px 10px;
      cursor: pointer;
    }
    #mesh-qa-suggestions button:hover {
      border-color: var(--mq-cyan);
      color: var(--mq-cyan);
    }
    #mesh-qa-form {
      display: flex;
      gap: 8px;
      padding: 12px 16px 14px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    #mesh-qa-input {
      flex: 1;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.35);
      color: #fff;
      padding: 10px 12px;
      font-size: 13px;
      outline: none;
    }
    #mesh-qa-input:focus { border-color: var(--mq-cyan); }
    #mesh-qa-send {
      border-radius: 10px;
      border: 1px solid var(--mq-border);
      background: rgba(0,212,232,0.15);
      color: var(--mq-cyan);
      padding: 0 14px;
      cursor: pointer;
      font-size: 13px;
    }
    #mesh-qa-send:disabled { opacity: 0.45; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'mesh-qa-root';
  root.innerHTML = `
    <div id="mesh-qa-panel" role="dialog" aria-label="Mesh docs assistant">
      <div id="mesh-qa-head">Ask Mesh <span>Answers from try-mesh.com docs</span></div>
      <div id="mesh-qa-log"></div>
      <div id="mesh-qa-suggestions"></div>
      <form id="mesh-qa-form">
        <input id="mesh-qa-input" type="text" placeholder="Ask about install, MCP, models…" maxlength="500" autocomplete="off" />
        <button id="mesh-qa-send" type="submit">Send</button>
      </form>
    </div>
    <button id="mesh-qa-toggle" type="button" aria-expanded="false" aria-controls="mesh-qa-panel" title="Ask Mesh">?</button>
  `;
  document.body.appendChild(root);

  const toggle = root.querySelector('#mesh-qa-toggle');
  const panel = root.querySelector('#mesh-qa-panel');
  const log = root.querySelector('#mesh-qa-log');
  const form = root.querySelector('#mesh-qa-form');
  const input = root.querySelector('#mesh-qa-input');
  const send = root.querySelector('#mesh-qa-send');
  const suggestions = root.querySelector('#mesh-qa-suggestions');

  let busy = false;
  const OPTIONS_RE = /<<options>>([\s\S]*?)<\/options>>/i;

  function parseOptions(text) {
    const match = text.match(OPTIONS_RE);
    if (!match) return { body: text.trim(), options: [] };
    const body = text.replace(OPTIONS_RE, '').trim();
    const options = match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const pipe = line.indexOf('|');
        if (pipe === -1) return { label: line, query: line };
        return {
          label: line.slice(0, pipe).trim(),
          query: line.slice(pipe + 1).trim(),
        };
      })
      .filter((o) => o.label && o.query)
      .slice(0, 3);
    return { body, options };
  }

  function visibleWhileStreaming(text) {
    const idx = text.indexOf('<<options>>');
    return idx === -1 ? text : text.slice(0, idx).trimEnd();
  }

  function attachFollowups(el, options) {
    const old = el.querySelector('.mq-followups');
    if (old) old.remove();
    if (!options?.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'mq-followups';
    const label = document.createElement('div');
    label.className = 'mq-followups-label';
    label.textContent = 'Weiter?';
    wrap.appendChild(label);
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => ask(opt.query));
      wrap.appendChild(btn);
    }
    el.appendChild(wrap);
  }

  function attachSources(el, sources) {
    if (!sources?.length) return;
    let wrap = el.querySelector('.mq-sources');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'mq-sources';
      el.appendChild(wrap);
    }
    wrap.innerHTML = '';
    for (const s of sources) {
      const a = document.createElement('a');
      a.href = s.uri || '/docs';
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = s.title || 'Docs';
      wrap.appendChild(a);
    }
  }

  function addBubble(text, role, sources) {
    const el = document.createElement('div');
    el.className = `mq-bubble ${role}`;
    el.textContent = text;
    if (role === 'bot') attachSources(el, sources);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
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
        input.value = q;
        form.requestSubmit();
      });
      suggestions.appendChild(btn);
    }
  }

  async function ask(message) {
    if (!message || busy) return;
    busy = true;
    send.disabled = true;
    suggestions.innerHTML = '';
    addBubble(message, 'user');

    const botEl = document.createElement('div');
    botEl.className = 'mq-bubble bot streaming';
    log.appendChild(botEl);
    log.scrollTop = log.scrollHeight;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ message }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json().catch(() => ({}));
        botEl.classList.remove('streaming');
        botEl.textContent = data.message || 'Something went wrong. Try /docs.';
        return;
      }

      let sources = [];
      let fullText = '';
      let followups = [];
      await consumeSse(res, (event, data) => {
        if (event === 'delta' && data.text) {
          fullText += data.text;
          botEl.textContent = visibleWhileStreaming(fullText);
          log.scrollTop = log.scrollHeight;
        } else if (event === 'replace' && data.text) {
          fullText = data.text;
          botEl.textContent = data.text;
        } else if (event === 'options' && data.items) {
          followups = data.items;
        } else if (event === 'meta' && data.sources) {
          sources = data.sources;
        } else if (event === 'error') {
          fullText = data.message || 'Error. Try /docs.';
          botEl.textContent = fullText;
        }
      });

      botEl.classList.remove('streaming');
      if (!fullText.trim()) {
        botEl.textContent = 'No answer found. Try /docs or /quickstart.';
      }
      if (!followups.length) {
        const parsed = parseOptions(fullText);
        botEl.textContent = parsed.body || botEl.textContent;
        followups = parsed.options;
      }
      attachFollowups(botEl, followups);
      attachSources(botEl, sources);
      log.scrollTop = log.scrollHeight;
    } catch {
      botEl.classList.remove('streaming');
      botEl.textContent = 'Network error. Check /docs or /quickstart.';
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
        addBubble('Kurze Antworten zu Mesh — Install, CLI, MCP, Modelle. Was willst du wissen?', 'bot');
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
