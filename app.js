/* Aura (a working name; the girls will vote on it): a daily five-question quest for three sisters.
 *
 * Two modes, picked by config.js:
 *  - demo (no apiUrl): example history and everything kept in this browser. The preview and a fresh checkout run so.
 *  - live (apiUrl set): the family's Google Sheet is the record, through the Apps Script in backend/Code.gs.
 *
 * The scoring here (stats) must match the Apps Script's (scoreMonth_): the board on the phones and the
 * token the script awards on the 1st are worked out from the same rows by the same rules.
 */
(() => {
"use strict";

const CFG = window.FQ_CONFIG || {};
const LIVE = !!(CFG.apiUrl && String(CFG.apiUrl).trim());
const PREVIEW = !!window.FQ_PREVIEW;

/* ---------- helpers ---------- */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Math inside Hebrew flips without an isolate ("−1" shows as "1−"), so the banks mark left-to-right runs with {...}. */
const fmt = s => esc(s).replace(/\{([^}]*)\}/g, '<bdi dir="ltr">$1</bdi>');
const plain = s => String(s).replace(/[{}]/g, "");
const optDir = s => /[֐-׿]/.test(s) ? "rtl" : "ltr";
const pad2 = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const EPOCH = Date.UTC(2026, 0, 1);
const dayIndex = s => { const [y, m, d] = s.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => dayIndex(b) - dayIndex(a);
const mod = (a, n) => ((a % n) + n) % n;

const NOW = new Date();
const TODAY = ymd(NOW);
const Y = NOW.getFullYear(), M = NOW.getMonth() + 1, D = NOW.getDate();
const monthKey = (y, m) => `${y}-${pad2(m)}`;
const THIS_MONTH = monthKey(Y, M);
const prevMonth = (y, m) => m === 1 ? [y - 1, 12] : [y, m - 1];
const daysIn = (y, m) => new Date(y, m, 0).getDate();
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const APPARATUS = ["Rope", "Hoop", "Ball", "Clubs", "Ribbon"];
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

/* ---------- tracks: which pools each girl's five come from ---------- */
/* Every day: 2 math, 2 English and 1 "other", drawn by weight from the track's other pools. */
const TRACKS = {
  "g10-bio": { grade: "כיתה י׳", math: "g10-math", eng: "g10-eng", other: [["g10-bio", 3], ["g10-hist", 1], ["g10-lit", 1], ["g10-heb", 1]] },
  "g7":      { grade: "כיתה ז׳", math: "g7-math", eng: "g7-eng", other: [["g7-sci", 2], ["g7-heb", 1], ["g7-hist", 1], ["g7-bible", 1], ["g7-geo", 1]] },
  "g7-art":  { grade: "כיתה ז׳", math: "g7-math", eng: "g7-eng", other: [["g7-art", 3], ["g7-sci", 2], ["g7-heb", 1], ["g7-hist", 1], ["g7-bible", 1], ["g7-geo", 1]] }
};
const trackPools = tr => { const t = TRACKS[tr] || TRACKS.g7; return [t.math, t.eng, ...t.other.map(o => o[0])]; };
const SUBJ = {
  math: "מתמטיקה", eng: "אנגלית", sci: "מדע", heb: "לשון", hist: "היסטוריה", bible: "תנ״ך",
  geo: "גאוגרפיה", art: "אמנות", bio: "ביולוגיה", lit: "ספרות"
};
const subjOf = pool => String(pool || "").split("-")[1] || "math";

/* ---------- auras: each girl picks her own colours ---------- */
const AURAS = {
  orchid: { name: "Orchid", c: ["#A855F7", "#EC4899", "#6366F1"] },
  lagoon: { name: "Lagoon", c: ["#14B8A6", "#3B82F6", "#67E8F9"] },
  ember:  { name: "Ember",  c: ["#F97316", "#EF4444", "#FACC15"] },
  cherry: { name: "Cherry", c: ["#F43F5E", "#FB7185", "#9F1239"] },
  matcha: { name: "Matcha", c: ["#84CC16", "#22C55E", "#BEF264"] },
  chrome: { name: "Chrome", c: ["#CBD5E1", "#8B95A8", "#F8FAFC"] }
};

/* ---------- this phone's own memory ---------- */
const KEY = "fq.v2";
const L = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
  s = s && typeof s === "object" ? s : {};
  const def = { me: null, parent: false, code: "", auras: {}, avatars: {}, rows: [], outbox: [], tests: [], progress: {},
                sound: true, haptics: true, seenRecap: "", demoTokens: null, demoSettings: null, cache: null };
  for (const k in def) if (s[k] === undefined) s[k] = def[k];
  return s;
})();
function save() { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) { /* private window: the page still works */ } }

/* ---------- the family: from the Sheet when live, from the example otherwise ---------- */
let FAM = null;
let EXAMPLE = [];
function demoFamily() {
  const base = window.FQ_DEMO || {};
  return {
    profiles: base.profiles || [
      { id: "a", name: "מאיה", track: "g10-bio", pair: "", slot: 0, flavor: "portfolio", aura: "orchid" },
      { id: "b", name: "טל", track: "g7", pair: "twins", slot: 0, flavor: "routine", aura: "cherry" },
      { id: "c", name: "שיר", track: "g7-art", pair: "twins", slot: 1, flavor: "stage", aura: "lagoon" }
    ],
    settings: Object.assign({ goal: 250, goalReward: "ערב פיצה, ואתן בוחרות סרט", prize5: "", prize10: "", tokenValue: 100,
      improvedReward: "פרס קטן מאבא", parentPin: "1234", digestHour: 21 }, base.settings || {}, L.demoSettings || {}),
    tokens: L.demoTokens || Object.assign({ a: 2, b: 1, c: 3 }, base.tokens || {}),
    rows: [], tests: []
  };
}
const profile = id => FAM.profiles.find(p => p.id === id) || null;
const me = () => profile(L.me) || null;
const auraOf = p => (p && (L.auras[p.id] || p.aura)) || "orchid";
function rows() {
  const src = LIVE ? FAM.rows.concat(...L.outbox.map(b => b.rows)) : L.rows.concat(EXAMPLE);
  const seen = new Set(), out = [];
  for (const r of src) { const k = `${r.d}|${r.p}|${r.q}|${r.r ? 1 : 0}`; if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}
const tests = () => LIVE ? (FAM.tests || []) : L.tests;

/* ---------- question banks ---------- */
const BANKS = {}, QIDX = {};
async function loadBanks(pools) {
  await Promise.all(pools.filter(p => !BANKS[p]).map(async p => {
    let items = window.FQ_BANKS && window.FQ_BANKS[p];
    if (!items) {
      try { const r = await fetch(`data/bank/${p}.json`, { cache: "no-cache" }); if (r.ok) items = await r.json(); } catch (e) { items = null; }
    }
    BANKS[p] = Array.isArray(items) ? items : [];
    BANKS[p].forEach(q => { q.pool = p; QIDX[q.id] = q; });
  }));
}

/* ---------- today's five ----------
 * Each pool has one fixed shuffled order. The girls who share a pool (the twins) split it by that order,
 * alternate questions each, so they can never get the same question, this month or any other. Each girl
 * takes, in her own order, the first questions she has not answered yet (in the two months of history the
 * app holds), then the ones she answered longest ago. The pick reads only the days before `date`, so the
 * day's five stay the same all day, on every phone.
 * The first scheme (day n read positions 6n onward, live on 2026-11-11) skipped a third of every pool and
 * wrapped the 15-question pools every 2.5 days: a girl would have met the same history question in 5. */
const PERM = {};
const permOf = pool => PERM[pool] || (PERM[pool] = shuffle(BANKS[pool].map((_, i) => i), rng(hash("order|" + pool))));
function sharers(prof, pool) {
  if (!prof.pair) return [prof];
  return FAM.profiles.filter(p => p.pair === prof.pair && trackPools(p.track).includes(pool))
    .sort((a, b) => (a.slot - b.slot) || (a.id < b.id ? -1 : 1));
}
function shareOf(prof, pool) {
  const bank = BANKS[pool] || [];
  if (!bank.length) return [];
  const grp = sharers(prof, pool), gi = Math.max(0, grp.findIndex(p => p.id === prof.id));
  return permOf(pool).filter((_, k) => k % grp.length === gi).map(i => bank[i]);
}
function take(prof, pool, n, date, src) {
  const mine = shareOf(prof, pool), last = {};
  src.forEach(r => { if (r.p === prof.id && r.pool === pool && r.d < date && !(last[r.q] >= r.d)) last[r.q] = r.d; });
  const fresh = mine.filter(q => !last[q.id]);
  const seen = mine.filter(q => last[q.id]).sort((a, b) => last[a.id] < last[b.id] ? -1 : last[a.id] > last[b.id] ? 1 : 0);
  return fresh.concat(seen).slice(0, n);
}
function otherPool(prof, date) {
  const opts = (TRACKS[prof.track] || TRACKS.g7).other.filter(([p]) => (BANKS[p] || []).length);
  if (!opts.length) return null;
  let x = rng(hash("other|" + prof.id + "|" + date))() * opts.reduce((s, o) => s + o[1], 0);
  for (const [p, w] of opts) { x -= w; if (x < 0) return p; }
  return opts[opts.length - 1][0];
}
function subjectsOf(prof) { return [...new Set(trackPools(prof.track).map(subjOf))]; }
function poolFor(prof, subj) { return trackPools(prof.track).find(p => subjOf(p) === subj) || null; }
function activeTest(prof, date) {
  return tests().filter(t => t.p === prof.id && t.date >= date && daysBetween(date, t.date) <= 3)
    .sort((a, b) => a.date < b.date ? -1 : 1)[0] || null;
}
function dailySet(prof, date, src) {
  src = src || rows();
  const t = TRACKS[prof.track] || TRACKS.g7, other = otherPool(prof, date);
  let slots = [t.math, t.eng, other, t.math, t.eng];
  const test = activeTest(prof, date), tp = test && poolFor(prof, test.subj);
  if (tp === t.math) slots = [t.math, t.eng, t.math, other, t.math];
  else if (tp === t.eng) slots = [t.eng, t.math, t.eng, other, t.eng];
  else if (tp) slots = [t.math, tp, t.eng, tp, tp];
  slots = slots.map((p, i) => p && (BANKS[p] || []).length ? p : (i % 2 ? t.eng : t.math));
  const need = {}, got = {}, used = {};
  slots.forEach(p => { need[p] = (need[p] || 0) + 1; });
  for (const p in need) got[p] = take(prof, p, need[p], date, src);
  return slots.map(p => { used[p] = used[p] || 0; return got[p][used[p]++]; }).filter(Boolean);
}
/* A question she missed 2-21 days ago comes back once, worth double. */
function revengeFor(prof, date, todays) {
  const ids = new Set(todays.map(q => q.id));
  const mine = rows().filter(r => r.p === prof.id);
  const closed = new Set(mine.filter(r => r.r && (r.ok || daysBetween(r.d, date) < 2)).map(r => r.q));
  const c = mine.filter(r => !r.r && !r.ok && QIDX[r.q] && !ids.has(r.q) && !closed.has(r.q))
    .filter(r => { const g = daysBetween(r.d, date); return g >= 2 && g <= 21; })
    .sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.q < b.q ? -1 : 1));
  return c.length ? QIDX[c[0].q] : null;
}

