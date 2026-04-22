/* ============================================================================
   Engine page — scroll animation
   3 phases: Graph (0-0.35) -> Capsules (0.32-0.70) -> Source (0.66-1.0)
   ============================================================================ */

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Hero word cycle ---------- */
const wordCycle = document.querySelector('.word-cycle');
const cycleWords = ['capsule graph', 'compressed files', 'full source'];
let cycleIndex = 0;
if (wordCycle && !prefersReducedMotion) {
  setInterval(() => {
    cycleIndex = (cycleIndex + 1) % cycleWords.length;
    wordCycle.textContent = cycleWords[cycleIndex];
  }, 2000);
}

/* ---------- Graph data ---------- *
 * Clean 3-column × 4-row layout. ViewBox is 1000 × 720.
 * Cols: 180 (INGEST) / 500 (COMPRESS) / 820 (SERVE)
 * Rows: 100 / 230 / 380 / 610 — capsule sits on row 380 (core)
 */
const COLS = { ingest: 180, compress: 500, serve: 820 };
const mapNodes = [
  { id: 'watcher', label: 'file watcher', meta: 'chokidar events', x: COLS.ingest, y: 100, w: 168, h: 52, lane: 'ingest' },
  { id: 'ast', label: 'AST parse', meta: 'tree-sitter', x: COLS.compress, y: 100, w: 168, h: 52, lane: 'compress' },
  { id: 'vector', label: 'vector index', meta: 'embeddings', x: COLS.serve, y: 100, w: 168, h: 52, lane: 'serve' },
  { id: 'ingest', label: 'repo ingest', meta: 'parse + index', x: COLS.ingest, y: 230, w: 168, h: 52, lane: 'ingest' },
  { id: 'symbols', label: 'symbol graph', meta: 'calls + refs', x: COLS.compress, y: 230, w: 168, h: 52, lane: 'compress' },
  { id: 'deps', label: 'dep matrix', meta: 'edges weighted', x: COLS.serve, y: 230, w: 168, h: 52, lane: 'serve' },
  { id: 'capsule', label: 'MESH CAPSULE', meta: 'compressed context', x: COLS.compress, y: 380, w: 256, h: 80, lane: 'compress', core: true },
  { id: 'cache', label: 'layer cache', meta: 'redis / memory', x: COLS.compress, y: 485, w: 168, h: 44, lane: 'compress' },
  { id: 'ide', label: 'IDE surface', meta: 'editor + review', x: COLS.ingest, y: 610, w: 168, h: 52, lane: 'ingest' },
  { id: 'mcp', label: 'MCP surface', meta: 'tool transport', x: COLS.compress, y: 610, w: 168, h: 52, lane: 'compress' },
  { id: 'api', label: 'API surface', meta: 'app endpoints', x: COLS.serve, y: 610, w: 168, h: 52, lane: 'serve' }
];

const mapEdges = [
  // inputs to mid
  { a: 'watcher', b: 'ingest' },
  { a: 'watcher', b: 'ast' },
  { a: 'ast', b: 'symbols' },
  { a: 'ast', b: 'deps' },
  { a: 'vector', b: 'deps' },
  // mid → capsule (converging)
  { a: 'ingest', b: 'capsule', hub: true },
  { a: 'symbols', b: 'capsule', hub: true },
  { a: 'deps', b: 'capsule', hub: true },
  // cache sidecar
  { a: 'cache', b: 'capsule' },
  // capsule → surfaces (outputs)
  { a: 'capsule', b: 'ide', hub: true, out: true },
  { a: 'capsule', b: 'mcp', hub: true, out: true },
  { a: 'capsule', b: 'api', hub: true, out: true }
];

