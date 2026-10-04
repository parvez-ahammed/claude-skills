// Video-maker page library. Load after build/timeline.js:
//   <script src="build/timeline.js"></script><script src="/engine/lib/stage.js"></script>
// Every visual must be a pure function of time t: the renderer calls seek(t) for each frame in any order,
// across several browsers at once. CSS animations, transitions, setTimeout and Math.random() break that rule.
(() => {
  const TL = window.TIMELINE;
  if (!TL) throw new Error("window.TIMELINE is missing: run plan.mjs, and load build/timeline.js before stage.js");
  const [W, H] = TL.size;
  const U = Math.min(W, H) / 1080;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/engine/lib/stage.css";
  document.head.prepend(link);
  let stage = document.getElementById("stage");
  if (!stage) { stage = document.createElement("div"); stage.id = "stage"; document.body.prepend(stage); }
  Object.assign(document.documentElement.style, { width: W + "px", height: H + "px" });
  Object.assign(stage.style, { width: W + "px", height: H + "px" });
  document.documentElement.style.setProperty("--u", U + "px");

  // ---------- maths ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, x) => a + (b - a) * x;
  const ease = {
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    inOut: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    back: x => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  // Repeatable pseudo-random numbers: rand(seed) always gives the same value for the same seed.
  const rand = seed => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };

  // ---------- timing (all seconds, absolute) ----------
  const need = (o, what) => { if (!o) throw new Error(`Unknown ${what}`); return o; };
  const S = (id, off = 0) => need(TL.scenes[id], `scene "${id}"`).start + off;
  const E = (id, off = 0) => need(TL.scenes[id], `scene "${id}"`).end + off;
  const L = (id, off = 0) => need(TL.lines[id], `line "${id}"`).at + off;
  const LE = (id, off = 0) => need(TL.lines[id], `line "${id}"`).end + off;
  // Estimated time a word is spoken: Wd("features", "prices") or Wd("features", "and#2").
  const Wd = (id, word, off = 0) => {
    const [w, nth] = word.split("#");
    const hits = need(TL.lines[id], `line "${id}"`).words.filter(([x]) => x.toLowerCase().startsWith(w.toLowerCase()));
    return need(hits[(+nth || 1) - 1], `word "${word}" in line "${id}"`)[1] + off;
  };

  // ---------- DOM ----------
  const el = (tag, cls, parent = stage, html = "") => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    e.innerHTML = html;
    parent.appendChild(e);
    return e;
  };
  // at() sets position:absolute too, so a missing class cannot leave an element stuck at the top-left.
  const at = (e, x, y) => { e.style.position = "absolute"; e.style.left = x + "px"; e.style.top = y + "px"; return e; };
  const place = (e, { x = 0, y = 0, s = 1, r = 0, o = 1 } = {}) => {
    e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
    e.style.opacity = o;
    e.style.visibility = o <= 0.001 ? "hidden" : "visible";
  };
  const pop = (e, t, t0, extra = {}) => { const p = ease.back(prog(t, t0, t0 + .45)); place(e, { s: lerp(.6, 1, p), o: clamp(prog(t, t0, t0 + .2)), ...extra }); };
  const rise = (e, t, t0, dy = 30 * U) => { const p = ease.out(prog(t, t0, t0 + .5)); place(e, { y: (1 - p) * dy, o: p }); };
  const slide = (e, t, t0, dx = -30 * U) => { const p = ease.out(prog(t, t0, t0 + .45)); place(e, { x: (1 - p) * dx, o: p }); };
  const typed = (text, t, a, b) => text.slice(0, Math.round(text.length * prog(t, a, b)));
  const countUp = (t, a, b, to, from = 0) => Math.round(lerp(from, to, ease.out(prog(t, a, b))));

  // ---------- frame loop ----------
  const updaters = [];
  const onFrame = fn => updaters.push(fn);

  // A scene is a full-frame layer shown between its planned start and end, with short fades.
  const sceneOrder = TL.sceneOrder;
  const scene = (id, { fadeIn = true, fadeOut = id !== sceneOrder.at(-1), fade = .35 } = {}) => {
    const root = el("div", "vm-scene");
    const [a, b] = [S(id), E(id)];
    const s = {
      id, root, start: a, end: b,
      visible(t) {
        const o = (fadeIn && a > 0 ? prog(t, a, a + fade) : 1) * (fadeOut ? 1 - prog(t, b - fade, b) : 1);
        const on = t >= a - .01 && t <= b + .01 && o > 0;
        root.style.opacity = o;
        root.style.visibility = on ? "visible" : "hidden";
        return on;
      },
    };
    return s;
  };

  // headline(parent, y, [[["Every", t], ["tool", t2, true]], [...second line]]) - words rise in one by one.
  const headline = (parent, y, lines, { size } = {}) => {
    const root = el("div", "vm-headline", parent);
    root.style.top = y + "px";
    if (size) root.style.fontSize = size * U + "px";
    const words = [];
    for (const line of lines) {
      const lineEl = el("div", "", root);
      for (const [text, t, hl] of line) words.push({ e: el("span", "vm-word" + (hl ? " vm-hl" : ""), lineEl, text), t });
    }
    return {
      root,
      update(t, fade = 1) { for (const w of words) { const p = ease.out(prog(t, w.t, w.t + .4)); place(w.e, { y: (1 - p) * 34 * U, o: p * fade }); } },
    };
  };
  // Same, but word times come from a spoken line: sayLine(parent, y, "hook", { breakAfter: ["tool"], highlight: ["email"] })
  const sayLine = (parent, y, lineId, { text, breakAfter = [], highlight = [], lead = .1, size } = {}) => {
    const spoken = TL.lines[lineId].words;
    const shown = (text ?? TL.lines[lineId].text).split(/\s+/);
    const lines = [[]];
    shown.forEach((w, i) => {
      const bare = w.replace(/[^\p{L}\p{N}'-]/gu, "").toLowerCase();
      const hit = spoken.find(([x]) => x.toLowerCase() === bare) ?? spoken[Math.min(i, spoken.length - 1)];
      lines.at(-1).push([w, hit[1] - lead, highlight.some(h => bare.startsWith(h.toLowerCase()))]);
      if (breakAfter.some(b => bare === b.toLowerCase())) lines.push([]);
    });
    return headline(parent, y, lines.filter(l => l.length), { size });
  };

  const CHECK = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
  // column(parent, { x, y, width, eyebrow, title, t0, bullets: [["text", time], ...] }) - the left-hand explainer text.
  const column = (parent, { x = 130 * U, y = 250 * U, width = 700 * U, eyebrow, title, t0, bullets = [] }) => {
    const col = at(el("div", "vm-col", parent), x, y);
    col.style.width = width + "px";
    const eb = eyebrow ? el("div", "vm-eyebrow", col, eyebrow) : null;
    const ti = title ? el("div", "vm-title", col, title) : null;
    const bs = bullets.map(([text, t]) => ({ e: el("div", "vm-bullet", col, CHECK + `<span>${text}</span>`), t }));
    return t => {
      if (eb) rise(eb, t, t0, 20 * U);
      if (ti) rise(ti, t, t0 + .12, 36 * U);
      for (const b of bs) slide(b.e, t, b.t);
    };
  };

  const CURSOR = `<svg class="vm-cursor" viewBox="0 0 17 22"><path d="M1 1v17l4.5-4.2 3 6.7 3-1.4-3-6.6H14z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  // cursor(parent) -> move(t, [[time, x, y], ...], clickAt) : a pointer that glides between points and shows a click ripple.
  const cursor = parent => {
    const c = el("div", "vm-abs", parent, CURSOR);
    const ripple = el("div", "vm-ripple vm-abs", parent);
    return (t, path, clickAt) => {
      let x = path[0][1], y = path[0][2];
      for (let i = 1; i < path.length; i++) {
        const [t1, x1, y1] = path[i], [t0, x0, y0] = path[i - 1];
        if (t >= t0) { const p = ease.inOut(prog(t, t0, t1)); x = lerp(x0, x1, p); y = lerp(y0, y1, p); }
      }
      place(c, { x, y, o: prog(t, path[0][0] - .2, path[0][0]) * (1 - prog(t, path.at(-1)[0] + .6, path.at(-1)[0] + .9)) });
      const pr = clickAt === undefined ? 0 : prog(t, clickAt, clickAt + .5);
      place(ripple, { x, y, s: lerp(.3, 1.6, pr), o: pr > 0 && pr < 1 ? 1 - pr : 0 });
    };
  };

  // Captions for people who watch without sound. Turn off with window.CAPTIONS = false before stage.js runs.
  const captionsEnabled = window.CAPTIONS !== false;
  let capWrap, capText;
  const addCaptions = () => {
    capWrap = el("div", "vm-caption");
    capWrap.style.bottom = Math.round(H * .045) + "px";
    capText = el("span", "", capWrap);
    onFrame(t => {
      const c = TL.captions.find(c => t >= c.start && t < c.end + .35);
      if (!c) return place(capWrap, { o: 0 });
      capText.textContent = c.text;
      place(capWrap, { o: prog(t, c.start, c.start + .15) * (1 - prog(t, c.end + .2, c.end + .35)) });
    });
  };

  const seek = t => {
    if (captionsEnabled && !capWrap) addCaptions();
    for (const f of updaters) f(t);
  };

  window.ready = document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = r; i.onerror = r; }))));

  Object.assign(window, {
    TL, W, H, U, stage, clamp, prog, lerp, ease, rand, S, E, L, LE, Wd, el, at, place, pop, rise, slide, typed, countUp,
    onFrame, scene, headline, sayLine, column, cursor, seek, CHECK_ICON: CHECK,
  });

  // Open index.html?play in a browser (through render.mjs's server or any static server) to watch it live, or ?t=12 for one frame.
  addEventListener("load", () => window.ready.then(() => {
    const q = new URLSearchParams(location.search);
    if (q.has("t")) seek(+q.get("t"));
    else if (q.has("play")) { const t0 = performance.now(); const loop = () => { seek(((performance.now() - t0) / 1000) % TL.duration); requestAnimationFrame(loop); }; loop(); }
    else seek(0);
  }));
})();