/* ---------- scoring (keep in step with scoreMonth_ in backend/Code.gs) ----------
 * A day counts once its five are done: 10 points, 4 a right answer, 8 a revenge round won,
 * and 15 for every week of the month (Sunday to Saturday) with five such days. */
const POINTS = { day: 10, right: 4, revenge: 8, week: 15, weekDays: 5 };
function stats(pid, y, m) {
  const mk = monthKey(y, m), firstDow = new Date(y, m - 1, 1).getDay();
  const rs = rows().filter(r => r.p === pid && r.d.slice(0, 7) === mk);
  const byDay = {}, bySubj = {}, miss = {};
  rs.forEach(r => {
    const e = byDay[r.d] || (byDay[r.d] = { reg: 0, ok: 0, rev: 0, revOk: 0 });
    if (r.r) { e.rev++; if (r.ok) e.revOk++; } else { e.reg++; if (r.ok) e.ok++; }
    const s = subjOf(r.pool); bySubj[s] = bySubj[s] || [0, 0]; bySubj[s][1]++;
    if (r.ok) bySubj[s][0]++; else miss[r.t] = (miss[r.t] || 0) + 1;
  });
  const days = Object.keys(byDay).sort().filter(d => byDay[d].reg >= 5).map(d => Object.assign({ d }, byDay[d]));
  const weeks = {};
  days.forEach(e => { const w = Math.floor((+e.d.slice(8) - 1 + firstDow) / 7); weeks[w] = (weeks[w] || 0) + 1; });
  const fullWeeks = Object.values(weeks).filter(n => n >= POINTS.weekDays).length;
  const reg = days.reduce((s, e) => s + e.reg, 0), ok = days.reduce((s, e) => s + e.ok, 0), revOk = days.reduce((s, e) => s + e.revOk, 0);
  const elapsed = mk === THIS_MONTH ? D : daysIn(y, m);
  return {
    days, byDay, played: days.length, reg, ok, revOk, fullWeeks, bySubj,
    points: days.length * POINTS.day + ok * POINTS.right + revOk * POINTS.revenge + fullWeeks * POINTS.week,
    part: elapsed ? Math.round(days.length / elapsed * 100) : 0,
    acc: reg ? Math.round(ok / reg * 100) : 0,
    weak: Object.entries(miss).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(x => x[0])
  };
}
function ranking(y, m) {
  return FAM.profiles.map(p => Object.assign({ id: p.id }, stats(p.id, y, m)))
    .sort((a, b) => b.points - a.points || b.acc - a.acc || b.played - a.played || (a.id < b.id ? -1 : 1));
}
/* Equal points, accuracy and days share a place: on 2026-11-11 all three finished 3/5 and the board had
 * put them 1st, 2nd and 3rd by their letters. */
const ahead = (a, b) => a.points !== b.points ? a.points > b.points : a.acc !== b.acc ? a.acc > b.acc : a.played > b.played;
function placeOf(rk, id) { const me = rk.find(r => r.id === id); return me ? 1 + rk.filter(r => ahead(r, me)).length : rk.length; }
function playedOn(pid, date) { return rows().filter(r => r.p === pid && r.d === date && !r.r).length >= 5; }
function improved(y, m) {
  const [py, pm] = prevMonth(y, m);
  let best = null;
  FAM.profiles.forEach(p => {
    const a = stats(p.id, y, m), b = stats(p.id, py, pm);
    if (a.played < 8 || b.played < 8) return;
    const gain = a.acc - b.acc;
    if (gain > 0 && (!best || gain > best.gain)) best = { id: p.id, gain };
  });
  return best;
}

/* ---------- example history for the demo (marked as such on screen) ---------- */
function makeExample() {
  const [py, pm] = prevMonth(Y, M), out = [];
  const EX = { portfolio: [0.8, 0.84], routine: [0.64, 0.8], stage: [0.86, 0.74] };
  FAM.profiles.forEach(prof => {
    const [p, acc] = EX[prof.flavor] || [0.75, 0.8];
    for (let d = ymd(new Date(py, pm - 1, 1)); d < TODAY; d = addDays(d, 1)) {
      const r = rng(hash("example|" + prof.id + "|" + d));
      if (r() > p || L.rows.some(x => x.p === prof.id && x.d === d)) continue;
      dailySet(prof, d, L.rows.concat(out)).forEach(q => out.push({ d, p: prof.id, q: q.id, pool: q.pool, t: q.topic, l: q.level, ok: r() < acc ? 1 : 0, r: 0 }));
    }
  });
  return out;
}

/* ---------- the Sheet (live mode) ---------- */
async function api(action, body) {
  const url = String(CFG.apiUrl).trim();
  let r;
  if (action === "state") r = await fetch(`${url}?action=state&code=${encodeURIComponent(L.code)}`, { redirect: "follow" });
  else r = await fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
                              body: JSON.stringify(Object.assign({ action, code: L.code }, body || {})) });
  if (!r.ok) throw new Error("http " + r.status);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "refused");
  return j;
}
async function refresh() {
  const s = await api("state");
  FAM = { profiles: s.profiles || [], settings: s.settings || {}, tokens: s.tokens || {}, rows: s.rows || [], tests: s.tests || [] };
  L.cache = FAM; save();
}
async function flush() {
  while (L.outbox.length) {
    try { await api("submit", L.outbox[0]); L.outbox.shift(); save(); } catch (e) { return false; }
  }
  return true;
}

/* ---------- sound, touch, sparks ---------- */
let AC = null;
function tone(notes) {
  if (!L.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = AC.currentTime + 0.01;
    notes.forEach(([f, at, dur, vol, type]) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(AC.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    });
  } catch (e) { /* no audio here */ }
}
const SFX = {
  tap: () => tone([[880, 0, 0.05, 0.025]]),
  good: () => tone([[1318.5, 0, 0.18, 0.07], [1975.5, 0.07, 0.3, 0.05]]),
  bad: () => tone([[196, 0, 0.22, 0.05, "triangle"], [164.8, 0.08, 0.26, 0.045, "triangle"]]),
  done: () => tone([[659.3, 0, 0.3, 0.06], [830.6, 0.09, 0.3, 0.06], [987.8, 0.18, 0.35, 0.06], [1318.5, 0.3, 0.7, 0.05]]),
  coin: () => tone([[1568, 0, 0.12, 0.04, "square"], [2093, 0.06, 0.22, 0.035, "square"]])
};
function buzz(p) { if (!L.haptics || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) { /* not on iPhone */ } }
const FX = { parts: [], on: false };
function sparks(x, y, colors, n, power) {
  if (REDUCED) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * power;
    FX.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.35, life: 1, decay: 0.012 + Math.random() * 0.02,
                    s: 1.5 + Math.random() * 3, c: colors[i % colors.length], sq: Math.random() < 0.4, rot: Math.random() * 6 });
  }
  if (FX.on) return;
  FX.on = true;
  const cv = $("#fx"), ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  (function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    FX.parts = FX.parts.filter(p => p.life > 0);
    for (const p of FX.parts) {
      p.vy += 0.16; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= p.decay; p.rot += 0.1;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
      if (p.sq) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill(); }
    }
    if (FX.parts.length) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); FX.on = false; }
  })();
}
function speak(text) {
  try { const u = new SpeechSynthesisUtterance(plain(text).replace(/_{2,}/g, "blank")); u.lang = "en-US"; u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* no voice */ }
}