/* ---------- File data for phases 2 & 3 ---------- */
const files = [
  {
    title: 'src/server.ts',
    type: 'ts',
    role: 'gateway',
    lane: 'ingest',
    deps: 3,
    symbols: 47,
    tokensIn: 2104,
    tokensOut: 336,
    ratio: 84,
    code: [
      '<span class="tok-cmt">// src/server.ts — 482 lines total</span>',
      '<span class="tok-key">import</span> express <span class="tok-key">from</span> <span class="tok-str">\'express\'</span>;',
      '<span class="tok-key">import</span> { createMcpRouter } <span class="tok-key">from</span> <span class="tok-str">\'./routes/mcp\'</span>;',
      '<span class="tok-key">import</span> { apiLimiter } <span class="tok-key">from</span> <span class="tok-str">\'./middleware\'</span>;',
      '',
      '<span class="tok-key">const</span> app <span class="tok-op">=</span> <span class="tok-fn">express</span>();',
      'app.<span class="tok-fn">use</span>(express.<span class="tok-fn">json</span>({ limit: <span class="tok-str">\'10mb\'</span> }));',
      'app.<span class="tok-fn">use</span>(<span class="tok-str">\'/mcp\'</span>, <span class="tok-fn">createMcpRouter</span>(ctx));',
      'app.<span class="tok-fn">use</span>(<span class="tok-str">\'/api\'</span>, apiLimiter);',
      '',
      '<span class="tok-key">async function</span> <span class="tok-fn">bootstrap</span>() {',
      '  <span class="tok-key">const</span> cfg <span class="tok-op">=</span> <span class="tok-key">await</span> <span class="tok-fn">loadConfig</span>();',
      '  <span class="tok-key">const</span> ctx <span class="tok-op">=</span> <span class="tok-key">await</span> <span class="tok-fn">createContext</span>(cfg);',
      '  <span class="tok-key">return</span> ctx;',
      '}',
      '',
      'app.<span class="tok-fn">listen</span>(PORT, () <span class="tok-op">=></span> {',
      '  logger.<span class="tok-fn">info</span>(<span class="tok-str">`Gateway online :${PORT}`</span>);',
      '});'
    ]
  },
  {
    title: 'routes/mcp.ts',
    type: 'ts',
    role: 'transport',
    lane: 'compress',
    deps: 4,
    symbols: 22,
    tokensIn: 1380,
    tokensOut: 212,
    ratio: 85,
    code: [
      '<span class="tok-cmt">// routes/mcp.ts — 205 lines total</span>',
      '<span class="tok-key">import</span> { z } <span class="tok-key">from</span> <span class="tok-str">\'zod\'</span>;',
      '<span class="tok-key">import</span> { rpc } <span class="tok-key">from</span> <span class="tok-str">\'../rpc\'</span>;',
      '',
      '<span class="tok-key">const</span> mcpSchema <span class="tok-op">=</span> z.<span class="tok-fn">object</span>({',
      '  jsonrpc: z.<span class="tok-fn">literal</span>(<span class="tok-str">\'2.0\'</span>),',
      '  id: z.<span class="tok-fn">union</span>([z.<span class="tok-fn">string</span>(), z.<span class="tok-fn">number</span>()]),',
      '  method: z.<span class="tok-fn">string</span>(),',
      '  params: z.<span class="tok-fn">unknown</span>().<span class="tok-fn">optional</span>()',
      '});',
      '',
      'router.<span class="tok-fn">post</span>(<span class="tok-str">\'/mcp\'</span>, <span class="tok-key">async</span> (req, res) <span class="tok-op">=></span> {',
      '  <span class="tok-key">const</span> payload <span class="tok-op">=</span> mcpSchema.<span class="tok-fn">parse</span>(req.body);',
      '  <span class="tok-key">const</span> result <span class="tok-op">=</span> <span class="tok-key">await</span> rpc.<span class="tok-fn">handle</span>(payload);',
      '  <span class="tok-key">return</span> res.<span class="tok-fn">json</span>(result);',
      '});'
    ]
  },
  {
    title: 'routes/terminal.ts',
    type: 'ts',
    role: 'realtime',
    lane: 'serve',
    deps: 3,
    symbols: 31,
    tokensIn: 1720,
    tokensOut: 258,
    ratio: 85,
    code: [
      '<span class="tok-cmt">// routes/terminal.ts — 312 lines total</span>',
      '<span class="tok-key">import</span> * <span class="tok-key">as</span> pty <span class="tok-key">from</span> <span class="tok-str">\'node-pty\'</span>;',
      '<span class="tok-key">import</span> { WebSocketServer } <span class="tok-key">from</span> <span class="tok-str">\'ws\'</span>;',
      '',
      '<span class="tok-key">const</span> wss <span class="tok-op">=</span> <span class="tok-key">new</span> <span class="tok-fn">WebSocketServer</span>({ noServer: <span class="tok-key">true</span> });',
      '',
      'server.<span class="tok-fn">on</span>(<span class="tok-str">\'upgrade\'</span>, (req, socket, head) <span class="tok-op">=></span> {',
      '  <span class="tok-key">const</span> session <span class="tok-op">=</span> sessionPool.<span class="tok-fn">get</span>(req);',
      '  <span class="tok-key">if</span> (!session) <span class="tok-key">return</span> socket.<span class="tok-fn">destroy</span>();',
      '',
      '  wss.<span class="tok-fn">handleUpgrade</span>(req, socket, head, (ws) <span class="tok-op">=></span> {',
      '    <span class="tok-key">const</span> proc <span class="tok-op">=</span> pty.<span class="tok-fn">spawn</span>(shell, [], {',
      '      cwd: session.workdir,',
      '      env: process.env',
      '    });',
      '    session.<span class="tok-fn">bind</span>(ws, proc);',
      '  });',
      '});'
    ]
  },
  {
    title: 'core/compression.cjs',
    type: 'cjs',
    role: 'engine',
    lane: 'compress',
    deps: 5,
    symbols: 63,
    tokensIn: 3280,
    tokensOut: 492,
    ratio: 85,
    code: [
      '<span class="tok-cmt">// core/compression.cjs — 742 lines total</span>',
      '<span class="tok-key">const</span> { symbolIndex } <span class="tok-op">=</span> <span class="tok-fn">require</span>(<span class="tok-str">\'./symbols\'</span>);',
      '<span class="tok-key">const</span> { depGraph } <span class="tok-op">=</span> <span class="tok-fn">require</span>(<span class="tok-str">\'./graph\'</span>);',
      '',
      '<span class="tok-key">function</span> <span class="tok-fn">buildCapsule</span>(record, tier) {',
      '  <span class="tok-key">const</span> graph <span class="tok-op">=</span> depGraph.<span class="tok-fn">expand</span>(record.entry);',
      '  <span class="tok-key">const</span> symbols <span class="tok-op">=</span> symbolIndex.<span class="tok-fn">pick</span>(graph, tier);',
      '  <span class="tok-key">const</span> compressed <span class="tok-op">=</span> {',
      '    entry: record.entry,',
      '    symbolMap: <span class="tok-fn">buildSymbolMap</span>(symbols),',
      '    callSites: <span class="tok-fn">buildCallSites</span>(symbols),',
      '    queryIndex: <span class="tok-fn">buildQueryIndex</span>(graph)',
      '  };',
      '  <span class="tok-key">return</span> capsuleBuilder.<span class="tok-fn">render</span>(compressed);',
      '}',
      '',
      'module.exports <span class="tok-op">=</span> { buildCapsule };'
    ]
  }
];

