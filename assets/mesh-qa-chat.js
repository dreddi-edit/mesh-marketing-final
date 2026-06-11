(() => {
  if (window.__meshQaChatLoaded) return;
  window.__meshQaChatLoaded = true;

  const SUGGESTIONS = [
    'How do I install Mesh CLI?',
    'What is the MCP server?',
    'Which models does Mesh support?',
  ];

  const MESH_ICON = `<svg class="mq-logo" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="9" fill="#08111a"/>
    <path d="M10 10L5 20L10 30" stroke="#00d4e8" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M30 10L35 20L30 30" stroke="#7ceeff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const MIC_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>`;

  const style = document.createElement('style');
  style.textContent = `
    #mesh-qa-root {
      --mq-cyan: var(--cyan, oklch(0.74 0.14 200));
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
      padding: 0;
      border-radius: 14px;
      border: 1px solid oklch(0.74 0.14 200 / 0.35);
      background: linear-gradient(145deg, oklch(0.14 0.05 200), oklch(0.1 0.04 200));
      cursor: pointer;
      box-shadow: 0 16px 48px oklch(0 0 0 / 0.45);
      display: grid;
      place-items: center;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    #mesh-qa-toggle .mq-logo { width: 28px; height: 28px; display: block; }
    #mesh-qa-toggle:hover {
      transform: translateY(-2px);
      border-color: var(--mq-cyan);
      box-shadow: 0 20px 56px oklch(0.74 0.14 200 / 0.18);
    }
    #mesh-qa-root[data-open="true"] #mesh-qa-toggle { display: none; }
    #mesh-qa-panel {
      display: none;
      width: min(400px, calc(100vw - 32px));
      height: min(540px, calc(100vh - 108px));
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 14px 14px 16px;
      border-bottom: 1px solid oklch(1 0 0 / 0.06);
    }
    .mq-head-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .mq-head-brand .mq-logo { width: 32px; height: 32px; flex-shrink: 0; }
    .mq-head-brand strong {
      font-family: var(--mq-display);
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: oklch(0.99 0.004 195);
      line-height: 1;
    }
    #mesh-qa-close {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid oklch(1 0 0 / 0.08);
      background: oklch(1 0 0 / 0.04);
      color: oklch(0.78 0.02 200);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      display: grid;
      place-items: center;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }
    #mesh-qa-close:hover {
      color: var(--mq-cyan);
      border-color: oklch(0.74 0.14 200 / 0.35);
      background: oklch(0.74 0.14 200 / 0.08);
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
    .mq-row { display: flex; flex-direction: column; gap: 8px; max-width: 100%; }
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
    .mq-thinking-dots { display: inline-flex; gap: 4px; }
    .mq-thinking-dots i {
      width: 5px; height: 5px; border-radius: 50%;
      background: var(--mq-cyan); opacity: 0.35;
      animation: mq-pulse 1.2s ease-in-out infinite;
    }
    .mq-thinking-dots i:nth-child(2) { animation-delay: 0.15s; }
    .mq-thinking-dots i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes mq-pulse {
      0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
      40% { opacity: 1; transform: translateY(-2px); }
    }
    .mq-chips { display: flex; flex-wrap: wrap; gap: 8px; padding-left: 2px; }
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
    }
    #mesh-qa-suggestions button:hover {
      border-color: oklch(0.74 0.14 200 / 0.4);
      color: var(--mq-cyan);
    }
    #mesh-qa-talk-bar {
      padding: 0 18px 10px;
    }
    #mesh-qa-talk-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid oklch(0.74 0.14 200 / 0.22);
      background: oklch(0.74 0.14 200 / 0.06);
      color: oklch(0.92 0.03 200);
      font-family: var(--mq-sans);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    #mesh-qa-talk-btn:hover {
      background: oklch(0.74 0.14 200 / 0.12);
      border-color: var(--mq-cyan);
      color: var(--mq-cyan);
    }
    #mesh-qa-root[data-mode="voice"] #mesh-qa-talk-bar,
    #mesh-qa-root[data-mode="voice"] #mesh-qa-form,
    #mesh-qa-root[data-mode="voice"] #mesh-qa-suggestions { display: none; }
    #mesh-qa-voice {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 8px 18px 16px;
      border-top: 1px solid oklch(1 0 0 / 0.06);
      background: oklch(0 0 0 / 0.12);
    }
    #mesh-qa-root[data-mode="voice"] #mesh-qa-voice { display: flex; }
    #mesh-qa-voice-back {
      align-self: flex-start;
      border: none;
      background: none;
      color: var(--mq-muted);
      font-family: var(--mq-mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      padding: 0;
    }
    #mesh-qa-voice-back:hover { color: var(--mq-cyan); }
    .mq-voice-stage {
      position: relative;
      width: 100%;
      height: 120px;
      border-radius: 14px;
      border: 1px solid oklch(1 0 0 / 0.07);
      background: oklch(0 0 0 / 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .mq-voice-bars {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 48px;
    }
    .mq-voice-bars span {
      width: 3px;
      height: 8px;
      border-radius: 2px;
      background: linear-gradient(180deg, var(--mq-cyan), oklch(0.74 0.14 200 / 0.35));
      transform-origin: center;
      animation: mq-vbar 1.1s ease-in-out infinite;
    }
    .mq-voice-bars span:nth-child(2) { animation-delay: 0.1s; }
    .mq-voice-bars span:nth-child(3) { animation-delay: 0.2s; }
    .mq-voice-bars span:nth-child(4) { animation-delay: 0.3s; }
    .mq-voice-bars span:nth-child(5) { animation-delay: 0.4s; }
    @keyframes mq-vbar {
      0%, 100% { transform: scaleY(0.35); opacity: 0.45; }
      50% { transform: scaleY(1.6); opacity: 1; }
    }
    #mesh-qa-root[data-voice-state="idle"] .mq-voice-bars span { animation-play-state: paused; transform: scaleY(0.35); }
    #mesh-qa-root[data-voice-state="listening"] .mq-voice-bars span { animation-play-state: running; }
    #mesh-qa-root[data-voice-state="thinking"] .mq-voice-bars span { animation-duration: 0.55s; }
    #mesh-qa-root[data-voice-state="speaking"] .mq-voice-bars span { animation-duration: 0.75s; }
    #mesh-qa-voice-mic {
      position: absolute;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 1px solid oklch(0.74 0.14 200 / 0.35);
      background: oklch(0.1 0.04 200);
      color: var(--mq-cyan);
      cursor: pointer;
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 0 oklch(0.74 0.14 200 / 0.35);
      transition: box-shadow 0.2s ease, transform 0.15s ease;
    }
    #mesh-qa-voice-mic:hover { transform: scale(1.04); }
    #mesh-qa-root[data-voice-state="listening"] #mesh-qa-voice-mic {
      animation: mq-mic-glow 1.8s ease-in-out infinite;
    }
    @keyframes mq-mic-glow {
      0%, 100% { box-shadow: 0 0 0 0 oklch(0.74 0.14 200 / 0.45); }
      50% { box-shadow: 0 0 0 14px oklch(0.74 0.14 200 / 0); }
    }
    #mesh-qa-voice-status {
      font-family: var(--mq-mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--mq-muted);
      text-align: center;
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
    }
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
    }
    #mesh-qa-send:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 480px) {
      #mesh-qa-root { right: 14px; bottom: 14px; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'mesh-qa-root';
  root.dataset.mode = 'chat';
  root.dataset.voiceState = 'idle';
  root.innerHTML = `
    <div id="mesh-qa-panel" role="dialog" aria-label="Mesh assistant">
      <div id="mesh-qa-head">
        <div class="mq-head-brand">${MESH_ICON}<strong>Ask Mesh</strong></div>
        <button id="mesh-qa-close" type="button" aria-label="Close chat">×</button>
      </div>
      <div id="mesh-qa-log"></div>
      <div id="mesh-qa-suggestions"></div>
      <div id="mesh-qa-talk-bar">
        <button id="mesh-qa-talk-btn" type="button">${MIC_ICON}<span>Talk to Mesh</span></button>
      </div>
      <form id="mesh-qa-form">
        <input id="mesh-qa-input" type="text" placeholder="Install, MCP, models…" maxlength="500" autocomplete="off" />
        <button id="mesh-qa-send" type="submit">Send</button>
      </form>
      <div id="mesh-qa-voice" aria-label="Voice mode">
        <button id="mesh-qa-voice-back" type="button">← Back to chat</button>
        <div class="mq-voice-stage">
          <div class="mq-voice-bars" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <button id="mesh-qa-voice-mic" type="button" aria-label="Hold to speak">${MIC_ICON}</button>
        </div>
        <div id="mesh-qa-voice-status">Tap the mic and ask anything</div>
      </div>
    </div>
    <button id="mesh-qa-toggle" type="button" aria-expanded="false" aria-controls="mesh-qa-panel" title="Ask Mesh">${MESH_ICON}</button>
  `;
  document.body.appendChild(root);

  const toggle = root.querySelector('#mesh-qa-toggle');
  const closeBtn = root.querySelector('#mesh-qa-close');
  const log = root.querySelector('#mesh-qa-log');
  const form = root.querySelector('#mesh-qa-form');
  const input = root.querySelector('#mesh-qa-input');
  const send = root.querySelector('#mesh-qa-send');
  const suggestions = root.querySelector('#mesh-qa-suggestions');
  const talkBtn = root.querySelector('#mesh-qa-talk-btn');
  const voiceBack = root.querySelector('#mesh-qa-voice-back');
  const voiceMic = root.querySelector('#mesh-qa-voice-mic');
  const voiceStatus = root.querySelector('#mesh-qa-voice-status');

  let busy = false;
  let activeChips = null;
  let recognition = null;
  let speaking = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceSupported = Boolean(SpeechRecognition && window.speechSynthesis);

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatAnswerHtml(text) {
    return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function plainSpeech(text) {
    return String(text || '').replace(/`([^`]+)`/g, '$1').replace(/\s+/g, ' ').trim();
  }

  function setOpen(open) {
    root.dataset.open = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) input.focus();
    else stopVoice();
  }

  function setVoiceState(state) {
    root.dataset.voiceState = state;
  }

  function setMode(mode) {
    root.dataset.mode = mode;
    if (mode === 'chat') {
      setVoiceState('idle');
      voiceStatus.textContent = 'Tap the mic and ask anything';
    }
  }

  function clearChips() {
    if (activeChips?.parentNode) activeChips.parentNode.remove();
    activeChips = null;
  }

  function setChips(options) {
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
      btn.disabled = busy;
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
    return { bubble };
  }

  function addBotBubble(text) {
    const row = document.createElement('div');
    row.className = 'mq-row bot';
    const bubble = document.createElement('div');
    bubble.className = 'mq-bubble bot';
    bubble.innerHTML = formatAnswerHtml(text);
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function speak(text) {
    const line = plainSpeech(text);
    if (!line || !window.speechSynthesis) return Promise.resolve();
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(line);
      utter.rate = 1.02;
      utter.pitch = 1;
      const lang = document.documentElement.lang || 'en';
      utter.lang = lang.startsWith('de') ? 'de-DE' : 'en-US';
      utter.onend = () => {
        speaking = false;
        resolve();
      };
      utter.onerror = () => {
        speaking = false;
        resolve();
      };
      speaking = true;
      window.speechSynthesis.speak(utter);
    });
  }

  function stopVoice() {
    try {
      recognition?.stop();
    } catch { /* ignore */ }
    window.speechSynthesis?.cancel();
    speaking = false;
    setVoiceState('idle');
  }

  async function revealText(el, text, { msPerChar = 10, instant = false } = {}) {
    if (instant) {
      el.innerHTML = formatAnswerHtml(text);
      return;
    }
    const target = formatAnswerHtml(text);
    el.innerHTML = '';
    let i = 0;
    const plain = text;
    return new Promise((resolve) => {
      const tick = () => {
        i += 1;
        el.innerHTML = formatAnswerHtml(plain.slice(0, i));
        log.scrollTop = log.scrollHeight;
        if (i < plain.length) window.setTimeout(tick, msPerChar);
        else {
          el.innerHTML = target;
          resolve();
        }
      };
      if (!plain.length) resolve();
      else tick();
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

  async function ask(message, { voice = false } = {}) {
    const text = String(message || '').trim();
    if (!text || busy) return null;

    busy = true;
    send.disabled = true;
    suggestions.innerHTML = '';
    clearChips();

    if (voice) {
      setVoiceState('thinking');
      voiceStatus.textContent = 'Searching docs…';
    }

    addUserBubble(text);
    const { bubble: botBubble } = addBotRow();

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

      const instant = voice || errored;
      const speed = answer.length > 180 ? 6 : 10;
      await revealText(botBubble, answer, { msPerChar: instant ? 0 : speed, instant });
      setChips(followups);
      log.scrollTop = log.scrollHeight;

      if (voice) {
        setVoiceState('speaking');
        voiceStatus.textContent = 'Mesh is speaking…';
        await speak(answer);
        setVoiceState('idle');
        voiceStatus.textContent = 'Tap the mic for another question';
      }

      return answer;
    } catch {
      botBubble.innerHTML = formatAnswerHtml('Network error. Check /docs or /quickstart.');
      if (voice) {
        setVoiceState('idle');
        voiceStatus.textContent = 'Connection error — try again';
      }
      return null;
    } finally {
      busy = false;
      send.disabled = false;
      if (root.dataset.mode === 'chat') input.focus();
    }
  }

  function initRecognition() {
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    const lang = document.documentElement.lang || 'en';
    rec.lang = lang.startsWith('de') ? 'de-DE' : 'en-US';
    rec.onstart = () => {
      setVoiceState('listening');
      voiceStatus.textContent = 'Listening…';
    };
    rec.onerror = (e) => {
      setVoiceState('idle');
      if (e.error === 'not-allowed') {
        voiceStatus.textContent = 'Microphone access denied';
      } else if (e.error !== 'aborted') {
        voiceStatus.textContent = 'Could not hear you — tap mic again';
      }
    };
    rec.onend = () => {
      if (root.dataset.voiceState === 'listening') {
        setVoiceState('idle');
        voiceStatus.textContent = 'Tap the mic and ask anything';
      }
    };
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) ask(transcript, { voice: true });
    };
    return rec;
  }

  function startListening() {
    if (!voiceSupported) {
      voiceStatus.textContent = 'Voice needs Chrome or Safari';
      return;
    }
    if (busy || speaking) return;
    if (!recognition) recognition = initRecognition();
    if (!recognition) return;
    try {
      recognition.start();
    } catch {
      voiceStatus.textContent = 'Tap mic again';
    }
  }

  toggle.addEventListener('click', () => {
    const open = root.dataset.open !== 'true';
    setOpen(open);
    if (open && !log.childElementCount) {
      addBotBubble('Short answers about install, CLI, MCP, and models.');
      renderSuggestions();
    }
  });

  closeBtn.addEventListener('click', () => setOpen(false));

  talkBtn.addEventListener('click', () => {
    if (!voiceSupported) {
      addBotBubble('Talk to Mesh needs a browser with speech recognition (Chrome or Safari). You can keep using text chat.');
      return;
    }
    setMode('voice');
    voiceStatus.textContent = 'Tap the mic and ask anything';
  });

  voiceBack.addEventListener('click', () => {
    stopVoice();
    setMode('chat');
    input.focus();
  });

  voiceMic.addEventListener('click', startListening);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = input.value.trim();
    input.value = '';
    ask(message);
  });
})();