/* ---------- a generative piece a day, for the portfolio ---------- */
function drawArt(cv, seed, pal, score) {
  const r = rng(hash(seed)), ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  ctx.fillStyle = "#0E0E16"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * r(), H * r(), 0, W / 2, H / 2, Math.max(W, H) * 0.8);
  g.addColorStop(0, pal[0] + "66"); g.addColorStop(1, "#0E0E1600");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const n = 3 + score * 2, u = Math.min(W, H);
  for (let i = 0; i < n; i++) {
    const c = pal[Math.floor(r() * pal.length)], kind = Math.floor(r() * 4);
    ctx.globalAlpha = 0.45 + r() * 0.45; ctx.fillStyle = c; ctx.strokeStyle = c;
    ctx.save(); ctx.translate(W * r(), H * r()); ctx.rotate(r() * Math.PI);
    if (kind === 0) { ctx.beginPath(); ctx.arc(0, 0, u * (0.06 + r() * 0.22), 0, 7); ctx.fill(); }
    else if (kind === 1) { ctx.lineWidth = u * (0.02 + r() * 0.05); ctx.beginPath(); ctx.arc(0, 0, u * (0.15 + r() * 0.3), 0, Math.PI * (0.4 + r())); ctx.stroke(); }
    else if (kind === 2) { const w = u * (0.1 + r() * 0.4); ctx.fillRect(-w / 2, -w / 6, w, w / 3); }
    else { ctx.lineWidth = Math.max(1, u * 0.008); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-u * 0.3, k * u * 0.03); ctx.lineTo(u * 0.3, k * u * 0.03); ctx.stroke(); } }
    ctx.restore();
  }
  if (score >= 5) {
    ctx.globalAlpha = 0.95; ctx.strokeStyle = "#F2C56B"; ctx.lineWidth = Math.max(1.5, u * 0.012);
    ctx.beginPath(); ctx.arc(W * (0.25 + r() * 0.5), H * (0.25 + r() * 0.5), u * 0.12, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function paintArt(root) {
  $$("canvas[data-art]", root).forEach(cv => {
    const [seed, aura, score] = cv.dataset.art.split("~");
    drawArt(cv, seed, AURAS[aura] ? AURAS[aura].c : AURAS.orchid.c, +score);
  });
}

/* ---------- icons ---------- */
const I = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ""}>${d}</svg>`;
const ICON = {
  home: I('<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>'),
  board: I('<path d="M4 20V11h4v9M10 20V5h4v15M16 20v-6h4v6"/>'),
  vault: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l1.3 3.2 3.2 1.3-3.2 1.3L12 16.5l-1.3-3.2L7.5 12l3.2-1.3z"/>'),
  me: I('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: I('<path d="M9 5l7 7-7 7"/>'),
  soundOn: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  listen: I('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/>'),
  half: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  cal: I('<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>'),
  flame: I('<path d="M12 3c.8 3.8 5 5.6 5 10.4A5 5 0 0 1 7 13.4c0-2.3 1.3-3.8 2.2-4.6 0 1.6.8 2.7 1.8 2.7C11 8.2 10.6 5.6 12 3z"/>'),
  lock: I('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  image: I('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8 8"/>'),
  revenge: I('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4.5v4h-4"/>'),
  crown: I('<path d="M4 8l4.2 4L12 6l3.8 6L20 8l-1.6 10H5.6z"/>'),
  star: I('<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 17l-5.3 2.9 1.2-6-4.5-4.1 6-.7z"/>')
};

/* ---------- screens ---------- */
const app = $("#app"), tabsEl = $("#tabs"), layer = $("#layer");
let view = "home", parentOK = false, pin = "", parentPin = "";
let deferredInstall = null;

function applyAura(key) {
  const a = AURAS[key] || AURAS.orchid, root = document.documentElement;
  root.style.setProperty("--a1", a.c[0]); root.style.setProperty("--a2", a.c[1]); root.style.setProperty("--a3", a.c[2]);
  const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", "#09090F");
}
const initial = n => (String(n || "?").trim()[0] || "?");
function avatar(p, cls) {
  const a = AURAS[auraOf(p)] || AURAS.orchid, img = L.avatars[p.id];
  return `<span class="av ${cls || ""}" style="--a1:${a.c[0]};--a2:${a.c[1]}" aria-hidden="true">${img ? `<img src="${img}" alt="">` : esc(initial(p.name))}</span>`;
}
function weekStrip(pid) {
  const dow = NOW.getDay(), cells = [];
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(TODAY, i - dow), on = d <= TODAY && playedOn(pid, d);
    if (on) n++;
    cells.push(`<span class="wd ${on ? "on" : ""} ${d === TODAY ? "today" : ""} ${d > TODAY ? "out" : ""}"><i></i>${DAYS[i]}</span>`);
  }
  return { html: `<div class="week" role="img" aria-label="השבוע: ${n} ימים">${cells.join("")}</div>`, n };
}
function show(v) {
  view = v;
  layer.innerHTML = "";
  const girlTabs = ["home", "board", "vault", "me"].includes(v);
  tabsEl.hidden = !girlTabs;
  $$("button", tabsEl).forEach(b => b.setAttribute("aria-current", b.dataset.to === v ? "page" : "false"));
  const html = ({ home: renderHome, board: renderBoard, vault: renderVault, me: renderMe, parent: renderParent,
                  code: renderCode, who: renderWho, aura: renderAuraPick, error: renderError })[v]();
  app.innerHTML = html;
  app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  paintArt(app);
  window.scrollTo(0, 0);
}
const flavorTitle = p => ({ portfolio: "Portfolio", routine: "The season", stage: "Setlist" })[p.flavor] || "החודש";

function renderHome() {
  const p = me(), st = stats(p.id, Y, M), rk = ranking(Y, M), place = placeOf(rk, p.id);
  const done = playedOn(p.id, TODAY), set = dailySet(p, TODAY), rev = done ? null : revengeFor(p, TODAY, set);
  const test = activeTest(p, TODAY), wk = weekStrip(p.id), h = NOW.getHours();
  const hi = h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 22 ? "ערב טוב" : "לילה טוב";
  let hero;
  if (done) {
    const e = st.byDay[TODAY] || { ok: 0, revOk: 0 }, pts = POINTS.day + e.ok * POINTS.right + e.revOk * POINTS.revenge;
    const left = 24 * 60 - (h * 60 + NOW.getMinutes());
    hero = `<section class="glass hero-card">
      <span class="eyebrow">Done for today</span>
      <div class="row" style="align-items:flex-end"><span class="display big num" dir="ltr">${e.ok}/5</span><span class="display grad-text" style="font-size:40px" dir="ltr">+${pts}</span></div>
      <p class="muted">המשימה הבאה נפתחת בעוד ${Math.floor(left / 60)} שעות ו־${left % 60} דקות.</p>
      <button type="button" class="btn btn-ghost wide" data-act="tab" data-to="board">לטבלה</button></section>`;
  } else {
    const subj = {};
    set.forEach(q => { const s = SUBJ[subjOf(q.pool)]; subj[s] = (subj[s] || 0) + 1; });
    const chips = Object.entries(subj).map(([k, n]) => `<span class="chip">${n} ${k}</span>`).join("");
    const resumed = L.progress[p.id] && L.progress[p.id].date === TODAY ? L.progress[p.id].i : 0;
    hero = `<section class="glass hero-card">
      <span class="eyebrow">${DAYS_FULL[NOW.getDay()]} · ${D} ב${MONTHS[M - 1]}</span>
      <h1 class="display">${resumed ? `עוד ${set.length - resumed} שאלות` : "חמש שאלות"}</h1>
      <div class="chips">${chips}${test ? `<span class="chip warn">${ICON.cal.replace("<svg", '<svg width="14" height="14"')} מבחן ב${esc(SUBJ[test.subj] || test.subj)}</span>` : ""}${rev ? `<span class="chip warn">+1 סיבוב נקמה</span>` : ""}</div>
      <div class="meta"><span>בערך <b>3 דקות</b></span><span>עד <b class="num">${POINTS.day + 5 * POINTS.right + (rev ? POINTS.revenge : 0)}</b> נקודות</span></div>
      <button type="button" class="btn btn-primary wide" data-act="start">${resumed ? "להמשיך" : "להתחיל"}</button></section>`;
  }
  const tiles = [];
  for (let d = 1; d <= daysIn(Y, M); d++) {
    const date = `${THIS_MONTH}-${pad2(d)}`, e = st.byDay[date], on = e && e.reg >= 5;
    const cls = `tile ${on ? "on" : ""} ${on && e.ok === 5 ? "perfect" : ""} ${d === D ? "today" : ""} ${d > D ? "future" : ""}`;
    let inner = "";
    if (on && p.flavor === "portfolio") inner = `<canvas width="60" height="80" data-art="${p.id}|${date}~${auraOf(p)}~${e.ok}"></canvas>`;
    else if (on) inner = `<i class="lvl" style="height:${20 + e.ok * 16}%"></i>`;
    tiles.push(`<div class="${cls}">${inner}<span class="num">${d}</span></div>`);
  }
  const upcoming = tests().filter(t => t.p === p.id && t.date >= TODAY).sort((a, b) => a.date < b.date ? -1 : 1);
  const [py, pm] = prevMonth(Y, M), showRecap = stats(p.id, py, pm).played > 0 && (D <= 10 || !LIVE);
  return `
  <header class="top"><div class="hello">${avatar(p, "ring")}<div><b>${hi}, ${esc(p.name)}</b><span>${esc((TRACKS[p.track] || TRACKS.g7).grade)}</span></div></div>
    <button type="button" class="round" data-act="tab" data-to="me" aria-label="ההגדרות שלי">${ICON.me}</button></header>
  ${hero}
  <section class="glass pad stack"><div class="row"><span class="eyebrow">This week</span><span class="small muted"><b class="num" style="color:var(--text)">${Math.min(wk.n, 5)}/5</b> ימים · שבוע מלא = 15 נק׳</span></div>${wk.html}
    <p class="small faint">חמישה ימים בשבוע מספיקים. אימון או שבת בלי משימה לא שוברים כלום.</p></section>
  <div class="stats">
    <div class="glass stat"><b class="num">${st.points}</b><span>נקודות ב${MONTHS[M - 1]}</span></div>
    <div class="glass stat"><b class="num">#${place}</b><span>בטבלה</span></div>
    <div class="glass stat"><b class="num">${FAM.tokens[p.id] || 0}</b><span>אסימונים</span></div>
  </div>
  ${showRecap ? `<button type="button" class="glass pad row" data-act="recap" style="text-align:start"><span><span class="eyebrow">Recap</span><br><b style="font-size:18px">הסיכום שלך ל${MONTHS[pm - 1]}</b></span>${ICON.back.replace("<svg", '<svg width="20" height="20" style="transform:scaleX(-1)"')}</button>` : ""}
  <section class="glass pad"><div class="row"><span class="eyebrow">${flavorTitle(p)} · ${MONTHS[M - 1]}</span><span class="small muted">${st.played} ימים</span></div>
    <div class="grid">${tiles.join("")}</div></section>
  <section class="glass pad stack"><div class="row"><span class="eyebrow">Tests</span>
      <button type="button" class="btn btn-ghost btn-sm" data-act="addTest">${ICON.plus.replace("<svg", '<svg width="16" height="16"')} מבחן</button></div>
    ${upcoming.length ? upcoming.map(t => `<div class="row small"><span>${esc(SUBJ[t.subj] || t.subj)}${t.note ? ` · ${esc(t.note)}` : ""}</span><span class="muted">${DAYS_FULL[parseYmd(t.date).getDay()]} ${+t.date.slice(8)}.${+t.date.slice(5, 7)}</span></div>`).join("")
      : `<p class="small muted">יש מבחן בקרוב? שלושה ימים לפניו, השאלות מתמקדות במקצוע שלו.</p>`}</section>
  ${LIVE ? "" : `<p class="demo">תצוגה לדוגמה: ההיסטוריה עד היום היא נתוני דוגמה.</p>`}`;
}

function renderBoard() {
  const p = me(), rk = ranking(Y, M), left = daysIn(Y, M) - D, lead = rk[0] ? rk[0].points : 0;
  const rowsHTML = rk.map(r => {
    const q = profile(r.id), pl = placeOf(rk, r.id);
    return `<li class="glass st ${r.id === p.id ? "me" : ""} ${pl === 1 ? "first" : ""}"><span class="st-pos num">${pl}</span>${avatar(q)}
      <div class="st-main"><b>${esc(q.name)}${pl === 1 && r.points ? `<span style="color:var(--gold);display:inline-flex">${ICON.crown.replace("<svg", '<svg width="18" height="18"')}</span>` : ""}</b>
        <span class="st-sub">${r.played} ימים · ${r.acc}% דיוק${lead > r.points ? ` · ${lead - r.points} מאחור` : ""}</span></div>
      <span class="st-pts num">${r.points}<small>נק׳</small></span></li>`;
  }).join("");
  const s = FAM.settings, goal = +s.goal || 250;
  const fam = FAM.profiles.reduce((t, q) => { const x = stats(q.id, Y, M); return t + x.ok + x.revOk; }, 0);
  const [py, pm] = prevMonth(Y, M), last = ranking(py, pm), imp = improved(py, pm);
  const champs = last.filter(r => r.points && placeOf(last, r.id) === 1).map(r => profile(r.id));
  return `
  <header class="month-head"><div><span class="eyebrow">Standings</span><h1 class="display">${MONTHS[M - 1]}</h1></div>
    <span class="small muted">${left > 0 ? `עוד ${left} ימים. ב־1 לחודש המובילה מקבלת אסימון והכול מתאפס.` : "היום האחרון. מחר מתחילים מאפס."}</span></header>
  <ol class="standings">${rowsHTML}</ol>
  <section class="glass pad stack"><div class="row"><span class="eyebrow">Family goal</span><span class="num small" dir="ltr"><b>${fam}</b> / ${goal}</span></div>
    <div class="bar"><i style="width:${Math.min(100, fam / goal * 100)}%"></i></div>
    <p class="small muted">${goal} תשובות נכונות של שלושתכן יחד החודש: ${esc(s.goalReward || "")}.</p></section>
  ${champs.length ? `<section class="glass pad stack"><span class="eyebrow">${MONTHS[pm - 1]}</span>
    <div class="row"><span>${champs.length > 1 ? "האלופות" : "האלופה"}: <b>${champs.map(c => esc(c.name)).join(" ו")}</b></span>${imp ? `<span>השתפרה הכי הרבה: <b>${esc(profile(imp.id).name)}</b> <span class="muted">(+${imp.gain}% דיוק)</span></span>` : ""}</div></section>` : ""}
  <details class="glass pad how"><summary>איך סופרים נקודות <span class="muted">+</span></summary>
    <ul><li>${POINTS.day} על כל יום עם משימה</li><li>${POINTS.right} על כל תשובה נכונה</li><li>${POINTS.revenge} על סיבוב נקמה מוצלח</li><li>${POINTS.week} על שבוע עם ${POINTS.weekDays} ימי משימה</li>
    <li>כל אחת עונה ברמה של הכיתה שלה, אז הניקוד הוגן בין ז׳ לי׳.</li>${s.improvedReward ? `<li>מי שמשתפרת הכי הרבה בדיוק לעומת החודש הקודם: ${esc(s.improvedReward)}.</li>` : ""}</ul></details>`;
}

function renderVault() {
  const p = me(), n = +FAM.tokens[p.id] || 0, s = FAM.settings, val = +s.tokenValue || 100;
  const coins = Array.from({ length: Math.max(10, n) }, (_, i) => i < n
    ? `<span class="coin" style="animation-delay:${i * 0.06}s">${ICON.star.replace("<svg", '<svg fill="currentColor"')}</span>`
    : `<span class="coin empty num">${i + 1}</span>`).join("");
  const tier = (k, label, text) => `<div class="glass tier ${n >= k ? "reached" : ""}"><span class="n num">${k}</span>
    <div><b>${esc(text)}</b><div class="small muted">${label}</div></div><span class="small ${n >= k ? "" : "muted"}" style="${n >= k ? "color:var(--gold)" : ""}">${n >= k ? "פתוח" : `עוד ${k - n}`}</span></div>`;
  return `
  <header><span class="eyebrow">Vault</span><h1 class="display" style="font-size:58px">${n} <span class="muted" style="font-size:24px">אסימונים</span></h1></header>
  <section class="glass pad"><div class="coins">${coins}</div></section>
  ${n >= 10 ? `<div class="blackcard"><span class="eyebrow" style="color:var(--gold)">Black card</span><span class="display">${esc(s.prize10 || "הפרס הענק")}</span></div>` : ""}
  ${tier(1, "אפשר לפדות כל אסימון מתי שרוצים", `${val} ₪`)}
  ${tier(5, "חמישה אסימונים שמורים", s.prize5 || "פרס גדול (אבא עוד מחליט)")}
  ${tier(10, "עשרה אסימונים שמורים", s.prize10 || "פרס ענק (אבא עוד מחליט)")}
  <button type="button" class="btn btn-aura wide" data-act="redeem" ${n ? "" : "disabled"}>לפדות אסימון ב־${val} ₪</button>
  <p class="small muted" style="text-align:center">אלופת החודש מקבלת אסימון ב־1 לחודש הבא.</p>`;
}

function subjectBars(st) {
  return Object.entries(st.bySubj).sort((a, b) => b[1][1] - a[1][1]).map(([s, [ok, t]]) => {
    const v = Math.round(ok / t * 100);
    return `<div class="sbar"><span>${SUBJ[s] || s}</span><span class="bar"><i style="width:${v}%"></i></span><span class="num muted">${v}%</span></div>`;
  }).join("") || `<p class="small muted">עוד אין תשובות החודש.</p>`;
}
function renderMe() {
  const p = me(), st = stats(p.id, Y, M), cur = auraOf(p);
  const sw = Object.entries(AURAS).map(([k, a]) => `<button type="button" class="sw" data-act="aura" data-k="${k}" aria-pressed="${k === cur}">
    <i style="background:radial-gradient(circle at 30% 30%,${a.c[2]},${a.c[0]} 45%,${a.c[1]})"></i>${a.name}</button>`).join("");
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  const others = LIVE ? "" : `<section class="glass pad stack"><span class="eyebrow">Demo</span><p class="small muted">בתצוגה לדוגמה אפשר לעבור בין הבנות ולראות את המסך של אבא.</p>
    <div class="chips">${FAM.profiles.map(q => `<button type="button" class="chip" data-act="become" data-id="${q.id}">${esc(q.name)}</button>`).join("")}
    <button type="button" class="chip" data-act="parent">${ICON.lock.replace("<svg", '<svg width="14" height="14"')} אבא</button></div></section>`;
  return `
  <header class="top"><span class="eyebrow">Me</span></header>
  <section class="stack" style="align-items:center;text-align:center">
    <button type="button" data-act="photo" aria-label="החלפת תמונה">${avatar(p, "lg ring")}</button>
    <h1 class="display" style="font-size:44px">${esc(p.name)}</h1>
    <button type="button" class="link" data-act="photo">${L.avatars[p.id] ? "להחליף תמונה" : "להוסיף תמונה או ציור שלך"}</button>
    <input type="file" id="photoFile" accept="image/*" hidden></section>
  <section class="glass pad stack"><span class="eyebrow">Your aura</span><div class="swatches">${sw}</div></section>
  <section class="glass pad stack"><div class="row"><span class="eyebrow">What Dad sees</span><span class="small muted">${st.played} ימים · ${st.acc}% דיוק</span></div>
    ${subjectBars(st)}
    ${st.weak.length ? `<p class="small"><span class="muted">כדאי לחזק:</span> ${st.weak.map(esc).join(", ")}</p>` : ""}
    <p class="small faint">אבא רואה בדיוק את זה, וגם אילו שאלות קיבלת. לא יותר.</p></section>
  <button type="button" class="glass pad row" data-act="recap" style="text-align:start"><span>הסיכום של ${MONTHS[prevMonth(Y, M)[1] - 1]}</span>${ICON.back.replace("<svg", '<svg width="18" height="18" style="transform:scaleX(-1)"')}</button>
  <section class="glass pad">
    <div class="toggle" style="border-top:0"><span>צלילים</span><button type="button" class="switch" role="switch" aria-checked="${L.sound}" data-act="toggle" data-k="sound" aria-label="צלילים"></button></div>
    <div class="toggle"><span>רטט <span class="small faint">(באנדרואיד)</span></span><button type="button" class="switch" role="switch" aria-checked="${L.haptics}" data-act="toggle" data-k="haptics" aria-label="רטט"></button></div>
  </section>
  ${!standalone && ios ? `<section class="glass pad stack"><span class="eyebrow">Home screen</span><p class="small muted">באייפון: כפתור השיתוף בספארי ואז ״הוספה למסך הבית״. ככה זה נפתח כמו אפליקציה.</p></section>` : ""}
  ${!standalone && deferredInstall ? `<button type="button" class="btn btn-ghost wide" data-act="install">להוסיף למסך הבית</button>` : ""}
  ${others}
  ${LIVE ? `<button type="button" class="link" style="align-self:center" data-act="forget">זה לא הטלפון שלי</button>` : ""}`;
}

/* ---------- Dad's screen ---------- */
function renderParent() {
  if (!parentOK) {
    const dots = [0, 1, 2, 3].map(i => `<i class="${i < pin.length ? "on" : ""}"></i>`).join("");
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button type="button" data-act="pin" data-k="${k}">${k}</button>`).join("");
    return `<header class="top"><button type="button" class="round" data-act="leaveParent" aria-label="חזרה">${ICON.back}</button><span class="eyebrow">Parent</span><span style="width:44px"></span></header>
    <div class="pin"><span class="round" style="width:64px;height:64px">${ICON.lock}</span><p>הקוד של אבא</p><div class="pin-dots" id="pinDots">${dots}</div>
      <div class="keypad" dir="ltr">${keys}<span></span><button type="button" data-act="pin" data-k="0">0</button><button type="button" data-act="pin" data-k="del" aria-label="מחיקה">⌫</button></div>
      ${LIVE ? "" : `<p class="small faint">בתצוגה לדוגמה הקוד הוא 1234</p>`}</div>`;
  }
  const rk = ranking(Y, M), s = FAM.settings;
  const cards = FAM.profiles.map(p => {
    const st = stats(p.id, Y, M), place = placeOf(rk, p.id), e = st.byDay[TODAY];
    const done = playedOn(p.id, TODAY);
    const spark = Array.from({ length: 14 }, (_, i) => { const d = addDays(TODAY, i - 13), x = rows().filter(r => r.p === p.id && r.d === d && !r.r);
      const ok = x.filter(r => r.ok).length; return `<i class="${x.length >= 5 ? "on" : ""}" style="height:${x.length >= 5 ? 20 + ok * 16 : 8}%" title="${d}"></i>`; }).join("");
    const up = tests().filter(t => t.p === p.id && t.date >= TODAY);
    const a = AURAS[auraOf(p)];
    return `<section class="glass pad stack" style="--a1:${a.c[0]};--a2:${a.c[1]}">
      <div class="row"><div class="hello">${avatar(p)}<div><b>${esc(p.name)}</b><span>${esc((TRACKS[p.track] || TRACKS.g7).grade)}</span></div></div>
        ${done ? `<span class="chip good">היום ${e.ok}/5</span>` : `<span class="chip bad">עוד לא היום</span>`}</div>
      <div class="pgrid num"><div><b>${st.played}/${D}</b><span>ימים</span></div><div><b>${st.acc}%</b><span>דיוק</span></div><div><b>${st.points}</b><span>נקודות</span></div><div><b>#${place}</b><span>מקום</span></div></div>
      <div class="spark" aria-label="שבועיים אחרונים">${spark}</div>
      ${subjectBars(st)}
      ${st.weak.length ? `<p class="small"><span class="muted">כדאי לחזק:</span> ${st.weak.map(esc).join(", ")}</p>` : ""}
      ${up.length ? `<p class="small"><span class="muted">מבחנים:</span> ${up.map(t => `${esc(SUBJ[t.subj] || t.subj)} ${+t.date.slice(8)}.${+t.date.slice(5, 7)}`).join(", ")}</p>` : ""}
      <p class="small faint">השאלות של היום: ${dailySet(p, TODAY).map(q => esc(q.topic)).join(" · ")}</p>
      <div class="row"><span class="small muted">${+FAM.tokens[p.id] || 0} אסימונים</span><button type="button" class="btn btn-ghost btn-sm" data-act="grant" data-id="${p.id}">+1 אסימון</button></div>
    </section>`;
  }).join("");
  const pairs = {};
  FAM.profiles.filter(p => p.pair).forEach(p => (pairs[p.pair] = pairs[p.pair] || []).push(p));
  const overlap = Object.values(pairs).filter(g => g.length > 1).map(g => {
    const [a, b] = g.map(p => new Set(dailySet(p, TODAY).map(q => q.id)));
    const n = [...a].filter(x => b.has(x)).length;
    return `${g.map(p => esc(p.name)).join(" ו")} קיבלו היום ${n ? `${n} שאלות משותפות` : "שאלות שונות לגמרי"}.`;
  }).join(" ");
  return `
  <header class="top"><button type="button" class="round" data-act="leaveParent" aria-label="יציאה">${ICON.back}</button><span class="eyebrow">Parent · ${D}.${M}</span><span style="width:44px"></span></header>
  <h1 class="display" style="font-size:46px">${MONTHS[M - 1]}, יום ${D}</h1>
  ${overlap ? `<p class="small muted">${overlap}</p>` : ""}
  ${cards}
  <section class="stack"><span class="eyebrow">The email you get at ${+s.digestHour || 21}:00</span>
    <div class="mail"><div class="mail-h"><b>Aura · יום ${DAYS_FULL[NOW.getDay()]} ${D}.${M}</b></div><div class="mail-b">${digestLines().map(l => `<p>${l}</p>`).join("")}</div></div></section>
  <section class="glass pad stack"><span class="eyebrow">Prizes</span>
    <div class="field"><label for="p5">הפרס של 5 אסימונים</label><input id="p5" value="${esc(s.prize5 || "")}" placeholder="למשל: הופעה לבחירתה"></div>
    <div class="field"><label for="p10">הפרס של 10 אסימונים</label><input id="p10" value="${esc(s.prize10 || "")}" placeholder="למשל: סוף שבוע באילת"></div>
    <div class="field"><label for="pg">הפרס של היעד המשפחתי</label><input id="pg" value="${esc(s.goalReward || "")}"></div>
    <button type="button" class="btn btn-primary" data-act="savePrizes">שמירה</button></section>
  ${LIVE ? `<button type="button" class="link" style="align-self:center" data-act="forget">זה לא הטלפון שלי</button>` : ""}`;
}
function digestLines() {
  const rk = ranking(Y, M), lines = FAM.profiles.map(p => {
    const x = rows().filter(r => r.p === p.id && r.d === TODAY && !r.r), ok = x.filter(r => r.ok).length;
    const miss = [...new Set(x.filter(r => !r.ok).map(r => r.t))];
    return `<b>${esc(p.name)}:</b> ${x.length >= 5 ? `${ok}/5${miss.length ? `. פספסה: ${miss.map(esc).join(", ")}` : ", בלי טעויות"}` : "לא שיחקה היום"}. השבוע ${weekStrip(p.id).n} ימים.`;
  });
  const leads = rk.filter(r => r.points && placeOf(rk, r.id) === 1).map(r => esc(profile(r.id).name));
  lines.push(`<span class="faint">${leads.length ? `${leads.join(" ו")} ${leads.length > 1 ? "מובילות" : "מובילה"} עם ${rk[0].points} נקודות. ` : ""}נשארו ${daysIn(Y, M) - D} ימים לחודש.</span>`);
  return lines;
}