/* ---------- DOM refs ---------- */
const mapGlowGroup = document.getElementById('map-glow');
const mapEdgesGroup = document.getElementById('map-edges');
const mapNodesGroup = document.getElementById('map-nodes');
const compressedStage = document.getElementById('compressed-stage');
const sourceStage = document.getElementById('source-stage');
const mapCore = document.getElementById('map-core');
const stageTitle = document.getElementById('stage-title');
const phaseNum = document.getElementById('phase-num');
const scrubberFill = document.getElementById('scrubber-fill');
const phaseDots = document.querySelectorAll('.phase-dot');

const NS = 'http://www.w3.org/2000/svg';
const nodeById = new Map(mapNodes.map((n) => [n.id, n]));

/* ---------- Render central capsule glow (behind edges) ---------- */
(() => {
  const capsule = nodeById.get('capsule');
  const halo = document.createElementNS(NS, 'ellipse');
  halo.setAttribute('cx', String(capsule.x));
  halo.setAttribute('cy', String(capsule.y));
  halo.setAttribute('rx', String(capsule.w * 1.25));
  halo.setAttribute('ry', String(capsule.h * 1.8));
  halo.setAttribute('class', 'capsule-halo');
  mapGlowGroup.appendChild(halo);
})();

/* ---------- Render edges ---------- */
mapEdges.forEach((edge) => {
  const from = nodeById.get(edge.a);
  const to = nodeById.get(edge.b);
  if (!from || !to) return;

  // attachment points: bottom of `from`, top of `to`
  const x1 = from.x;
  const y1 = from.y + from.h / 2 + 2;
  const x2 = to.x;
  const y2 = to.y - to.h / 2 - 2;

  // curved path: gentle S-curve using cubic Bezier
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cp1x = x1 + dx * 0.08;
  const cp1y = y1 + dy * 0.55;
  const cp2x = x2 - dx * 0.08;
  const cp2y = y2 - dy * 0.55;
  const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  let cls = 'map-edge';
  if (edge.hub) cls += ' is-hub';
  if (edge.out) cls += ' is-out';
  path.setAttribute('class', cls);
  mapEdgesGroup.appendChild(path);
});

