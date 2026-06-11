(() => {
  if (window.__meshQaChatLoaded) return;
  window.__meshQaChatLoaded = true;

  const LS_TOAST = 'mesh-qa-help-toast-dismissed';
  const LS_VOICE_TIP = 'mesh-qa-voice-tip-seen';

  const SUGGESTIONS = [
    'How do I install Mesh CLI?',
    'What is the MCP server?',
    'Which models does Mesh support?',
  ];

  const GREETING =
    "Hi! I'm Mesh — your guide to install, CLI, MCP, and models. What would you like to know?";

  const MESH_ICON = `<svg class="mq-logo" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="9" fill="#08111a"/>
    <path d="M10 10L5 20L10 30" stroke="#00d4e8" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M30 10L35 20L30 30" stroke="#7ceeff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const MIC_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
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
      position: fixed; right: 24px; bottom: 24px; z-index: 99990;
    }
    #mesh-qa-toast {
      display: none; position: absolute; right: 0; bottom: 64px;
      max-width: 220px; padding: 10px 14px; border-radius: 14px 14px 4px 14px;
      border: 1px solid oklch(0.74 0.14 200 / 0.35);
      background: oklch(0.14 0.05 200 / 0.96);
      color: oklch(0.94 0.02 200); font-size: 13px; line-height: 1.45;
      box-shadow: 0 12px 40px oklch(0 0 0 / 0.4);
      cursor: pointer; animation: mq-toast-in 0.35s ease;
    }
    #mesh-qa-toast[data-show="true"] { display: block; }
    #mesh-qa-toast::after {
      content: ''; position: absolute; right: 18px; bottom: -6px;
      width: 12px; height: 12px; background: inherit;
      border-right: 1px solid oklch(0.74 0.14 200 / 0.35);
      border-bottom: 1px solid oklch(0.74 0.14 200 / 0.35);
      transform: rotate(45deg);
    }
    @keyframes mq-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    #mesh-qa-toggle {
      width: 52px; height: 52px; padding: 0; border-radius: 14px;
      border: 1px solid oklch(0.74 0.14 200 / 0.35);
      background: linear-gradient(145deg, oklch(0.14 0.05 200), oklch(0.1 0.04 200));
      cursor: pointer; box-shadow: 0 16px 48px oklch(0 0 0 / 0.45);
      display: grid; place-items: center;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    #mesh-qa-toggle .mq-logo { width: 28px; height: 28px; }
    #mesh-qa-toggle:hover { transform: translateY(-2px); border-color: var(--mq-cyan); }
    #mesh-qa-root[data-open="true"] #mesh-qa-toggle { display: none; }
    #mesh-qa-panel {
      display: none; width: min(400px, calc(100vw - 32px));
      height: min(540px, calc(100vh - 108px)); border-radius: 18px;
      border: 1px solid oklch(1 0 0 / 0.08);
      background: linear-gradient(165deg, oklch(0.12 0.045 200 / 0.98), oklch(0.09 0.04 200 / 0.98));
      backdrop-filter: blur(20px); box-shadow: 0 28px 80px oklch(0 0 0 / 0.55);
      overflow: hidden; flex-direction: column; position: relative;
    }
    #mesh-qa-root[data-open="true"] #mesh-qa-panel { display: flex; }
    #mesh-qa-voice-tip {
      display: none; position: absolute; left: 18px; right: 18px; bottom: 78px;
      padding: 10px 36px 10px 12px; border-radius: 12px;
      border: 1px solid oklch(0.74 0.14 200 / 0.35);
      background: oklch(0.1 0.05 200 / 0.98);
      color: oklch(0.92 0.02 200); font-size: 13px; line-height: 1.45;
      box-shadow: 0 8px 28px oklch(0 0 0 / 0.35); z-index: 2;
    }
    #mesh-qa-voice-tip[data-show="true"] { display: block; animation: mq-toast-in 0.3s ease; }
    #mesh-qa-voice-tip strong { color: var(--mq-cyan); font-weight: 600; }
    #mesh-qa-voice-tip-close {
      position: absolute; top: 6px; right: 8px; width: 24px; height: 24px;
      border: none; background: transparent; color: oklch(0.7 0.02 200);
      cursor: pointer; font-size: 16px; line-height: 1;
    }
    #mesh-qa-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 14px 16px 18px; border-bottom: 1px solid oklch(1 0 0 / 0.06);
    }
    .mq-head-brand { display: flex; align-items: center; gap: 12px; }
    .mq-head-brand .mq-logo { width: 36px; height: 36px; flex-shrink: 0; }
    .mq-head-brand strong {
      font-family: var(--mq-display); font-size: 24px; font-weight: 800;
      letter-spacing: 0.06em; text-transform: uppercase; color: oklch(0.99 0.004 195);
    }
    #mesh-qa-close {
      width: 34px; height: 34px; border-radius: 10px;
      border: 1px solid oklch(1 0 0 / 0.08); background: oklch(1 0 0 / 0.04);
      color: oklch(0.78 0.02 200); cursor: pointer; font-size: 20px; line-height: 1;
    }
    #mesh-qa-close:hover { color: var(--mq-cyan); border-color: oklch(0.74 0.14 200 / 0.35); }
    #mesh-qa-log {
      flex: 1; overflow-y: auto; padding: 16px 18px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .mq-row.user { display: flex; justify-content: flex-end; }
    .mq-row.bot { display: flex; justify-content: flex-start; }
    .mq-bubble {
      max-width: 92%; padding: 11px 14px; border-radius: 14px;
      font-size: 14px; line-height: 1.55; word-break: break-word;
    }
    .mq-bubble.user {
      background: oklch(0.74 0.14 200 / 0.12); color: oklch(0.96 0.02 200);
      border: 1px solid oklch(0.74 0.14 200 / 0.22);
    }
    .mq-bubble.bot {
      background: oklch(1 0 0 / 0.04); color: oklch(0.94 0.01 200);
      border: 1px solid oklch(1 0 0 / 0.07);
    }
    .mq-bubble.bot code {
      font-family: var(--mq-mono); font-size: 12px; color: var(--mq-cyan);
      background: oklch(0 0 0 / 0.28); padding: 1px 6px; border-radius: 6px;
    }
    .mq-bubble.live { font-style: italic; color: var(--mq-muted); border-style: dashed; }
    .mq-thinking { display: inline-flex; align-items: center; gap: 6px; color: var(--mq-muted); font-size: 13px; }
    .mq-thinking-dots { display: inline-flex; gap: 4px; }
    .mq-thinking-dots i {
      width: 5px; height: 5px; border-radius: 50%; background: var(--mq-cyan);
      animation: mq-pulse 1.2s ease-in-out infinite;
    }
    .mq-thinking-dots i:nth-child(2) { animation-delay: 0.15s; }
    .mq-thinking-dots i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes mq-pulse { 0%,80%,100%{opacity:.25} 40%{opacity:1} }
    .mq-chips { display: flex; flex-wrap: wrap; gap: 8px; padding-left: 2px; }
    .mq-chips-label {
      width: 100%; font-family: var(--mq-mono); font-size: 10px;
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--mq-muted);
    }
    .mq-chips button {
      font-size: 12px; border-radius: 999px;
      border: 1px solid oklch(0.74 0.14 200 / 0.28);
      background: oklch(0.74 0.14 200 / 0.06); color: oklch(0.9 0.03 200);
      padding: 7px 12px; cursor: pointer;
    }
    .mq-chips button:hover:not(:disabled) { border-color: var(--mq-cyan); color: var(--mq-cyan); }
    #mesh-qa-suggestions { padding: 0 18px 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    #mesh-qa-suggestions button {
      font-size: 12px; border-radius: 999px; border: 1px solid oklch(1 0 0 / 0.1);
      background: oklch(1 0 0 / 0.03); color: oklch(0.78 0.02 200); padding: 6px 11px; cursor: pointer;
    }
    #mesh-qa-voice-hint {
      display: none; padding: 0 18px 8px;
      font-family: var(--mq-mono); font-size: 10px; letter-spacing: 0.05em;
      text-transform: uppercase; color: var(--mq-cyan);
    }
    #mesh-qa-root[data-voice="on"] #mesh-qa-voice-hint { display: block; }
    #mesh-qa-form {
      display: flex; gap: 8px; align-items: center;
      padding: 14px 18px 16px; border-top: 1px solid oklch(1 0 0 / 0.06);
      background: oklch(0 0 0 / 0.15);
    }
    #mesh-qa-mic {
      width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px;
      border: 1px solid oklch(0.74 0.14 200 / 0.28);
      background: oklch(0.74 0.14 200 / 0.06); color: var(--mq-cyan);
      cursor: pointer; display: grid; place-items: center;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    #mesh-qa-mic:hover { background: oklch(0.74 0.14 200 / 0.14); }
    #mesh-qa-mic:disabled { opacity: 0.45; cursor: wait; }
    #mesh-qa-root[data-voice="on"] #mesh-qa-mic {
      background: oklch(0.74 0.14 200 / 0.2); border-color: oklch(0.74 0.14 200 / 0.55);
      color: var(--mq-cyan); box-shadow: 0 0 0 3px oklch(0.74 0.14 200 / 0.15);
      animation: mq-mic-pulse 1.6s ease-in-out infinite;
    }
    @keyframes mq-mic-pulse { 0%,100%{box-shadow:0 0 0 3px oklch(0.74 0.14 200 / 0.12)} 50%{box-shadow:0 0 0 8px oklch(0.74 0.14 200 / 0)} }
    #mesh-qa-input {
      flex: 1; border-radius: 12px; border: 1px solid oklch(1 0 0 / 0.1);
      background: oklch(0 0 0 / 0.35); color: oklch(0.98 0.01 200);
      padding: 11px 13px; font-size: 14px; outline: none;
    }
    #mesh-qa-input:focus { border-color: oklch(0.74 0.14 200 / 0.45); }
    #mesh-qa-send {
      border-radius: 12px; border: none; background: var(--mq-cyan);
      color: oklch(0.12 0.04 200); padding: 0 16px; height: 42px;
      cursor: pointer; font-family: var(--mq-mono); font-size: 12px;
    }
    #mesh-qa-send:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 480px) { #mesh-qa-root { right: 14px; bottom: 14px; } }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'mesh-qa-root';
  root.dataset.voice = 'off';
  root.innerHTML = `
    <div id="mesh-qa-toast" role="status">Need help? Ask me anything.</div>
    <div id="mesh-qa-panel" role="dialog" aria-label="Mesh assistant">
      <div id="mesh-qa-head">
        <div class="mq-head-brand">${MESH_ICON}<strong>Ask Mesh</strong></div>
        <button id="mesh-qa-close" type="button" aria-label="Close">×</button>
      </div>
      <div id="mesh-qa-log"></div>
      <div id="mesh-qa-suggestions"></div>
      <div id="mesh-qa-voice-hint"></div>
      <div id="mesh-qa-voice-tip" role="note">
        <button id="mesh-qa-voice-tip-close" type="button" aria-label="Dismiss">×</button>
        You can also <strong>talk to Mesh</strong> — tap the mic and speak.
      </div>
      <form id="mesh-qa-form">
        <button id="mesh-qa-mic" type="button" aria-label="Talk to Mesh" title="Talk to Mesh">${MIC_ICON}</button>
        <input id="mesh-qa-input" type="text" placeholder="Ask anything…" maxlength="500" autocomplete="off" />
        <button id="mesh-qa-send" type="submit">Send</button>
      </form>
    </div>
    <button id="mesh-qa-toggle" type="button" aria-expanded="false" title="Ask Mesh">${MESH_ICON}</button>
  `;
  document.body.appendChild(root);

  const toggle = root.querySelector('#mesh-qa-toggle');
  const toast = root.querySelector('#mesh-qa-toast');
  const closeBtn = root.querySelector('#mesh-qa-close');
  const log = root.querySelector('#mesh-qa-log');
  const form = root.querySelector('#mesh-qa-form');
  const input = root.querySelector('#mesh-qa-input');
  const send = root.querySelector('#mesh-qa-send');
  const micBtn = root.querySelector('#mesh-qa-mic');
  const suggestions = root.querySelector('#mesh-qa-suggestions');
  const voiceHint = root.querySelector('#mesh-qa-voice-hint');
  const voiceTip = root.querySelector('#mesh-qa-voice-tip');
  const voiceTipClose = root.querySelector('#mesh-qa-voice-tip-close');

  let busy = false;
  let activeChips = null;
  let voice = null;
  let voiceLiveEl = null;
  let voiceUserEl = null;
  let voiceBotEl = null;
  let voiceConnecting = false;

  function escapeHtml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function formatHtml(t) {
    return escapeHtml(t).replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function dismissToast() {
    toast.dataset.show = 'false';
    try { localStorage.setItem(LS_TOAST, '1'); } catch { /* ignore */ }
  }

  function dismissVoiceTip() {
    voiceTip.dataset.show = 'false';
    try { localStorage.setItem(LS_VOICE_TIP, '1'); } catch { /* ignore */ }
  }

  function maybeShowVoiceTip() {
    try {
      if (localStorage.getItem(LS_VOICE_TIP)) return;
    } catch { /* ignore */ }
    voiceTip.dataset.show = 'true';
  }

  function setOpen(open) {
    root.dataset.open = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      dismissToast();
      input.focus();
      if (!log.childElementCount) {
        appendBubble(GREETING, 'bot');
        renderSuggestions();
        maybeShowVoiceTip();
      }
    } else {
      hangUpVoice();
      voiceTip.dataset.show = 'false';
    }
  }

  function setVoiceOn(on) {
    root.dataset.voice = on ? 'on' : 'off';
    micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    voiceHint.textContent = on ? '● Live voice — tap mic to stop' : '';
  }

  function appendBubble(text, role, { live = false } = {}) {
    const row = document.createElement('div');
    row.className = `mq-row ${role}`;
    const bubble = document.createElement('div');
    bubble.className = `mq-bubble ${role}${live ? ' live' : ''}`;
    bubble.innerHTML = role === 'bot' ? formatHtml(text) : escapeHtml(text);
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function clearChips() {
    activeChips?.parentNode?.remove();
    activeChips = null;
  }

  function setChips(options) {
    clearChips();
    if (!options?.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'mq-row bot';
    const chips = document.createElement('div');
    chips.className = 'mq-chips';
    chips.innerHTML = '<div class="mq-chips-label">Follow up</div>';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => { if (!busy) ask(opt.query); });
      chips.appendChild(btn);
    }
    wrap.appendChild(chips);
    log.appendChild(wrap);
    activeChips = wrap;
    log.scrollTop = log.scrollHeight;
  }

  async function loadVoiceScript() {
    if (window.MeshVoiceLive) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/assets/mesh-qa-voice-live.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function hangUpVoice() {
    voiceConnecting = false;
    voice?.disconnect();
    voice = null;
    voiceLiveEl = voiceUserEl = voiceBotEl = null;
    setVoiceOn(false);
    micBtn.disabled = false;
    input.disabled = false;
  }

  async function startVoice() {
    if (root.dataset.voice === 'on' || voiceConnecting) {
      if (root.dataset.voice === 'on') hangUpVoice();
      return;
    }
    dismissVoiceTip();
    voiceConnecting = true;
    micBtn.disabled = true;
    voiceHint.textContent = '● Connecting…';
    voiceHint.style.display = 'block';

    try {
      await loadVoiceScript();
      voice = new window.MeshVoiceLive({
        onStatus: (t) => { if (voiceHint) voiceHint.textContent = `● ${t}`; },
        onUserPartial: (t) => {
          if (!voiceUserEl) voiceUserEl = appendBubble(t, 'user', { live: true });
          else voiceUserEl.textContent = t;
        },
        onUserFinal: (t) => {
          if (voiceUserEl) {
            voiceUserEl.textContent = t;
            voiceUserEl.classList.remove('live');
          } else appendBubble(t, 'user');
          voiceUserEl = null;
        },
        onBotPartial: (t) => {
          if (!voiceBotEl) voiceBotEl = appendBubble(t, 'bot', { live: true });
          else voiceBotEl.innerHTML = formatHtml(t);
        },
        onBotFinal: (t) => {
          if (voiceBotEl) {
            voiceBotEl.innerHTML = formatHtml(t);
            voiceBotEl.classList.remove('live');
          } else appendBubble(t, 'bot');
          voiceBotEl = null;
        },
        onDisconnected: () => {
          if (!voiceConnecting) hangUpVoice();
        },
      });
      await voice.connect();
      voiceConnecting = false;
      setVoiceOn(true);
      micBtn.disabled = false;
      input.disabled = true;
      suggestions.innerHTML = '';
      clearChips();
    } catch (e) {
      voiceConnecting = false;
      hangUpVoice();
      if (e?.message === 'VOICE_UNAVAILABLE') {
        appendBubble(
          'Live voice is not available right now. Text chat works — type your question below.',
          'bot',
        );
      } else {
        appendBubble(
          e?.message || 'Could not start voice. Check mic permissions and try again.',
          'bot',
        );
      }
    }
  }

  async function revealText(el, text, instant) {
    if (instant) { el.innerHTML = formatHtml(text); return; }
    let i = 0;
    await new Promise((resolve) => {
      const tick = () => {
        i += 1;
        el.innerHTML = formatHtml(text.slice(0, i));
        log.scrollTop = log.scrollHeight;
        if (i < text.length) setTimeout(tick, text.length > 180 ? 6 : 10);
        else resolve();
      };
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
    try { return { event, data: JSON.parse(dataLines.join('\n')) }; } catch { return null; }
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
        const p = parseSseBlock(part);
        if (p) onEvent(p.event, p.data);
      }
    }
  }

  function renderSuggestions() {
    suggestions.innerHTML = '';
    for (const q of SUGGESTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = q;
      btn.addEventListener('click', () => { if (!busy) ask(q); });
      suggestions.appendChild(btn);
    }
  }

  async function ask(message) {
    const text = String(message || '').trim();
    if (!text || busy) return;
    if (root.dataset.voice === 'on') hangUpVoice();

    busy = true;
    send.disabled = true;
    suggestions.innerHTML = '';
    clearChips();
    appendBubble(text, 'user');

    const botBubble = appendBubble('', 'bot');
    botBubble.innerHTML = `<span class="mq-thinking">Searching docs <span class="mq-thinking-dots"><i></i><i></i><i></i></span></span>`;

    let answer = '';
    let followups = [];
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: text }),
      });
      if (!(res.headers.get('content-type') || '').includes('text/event-stream')) {
        const data = await res.json().catch(() => ({}));
        answer = data.message || 'Something went wrong.';
      } else {
        await consumeSse(res, (event, data) => {
          if (event === 'answer') answer = data.text || answer;
          if (event === 'options') followups = data.items || followups;
          if (event === 'error') answer = data.message || answer;
        });
      }
      if (!answer.trim()) answer = 'No answer found. Try /docs or /quickstart.';
      await revealText(botBubble, answer, false);
      setChips(followups);
    } catch {
      botBubble.innerHTML = formatHtml('Network error. Try /docs.');
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  toggle.addEventListener('click', () => setOpen(root.dataset.open !== 'true'));
  closeBtn.addEventListener('click', () => setOpen(false));
  micBtn.addEventListener('click', startVoice);
  voiceTipClose.addEventListener('click', (e) => { e.stopPropagation(); dismissVoiceTip(); });
  toast.addEventListener('click', () => setOpen(true));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    input.value = '';
    ask(msg);
  });

  try {
    if (!localStorage.getItem(LS_TOAST)) {
      setTimeout(() => {
        if (root.dataset.open !== 'true') toast.dataset.show = 'true';
      }, 10000);
    }
  } catch { /* ignore */ }
})();