/* ---------- first run on a phone (live) ---------- */
function renderCode() {
  return `<div class="onb"><span class="eyebrow">Welcome</span><span class="wordmark" dir="ltr">Aura</span>
    <p class="muted">חמש שאלות ביום, טבלה חודשית, אסימונים. הכניסי את קוד המשפחה שאבא נתן.</p>
    <div class="field"><label for="code">קוד המשפחה</label><input id="code" autocomplete="off" autocapitalize="characters" dir="ltr" value="${esc(L.code)}"></div>
    <button type="button" class="btn btn-primary wide" data-act="joinCode">כניסה</button><p class="small muted" id="codeMsg"></p></div>`;
}
function renderWho() {
  return `<div class="onb"><span class="eyebrow"><bdi>Who’s this phone?</bdi></span><h1 class="display" style="font-size:48px">של מי הטלפון הזה?</h1>
    <div class="stack">${FAM.profiles.map(p => `<button type="button" class="glass pick" data-act="claim" data-id="${p.id}">${avatar(p)}<div><b>${esc(p.name)}</b><span class="small muted">${esc((TRACKS[p.track] || TRACKS.g7).grade)}</span></div></button>`).join("")}
    <button type="button" class="glass pick" data-act="claimParent"><span class="round">${ICON.lock}</span><div><b>אבא</b><span class="small muted">המסך של ההורה</span></div></button></div>
    <p class="small faint">הטלפון נשאר שלך: כל אחת משחקת רק מהטלפון שלה.</p></div>`;
}
function renderAuraPick() {
  const p = me(), cur = auraOf(p);
  return `<div class="onb"><span class="eyebrow">Pick your aura</span><h1 class="display" style="font-size:48px">הצבעים שלך</h1>
    <div class="swatches">${Object.entries(AURAS).map(([k, a]) => `<button type="button" class="sw" data-act="aura" data-k="${k}" aria-pressed="${k === cur}"><i style="background:radial-gradient(circle at 30% 30%,${a.c[2]},${a.c[0]} 45%,${a.c[1]})"></i>${a.name}</button>`).join("")}</div>
    <button type="button" class="btn btn-primary wide" data-act="tab" data-to="home">יאללה</button><p class="small faint">אפשר להחליף מתי שרוצים.</p></div>`;
}
function renderError() {
  return `<div class="onb"><span class="wordmark" dir="ltr">Aura</span><p class="muted">אין חיבור לגיליון של המשפחה כרגע. בדקי אינטרנט ונסי שוב.</p>
    <button type="button" class="btn btn-primary wide" data-act="retry">לנסות שוב</button>
    <button type="button" class="link" style="align-self:center" data-act="resetCode">להקליד קוד אחר</button></div>`;
}