/* ---------- Render nodes ---------- */
mapNodes.forEach((node) => {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', `map-node-group${node.core ? ' is-core' : ''}`);

  const rect = document.createElementNS(NS, 'rect');
  rect.setAttribute('x', String(node.x - node.w / 2));
  rect.setAttribute('y', String(node.y - node.h / 2));
  rect.setAttribute('width', String(node.w));
  rect.setAttribute('height', String(node.h));
  rect.setAttribute('rx', node.core ? '14' : '10');
  rect.setAttribute('ry', node.core ? '14' : '10');
  rect.setAttribute('class', `map-node${node.core ? ' is-core' : ''}`);
  g.appendChild(rect);

  // status dot (small circle top-left of each node)
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('cx', String(node.x - node.w / 2 + 10));
  dot.setAttribute('cy', String(node.y - node.h / 2 + 10));
  dot.setAttribute('r', node.core ? '3' : '2.4');
  dot.setAttribute('class', node.core ? 'map-node-dot map-node-dot-core' : 'map-node-dot');
  g.appendChild(dot);

  const label = document.createElementNS(NS, 'text');
  label.setAttribute('x', String(node.x));
  label.setAttribute('y', String(node.y - (node.core ? 4 : 2)));
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('class', `map-node-label${node.core ? ' is-core' : ''}`);
  label.textContent = node.label;
  g.appendChild(label);

  const meta = document.createElementNS(NS, 'text');
  meta.setAttribute('x', String(node.x));
  meta.setAttribute('y', String(node.y + (node.core ? 16 : 14)));
  meta.setAttribute('text-anchor', 'middle');
  meta.setAttribute('class', `map-node-meta${node.core ? ' is-core' : ''}`);
  meta.textContent = node.meta;
  g.appendChild(meta);

  mapNodesGroup.appendChild(g);
});

/* ---------- Build phase 2 & 3 cards ---------- */
const compressedCards = [];
const sourceCards = [];

files.forEach((file, index) => {
  const compressedEl = document.createElement('article');
  compressedEl.className = 'compressed-card';
  compressedEl.setAttribute('data-lane', file.lane);
  compressedEl.innerHTML = `
    <div class="cap-head">
      <p class="cap-filename">${file.title}</p>
      <span class="cap-type">.${file.type}</span>
    </div>
    <div class="cap-meta">${file.role} · ${file.symbols} sym · ${file.deps} deps</div>
    <div class="cap-bar-wrap">
      <div class="cap-bar"><span class="cap-bar-fill" style="--w:${file.ratio}%"></span></div>
      <div class="cap-tokens">
        <span><b>${file.tokensIn.toLocaleString()}</b> → ${file.tokensOut.toLocaleString()} tok</span>
        <span class="cap-ratio">${file.ratio}% ↓</span>
      </div>
    </div>
  `;
  compressedStage.appendChild(compressedEl);

  const sourceEl = document.createElement('article');
  sourceEl.className = 'code-card';
  sourceEl.innerHTML = `
    <div class="code-head">
      <span class="code-title">${file.title}</span>
      <span class="code-role">${file.role}</span>
    </div>
    <pre>${file.code.join('\n')}</pre>
  `;
  sourceStage.appendChild(sourceEl);

  compressedCards.push({ el: compressedEl, index, tx: 0, ty: 0 });
  sourceCards.push({ el: sourceEl, index, tx: 0, ty: 0 });
});