/* ---------- the quest ---------- */
let Q = null;
function startQuest() {
  const p = me(), set = dailySet(p, TODAY), rev = revengeFor(p, TODAY, set);
  const items = set.map(q => ({ q, rev: false }));
  if (rev) items.push({ q: rev, rev: true });
  Q = { pid: p.id, items, orders: items.map(it => shuffle([0, 1, 2, 3], rng(hash(TODAY + "|" + p.id + "|" + it.q.id)))),
        i: 0, res: [], combo: 0, fifty: false, locked: false };
  const saved = L.progress[p.id];
  if (saved && saved.date === TODAY && saved.ids === items.map(it => it.q.id).join()) Object.assign(Q, { i: saved.i, res: saved.res, fifty: saved.fifty, combo: saved.combo || 0 });
  renderQuestion();
}
function keepProgress() {
  L.progress[Q.pid] = { date: TODAY, ids: Q.items.map(it => it.q.id).join(), i: Q.i, res: Q.res, fifty: Q.fifty, combo: Q.combo };
  save();
}
function quizShell(inner) { return `<div class="quiz" role="dialog" aria-modal="true" aria-label="המשימה של היום"><div class="aura calm" aria-hidden="true"><i></i><i></i><i></i></div><div class="quiz-in">${inner}</div></div>`; }
function segs() {
  return `<div class="segs">${Q.items.map((it, k) => `<span class="seg ${it.rev ? "rev" : ""} ${k < Q.i || (k === Q.i && Q.locked) ? (Q.res[k] ? "done" : "done bad") : k === Q.i ? "cur" : ""}"><i></i></span>`).join("")}</div>`;
}
function renderQuestion() {
  const it = Q.items[Q.i], q = it.q, ord = Q.orders[Q.i], ltr = !!q.ltr, keys = ltr ? ["A", "B", "C", "D"] : ["א", "ב", "ג", "ד"];
  const lv = [1, 2, 3].map(n => `<i class="${n <= q.level ? "on" : ""}"></i>`).join("");
  const canSpeak = ltr && "speechSynthesis" in window;
  layer.innerHTML = quizShell(`
    ${segs()}
    <div class="qhead"><button type="button" class="round" data-act="quit" aria-label="יציאה, ההתקדמות נשמרת">${ICON.close}</button>
      <span class="combo" id="combo" ${Q.combo >= 2 ? "" : "hidden"}>${ICON.flame.replace("<svg", '<svg width="20" height="20"')}<span dir="ltr">×${Q.combo}</span></span></div>
    <div class="qsubj"><span class="chip"><i></i>${SUBJ[subjOf(q.pool)]} · ${esc(q.topic)}</span><span class="lvl-dots" aria-label="רמה ${q.level} מתוך 3">${lv}</span>
      ${it.rev ? `<span class="revtag">${ICON.revenge.replace("<svg", '<svg width="16" height="16"')} סיבוב נקמה · כפול</span>` : ""}</div>
    <h2 class="q" ${ltr ? 'dir="ltr"' : ""}>${fmt(q.q)}</h2>
    <div class="opts" ${ltr ? 'dir="ltr"' : ""}>${ord.map((oi, j) => `<button type="button" class="opt" data-act="answer" data-j="${j}"><span class="k">${keys[j]}</span><span dir="${optDir(q.options[oi])}">${fmt(q.options[oi])}</span></button>`).join("")}</div>
    <div class="qtools"><button type="button" class="tool" data-act="fifty" ${Q.fifty ? "disabled" : ""}>${ICON.half} 50:50${Q.fifty ? " · נוצל" : ""}</button>
      ${canSpeak ? `<button type="button" class="tool" data-act="listen">${ICON.listen} Listen</button>` : ""}<span class="small faint num" dir="ltr">${Q.i + 1} / ${Q.items.length}</span></div>
    <div id="explain"></div>`);
}
function answer(j, btn) {
  if (Q.locked) return;
  Q.locked = true;
  const it = Q.items[Q.i], q = it.q, ord = Q.orders[Q.i], right = ord.indexOf(0), ok = j === right;
  Q.res[Q.i] = ok;
  $$(".opt", layer).forEach((b, k) => { b.disabled = true; b.classList.add(k === right ? "right" : k === j ? "wrong" : "dim"); });
  const seg = $$(".seg", layer)[Q.i]; if (seg) seg.className = `seg ${it.rev ? "rev" : ""} done ${ok ? "" : "bad"}`;
  const rect = btn.getBoundingClientRect(), a = AURAS[auraOf(me())].c;
  if (ok) {
    Q.combo++; SFX.good(); buzz(15);
    sparks(rect.left + rect.width / 2, rect.top + rect.height / 2, [a[0], a[1], "#ffffff", "#3EE6A4"], 26, 5);
    const f = document.createElement("div"); f.className = "fly"; f.dir = "ltr"; f.textContent = "+" + (it.rev ? POINTS.revenge : POINTS.right);
    f.style.left = (rect.left + rect.width / 2) + "px"; f.style.top = (rect.top - 10) + "px"; document.body.appendChild(f); setTimeout(() => f.remove(), 1100);
    const c = $("#combo", layer);
    if (Q.combo >= 2 && c) { c.hidden = false; $("span", c).textContent = "×" + Q.combo; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }
  } else { Q.combo = 0; const c = $("#combo", layer); if (c) c.hidden = true; SFX.bad(); buzz([30, 40, 30]); }
  keepProgress();
  const last = Q.i === Q.items.length - 1;
  const head = ok ? ["בול.", "נכון.", "יש.", "מדויק.", "בדיוק ככה."][(Q.i + Q.combo) % 5] : (it.rev ? "עוד לא. היא תחזור." : "כמעט.");
  $("#explain", layer).innerHTML = `<section class="glass explain ${ok ? "ok" : "no"}"><h3>${head}</h3><p ${q.ltr ? 'dir="ltr"' : ""}>${fmt(q.explain)}</p>
    <button type="button" class="btn btn-primary wide" data-act="next">${last ? "לתוצאה" : "הבאה"}</button></section>`;
  const nb = $("[data-act=next]", layer);
  nb.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
  nb.focus({ preventScroll: true });
}
function useFifty() {
  if (Q.fifty || Q.locked) return;
  Q.fifty = true; SFX.tap(); keepProgress();
  const ord = Q.orders[Q.i], right = ord.indexOf(0);
  shuffle([0, 1, 2, 3].filter(k => k !== right), rng(hash(TODAY + Q.pid + Q.items[Q.i].q.id + "half"))).slice(0, 2)
    .forEach(k => { const b = $$(".opt", layer)[k]; b.disabled = true; b.classList.add("gone"); });
  const t = $("[data-act=fifty]", layer); t.disabled = true; t.innerHTML = `${ICON.half} 50:50 · נוצל`;
}
async function finishQuest() {
  const p = me(), before = stats(p.id, Y, M);
  const add = Q.items.map((it, k) => ({ d: TODAY, p: p.id, q: it.q.id, pool: it.q.pool, t: it.q.topic, l: it.q.level, ok: Q.res[k] ? 1 : 0, r: it.rev ? 1 : 0 }));
  if (LIVE) L.outbox.push({ p: p.id, d: TODAY, rows: add }); else L.rows.push(...add);
  delete L.progress[p.id];
  save();
  const after = stats(p.id, Y, M), gained = after.points - before.points, weekBonus = after.fullWeeks > before.fullWeeks;
  renderResult(p, gained, weekBonus, after);
  SFX.done(); buzz([20, 60, 20]);
  const a = AURAS[auraOf(p)].c;
  if (Q.res.filter(Boolean).length >= 4) setTimeout(() => sparks(innerWidth / 2, innerHeight * 0.28, [a[0], a[1], a[2], "#F2C56B", "#ffffff"], 140, 9), 250);
  if (LIVE) flush().then(okd => { if (okd) refresh().catch(() => {}); });
}
function flavorBlock(p, items, res, st) {
  const ok = res.filter(Boolean).length, total = res.length, reg = items.filter(it => !it.rev).length;
  const regOk = items.reduce((s, it, k) => s + (!it.rev && res[k] ? 1 : 0), 0);
  if (p.flavor === "routine") {
    let dsc = 0; items.forEach((it, k) => { if (res[k]) dsc += 1 + 0.5 * it.q.level; });
    const e = Math.max(0, 10 - 1.3 * (total - ok));
    return `<section class="glass routine" style="padding-bottom:62px"><div class="row"><span class="eyebrow">Routine · ${APPARATUS[mod(dayIndex(TODAY), 5)]}</span><span class="eyebrow num">${D}.${M}</span></div>
      <div class="scores num" dir="ltr"><div><small>D</small><b>${dsc.toFixed(2)}</b></div><div><small>E</small><b>${e.toFixed(2)}</b></div><div class="tot"><small>TOTAL</small><b class="grad-text">${(dsc + e).toFixed(2)}</b></div></div>
      <p class="small muted">D: כל תשובה נכונה לפי הקושי שלה. E: עשר, פחות 1.30 על כל טעות.</p>
      <svg class="ribbon" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="rg"><stop offset="0" style="stop-color:var(--a1)"/><stop offset="1" style="stop-color:var(--a2)"/></linearGradient></defs>
        <path d="M-10 52 C 60 -6, 110 84, 170 36 S 270 -4, 320 40 S 380 62, 412 18" fill="none" stroke="url(#rg)" stroke-width="3" stroke-linecap="round"/></svg></section>`;
  }
  if (p.flavor === "stage") {
    const lit = 6 + regOk * 3;
    const bars = Array.from({ length: 22 }, (_, i) => `<i class="${i < lit ? "" : "off"}" style="height:${30 + ((i * 37) % 70)}%;animation-delay:${(i % 5) * 0.11}s"></i>`).join("");
    const head = regOk === reg ? "Encore" : regOk >= reg - 1 ? "Standing ovation" : regOk >= 3 ? "Great set" : "Soundcheck";
    const sub = regOk === reg ? "הקהל לא מוכן ללכת הביתה." : regOk >= 3 ? "הקהל איתך." : "חזרה גנרלית. מחר על הבמה.";
    return `<section class="glass stage"><span class="eyebrow">Live · track ${st.played} · ${MONTHS[M - 1]}</span><div class="eq" aria-hidden="true">${bars}</div>
      <span class="display grad-text" style="font-size:48px">${head}</span><p class="muted">${sub}</p>
      <div class="stars" aria-label="${regOk} מתוך ${reg}">${Array.from({ length: reg }, (_, i) => `<span class="${i < regOk ? "on" : ""}" style="animation-delay:${0.2 + i * 0.12}s">★</span>`).join("")}</div></section>`;
  }
  const names = ["Study", "Composition", "Fragment", "Étude", "Nocturne"], aura = auraOf(p);
  return `<figure class="glass piece" style="margin:0"><canvas width="640" height="800" data-art="${p.id}|${TODAY}~${aura}~${regOk}"></canvas>
    <figcaption><b dir="ltr">${names[mod(dayIndex(TODAY), 5)]} in ${AURAS[aura].name}</b><span class="small muted" dir="ltr">Nº ${st.played} · ${regOk}/${reg}</span></figcaption></figure>`;
}
function renderResult(p, gained, weekBonus, st) {
  const ok = Q.res.filter(Boolean).length;
  const list = Q.items.map((it, k) => `<div class="rv"><span class="mk ${Q.res[k] ? "ok" : "no"}">${Q.res[k] ? "✓" : "✗"}</span>
    <span class="t"><b>${SUBJ[subjOf(it.q.pool)]} · ${esc(it.q.topic)}${it.rev ? " · נקמה" : ""}</b><br><span class="muted" ${it.q.ltr ? 'dir="ltr"' : ""}>${fmt(it.q.q)}</span></span></div>`).join("");
  layer.innerHTML = quizShell(`
    <div class="row"><span class="eyebrow">Done</span><button type="button" class="round" data-act="closeQuiz" aria-label="סגירה">${ICON.close}</button></div>
    <div class="res-top"><span class="display grad-text num" id="gain" data-to="${gained}" dir="ltr">+0</span>
      <p class="muted"><bdi dir="ltr">${ok}/${Q.items.length}</bdi> נכונות · נקודות לטבלה${weekBonus ? ", כולל 15 על שבוע מלא" : ""}</p></div>
    ${flavorBlock(p, Q.items, Q.res, st)}
    <section class="glass pad review"><span class="eyebrow">Today</span>${list}
      ${Q.res.some(x => !x) ? `<p class="small faint">מה שפספסת חוזר בעוד יומיים, בסיבוב נקמה ששווה כפול.</p>` : ""}</section>
    <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-aura wide" data-act="closeQuiz" data-to="board">לטבלה</button>
      <button type="button" class="btn btn-ghost wide" data-act="closeQuiz">סיום</button></div>`);
  paintArt(layer);
  const el = $("#gain", layer), to = +el.dataset.to;
  if (REDUCED) { el.textContent = "+" + to; return; }
  const t0 = performance.now();
  (function step(t) { const k = Math.min(1, (t - t0) / 1000); el.textContent = "+" + Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
}

/* ---------- the monthly recap, as stories ---------- */
let STORY = null;
function openRecap(pid) {
  const [py, pm] = prevMonth(Y, M), st = stats(pid, py, pm);
  if (!st.played) { toast("עוד אין סיכום לחודש שעבר"); return; }
  const rk = ranking(py, pm), place = placeOf(rk, pid);
  const best = Object.entries(st.bySubj).filter(([, v]) => v[1] >= 5).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1])[0];
  const perfect = st.days.filter(e => e.ok === 5).length;
  STORY = { i: 0, timer: null, slides: [
    `<span class="eyebrow">Your month</span><span class="display" style="font-size:84px">${MONTHS[pm - 1]}</span><p class="muted">הסיכום שלך. הקישי כדי להמשיך.</p>`,
    `<span class="huge num grad-text">${st.played}</span><span class="display">ימים עם משימה</span><p class="muted">מתוך ${daysIn(py, pm)}. ${st.fullWeeks ? `${st.fullWeeks} שבועות מלאים.` : ""}</p>`,
    `<span class="huge num grad-text" dir="ltr">${st.acc}%</span><span class="display">דיוק</span><p class="muted">${st.ok} תשובות נכונות מתוך ${st.reg}${perfect ? `, ו־${perfect} ימים מושלמים` : ""}.</p>`,
    best ? `<span class="eyebrow">Your strongest</span><span class="display" style="font-size:80px">${SUBJ[best[0]]}</span><p class="muted">${Math.round(best[1][0] / best[1][1] * 100)}% נכון.</p>` : null,
    `<span class="huge num grad-text">#${place}</span><span class="display">${place === 1 ? "האלופה של החודש" : "בטבלה"}</span><p class="muted">${place === 1 ? "אסימון חדש מחכה בכספת." : `${st.points} נקודות. החודש הזה מתחיל מאפס.`}</p>`
  ].filter(Boolean) };
  renderStory();
}
function renderStory() {
  clearTimeout(STORY.timer);
  const n = STORY.slides.length;
  layer.innerHTML = `<div class="story" role="dialog" aria-modal="true" aria-label="הסיכום החודשי" data-act="storyNext"><div class="aura" aria-hidden="true"><i></i><i></i><i></i></div><div class="story-in">
    <div class="segs">${STORY.slides.map((_, k) => `<span class="seg ${k < STORY.i ? "done" : k === STORY.i ? "cur" : ""}"><i></i></span>`).join("")}</div>
    <div class="row" style="margin-top:12px"><span class="eyebrow">Recap</span><button type="button" class="round" data-act="storyClose" aria-label="סגירה">${ICON.close}</button></div>
    <div class="slide">${STORY.slides[STORY.i]}</div></div></div>`;
  if (!REDUCED) STORY.timer = setTimeout(() => { if (STORY && STORY.i < n - 1) { STORY.i++; renderStory(); } }, 5000);
}