/* ---------- Reveal observer for non-stage sections ---------- */
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

/* ---------- Scroll scene ---------- */
const scrollSection = document.getElementById('engine-story');

const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Phase boundaries — slight overlap for smooth crossfade */
const P1_END = 0.33;   // graph dominant
const P2_START = 0.30; // capsules start appearing
const P2_END = 0.68;   // capsules dominant
const P3_START = 0.65; // source cards emerge
/* P3 runs to 1.0 */

const phases = [
  { index: 0, num: '01', title: 'Dependency graph' },
  { index: 1, num: '02', title: 'Compressed capsules' },
  { index: 2, num: '03', title: 'Mapped source files' }
];

let lastPhaseIndex = -1;
function updateChrome(progress) {
  let currentPhase;
  if (progress < 0.34) currentPhase = 0;
  else if (progress < 0.68) currentPhase = 1;
  else currentPhase = 2;

  if (currentPhase !== lastPhaseIndex) {
    const p = phases[currentPhase];
    if (phaseNum) phaseNum.textContent = p.num;
    if (stageTitle) stageTitle.textContent = p.title;
    phaseDots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === currentPhase);
    });
    lastPhaseIndex = currentPhase;
  }

  if (scrubberFill) {
    scrubberFill.style.width = `${(progress * 100).toFixed(2)}%`;
  }
}

function computeTargets() {
  const compRect = compressedStage.getBoundingClientRect();
  const srcRect = sourceStage.getBoundingClientRect();
  const isNarrow = window.innerWidth < 980;

  // Phase 2: 4x1 grid (desktop), 2x2 (narrow) — clean, no scatter
  const capCols = isNarrow ? 2 : 4;
  const capRows = Math.ceil(compressedCards.length / capCols);
  const capPadX = isNarrow ? 14 : 28;
  const capPadY = isNarrow ? 20 : 38;
  const capCellW = (compRect.width - capPadX * 2) / capCols;
  const capCellH = Math.min((compRect.height - capPadY * 2) / capRows, 170);
  const capStartY = (compRect.height - capCellH * capRows) / 2;

  compressedCards.forEach((item) => {
    const col = item.index % capCols;
    const row = Math.floor(item.index / capCols);
    item.tx = capPadX + capCellW * (col + 0.5);
    item.ty = capStartY + capCellH * (row + 0.5);
  });

  // Phase 3: 4x1 grid desktop, 2x2 narrow — taller cards
  const srcCols = isNarrow ? 2 : 4;
  const srcRows = Math.ceil(sourceCards.length / srcCols);
  const srcPadX = isNarrow ? 10 : 22;
  const srcPadY = isNarrow ? 14 : 24;
  const srcCellW = (srcRect.width - srcPadX * 2) / srcCols;
  const srcCellH = (srcRect.height - srcPadY * 2) / srcRows;

  sourceCards.forEach((item) => {
    const col = item.index % srcCols;
    const row = Math.floor(item.index / srcCols);
    item.tx = srcPadX + srcCellW * (col + 0.5);
    item.ty = srcPadY + srcCellH * (row + 0.5);
  });
}