/* ---------- sheets and toasts ---------- */
function sheet(html) { layer.innerHTML = `<div class="sheet-bg" data-act="closeSheet"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; }
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
}
function testSheet() {
  const p = me(), subs = subjectsOf(p);
  sheet(`<h3>מבחן בקרוב</h3><p class="small muted">שלושה ימים לפני המבחן, רוב השאלות יהיו מהמקצוע הזה.</p>
    <div class="field"><label>מקצוע</label><div class="seg-pick" id="tsub">${subs.map((s, i) => `<button type="button" data-act="pickSub" data-k="${s}" aria-pressed="${i === 0}">${SUBJ[s]}</button>`).join("")}</div></div>
    <div class="field"><label for="tdate">תאריך</label><input id="tdate" type="date" min="${TODAY}" value="${addDays(TODAY, 3)}"></div>
    <div class="field"><label for="tnote">על מה? (לא חובה)</label><input id="tnote" maxlength="40" placeholder="למשל: משוואות"></div>
    <button type="button" class="btn btn-primary wide" data-act="saveTest">שמירה</button>`);
}
function readPhoto(file) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
    cv.getContext("2d").drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    URL.revokeObjectURL(url);
    L.avatars[me().id] = cv.toDataURL("image/jpeg", 0.85); save(); show("me"); toast("נשמר בטלפון שלך בלבד");
  };
  img.onerror = () => toast("לא הצלחתי לקרוא את התמונה");
  img.src = url;
}

/* ---------- one handler for every tap ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "closeSheet" && e.target !== b) return;
  if (act === "storyNext" && e.target.closest("[data-act=storyClose]")) return;
  switch (act) {
    case "tab": SFX.tap(); show(b.dataset.to); break;
    case "start": startQuest(); break;
    case "answer": answer(+b.dataset.j, b); break;
    case "fifty": useFifty(); break;
    case "listen": speak(Q.items[Q.i].q.q); break;
    case "next": Q.locked = false; if (Q.i < Q.items.length - 1) { Q.i++; keepProgress(); renderQuestion(); } else finishQuest(); break;
    case "quit": keepProgress(); Q = null; layer.innerHTML = ""; show("home"); break;
    case "closeQuiz": Q = null; layer.innerHTML = ""; show(b.dataset.to || "home"); break;
    case "recap": openRecap(me().id); break;
    case "storyNext": if (STORY.i < STORY.slides.length - 1) { STORY.i++; renderStory(); } else { clearTimeout(STORY.timer); STORY = null; layer.innerHTML = ""; } break;
    case "storyClose": clearTimeout(STORY.timer); STORY = null; layer.innerHTML = ""; break;
    case "aura": {
      const p = me(); L.auras[p.id] = b.dataset.k; save(); applyAura(b.dataset.k); SFX.tap();
      $$("[data-act=aura]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (LIVE) api("profile", { p: p.id, aura: b.dataset.k }).catch(() => {});
      break;
    }
    case "photo": $("#photoFile").click(); break;
    case "toggle": L[b.dataset.k] = !L[b.dataset.k]; save(); b.setAttribute("aria-checked", String(L[b.dataset.k])); SFX.tap(); break;
    case "install": if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } break;
    case "become": L.me = b.dataset.id; save(); applyAura(auraOf(me())); show("home"); break;
    case "parent": parentOK = false; pin = ""; applyAura("chrome"); show("parent"); break;
    case "leaveParent": parentOK = false; pin = ""; if (me()) { applyAura(auraOf(me())); show("home"); } else if (LIVE && L.parent) show("parent"); else show("home"); break;
    case "pin": {
      SFX.tap();
      if (b.dataset.k === "del") pin = pin.slice(0, -1); else if (pin.length < 4) pin += b.dataset.k;
      if (pin.length === 4) {
        let good = false;
        if (LIVE) { try { await api("pin", { pin }); good = true; } catch (err) { good = false; } }
        else good = pin === String(FAM.settings.parentPin || "1234");
        if (good) { parentOK = true; parentPin = pin; pin = ""; show("parent"); return; }
        pin = ""; show("parent"); $("#pinDots").classList.add("err"); buzz(80); return;
      }
      show("parent"); break;
    }
    case "grant":
      sheet(`<h3>אסימון ל${esc(profile(b.dataset.id).name)}?</h3><p class="muted">מעבר לאסימון של אלופת החודש. היא תראה אותו בכספת.</p>
        <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-primary wide" data-act="grantYes" data-id="${b.dataset.id}">להעניק</button><button type="button" class="btn btn-ghost wide" data-act="closeSheet">ביטול</button></div>`);
      break;
    case "grantYes": {
      const id = b.dataset.id;
      if (LIVE) { try { await api("grant", { p: id, pin: parentPin }); await refresh(); } catch (err) { toast("לא נשמר. נסה שוב."); break; } }
      else { FAM.tokens[id] = (+FAM.tokens[id] || 0) + 1; L.demoTokens = FAM.tokens; save(); }
      SFX.coin(); show("parent"); toast("ניתן"); break;
    }
    case "savePrizes": {
      const v = { prize5: $("#p5").value.trim(), prize10: $("#p10").value.trim(), goalReward: $("#pg").value.trim() };
      if (LIVE) { try { await api("settings", Object.assign({ pin: parentPin }, v)); await refresh(); } catch (err) { toast("לא נשמר. נסה שוב."); break; } }
      else { L.demoSettings = Object.assign(L.demoSettings || {}, v); Object.assign(FAM.settings, v); save(); }
      toast("נשמר. הבנות יראו את זה בכספת."); break;
    }
    case "redeem": {
      const n = +FAM.tokens[me().id] || 0, val = +FAM.settings.tokenValue || 100;
      sheet(`<h3>לפדות אסימון?</h3><p class="muted">${val} ₪. יישארו לך ${n - 1}.${n < 5 ? ` עוד ${5 - n} ומגיעים לפרס הגדול.` : ""}</p>
        <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-aura wide" data-act="redeemYes">כן, לפדות</button><button type="button" class="btn btn-ghost wide" data-act="closeSheet">לשמור</button></div>`);
      break;
    }
    case "redeemYes": {
      const id = me().id;
      if (LIVE) { try { await api("redeem", { p: id }); await refresh(); } catch (err) { toast("לא עבר. נסי שוב כשיש אינטרנט."); layer.innerHTML = ""; break; } toast("נשלח לאבא"); }
      else { FAM.tokens[id] = Math.max(0, (+FAM.tokens[id] || 0) - 1); L.demoTokens = FAM.tokens; save(); toast("בגרסה האמיתית אבא מקבל על זה מייל"); }
      SFX.coin(); show("vault"); break;
    }
    case "closeSheet": layer.innerHTML = ""; break;
    case "addTest": testSheet(); break;
    case "pickSub": $$("#tsub button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); break;
    case "saveTest": {
      const sb = $("#tsub [aria-pressed=true]"), date = $("#tdate").value, note = $("#tnote").value.trim();
      if (!sb || !date || date < TODAY) { toast("צריך מקצוע ותאריך"); break; }
      const t = { p: me().id, date, subj: sb.dataset.k, note };
      if (LIVE) { try { await api("test", t); await refresh(); } catch (err) { toast("לא נשמר. נסי שוב."); break; } }
      else { L.tests.push(t); save(); }
      show("home"); toast("מצב מבחן נשמר"); break;
    }
    case "joinCode": {
      const v = $("#code").value.trim();
      if (!v) break;
      L.code = v; save(); $("#codeMsg").textContent = "מתחברת...";
      try { await refresh(); await loadBanks(allPools()); show("who"); } catch (err) { $("#codeMsg").textContent = "הקוד לא נכון, או שאין אינטרנט."; }
      break;
    }
    case "claim": L.me = b.dataset.id; L.parent = false; save(); applyAura(auraOf(me())); show(L.auras[L.me] ? "home" : "aura"); break;
    case "claimParent": L.parent = true; L.me = null; save(); applyAura("chrome"); show("parent"); break;
    case "forget":
      sheet(`<h3>להתנתק?</h3><p class="muted">הטלפון ישכח מי את (ההתקדמות שלך שמורה בגיליון של המשפחה).</p>
        <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-primary wide" data-act="forgetYes">להתנתק</button><button type="button" class="btn btn-ghost wide" data-act="closeSheet">ביטול</button></div>`);
      break;
    case "forgetYes": L.me = null; L.parent = false; save(); show("who"); break;
    case "retry": boot(); break;
    case "resetCode": L.code = ""; save(); show("code"); break;
  }
});
document.addEventListener("change", e => { if (e.target.id === "photoFile" && e.target.files[0]) readPhoto(e.target.files[0]); });
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });
window.addEventListener("online", () => { if (LIVE) flush(); });