function renderScene(progress) {
  document.documentElement.style.setProperty('--scroll', progress.toFixed(4));
  updateChrome(progress);

  /* ----- Phase 1: graph ----- */
  // visible 0 → 1 → 0 around P1
  const graphIn = clamp01(progress / 0.08);                       // entry fade-in
  const graphOut = clamp01((progress - P1_END) / 0.10);           // exit fade-out
  const graphOpacity = graphIn * (1 - graphOut);
  const graphScale = lerp(1.0, 0.92, easeInOutCubic(graphOut));
  const graphLift = lerp(0, -28, easeInOutCubic(graphOut));
  mapCore.style.opacity = graphOpacity.toFixed(3);
  mapCore.style.transform = `translateY(${graphLift.toFixed(1)}px) scale(${graphScale.toFixed(3)})`;

  /* ----- Phase 2: compressed capsules ----- */
  const compRect = compressedStage.getBoundingClientRect();
  const centerX = compRect.width / 2;
  const centerY = compRect.height / 2;

  const capInRaw = clamp01((progress - P2_START) / (P2_END - P2_START - 0.18));
  const capIn = easeOutCubic(capInRaw);
  const capOut = clamp01((progress - P3_START) / (1 - P3_START));
  const capStageOpacity = clamp01(capIn) * (1 - easeInOutCubic(capOut) * 0.95);
  compressedStage.style.opacity = capStageOpacity.toFixed(3);

  compressedCards.forEach((item) => {
    // staggered entry: each card delayed by index * 0.06
    const stagger = item.index * 0.06;
    const localT = clamp01((capInRaw - stagger) / (1 - stagger));
    const eased = easeOutCubic(localT);

    const x = lerp(centerX, item.tx, eased);
    const y = lerp(centerY, item.ty, eased);
    const scale = lerp(0.4, 1, eased);
    const tilt = lerp(item.index % 2 === 0 ? -6 : 6, 0, eased);
    const cardOpacity = eased * (1 - easeInOutCubic(capOut));

    item.el.style.left = `${x.toFixed(1)}px`;
    item.el.style.top = `${y.toFixed(1)}px`;
    item.el.style.opacity = cardOpacity.toFixed(3);
    item.el.style.transform = `translate(-50%, -50%) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
  });

  /* ----- Phase 3: source code cards ----- */
  const srcInRaw = clamp01((progress - P3_START) / (1 - P3_START));
  const srcStageOpacity = clamp01(srcInRaw * 1.4);
  sourceStage.style.opacity = srcStageOpacity.toFixed(3);

  sourceCards.forEach((item) => {
    const from = compressedCards[item.index];
    const sx = from ? from.tx : centerX;
    const sy = from ? from.ty : centerY;

    const stagger = item.index * 0.05;
    const localT = clamp01((srcInRaw - stagger) / (1 - stagger));
    const eased = easeOutCubic(localT);

    const x = lerp(sx, item.tx, eased);
    const y = lerp(sy, item.ty, eased);
    const scale = lerp(0.85, 1, eased);
    const cardOpacity = eased;

    item.el.style.left = `${x.toFixed(1)}px`;
    item.el.style.top = `${y.toFixed(1)}px`;
    item.el.style.opacity = cardOpacity.toFixed(3);
    item.el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
  });
}

/* ---------- Scroll listener ---------- */
let ticking = false;
function updateByScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const sectionRect = scrollSection.getBoundingClientRect();
    const sectionTop = sectionRect.top + window.scrollY;
    const scrollRange = Math.max(scrollSection.offsetHeight - window.innerHeight, 1);
    const local = clamp01((window.scrollY - sectionTop) / scrollRange);
    renderScene(prefersReducedMotion ? 1 : local);
    ticking = false;
  });
}

if (prefersReducedMotion) {
  computeTargets();
  renderScene(1);
} else {
  window.addEventListener('scroll', updateByScroll, { passive: true });
  window.addEventListener('resize', () => {
    computeTargets();
    updateByScroll();
  });
  computeTargets();
  updateByScroll();
}

/* ---------- Waitlist form ---------- */
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

/* ---------- Cursor follower ---------- */
if (!prefersReducedMotion) {
  const dot = document.querySelector('.cursor-dot');
  const beam = document.querySelector('.cursor-beam');
  if (dot && beam) {
    let x = window.innerWidth / 2;
    let bx = x;

    const show = () => { dot.style.opacity = '1'; beam.style.opacity = '0.25'; };
    const hide = () => { dot.style.opacity = '0'; beam.style.opacity = '0'; };

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