/* ---------- start ---------- */
function allPools() { return [...new Set(FAM.profiles.flatMap(p => trackPools(p.track)))]; }
async function boot() {
  if (LIVE) {
    const k = new URLSearchParams(location.search).get("k");
    /* The code stays in the address: on an iPhone the home-screen copy keeps its own storage, and the address it is saved from carries the code into it. */
    if (k) { L.code = k; save(); }
    if (!L.code) { FAM = { profiles: [], settings: {}, tokens: {}, rows: [], tests: [] }; show("code"); return; }
    try { await flush(); await refresh(); } catch (err) {
      /* Offline: carry on from the last copy of the Sheet, and send the answers when the connection is back. */
      if (L.cache) FAM = L.cache; else { show("error"); return; }
    }
    await loadBanks(allPools());
    if (L.parent) { applyAura("chrome"); show("parent"); return; }
    if (!me()) { show("who"); return; }
  } else {
    FAM = demoFamily();
    await loadBanks(allPools());
    EXAMPLE = makeExample();
    if (!me()) L.me = FAM.profiles[0].id;
  }
  applyAura(auraOf(me()));
  show("home");
  if (LIVE && L.seenRecap !== THIS_MONTH && D <= 7) {
    const [py, pm] = prevMonth(Y, M);
    if (stats(me().id, py, pm).played) { L.seenRecap = THIS_MONTH; save(); openRecap(me().id); }
  }
}
/* For tools/simulate_days.js: the page's own pick and scoring, driven from a test (never set in the app). */
if (window.FQ_TEST) window.FQ_TEST.api = { dailySet, revengeFor, stats, ranking, placeOf, profile, setRows: r => { EXAMPLE = r; } };
if (!PREVIEW && "serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot().catch(err => { console.error(err); app.innerHTML = `<p class="muted">משהו השתבש: ${esc(err.message)}</p>`; });
})();
