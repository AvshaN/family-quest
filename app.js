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
/* {...} marks a left-to-right run (math, a year range) in Hebrew text. It is an inline block, so a line that wraps
 * moves it whole to the next line: wrapping inside it put "3(x" at one line's end and "− 2) = 3x − 6" before the
 * question mark on the next, and "(1984–" and "1985)" apart (2026-11-13). One longer than a line wraps inside its own
 * box, still left to right. Brackets right round it go inside it, or a wrap could leave "(" on the line before. */
const fmt = s => esc(s).replace(/\(\{([^}]*)\}\)/g, "{($1)}").replace(/\{([^}]*)\}/g, '<bdi dir="ltr" class="ltr">$1</bdi>');
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
  "g10-bio": { grade: "כיתה י׳", math: "g10-math", eng: "g10-eng", other: [["g10-bio", 3], ["g10-bible", 1], ["g10-hist", 1], ["g10-civ", 1], ["g10-lit", 1], ["g10-heb", 1]] },
  "g7":      { grade: "כיתה ז׳", math: "g7-math", eng: "g7-eng", other: [["g7-sci", 2], ["g7-heb", 1], ["g7-hist", 1], ["g7-midrash", 1], ["g7-bible", 1], ["g7-geo", 1]] },
  "g7-art":  { grade: "כיתה ז׳", math: "g7-math", eng: "g7-eng", other: [["g7-art", 3], ["g7-sci", 2], ["g7-heb", 1], ["g7-hist", 1], ["g7-midrash", 1], ["g7-bible", 1], ["g7-geo", 1]] }
};
const trackPools = tr => { const t = TRACKS[tr] || TRACKS.g7; return [t.math, t.eng, ...t.other.map(o => o[0])]; };
/* What each track's class has reached (Avsha's rule, 2026-11-13: a topic the curriculum states beside one in her
 * notebook counts as studied; the topic that comes after it does not): a pool listed here gives her only these topics, in the daily five and in
 * revenge rounds; a pool not listed gives all its topics. On 2026-11-13 the eldest met probability, modals of
 * deduction and word formation, none studied yet; her notebook's test list was the straight line, and in English
 * her class was on the present simple and progressive and reading. Open a topic here as the class reaches it. */
const STUDYING = {
  "g10-bio": {
    // Perpendicular lines and the line's rising or falling (2026-11-13): stated beside parallel lines in the curriculum.
    // Her math notebook (same day) adds the test's algebra and the parallelogram and rhombus.
    "g10-math": ["שיפוע", "משוואת הישר", "ישרים מקבילים", "ישרים מאונכים", "הפונקציה הקווית", "חיתוך עם הצירים",
                 "חיתוך בין ישרים", "מערכות משוואות", "אמצע קטע", "מרחק בין נקודות", "שטח משולש", "פיתגורס",
                 "משוואות", "נוסחאות הכפל המקוצר", "שברים אלגבריים", "מקבילית ומעוין"],
    // English from her notebook too: George Eliot's poem, simile and metaphor, Unit 1's words, Test 2's word list.
    "g10-eng": ["Present Simple", "Present Progressive", "Reading", "Count That Day Lost", "Literary Terms",
                "Vocabulary: Unit 1", "Vocabulary: Test 2"],
    // Her biology notebook: homeostasis, surface and volume, the membrane and transport, the molecules of life
    // (water's properties beside them), the cell's organelles (taught without notes, she said) and the scientific
    // inquiry. Enzymes and the body's systems wait.
    "g10-bio": ["הומאוסטזיס", "שטח פנים ונפח", "מעבר חומרים דרך קרום התא", "מולקולות החיים", "מבנה התא", "החקר המדעי"],
    // Her Hebrew language notebook: the argument text, parts of speech, subject and predicate, connectors, numbers.
    "g10-heb": ["טקסט טיעון", "חלקי הדיבור", "חלקי המשפט", "קשרים לוגיים", "שם המספר"],
    // Her history notebook: time, the five W's, the nation, the French Revolution, Zionism's causes.
    "g10-hist": ["מושגי זמן", "חמשת המ״מים", "הלאומיות", "המהפכה הצרפתית", "הגורמים לציונות"],
    // Her civics notebook: rights, democracy's principles, and the electoral system (its page came with her history).
    "g10-civ": ["זכויות האדם והאזרח", "עקרונות הדמוקרטיה", "שיטת הבחירות"],
    // Her Bible notebook (2026-11-13): the Tanakh's structure and Genesis 1-3, the sentences of Genesis 3 read as an
    // aetiological story (a page that came with her history).
    "g10-bible": ["מבנה התנ״ך", "בראשית א: הבריאה", "בראשית ב: גן עדן", "שני סיפורי הבריאה", "בראשית ג: הפיתוי",
                  "בראשית ג: העונש והגירוש"]
  }
};
/* The twins are in one class, so one list serves both tracks. From their notebook pages and worksheets (2026-11-13;
 * one notebook each for all subjects): history is time, migration and identity, not the ancient world written for
 * them at first; science is what science is, units, the lab, body and material (states of matter beside it) and the
 * greenhouse effect; Hebrew is reading skills, question types, fact and opinion and their word lists (synonyms
 * beside them); English is their word lists, reading and the present tenses. Their math showed only one worksheet
 * (the distributive law, early October), too little to limit by, so math is not limited yet. */
STUDYING.g7 = STUDYING["g7-art"] = {
  "g7-hist": ["ציר זמן וחשיבה היסטורית", "רונית אלקבץ", "גורמי דחיפה ומשיכה", "העליות אחרי קום המדינה", "כור ההיתוך",
              "לאום, דת ואזרחות", "זהות"],
  // Their science book is Matmon Hadash, "Exploring Matter and Energy A": its first gate, a journey among materials, is
  // where their notes are; the particle model is the second gate and waits.
  "g7-sci": ["מדע וטכנולוגיה", "יחידות מידה", "בטיחות במעבדה", "גוף וחומר", "תכונות של חומרים", "מצבי צבירה", "אפקט החממה"],
  "g7-heb": ["מיומנויות קריאה", "סוגי שאלות", "עובדה, דעה ושמועה", "אוצר מילים", "מילים נרדפות והפכים"],
  // Their English book is Teamwork (7th grade, Band II of the Ministry's word list); no unit started yet.
  "g7-eng": ["Vocabulary", "Vocabulary: Word List 1", "Vocabulary: Band II", "Reading", "Present Simple", "Present Progressive"]
};
const studied = (prof, q) => { const t = (STUDYING[prof.track] || {})[q.pool]; return !t || t.includes(q.topic); };
const SUBJ = {
  math: "מתמטיקה", eng: "אנגלית", sci: "מדע", heb: "לשון", hist: "היסטוריה", civ: "אזרחות", midrash: "בית מדרש", bible: "תנ״ך",
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
/* Dad's test profile (Avsha, 2026-11-14: "a test profile similar to the girls, accessible from the parent profile,
 * where I can experiment with entering wrong/right answers without impacting the total score"). While SANDBOX is set
 * the app is a girl's app for a profile called "test" that only this phone knows: it follows the questions of the
 * girl he picked (her track, topics and result style; not her half of a shared pool), its answers and exams are
 * kept in this phone's memory (L.sand), and nothing of it is sent to the Sheet or counted for the girls. */
let SANDBOX = null;
const profile = id => FAM.profiles.find(p => p.id === id) || (SANDBOX && SANDBOX.p.id === id ? SANDBOX.p : null);
const me = () => SANDBOX ? SANDBOX.p : (profile(L.me) || null);
const everyone = () => SANDBOX ? FAM.profiles.concat(SANDBOX.p) : FAM.profiles;
const auraOf = p => (p && (L.auras[p.id] || p.aura)) || "orchid";
function rows() {
  // live: what the Sheet sent, what waits to be sent, and what was sent after the Sheet's last answer was asked for
  const src = (LIVE ? FAM.rows.concat(...L.outbox.map(b => b.rows), ...(L.sent || []).map(b => b.rows)) : L.rows.concat(EXAMPLE)).concat(SANDBOX ? L.sand.rows : []);
  const seen = new Set(), out = [];
  for (const r of src) { const k = `${r.d}|${r.p}|${r.q}|${r.r | 0}`; if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}
const tests = () => (LIVE ? (FAM.tests || []) : L.tests).concat(SANDBOX ? L.sand.tests : []);

/* ---------- question banks ----------
 * A phone keeps its own copy of each bank (the cache BANK_KEPT, which the service worker leaves alone when the app's
 * version changes), so the app opens from it with no wait; each opening then asks the site for the banks again and
 * takes any that changed (freshBanks) before she starts the day. */
const BANKS = {}, QIDX = {}, BANK_SIG = {};
const BANK_KEPT = "fq-banks";
const bankUrl = p => new URL(`data/bank/${p}.json`, location.href).href;
function setBank(p, items, text) {
  (BANKS[p] || []).forEach(q => { delete QIDX[q.id]; });
  BANKS[p] = Array.isArray(items) ? items : [];
  BANKS[p].forEach(q => { q.pool = p; QIDX[q.id] = q; });
  BANK_SIG[p] = text == null ? "" : text.length + "." + hash(text);
  delete PERM[p];
}
async function bankKept(p) {
  try {
    if (!("caches" in window)) return null;
    const r = (await (await caches.open(BANK_KEPT)).match(bankUrl(p))) || (await caches.match(bankUrl(p)));
    return r ? await r.text() : null;
  } catch (e) { return null; }
}
async function bankFetch(p) {
  try {
    const r = await fetch(bankUrl(p), { cache: "no-cache" });
    if (!r.ok) return null;
    const text = await r.text();
    JSON.parse(text);
    if ("caches" in window) caches.open(BANK_KEPT).then(c => c.put(bankUrl(p), new Response(text, { headers: { "Content-Type": "application/json" } }))).catch(() => {});
    return text;
  } catch (e) { return null; }
}
/* kept: start from the copies this phone holds, and fetch only a bank it has none of. */
async function loadBanks(pools, kept) {
  await Promise.all(pools.filter(p => !BANKS[p]).map(async p => {
    const given = window.FQ_BANKS && window.FQ_BANKS[p];
    if (given) { setBank(p, given, null); return; }
    let text = kept ? await bankKept(p) : null, items = null;
    try { items = text == null ? null : JSON.parse(text); } catch (e) { items = null; }
    if (!items) { text = await bankFetch(p); try { items = text == null ? null : JSON.parse(text); } catch (e) { items = null; } }
    setBank(p, items, items ? text : null);
  }));
}
/* The site's banks, asked again: true if any is not the one on screen. */
async function freshBanks(pools) {
  let changed = false;
  await Promise.all(pools.map(async p => {
    if (window.FQ_BANKS && window.FQ_BANKS[p]) return;
    const text = await bankFetch(p);
    if (text == null || text.length + "." + hash(text) === BANK_SIG[p]) return;
    setBank(p, JSON.parse(text), text); changed = true;
  }));
  return changed;
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
/* Questions a twin has answered never come to the other: adding questions to a bank reshuffles its order and so
 * the halves, and a question one twin met last week could otherwise land in the other's half. */
/* What an exam covers, when Avsha sends its page: for its week the three questions of its subject, and practice,
 * come from these topics first. The eldest's English test of 24.11.2026 is the word list "Module E - Test 2
 * Vocabulary" (43 words, each asked by translation, by definition and in a sentence) and reading texts (her own note
 * on the exam). Without an entry the week draws on everything her class has reached in the subject. */
const EXAM_TOPICS = [
  { track: "g10-bio", subj: "eng", date: "2026-11-24", topics: ["Vocabulary: Test 2", "Reading"] }
];
const examTopics = (prof, test) => { const e = test && EXAM_TOPICS.find(x => x.track === prof.track && x.subj === test.subj && x.date === test.date); return e ? e.topics : null; };
/* Her weakest topic in a pool (Avsha, 2026-11-22: the twins' misses pile up in a topic or two, one's in signed
 * numbers and the other's in perimeter and area, while the daily pick spreads over the whole pool): over the last
 * four weeks a miss counts one and a right answer takes half off, and the topic with the most left over is it. One
 * of her two math questions a day is drawn from it, a new question of the topic if there is one (the revenge round
 * already brings back the very questions she missed). A topic she or her classmate marked "not learned yet" in
 * that time is left out: more of it would be more of what was not taught. */
const WEAK = { days: 28, right: 0.5 };
function weakTopic(prof, pool, date, src) {
  const score = {}, missed = {}, off = new Set(), mates = new Set(sharers(prof, pool).map(x => x.id));
  src.forEach(r => {
    if (r.pool !== pool || r.d >= date || daysBetween(r.d, date) > WEAK.days) return;
    const q = QIDX[r.q], t = q && q.topic;
    if (!q || !studied(prof, q)) return;
    if (r.f && mates.has(r.p)) off.add(t);
    if (r.p !== prof.id) return;
    score[t] = (score[t] || 0) + (r.ok ? -WEAK.right : 1);
    if (!r.ok && !(missed[t] >= r.d)) missed[t] = r.d;
  });
  return Object.keys(missed).filter(t => score[t] > 0 && !off.has(t))
    .sort((a, b) => score[b] - score[a] || (missed[a] < missed[b] ? 1 : missed[a] > missed[b] ? -1 : (a < b ? -1 : 1)))[0] || null;
}
/* Difficulty that follows her (2026-11-26): since her questions were limited to what her class has reached, the
 * eldest got 43 of her 45 daily questions right, and the twins sat near three in four. Over her last two weeks in a
 * pool (the daily five only, eight answers at least): nine in ten right or more and her new questions come hardest
 * first; six in ten or fewer and they come easiest first; between the two, in the pool's own order. It moves by
 * itself: harder questions bring her accuracy down into the middle band, and easier ones bring it up. */
const LEVEL = { days: 14, min: 8, up: 0.9, down: 0.6 };
function bandOf(prof, pool, date, src) {
  let n = 0, ok = 0;
  (src || rows()).forEach(r => { if (r.p !== prof.id || r.pool !== pool || r.r || r.d >= date || daysBetween(r.d, date) > LEVEL.days) return; n++; if (r.ok) ok++; });
  return n < LEVEL.min ? 0 : ok / n >= LEVEL.up ? 1 : ok / n <= LEVEL.down ? -1 : 0;
}
function take(prof, pool, n, date, src, focus, weak) {
  const share = shareOf(prof, pool), now = share.filter(q => studied(prof, q)), mine = now.length ? now : share;
  const last = {}, theirs = new Set(), others = new Set(sharers(prof, pool).map(p => p.id).filter(id => id !== prof.id));
  src.forEach(r => {
    if (r.pool !== pool || r.d >= date) return;
    if (r.p === prof.id) { if (!(last[r.q] >= r.d)) last[r.q] = r.d; } else if (others.has(r.p)) theirs.add(r.q);
  });
  const band = bandOf(prof, pool, date, src);
  let fresh = mine.filter(q => !last[q.id] && !theirs.has(q.id));
  // by level, and within a level the pool's own order (the place is the tie-break, so every phone sorts alike)
  if (band) fresh = fresh.map((q, i) => [q, i]).sort((a, b) => band * (b[0].level - a[0].level) || a[1] - b[1]).map(x => x[0]);
  const seen = mine.filter(q => last[q.id]).sort((a, b) => last[a.id] < last[b.id] ? -1 : last[a.id] > last[b.id] ? 1 : 0);
  let order = fresh.concat(seen);
  // a question of the topic she has not met; failing that one she met a week ago or more, so that a small topic
  // does not send the same few questions round every other day
  const w = weak && !focus && order.find(q => q.topic === weak && (!last[q.id] || daysBetween(last[q.id], date) >= 7));
  if (w) { const rest = order.filter(q => q !== w); order = rest.slice(0, 1).concat(w, rest.slice(1)); }   // the second of the two
  return (focus ? order.filter(q => focus.includes(q.topic)).concat(order.filter(q => !focus.includes(q.topic))) : order).slice(0, n);
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
/* For a week before an exam, three of her five come from its subject (Avsha, 2026-11-13; it was three days). */
const TEST_LEAD = 7;
const inDays = n => n <= 0 ? "היום" : n === 1 ? "מחר" : n === 2 ? "מחרתיים" : `בעוד ${n} ימים`;
const dateHe = d => `${DAYS_FULL[parseYmd(d).getDay()]} ${+d.slice(8)}.${+d.slice(5, 7)}`;
function activeTest(prof, date) {
  return tests().filter(t => t.p === prof.id && t.date >= date && daysBetween(date, t.date) <= TEST_LEAD)
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
  for (const p in need) got[p] = take(prof, p, need[p], date, src, p === tp ? examTopics(prof, test) : null, p === t.math ? weakTopic(prof, p, date, src) : null);
  return slots.map(p => { used[p] = used[p] || 0; return got[p][used[p]++]; }).filter(Boolean);
}
/* A question she missed 2-21 days ago comes back as a revenge round, until she wins it. */
function revengeFor(prof, date, todays) {
  const ids = new Set(todays.map(q => q.id));
  const mine = rows().filter(r => r.p === prof.id);
  const closed = new Set(mine.filter(r => r.r === 1 && (r.ok || daysBetween(r.d, date) < 2)).map(r => r.q));
  const c = mine.filter(r => !r.r && !r.ok && QIDX[r.q] && studied(prof, QIDX[r.q]) && !ids.has(r.q) && !closed.has(r.q))
    .filter(r => { const g = daysBetween(r.d, date); return g >= 2 && g <= 21; })
    .sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.q < b.q ? -1 : 1));
  return c.length ? QIDX[c[0].q] : null;
}

/* ---------- scoring (keep in step with scoreMonth_ in backend/Code.gs) ----------
 * A day counts once its five are done. Until November 2026: 10 points a day, 4 a right answer, 8 a revenge round
 * won, and 15 for every week of the month (Sunday to Saturday) with five such days.
 * From December 2026 (Avsha, 2026-11-14): 5 a day, 5 a right answer, 5 more for a perfect day, 5 a revenge round.
 * Under the old rule a day of random taps earned half a perfect day's points (10 + a quarter of 20, of 30), and one
 * twin got 18 for none right of five and a revenge round; now it earns a third. The revenge round pays what a
 * right answer does: at double, missing a question on purpose and winning it back paid more than knowing it.
 * Practice rounds (r = 2) earn no points: they count for the map and the family goal only.
 * A fix-it lesson (r = 3, from 2026-11-26) earns `lesson` once its three questions are answered, on a day that
 * counts, whatever she got right: it pays for the work. No row of that kind exists before that date, so adding it
 * to both lines changes no closed month. */
const POINTS_BY = [["2026-12", { day: 5, right: 5, perfect: 5, revenge: 5, lesson: 5, week: 15, weekDays: 5 }],
                   ["", { day: 10, right: 4, perfect: 0, revenge: 8, lesson: 5, week: 15, weekDays: 5 }]];
const pointsOf = mk => POINTS_BY.find(x => mk >= x[0])[1];
const POINTS = pointsOf(THIS_MONTH);
const dayPoints = (e, P) => P.day + e.ok * P.right + (e.ok >= 5 ? P.perfect : 0) + e.revOk * P.revenge + ((e.fix | 0) >= FIX.n ? P.lesson : 0);
function stats(pid, y, m) {
  const mk = monthKey(y, m), P = pointsOf(mk), firstDow = new Date(y, m - 1, 1).getDay();
  const rs = rows().filter(r => r.p === pid && r.d.slice(0, 7) === mk);
  const byDay = {}, bySubj = {}, miss = {};
  let pracOk = 0, fixOk = 0;
  rs.forEach(r => {
    const e = byDay[r.d] || (byDay[r.d] = { reg: 0, ok: 0, rev: 0, revOk: 0, prac: 0, fix: 0 });
    if (r.r === 2) { e.prac++; if (r.ok) pracOk++; }
    else if (r.r === 3) { e.fix++; if (r.ok) fixOk++; }
    else if (r.r) { e.rev++; if (r.ok) e.revOk++; } else { e.reg++; if (r.ok) e.ok++; }
    const s = subjOf(r.pool); bySubj[s] = bySubj[s] || [0, 0]; bySubj[s][1]++;
    if (r.ok) bySubj[s][0]++; else miss[r.t] = (miss[r.t] || 0) + 1;
  });
  const days = Object.keys(byDay).sort().filter(d => byDay[d].reg >= 5).map(d => Object.assign({ d }, byDay[d]));
  const weeks = {};
  days.forEach(e => { const w = Math.floor((+e.d.slice(8) - 1 + firstDow) / 7); weeks[w] = (weeks[w] || 0) + 1; });
  const fullWeeks = Object.values(weeks).filter(n => n >= P.weekDays).length;
  const reg = days.reduce((s, e) => s + e.reg, 0), ok = days.reduce((s, e) => s + e.ok, 0), revOk = days.reduce((s, e) => s + e.revOk, 0);
  const perfect = days.filter(e => e.ok >= 5).length, lessons = days.filter(e => e.fix >= FIX.n).length;
  const elapsed = mk === THIS_MONTH ? D : daysIn(y, m);
  return {
    days, byDay, played: days.length, reg, ok, revOk, pracOk, fixOk, perfect, lessons, fullWeeks, bySubj, right: ok + revOk + pracOk + fixOk,
    points: days.length * P.day + ok * P.right + perfect * P.perfect + revOk * P.revenge + lessons * P.lesson + fullWeeks * P.week,
    part: elapsed ? Math.round(days.length / elapsed * 100) : 0,
    acc: reg ? Math.round(ok / reg * 100) : 0,
    weak: Object.entries(miss).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(x => x[0])
  };
}
function ranking(y, m) {
  return everyone().map(p => Object.assign({ id: p.id }, stats(p.id, y, m)))
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

/* ---------- full weeks: the streak and her own path to a token (Avsha, 2026-11-14) ----------
 * A full week is a calendar week, Sunday to Saturday, with five days played (the month's week bonus cuts weeks at
 * the month's ends; these do not). Every fourth full week is a token, in a row or not, so a girl far behind on the
 * month's board still has one to play for; the script grants it (pathTokens_). The streak is the full weeks in a
 * row, and a week still running never breaks it. The Sheet sends the weeks before this one (the phones hold only
 * two months of rows); this week is counted here. */
const PATH = { start: "2026-11-15", every: 4 };
const weekStart = d => addDays(d, -parseYmd(d).getDay());
function playedDays(pid) {
  const n = {};
  rows().forEach(r => { if (r.p === pid && !r.r) n[r.d] = (n[r.d] || 0) + 1; });
  return new Set(Object.keys(n).filter(d => n[d] >= 5));
}
function weeksOf(pid) {
  const played = playedDays(pid), cur = weekStart(TODAY), sv = LIVE && FAM.path && FAM.path[pid];
  const inWeek = w => { let n = 0; for (let i = 0; i < 7; i++) if (played.has(addDays(w, i))) n++; return n; };
  let full = 0, streak = 0;
  if (sv) { full = +sv.full || 0; streak = +sv.streak || 0; }
  else {
    const first = LIVE ? PATH.start : weekStart([...played].sort()[0] || TODAY);
    for (let w = first; w < cur; w = addDays(w, 7)) { if (inWeek(w) >= POINTS.weekDays) { full++; streak++; } else streak = 0; }
  }
  const now = cur >= PATH.start || !LIVE ? inWeek(cur) : 0;
  if (now >= POINTS.weekDays) { full++; streak++; }
  return { full, streak, now, left: PATH.every - full % PATH.every };
}

/* ---------- the sisters' streak (2026-11-26) ----------
 * The board ranks them, and a ranking lifts whoever leads and discourages whoever is last. This is the one count
 * they can only raise together: a week in which every sister has a full week (five days played) is a week of
 * theirs, and the weeks in a row are the streak. Weeks, not days: five days of seven is the app's rule, and a
 * streak of days would break on a rest day and set them blaming each other. Duolingo found that people who share a
 * streak with a friend are 22% likelier to do their day's lesson. The Sheet sends the weeks before this one
 * (state's `sis`); this week is counted here, with each sister's days so far. */
function sisOf() {
  const girls = FAM.profiles;
  if (girls.length < 2) return null;
  const pl = girls.map(p => playedDays(p.id)), cur = weekStart(TODAY), sv = LIVE && FAM.sis;
  const inWeek = (i, w) => { let n = 0; for (let d = 0; d < 7; d++) if (pl[i].has(addDays(w, d))) n++; return n; };
  let full = 0, streak = 0;
  if (sv) { full = +sv.full || 0; streak = +sv.streak || 0; }
  else {
    const first = LIVE ? PATH.start : weekStart(pl.flatMap(x => [...x]).sort()[0] || TODAY);
    for (let w = first; w < cur; w = addDays(w, 7)) { if (girls.every((_, i) => inWeek(i, w) >= POINTS.weekDays)) { full++; streak++; } else streak = 0; }
  }
  const now = girls.map((p, i) => ({ p, n: cur >= PATH.start || !LIVE ? inWeek(i, cur) : 0 })), done = now.every(x => x.n >= POINTS.weekDays);
  if (done) { full++; streak++; }
  return { full, streak, now, done };
}
const sisDots = n => `<span class="sdots" role="img" aria-label="${Math.min(n, 5)} מתוך 5 ימים">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
function sisCard() {
  const x = sisOf();
  if (!x) return "";
  const left = x.now.filter(g => g.n < POINTS.weekDays);
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Sisters' streak</span>
      <span class="streak" style="gap:6px"><span class="flame ${x.streak ? "on" : ""}">${ICON.flame}</span><b class="n num">${x.streak}</b><span class="small muted">${x.streak === 1 ? "שבוע של שלושתכן" : "שבועות של שלושתכן ברצף"}</span></span></div>
    ${x.now.map(g => { const a = AURAS[auraOf(g.p)]; return `<div class="sisrow" style="--a1:${a.c[0]};--a2:${a.c[1]}">${avatar(g.p, "sm")}<b>${esc(g.p.name)}</b>${sisDots(g.n)}<span class="small ${g.n >= 5 ? "good-t" : "muted"} num" dir="ltr">${Math.min(g.n, 5)}/5</span></div>`; }).join("")}
    <p class="small muted">${x.done ? "השבוע הזה כבר של שלושתכן." : `שבוע שבו כל אחת משחקת חמישה ימים מוסיף לרצף. ${left.length === 1 ? `חסרים רק הימים של ${esc(left[0].p.name)}.` : "אף אחת לא יכולה לבד."}`}</p></section>`;
}
/* Her own last week, to beat (the board shows who leads; this shows whether she is ahead of herself). The points of
 * the days played this week so far, against last week up to the same weekday, and against all of last week; the
 * week's bonus is left out of both. */
function daysScore(pid, from, to) {
  const by = {};
  rows().forEach(r => {
    if (r.p !== pid || r.d < from || r.d > to || r.r === 2) return;
    const e = by[r.d] || (by[r.d] = { reg: 0, ok: 0, revOk: 0, fix: 0 });
    if (r.r === 3) e.fix++; else if (r.r) { if (r.ok) e.revOk++; } else { e.reg++; if (r.ok) e.ok++; }
  });
  let pts = 0, days = 0;
  Object.keys(by).forEach(d => { if (by[d].reg >= 5) { pts += dayPoints(by[d], pointsOf(d.slice(0, 7))); days++; } });
  return { pts, days };
}
function versusSelf(pid) {
  const cur = weekStart(TODAY), dow = NOW.getDay();
  return { now: daysScore(pid, cur, TODAY), then: daysScore(pid, addDays(cur, -7), addDays(cur, dow - 7)), last: daysScore(pid, addDays(cur, -7), addDays(cur, -1)) };
}
function selfLine(pid) {
  const v = versusSelf(pid);
  if (!v.last.days) return "";
  const d = v.now.pts - v.then.pts;
  if (v.now.pts > v.last.pts) return `<span class="good-t">כבר עברת את כל השבוע שעבר שלך</span> <span class="muted num" dir="ltr">${v.now.pts} / ${v.last.pts}</span>`;
  if (d > 0) return `<span class="good-t"><bdi dir="ltr">+${d}</bdi> נקודות מול השבוע שעבר שלך, עד אותו יום</span>`;
  return `<span class="muted">השבוע שעבר שלך, עד היום ${DAYS_FULL[NOW.getDay()]}: <b class="num">${v.then.pts}</b> נק׳. השבוע: <b class="num">${v.now.pts}</b>.</span>`;
}
function selfCard() {
  const list = FAM.profiles.map(p => [p, versusSelf(p.id)]).filter(([, v]) => v.last.days || v.now.days);
  if (!list.length) return "";
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Against yourself</span><span class="small muted">השבוע מול השבוע שעבר, עד אותו יום</span></div>
    ${list.map(([p, v]) => { const d = v.now.pts - v.then.pts, a = AURAS[auraOf(p)], top = Math.max(v.now.pts, v.last.pts, 1);
      return `<div class="selfrow" style="--a1:${a.c[0]};--a2:${a.c[1]}"><div class="row"><span class="nm">${dot(p)}<b>${esc(p.name)}</b></span>
          <span class="small num" dir="ltr">${v.now.pts}${d > 0 ? ` <span class="good-t">+${d}</span>` : ""}</span></div>
        <div class="selfbar"><i style="width:${v.now.pts / top * 100}%"></i><u style="inset-inline-start:${v.then.pts / top * 100}%"></u></div></div>`; }).join("")}
    <p class="small faint">הפס הוא הנקודות של השבוע עד היום. הקו הוא איפה שהיית באותו יום בשבוע שעבר: לעבור אותו זה להשתפר מול עצמך, בלי קשר למקום בטבלה.</p></section>`;
}

/* ---------- what she knows: the map (Avsha, 2026-11-14) ----------
 * A topic fills with right answers on three different days, in the five, a revenge round or practice: the goal the
 * app shows beside the points is knowing the material. The Sheet sends the days older than the rows the phone holds. */
const KNOW = 3;
function knowOf(prof) {
  const older = (LIVE && FAM.know && FAM.know[prof.id]) || {}, days = {}, out = {};
  rows().forEach(r => {
    if (r.p !== prof.id || !r.ok) return;
    const k = r.pool + "|" + (QIDX[r.q] ? QIDX[r.q].topic : r.t);
    (days[k] = days[k] || new Set()).add(r.d);
  });
  new Set(Object.keys(older).concat(Object.keys(days))).forEach(k => { out[k] = (+older[k] || 0) + (days[k] ? days[k].size : 0); });
  return out;
}
/* A topic she knows fades (2026-11-26): four weeks with no right answer in it, and its star dims on the map until
 * one right answer, anywhere, lights it again. Coming back to a thing after a gap is one of the two best-supported
 * ways to keep it (the other, being tested on it, is what the app does all day), and the map only ever filled.
 * The phones hold at least four weeks of rows, so a topic with no right answer among them has faded. */
const FADE = { days: 28 };
function knowLast(prof) {
  const last = {};
  rows().forEach(r => { if (r.p !== prof.id || !r.ok) return; const k = r.pool + "|" + (QIDX[r.q] ? QIDX[r.q].topic : r.t); if (!(last[k] >= r.d)) last[k] = r.d; });
  return last;
}
const fadedIn = (know, last, k) => (know[k] || 0) >= KNOW && !(last[k] && daysBetween(last[k], TODAY) <= FADE.days);
function topicsOf(prof, pool) {
  const all = [...new Set((BANKS[pool] || []).map(q => q.topic))], lim = (STUDYING[prof.track] || {})[pool];
  return lim ? lim.filter(t => all.includes(t)) : all;
}
/* Her pools, the one with an exam this week first, each with its topics and how many are known. */
function knowMap(prof) {
  const know = knowOf(prof), last = knowLast(prof), test = activeTest(prof, TODAY), tp = test && poolFor(prof, test.subj);
  const pools = trackPools(prof.track).filter(p => (BANKS[p] || []).length);
  if (tp) pools.sort((a, b) => (b === tp) - (a === tp));
  return pools.map(pool => {
    const topics = topicsOf(prof, pool).map(t => ({ t, n: Math.min(KNOW, know[pool + "|" + t] || 0), fade: fadedIn(know, last, pool + "|" + t) }));
    return { pool, test: pool === tp ? test : null, topics, known: topics.filter(x => x.n >= KNOW && !x.fade).length, fading: topics.filter(x => x.fade).length };
  }).filter(x => x.topics.length);
}

/* ---------- practice: more questions after the five, if she wants (Avsha, 2026-11-14) ----------
 * No points for the board. First what she last got wrong, then what she has seen in topics not yet known (the
 * longest ago first), then new questions of her own share in those topics, then anything seen. Mostly a review, so
 * the pools the daily five draw on last as long; the subject of an exam this week comes first. Two rounds a day. */
// In the week of an exam, up to eight rounds a day: the eldest used all four she was allowed on the day of her
// English exam (24.11.2026: 20 questions, 15 the day before), and the limit exists only to make the pools last.
const PRACTICE = { n: 5, rounds: 2, examRounds: 8, perTopic: 2 };
const canPractice = () => !LIVE || !!SANDBOX || (FAM.api | 0) >= 2;   // an older script would score a practice row as a revenge round
function practiceLeft(pid) {
  const done = rows().filter(r => r.p === pid && r.d === TODAY && r.r === 2).length;
  return Math.max(0, (activeTest(profile(pid), TODAY) ? PRACTICE.examRounds : PRACTICE.rounds) - Math.ceil(done / PRACTICE.n));
}
function practiceSet(prof) {
  const all = rows(), today = new Set(), last = {}, theirs = new Set(), know = knowOf(prof), lastOk = knowLast(prof);
  const faded = q => fadedIn(know, lastOk, q.pool + "|" + q.topic);
  const pools = trackPools(prof.track).filter(p => (BANKS[p] || []).length);
  const sis = new Set(pools.flatMap(p => sharers(prof, p).map(x => x.id)).filter(id => id !== prof.id));
  all.forEach(r => {
    if (r.p === prof.id) { if (r.d === TODAY) today.add(r.q); if (!last[r.q] || r.d >= last[r.q].d) last[r.q] = { d: r.d, ok: r.ok }; }
    else if (sis.has(r.p)) theirs.add(r.q);
  });
  const can = q => q && pools.includes(q.pool) && studied(prof, q) && !today.has(q.id);
  const days = q => know[q.pool + "|" + q.topic] || 0;
  const old = (a, b) => last[a.id].d < last[b.id].d ? -1 : last[a.id].d > last[b.id].d ? 1 : (a.id < b.id ? -1 : 1);
  const seen = Object.keys(last).map(id => QIDX[id]).filter(can);
  const missed = seen.filter(q => !last[q.id].ok).sort(old);
  const learning = seen.filter(q => last[q.id].ok && days(q) < KNOW).sort(old);
  const fresh = shuffle(pools.flatMap(p => shareOf(prof, p)).filter(q => can(q) && !last[q.id] && !theirs.has(q.id) && (days(q) < KNOW || faded(q))),
                        rng(hash("practice|" + prof.id + "|" + TODAY))).sort((a, b) => faded(b) - faded(a) || days(a) - days(b));
  const fading = seen.filter(q => last[q.id].ok && faded(q)).sort(old);
  const known = seen.filter(q => last[q.id].ok && days(q) >= KNOW && !faded(q)).sort(old);
  let list = missed.concat(fading, learning, fresh, known);
  const test = activeTest(prof, TODAY), tp = test && poolFor(prof, test.subj);
  if (tp) list = list.filter(q => q.pool === tp).concat(list.filter(q => q.pool !== tp));
  // An exam with known topics: what she missed in them, then what she has not met (a known topic's too: the exam
  // asks every word), then what she has, the longest ago first. As many of one topic in a round as there are.
  const focus = examTopics(prof, test), inF = q => !!focus && q.pool === tp && focus.includes(q.topic);
  if (focus) {
    const unmet = shuffle(shareOf(prof, tp).filter(q => can(q) && inF(q) && !last[q.id] && !theirs.has(q.id)), rng(hash("exam|" + prof.id + "|" + TODAY)));
    const first = missed.filter(inF).concat(unmet, seen.filter(q => last[q.id].ok && inF(q)).sort(old));
    list = first.concat(list.filter(q => !first.includes(q)));
  }
  const per = {}, out = [];
  for (const q of list) {
    const k = q.pool + "|" + q.topic;
    if (!inF(q) && (per[k] || 0) >= PRACTICE.perTopic) continue;
    per[k] = (per[k] || 0) + 1; out.push(q);
    if (out.length >= PRACTICE.n) break;
  }
  return out;
}

/* ---------- the fix-it lesson (2026-11-26) ----------
 * Their first fifteen days showed the app testing a gap again and again without closing it: one twin had signed
 * numbers wrong 7 times of 12, the other perimeter and area 6 of 10, and each met an explanation only after a miss.
 * A topic is stuck when, over four weeks, her misses in it less half her right answers come to three or more (a
 * miss one, a right answer half off, as the weakest topic's count; every kind of row). The topic most stuck is
 * offered as a lesson, once a day, from the day after: the idea in a few lines (LESSONS, written for the math
 * topics so far), an example worked through, then three questions, the easier first and the one she last missed
 * to close. It is a round like any other (a miss comes back until it is right) and its rows are kind 3: they count
 * for the map and the family goal, and three of them in a day earn `lesson` points. The count reads the days before
 * today, so the offer does not change through the day. A topic she or her twin marked "not learned yet" is left
 * out, as it is for the weakest topic. Needs the script that knows kind 3 (api 6). */
const FIX = { min: 3, days: 28, right: 0.5, n: 3 };
const canFix = () => !LIVE || !!SANDBOX || (FAM.api | 0) >= 6;
function stuckOf(prof, date) {
  date = date || TODAY;
  const by = {}, off = new Set(), mates = new Set(FAM.profiles.filter(x => x.id === prof.id || (prof.pair && x.pair === prof.pair)).map(x => x.id).concat(prof.id));
  rows().forEach(r => {
    if (r.d >= date || daysBetween(r.d, date) > FIX.days) return;
    const q = QIDX[r.q];
    if (!q || !studied(prof, q)) return;
    const k = q.pool + "|" + q.topic;
    if (r.f && mates.has(r.p)) off.add(k);
    if (r.p !== prof.id) return;
    const e = by[k] || (by[k] = { pool: q.pool, topic: q.topic, n: 0, miss: 0, score: 0, last: "" });
    e.n++; e.score += r.ok ? -FIX.right : 1;
    if (!r.ok) { e.miss++; if (r.d > e.last) e.last = r.d; }
  });
  return Object.keys(by).filter(k => by[k].score >= FIX.min && !off.has(k)).map(k => by[k])
    .sort((a, b) => b.score - a.score || (a.last < b.last ? 1 : a.last > b.last ? -1 : (a.topic < b.topic ? -1 : 1)))[0] || null;
}
const fixToday = pid => rows().filter(r => r.p === pid && r.d === TODAY && r.r === 3).length;
/* The lesson on offer today: its topic and questions, or null (none stuck, done already, or too few questions). */
function fixOffer(prof) {
  if (!canFix()) return null;
  const st = stuckOf(prof), done = fixToday(prof.id);
  if (!st || done >= FIX.n) return null;
  const today = new Set(), last = {}, theirs = new Set(), sis = new Set(sharers(prof, st.pool).map(x => x.id).filter(id => id !== prof.id));
  rows().forEach(r => {
    if (r.pool !== st.pool) return;
    if (r.p === prof.id) { if (r.d === TODAY) today.add(r.q); if (!last[r.q] || r.d >= last[r.q].d) last[r.q] = { d: r.d, ok: r.ok }; }
    else if (sis.has(r.p)) theirs.add(r.q);
  });
  const share = shareOf(prof, st.pool), mine = share.filter(q => q.topic === st.topic && studied(prof, q) && !today.has(q.id) && (last[q.id] || !theirs.has(q.id)));
  const need = FIX.n - done;
  // the one she missed last closes the lesson; before it the easiest, a new question before one she has met
  const closer = mine.filter(q => last[q.id] && !last[q.id].ok).sort((a, b) => last[a.id].d < last[b.id].d ? 1 : last[a.id].d > last[b.id].d ? -1 : (a.id < b.id ? -1 : 1))[0] || null;
  const easy = mine.filter(q => q !== closer).sort((a, b) => a.level - b.level || (!!last[a.id] - !!last[b.id]) || (a.id < b.id ? -1 : 1));
  const set = easy.slice(0, closer ? need - 1 : need).concat(closer ? [closer] : []);
  if (set.length < Math.min(2, need)) return null;
  // the worked example: a question she will not be asked (her twin's half of the pool), else one she has got right;
  // the easiest there is, another each day
  const used = new Set(set.map(q => q.id)), inTopic = (BANKS[st.pool] || []).filter(q => q.topic === st.topic && !used.has(q.id));
  const hers = new Set(share.map(q => q.id));
  let ex = inTopic.filter(q => !hers.has(q.id));
  if (!ex.length) ex = inTopic.filter(q => last[q.id] && last[q.id].ok);
  if (!ex.length) ex = inTopic;
  const low = Math.min(...ex.map(q => q.level)), pick = ex.filter(q => q.level === low);
  return { st, set, example: pick.length ? pick[mod(dayIndex(TODAY), pick.length)] : null, idea: (LESSONS[st.pool] || {})[st.topic] || null };
}
/* The idea of a topic, in the words of the questions' own explanations. Add a topic's lines as it shows up stuck;
 * a topic without them gets the worked example alone. */
const LESSONS = {
  "g7-math": {
    "מספרים מכוונים": [
      "חיבור: כשהסימנים שווים, מחברים ושומרים על הסימן. כשהם שונים, מחסרים, והתוצאה מקבלת את הסימן של המספר הרחוק יותר מאפס: {−7 + 12 = 5}, {−12 + 7 = −5}.",
      "חיסור של מספר שלילי הוא חיבור של הנגדי שלו: {6 − (−9) = 6 + 9 = 15}.",
      "כפל וחילוק: סימנים שווים נותנים תוצאה חיובית, סימנים שונים נותנים תוצאה שלילית: {(−4) · (−6) = 24}, {(−36) : 9 = −4}.",
      "כשמתבלבלים, ציר המספרים עוזר: חיבור הוא צעדים ימינה, חיסור צעדים שמאלה."],
    "היקף ושטח": [
      "היקף הוא אורך הדרך מסביב לצורה: מחברים את כל הצלעות. היחידות הן ס״מ.",
      "שטח הוא כמה מקום הצורה תופסת. היחידות הן סמ״ר.",
      "מלבן: אורך כפול רוחב. משולש: בסיס כפול גובה, חלקי 2. מקבילית: צלע כפול הגובה אליה. טרפז: סכום הבסיסים כפול הגובה, חלקי 2.",
      "לפני שעונים, בודקים מה שאלו. במלבן של 9 על 4 ההיקף הוא 26 והשטח 36."],
    "זוויות": [
      "זוויות צמודות יוצרות יחד קו ישר: סכומן {180°}.",
      "זוויות קודקודיות, זו מול זו בנקודת החיתוך, שוות.",
      "סכום הזוויות במשולש הוא {180°}.",
      "בין ישרים מקבילים זוויות מתחלפות שוות, וזוויות חד־צדדיות משלימות זו את זו ל־{180°}."],
    "סדר פעולות חשבון": [
      "קודם מה שבסוגריים.",
      "אחר כך כפל וחילוק, משמאל לימין.",
      "בסוף חיבור וחיסור, משמאל לימין.",
      "{2 + 3 × 4 = 14}, ולא 20: הכפל קודם לחיבור."],
    "אחוזים": [
      "אחוז הוא חלק ממאה: {15%} הם {15/100}.",
      "כמה הם אחוזים ממספר: כופלים. {15%} מ־80 הם {80 · 15/100 = 12}.",
      "כמה אחוזים הם חלק מהשלם: מחלקים את החלק בשלם. 8 מתוך 32 הם {8/32 = 1/4}, כלומר {25%}.",
      "הנחה והתייקרות מחושבות תמיד מהמחיר שלפני השינוי."],
    "משוואות": [
      "משוואה היא מאזניים: מה שעושים לאגף אחד, עושים גם לשני.",
      "מעבירים את איברי ה־{x} לאגף אחד ואת המספרים לאגף השני. איבר שעובר אגף מחליף סימן.",
      "בסוף מחלקים במקדם של {x}, עם הסימן שלו.",
      "בודקים: מציבים את התשובה במשוואה המקורית."],
    "ביטויים אלגבריים": [
      "{2a} פירושו {2 · a}. מספר שלילי מציבים בתוך סוגריים: {2 · (−3)}.",
      "מכנסים רק איברים דומים: איברי {x} עם איברי {x}, מספרים עם מספרים. כל איבר לוקח איתו את הסימן שלפניו.",
      "בפתיחת סוגריים כופלים את מה שבחוץ בכל איבר שבפנים, עם הסימן: {−3(2x − 5) = −6x + 15}."],
    "חוק הפילוג": [
      "כופלים את המספר שמחוץ לסוגריים בכל אחד מהמחוברים: {4 × (10 + 3) = 4 × 10 + 4 × 3}.",
      "כך מחשבים בראש: מפרקים לעשרות ולאחדות. {8 × 14 = 80 + 32 = 112}."],
    "יחס ופרופורציה": [
      "יחס של {3 : 2} מחלק את השלם ל־{3 + 2 = 5} חלקים שווים.",
      "מוצאים כמה שווה חלק אחד, וכופלים במספר החלקים שמבקשים.",
      "במחיר קבוע מוצאים קודם את המחיר של אחד."],
    "בעיות מילוליות": [
      "בוחרים מה יהיה {x}: בדרך כלל מה ששואלים עליו, או הקטן מבין הגדלים.",
      "כותבים את שאר הגדלים בעזרת {x}.",
      "בונים משוואה ממה שנתון, ופותרים.",
      "בסוף חוזרים לשאלה: שאלו על {x}, או על גודל אחר?"],
    "סטטיסטיקה": [
      "ממוצע: סכום הנתונים חלקי מספרם.",
      "חציון: הנתון האמצעי אחרי שממיינים. כשמספר הנתונים זוגי, הממוצע של שני האמצעיים.",
      "שכיח: הנתון שמופיע הכי הרבה פעמים."]
  },
  "g10-math": {
    "משוואות": [
      "במשוואה ריבועית מעבירים הכול לאגף אחד, כך שבאגף השני נשאר 0.",
      "אם אפשר, מפרקים לגורמים: מכפלה שווה 0 כשאחד הגורמים שווה 0. {x(x − 3) = 0} נותן {x = 0} או {x = 3}.",
      "אם לא, נוסחת השורשים: {x = (−b ± √(b² − 4ac)) / 2a}.",
      "לא מחלקים ב־{x}: כך מאבדים את הפתרון {x = 0}.",
      "במשוואה עם שברים כופלים במכנה המשותף, ומינוס שלפני שבר חל על כל המונה שלו."],
    "ישרים מאונכים": [
      "מכפלת השיפועים של שני ישרים מאונכים היא {−1}.",
      "כדי למצוא שיפוע מאונך הופכים את השבר ומחליפים סימן: המאונך ל־{2/3} הוא {−3/2}, והמאונך ל־2 הוא {−1/2}.",
      "ישרים מקבילים, לעומתם, הם בעלי אותו שיפוע."],
    "ישרים מקבילים": [
      "לישרים מקבילים אותו שיפוע, וחיתוך שונה עם ציר ה־{y}.",
      "ישר מקביל דרך נקודה: אותו שיפוע, ומציבים את הנקודה כדי למצוא את {b}."],
    "שיפוע": [
      "שיפוע הוא השינוי ב־{y} חלקי השינוי ב־{x}: {m = (y₂ − y₁) / (x₂ − x₁)}.",
      "שומרים על אותו סדר במונה ובמכנה, ונזהרים במספרים שליליים: {3 − (−1) = 4}.",
      "כשהמשוואה אינה בצורה {y = mx + b}, מבודדים קודם את {y}. השיפוע הוא המקדם של {x}."],
    "משוואת הישר": [
      "{y = mx + b}: {m} הוא השיפוע, ו־{b} נקודת החיתוך עם ציר ה־{y}.",
      "שיפוע ונקודה: מציבים את הנקודה במשוואה ומוצאים את {b}.",
      "שתי נקודות: קודם מחשבים את השיפוע, ואז מציבים אחת מהן.",
      "נקודה נמצאת על הישר אם היא מקיימת את המשוואה שלו."],
    "שטח משולש": [
      "{S = (a · h) / 2}: צלע כפול הגובה אליה, חלקי 2.",
      "במערכת צירים בוחרים צלע שמקבילה לאחד הצירים: אורכה הוא הפרש השיעורים, והגובה אליה הוא המרחק של הקדקוד השלישי ממנה.",
      "במשולש קהה זווית הגובה יוצא אל המשך הצלע, מחוץ למשולש."],
    "מערכות משוואות": [
      "מחפשים זוג מספרים שמקיים את שתי המשוואות.",
      "חיבור או חיסור של המשוואות מבטל נעלם אחד. אפשר גם לבודד נעלם ולהציב אותו במשוואה השנייה.",
      "מוצאים נעלם אחד, מציבים ומוצאים את השני, ובודקים בשתי המשוואות."],
    "מרחק בין נקודות": [
      "{d = √((x₂ − x₁)² + (y₂ − y₁)²)}: ההפרשים הם הניצבים, והמרחק הוא היתר.",
      "נזהרים במספרים שליליים: {2 − (−1) = 3}."],
    "פיתגורס": [
      "במשולש ישר זווית {a² + b² = c²}, ו־{c} הוא היתר: הצלע שמול הזווית הישרה.",
      "מחפשים יתר: מחברים את ריבועי הניצבים ומוציאים שורש.",
      "מחפשים ניצב: מחסרים מריבוע היתר את ריבוע הניצב הידוע, ומוציאים שורש."],
    "נוסחאות הכפל המקוצר": [
      "{(a + b)² = a² + 2ab + b²} ו־{(a − b)² = a² − 2ab + b²}: לא שוכחים את האיבר האמצעי.",
      "{(a + b)(a − b) = a² − b²}.",
      "{(2x)² = 4x²}: מעלים בריבוע גם את המקדם."],
    "שברים אלגבריים": [
      "מצמצמים רק גורמים, לא מחוברים: קודם מפרקים את המונה ואת המכנה לגורמים.",
      "הכלים הם הוצאת גורם משותף והכפל המקוצר: {x² − 9 = (x + 3)(x − 3)}.",
      "{(4 − x) = −(x − 4)}: היפוך הסדר מוסיף מינוס."]
  }
};

/* ---------- after an exam, and over time (2026-11-26) ----------
 * The eldest did 35 extra questions in the two days before her English exam and none in the weeks without one: an
 * exam is what makes practice worth doing, and nothing afterwards said what it gave. An exam that has passed asks
 * for its grade on her home screen (hers to give or not; Dad can enter it too), and Dad's all-time tab sets each
 * grade beside what she did in the exam's subject in the week before it, with every girl's weeks as a chart. The
 * Sheet works these out from all its rows (state's `exams` and `trend`, api 6); the demo and Dad's test profile
 * from the rows the phone holds. */
const canGrade = () => !LIVE || !!SANDBOX || (FAM.api | 0) >= 6;
const hasGrade = t => t.grade !== "" && t.grade != null;
function pastExams() {
  if (LIVE && !SANDBOX) return FAM.exams || [];
  const all = rows();
  return (SANDBOX ? L.sand.tests : L.tests).filter(t => t.date < TODAY).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0).map(t => {
    const lo = addDays(t.date, -7), mine = all.filter(r => r.p === t.p && r.d >= lo && r.d < t.date && subjOf(r.pool) === t.subj);
    return { p: t.p, date: t.date, subj: t.subj, note: t.note || "", grade: t.grade == null ? "" : t.grade, n: mine.length, ok: mine.filter(r => r.ok).length, extra: mine.filter(r => r.r >= 2).length };
  });
}
/* Her exams of the last 30 days with no grade yet, unless she put the question off (for four days). */
const GRADE = { days: 30, later: 4 };
function gradeDue(p) {
  if (!canGrade()) return [];
  const later = L.gradeLater || {};
  return pastExams().filter(t => t.p === p.id && !hasGrade(t) && daysBetween(t.date, TODAY) <= GRADE.days && !(later[luckId(t)] > TODAY));
}
function gradeSheet(pid, date, subj) {
  const t = pastExams().find(x => x.p === pid && x.date === date && x.subj === subj), dad = view === "parent";
  sheet(`<h3>הציון במבחן ב${esc(SUBJ[subj] || subj)}</h3><p class="small muted">${dateHe(date)}${dad ? ` · ${esc(profile(pid).name)}` : ""}. מספר בין 0 ל־100.${dad ? "" : " אבא יראה אותו, ליד מה שתרגלת לפני המבחן."}</p>
    <div class="field"><label for="gval">ציון</label><input id="gval" type="number" inputmode="numeric" min="0" max="100" dir="ltr" value="${t && hasGrade(t) ? +t.grade : ""}"></div>
    <button type="button" class="btn btn-primary wide" data-act="gradeSave" data-p="${esc(pid)}" data-date="${esc(date)}" data-subj="${esc(subj)}">שמירה</button>
    ${t && hasGrade(t) ? `<button type="button" class="link" style="align-self:center" data-act="gradeSave" data-clear="1" data-p="${esc(pid)}" data-date="${esc(date)}" data-subj="${esc(subj)}">למחוק את הציון</button>` : ""}`);
}
/* Each girl's weeks, the oldest first: { w (its Sunday), n and ok (the daily questions), days, extra }. */
function trendOf(pid) {
  if (LIVE && !SANDBOX && FAM.trend) return FAM.trend[pid] || [];
  const by = {};
  rows().forEach(r => {
    if (r.p !== pid) return;
    const w = weekStart(r.d), e = by[w] || (by[w] = { w, n: 0, ok: 0, extra: 0, day: {} });
    if (r.r >= 2) { e.extra++; return; }
    if (r.r) return;
    e.n++; if (r.ok) e.ok++; e.day[r.d] = (e.day[r.d] || 0) + 1;
  });
  return Object.keys(by).sort().map(w => ({ w, n: by[w].n, ok: by[w].ok, days: Object.values(by[w].day).filter(n => n >= 5).length, extra: by[w].extra }));
}
/* The weeks as a chart: one line a girl, in her colour, her share of right answers week by week (a week with fewer
 * than five answers leaves a gap). The last twelve weeks. */
function trendChart(profs) {
  const data = profs.map(p => [p, trendOf(p.id)]), weeks = [...new Set(data.flatMap(([, t]) => t.map(x => x.w)))].sort().slice(-12);
  if (!weeks.length) return `<p class="small muted">עוד אין מספיק ימים בשביל מגמה.</p>`;
  const W = 320, H = 150, L0 = 30, R0 = 10, T0p = 10, B0 = 24, lo = 40, hi = 100;
  const x = i => weeks.length === 1 ? (L0 + W - R0) / 2 : L0 + 12 + (W - L0 - R0 - 12) * i / (weeks.length - 1);
  const y = v => T0p + (H - T0p - B0) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo));
  const grid = [60, 80, 100].map(v => `<line x1="${L0}" x2="${W - R0}" y1="${y(v)}" y2="${y(v)}" class="tg"/><text x="${L0 - 5}" y="${y(v) + 3.5}" text-anchor="end" class="tt">${v}%</text>`).join("");
  const lab = [...new Set([0, Math.floor((weeks.length - 1) / 2), weeks.length - 1])].map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="tt">${+weeks[i].slice(8)}.${+weeks[i].slice(5, 7)}</text>`).join("");
  const lines = data.map(([p, t], gi) => {
    const c = AURAS[auraOf(p)].c[0], dash = trendDash(profs, gi), pts = weeks.map((w, i) => { const e = t.find(z => z.w === w); return e && e.n >= 5 ? [x(i), y(e.ok / e.n * 100)] : null; });
    let d = "", pen = false;
    pts.forEach(pt => { if (!pt) { pen = false; return; } d += `${pen ? "L" : "M"}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`; pen = true; });
    const last = pts.filter(Boolean).pop();
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>${pts.filter(Boolean).map(pt => `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="${pt === last ? 4 : 2.8}" fill="${c}"${pt === last ? ' stroke="#fff" stroke-width="1.2"' : ""}/>`).join("")}`;
  }).join("");
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="דיוק לפי שבוע" dir="ltr">${grid}${lab}${lines}</svg>`;
}
/* Two girls in the same colours: the later one's line is dashed, the third's dotted, and the legend shows which. */
const trendDash = (profs, i) => ["", "7 5", "2 5"][profs.slice(0, i).filter(q => auraOf(q) === auraOf(profs[i])).length] || "";
const trendKey = profs => profs.map((p, i) => `<span class="nm"><svg width="26" height="8" viewBox="0 0 26 8" aria-hidden="true"><path d="M2 4H24" stroke="${AURAS[auraOf(p)].c[0]}" stroke-width="2.6" stroke-linecap="round"${trendDash(profs, i) ? ` stroke-dasharray="${trendDash(profs, i)}"` : ""}/></svg>${esc(p.name)}</span>`).join("");
const weekHe = w => `${+w.slice(8)}.${+w.slice(5, 7)}`;
/* One girl over time: her weeks as a table, and her exams with the week before each and its grade. */
function overTime(p, dad) {
  const t = trendOf(p.id).slice(-8).reverse(), ex = pastExams().filter(e => e.p === p.id).slice(0, 8);
  const wk = t.map(e => `<tr><td class="num">${weekHe(e.w)}</td><td class="num">${e.days}</td><td class="num" dir="ltr" style="text-align:end">${e.n ? Math.round(e.ok / e.n * 100) + "%" : "—"}</td><td class="num">${e.extra || "—"}</td></tr>`);
  const er = ex.map(e => `<tr><td class="num"><b>${+e.date.slice(8)}.${+e.date.slice(5, 7)}</b><br><span class="small">${esc(SUBJ[e.subj] || e.subj)}</span></td>
    <td style="white-space:normal" class="small">${e.n ? `${e.n} שאלות במקצוע, ${e.ok} נכונות${e.extra ? `<br><span class="muted">מהן ${e.extra} בתרגול ובחיזוק</span>` : ""}` : `<span class="faint">בלי שאלות במקצוע</span>`}</td>
    <td>${hasGrade(e) ? `<b class="big num">${+e.grade}</b>` : `<span class="faint">—</span>`}${canGrade() ? `<br><button type="button" class="link" style="min-height:0;font-size:13px" data-act="gradeOpen" data-p="${esc(e.p)}" data-date="${esc(e.date)}" data-subj="${esc(e.subj)}">${hasGrade(e) ? "לתקן" : "להזין"}</button>` : ""}</td></tr>`);
  return `${wk.length ? table(["שבוע מ־", "ימים", "דיוק", "תרגול וחיזוק"], wk) : `<p class="small muted">עוד אין שבועות.</p>`}
    ${er.length ? `<span class="eyebrow" style="margin-top:6px">Exams</span>${table(["מבחן", "בשבוע שלפניו", "ציון"], er)}` : dad ? `<p class="small faint">כשמבחן שברשימה עובר, הוא מופיע כאן עם מה שהיא עשתה בשבוע שלפניו ועם הציון.</p>` : ""}`;
}

/* ---------- how fast she answers (Avsha, 2026-11-14) ----------
 * Each first answer is timed, and nothing on her screen shows a clock. A day with three of the five answered in
 * under three seconds each is marked as rushed for Dad: a question and four options are not read in that time. */
const RUSH = { secs: 3, n: 3 };
const fastOnes = rs => rs.filter(r => +r.s > 0 && +r.s < RUSH.secs).length;
const median = a => { const x = a.slice().sort((p, q) => p - q), n = x.length; return n ? (n % 2 ? x[(n - 1) / 2] : (x[n / 2 - 1] + x[n / 2]) / 2) : 0; };

/* ---------- example history for the demo (marked as such on screen) ---------- */
function makeExample() {
  const [py, pm] = prevMonth(Y, M), out = [];
  const EX = { portfolio: [0.8, 0.84], routine: [0.64, 0.8], stage: [0.86, 0.74] };
  FAM.profiles.forEach(prof => {
    const [p, acc] = EX[prof.flavor] || [0.75, 0.8];
    for (let d = ymd(new Date(py, pm - 1, 1)); d < TODAY; d = addDays(d, 1)) {
      const r = rng(hash("example|" + prof.id + "|" + d));
      if (r() > p || L.rows.some(x => x.p === prof.id && x.d === d)) continue;
      dailySet(prof, d, L.rows.concat(out)).forEach(q => out.push({ d, p: prof.id, q: q.id, pool: q.pool, t: q.topic, l: q.level, ok: r() < acc ? 1 : 0, r: 0, s: Math.round(60 + r() * 240) / 10 }));
    }
  });
  return out;
}

/* ---------- the Sheet (live mode) ---------- */
const API_WAIT = 40000;   // a request with no answer by then has failed: on a weak signal a fetch can hang for minutes
async function api(action, body) {
  const url = String(CFG.apiUrl).trim(), ac = window.AbortController ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), API_WAIT) : 0, sig = ac ? { signal: ac.signal } : {};
  let r;
  try {
    if (action === "state" || action === "photos") r = await fetch(`${url}?action=${action}&code=${encodeURIComponent(L.code)}`, Object.assign({ redirect: "follow" }, sig));
    else r = await fetch(url, Object.assign({ method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
                                body: JSON.stringify(Object.assign({ action, code: L.code }, body || {})) }, sig));
  } finally { clearTimeout(timer); }
  if (!r.ok) throw new Error("http " + r.status);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "refused");
  return j;
}
/* An answer of the Sheet's that was asked for before her rows were sent can arrive after them (the opening asks in
 * the background, and the script of before 2026-11-26 took 20 seconds): it would put back a day without her
 * answers, the home screen would offer the day again, and the copy kept for the next opening would lack them.
 * So the batches sent are kept (L.sent) until an answer that was asked for after them has come. */
async function refresh() {
  const asked = Date.now();
  const s = await api("state");
  L.sent = (L.sent || []).filter(b => b.at > asked);
  FAM = { profiles: s.profiles || [], settings: s.settings || {}, tokens: s.tokens || {}, rows: s.rows || [], tests: s.tests || [],
          lifetime: s.lifetime || null, tokenLog: s.tokenLog || [], api: s.api | 0, path: s.path || null, know: s.know || null,
          exams: s.exams || null, trend: s.trend || null, sis: s.sis || null };
  L.cache = FAM; save();
}
async function flush() {
  while (L.outbox.length) {
    // The rows stay in what the phone holds once the Sheet has them. They used to leave the outbox here and come
    // back only with the next reading of the Sheet, a second or three later: in between the day looked unplayed,
    // and its home screen, drawn then, kept the start button (one twin played 22.11 twice, for a second revenge round).
    try { const b = L.outbox[0]; await api("submit", b); if (FAM && FAM.rows) FAM.rows = FAM.rows.concat(b.rows); L.sent = (L.sent || []).concat({ at: Date.now(), rows: b.rows }); L.outbox.shift(); save(); } catch (e) { return false; }
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
/* ---------- motion (Avsha, 2026-11-14: "the girls react well to animations and interesting graphics") ----------
 * One canvas over the page (#fx) carries the short effects: sparks, a ring off a right answer, motes that fly from
 * the answer to its place on the round's bar, a comet at a streak of three and five. They stop drawing when done. */
const FX = { parts: [], acts: [], on: false };
function fxRun() {
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
    ctx.globalAlpha = 1;
    const now = performance.now();
    FX.acts = FX.acts.filter(a => a(ctx, now));
    ctx.globalAlpha = 1;
    if (FX.parts.length || FX.acts.length) requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); FX.on = false; }
  })();
}
function sparks(x, y, colors, n, power) {
  if (REDUCED) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * power;
    FX.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.35, life: 1, decay: 0.012 + Math.random() * 0.02,
                    s: 1.5 + Math.random() * 3, c: colors[i % colors.length], sq: Math.random() < 0.4, rot: Math.random() * 6 });
  }
  fxRun();
}
function ring(x, y, color, size) {
  if (REDUCED) return;
  const t0 = performance.now();
  FX.acts.push((ctx, now) => {
    const k = (now - t0) / 560; if (k >= 1) return false;
    const e = 1 - Math.pow(1 - k, 3);
    ctx.globalAlpha = (1 - k) * 0.85; ctx.strokeStyle = color; ctx.lineWidth = 3 * (1 - k) + 0.6;
    ctx.beginPath(); ctx.arc(x, y, 14 + e * (size || 110), 0, 7); ctx.stroke();
    return true;
  });
  fxRun();
}
/* Motes with short tails, from (x0, y0) along an arc to (x1, y1). */
function streamTo(x0, y0, x1, y1, colors, n) {
  if (REDUCED) return;
  const t0 = performance.now();
  const motes = Array.from({ length: n }, (_, i) => ({ d: i * 26 + Math.random() * 50, bx: (Math.random() - 0.5) * 240, by: -30 - Math.random() * 110,
                                                       c: colors[i % colors.length], s: 1.8 + Math.random() * 2.2 }));
  FX.acts.push((ctx, now) => {
    let alive = false;
    for (const m of motes) {
      const k = (now - t0 - m.d) / 640;
      if (k >= 1) continue;
      alive = true;
      if (k < 0) continue;
      const mx = (x0 + x1) / 2 + m.bx, my = Math.min(y0, y1) + m.by;
      for (let j = 0; j < 7; j++) {
        const u = Math.max(0, k - j * 0.03), e = u * u * (3 - 2 * u), v = 1 - e;
        ctx.globalAlpha = (1 - j / 7) * 0.9; ctx.fillStyle = m.c;
        ctx.beginPath(); ctx.arc(v * v * x0 + 2 * v * e * mx + e * e * x1, v * v * y0 + 2 * v * e * my + e * e * y1, m.s * (1 - j / 9), 0, 7); ctx.fill();
      }
    }
    return alive;
  });
  fxRun();
}
function comet(colors) {
  if (REDUCED) return;
  const t0 = performance.now(), y = innerHeight * (0.13 + Math.random() * 0.08), W = innerWidth;
  FX.acts.push((ctx, now) => {
    const k = (now - t0) / 800; if (k >= 1) return false;
    const x = -60 + (W + 300) * (k * k * (3 - 2 * k)), g = ctx.createLinearGradient(x - 240, 0, x, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.75, colors[1]); g.addColorStop(1, "#ffffff");
    ctx.globalAlpha = Math.sin(k * Math.PI); ctx.strokeStyle = g; ctx.lineWidth = 3.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 240, y + 34 * (1 - k)); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
    return true;
  });
  fxRun();
}

/* The living aura: her three colours as slow smoke, drawn by a small shader on a canvas behind everything. It is
 * the round's mood: it brightens and quickens as right answers follow each other, a ring runs through it from each
 * one, a miss drains it grey for a moment, and a perfect day turns it gold. Drawn about 120 px across and stretched
 * (smoke has no detail to lose), every second frame, and not at all while the page is hidden: light enough for the
 * oldest of the three phones. Without WebGL, or with reduced motion, the three drifting discs stay as they were. */
const AURA_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R; uniform float T, E, D, G, K; uniform vec3 A, B, C; uniform vec3 P[3];
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * R) / min(R.x, R.y);
  vec2 q = vec2(fbm(p * 1.25 + vec2(0., T)), fbm(p * 1.25 + vec2(5.2, -T * .8)));
  vec2 r = vec2(fbm(p * 1.5 + 2.4 * q + vec2(1.7, 9.2) + .6 * T), fbm(p * 1.5 + 2.4 * q + vec2(8.3, 2.8) - .5 * T));
  float f = fbm(p * 1.1 + 2.2 * r);
  vec3 col = mix(A, B, smoothstep(.3, .68, f));
  col = mix(col, C, smoothstep(.45, .95, length(q)) * .75);
  col = mix(col, vec3(.95, .77, .42), G * smoothstep(.35, .8, r.x));
  // wisps of light on near black: the first version sat between 0.1 and 0.4 everywhere and read as one flat colour
  float l = smoothstep(.1, .6, 1.5 * f * f * f + f * r.y);
  float lum = (.05 + .8 * l) * (.6 + .6 * E) * (1. - .45 * K);
  lum *= 1. - .28 * dot(p, p);
  for (int i = 0; i < 3; i++) {
    float age = P[i].z;
    if (age >= 0.) { float d = distance(p, P[i].xy), w = (d - age * 1.5) * 5.5; float ringv = exp(-w * w) * exp(-age * 2.4); lum += ringv * .8; col = mix(col, vec3(1.), ringv * .3); }
  }
  col *= lum;
  float g = dot(col, vec3(.3, .59, .11));
  col = mix(col, vec3(g) * .55, D);
  gl_FragColor = vec4(col + vec3(.035, .035, .058), 1.);
}`;
const hex3 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const GLA = { gl: null, e: 0.3, eTo: 0.3, dim: 0, gold: 0, calm: 0, calmTo: 0, pulses: [], col: null, colTo: null, phase: Math.random() * 40 };
/* energy 0-1 (how alive), calm 0-1 (dimmer, under text to read), dim and gold: a moment that fades by itself */
function auraMood(m) {
  if (m.energy != null) GLA.eTo = m.energy;
  if (m.calm != null) GLA.calmTo = m.calm;
  if (m.dim != null) GLA.dim = m.dim;
  if (m.gold != null) GLA.gold = m.gold;
}
function auraPulse(x, y) { GLA.pulses.push({ x, y, t: performance.now() }); if (GLA.pulses.length > 3) GLA.pulses.shift(); }
function auraStart() {
  if (REDUCED || GLA.gl) return;
  const cv = document.createElement("canvas");
  cv.id = "auragl"; cv.setAttribute("aria-hidden", "true");
  let gl = null;
  try { gl = cv.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" }); } catch (e) { gl = null; }
  if (!gl) return;
  const shader = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : null; };
  const vs = shader(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"), fs = shader(gl.FRAGMENT_SHADER, AURA_FS);
  if (!vs || !fs) return;
  const pr = gl.createProgram();
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ["R", "T", "E", "D", "G", "K", "A", "B", "C"].forEach(n => { U[n] = gl.getUniformLocation(pr, n); });
  U.P = gl.getUniformLocation(pr, "P[0]");
  let across = 120, seen = 0, spent = 0;
  const fit = () => { const k = across / Math.min(innerWidth, innerHeight); cv.width = Math.max(48, Math.round(innerWidth * k)); cv.height = Math.max(48, Math.round(innerHeight * k)); gl.viewport(0, 0, cv.width, cv.height); };
  fit(); window.addEventListener("resize", fit);
  document.body.insertBefore(cv, document.body.firstChild);
  document.documentElement.classList.add("gl");
  cv.addEventListener("webglcontextlost", () => { GLA.gl = null; cv.remove(); document.documentElement.classList.remove("gl"); });
  GLA.gl = gl;
  let last = performance.now(), odd = false;
  const P = new Float32Array(9);
  (function frame(now) {
    if (!GLA.gl) return;
    requestAnimationFrame(frame);
    odd = !odd;
    if (document.hidden || odd) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // A phone that cannot keep up (under 20 frames a second over its first 60) gets a smaller picture, and if that
    // is still too much, the drifting discs it had before.
    if (seen >= 0 && dt < 0.1 && ++seen && (spent += dt) && seen === 60) {
      if (spent / 60 <= 0.05) seen = -1;
      else if (across > 80) { across = 72; fit(); seen = 0; spent = 0; }
      else { GLA.gl = null; cv.remove(); document.documentElement.classList.remove("gl"); return; }
    }
    GLA.e += (GLA.eTo - GLA.e) * Math.min(1, dt * 2.5); GLA.calm += (GLA.calmTo - GLA.calm) * Math.min(1, dt * 3);
    GLA.dim = Math.max(0, GLA.dim - dt * 1.1); GLA.gold = Math.max(0, GLA.gold - dt * 0.12);
    GLA.phase += dt * (0.05 + 0.13 * GLA.e);
    if (GLA.colTo) GLA.col = GLA.col ? GLA.col.map((c, i) => c.map((v, j) => v + (GLA.colTo[i][j] - v) * Math.min(1, dt * 2))) : GLA.colTo;
    const m = Math.min(innerWidth, innerHeight);
    for (let i = 0; i < 3; i++) {
      const pu = GLA.pulses[i], age = pu ? (now - pu.t) / 1000 : -1;
      P[i * 3] = pu ? (pu.x - innerWidth / 2) / m : 0; P[i * 3 + 1] = pu ? (innerHeight / 2 - pu.y) / m : 0; P[i * 3 + 2] = age > 2.5 ? -1 : age;
    }
    const c = GLA.col || [[.66, .33, .97], [.93, .28, .6], [.39, .4, .95]];
    gl.uniform2f(U.R, cv.width, cv.height); gl.uniform1f(U.T, GLA.phase);
    gl.uniform1f(U.E, GLA.e); gl.uniform1f(U.D, GLA.dim); gl.uniform1f(U.G, Math.min(1, GLA.gold)); gl.uniform1f(U.K, GLA.calm);
    gl.uniform3fv(U.A, c[0]); gl.uniform3fv(U.B, c[1]); gl.uniform3fv(U.C, c[2]); gl.uniform3fv(U.P, P);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  })(last);
}
function speak(text) {
  try { const u = new SpeechSynthesisUtterance(plain(text).replace(/_{2,}/g, "blank")); u.lang = "en-US"; u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* no voice */ }
}

/* ---------- a generative piece a day, for the portfolio ---------- */
/* Her artwork of the day: the same seed gives the same piece. artPlan lays it out, artDraw paints it with the first
 * k shapes arrived (each grows into place) and, with a time, breathing a little. On the result screen it assembles
 * shape by shape and then stays alive; the month's small tiles are the finished piece, still. */
function artPlan(seed, pal, score, W, H) {
  const r = rng(hash(seed)), u = Math.min(W, H), plan = { gx: W * r(), gy: H * r(), shapes: [], gold: null };
  for (let i = 0, n = 3 + score * 2; i < n; i++) {
    const c = pal[Math.floor(r() * pal.length)], kind = Math.floor(r() * 4), al = 0.45 + r() * 0.45, x = W * r(), y = H * r(), rot = r() * Math.PI;
    const sh = { c, kind, al, x, y, rot };
    if (kind === 0) sh.rad = u * (0.06 + r() * 0.22);
    else if (kind === 1) { sh.lw = u * (0.02 + r() * 0.05); sh.rad = u * (0.15 + r() * 0.3); sh.sweep = Math.PI * (0.4 + r()); }
    else if (kind === 2) sh.w = u * (0.1 + r() * 0.4);
    plan.shapes.push(sh);
  }
  if (score >= 5) plan.gold = { x: W * (0.25 + r() * 0.5), y: H * (0.25 + r() * 0.5) };
  return plan;
}
const easeOut = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
function artDraw(ctx, plan, pal, W, H, k, t) {
  const u = Math.min(W, H);
  ctx.globalAlpha = 1; ctx.fillStyle = "#0E0E16"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(plan.gx, plan.gy, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
  g.addColorStop(0, pal[0] + "66"); g.addColorStop(1, "#0E0E1600");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  plan.shapes.forEach((sh, i) => {
    const e = easeOut(k - i);
    if (e <= 0) return;
    const dx = t ? Math.sin(t * 0.5 + i * 1.7) * u * 0.012 : 0, dy = t ? Math.cos(t * 0.4 + i * 2.3) * u * 0.012 : 0, dr = t ? Math.sin(t * 0.3 + i) * 0.03 : 0;
    ctx.globalAlpha = sh.al * e; ctx.fillStyle = sh.c; ctx.strokeStyle = sh.c;
    ctx.save(); ctx.translate(sh.x + dx, sh.y + dy + (1 - e) * u * 0.08); ctx.rotate(sh.rot + dr + (1 - e) * 0.6);
    if (sh.kind === 0) { ctx.beginPath(); ctx.arc(0, 0, sh.rad * (0.2 + 0.8 * e), 0, 7); ctx.fill(); }
    else if (sh.kind === 1) { ctx.lineWidth = sh.lw; ctx.beginPath(); ctx.arc(0, 0, sh.rad, 0, sh.sweep * e); ctx.stroke(); }
    else if (sh.kind === 2) ctx.fillRect(-sh.w / 2 * e, -sh.w / 6, sh.w * e, sh.w / 3);
    else {
      ctx.lineWidth = Math.max(1, u * 0.008);
      for (let j = 0; j < 6; j++) { const le = easeOut((k - i) * 1.7 - j * 0.12); ctx.beginPath(); ctx.moveTo(-u * 0.3, j * u * 0.03); ctx.lineTo(-u * 0.3 + u * 0.6 * le, j * u * 0.03); ctx.stroke(); }
    }
    ctx.restore();
  });
  const ge = plan.gold ? easeOut((k - plan.shapes.length) * 0.8) : 0;
  if (ge > 0) {
    ctx.globalAlpha = 0.95; ctx.strokeStyle = "#F2C56B"; ctx.lineWidth = Math.max(1.5, u * 0.012);
    ctx.beginPath(); ctx.arc(plan.gold.x, plan.gold.y, u * 0.12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ge); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawArt(cv, seed, pal, score) {
  artDraw(cv.getContext("2d"), artPlan(seed, pal, score, cv.width, cv.height), pal, cv.width, cv.height, 99, 0);
}
/* A canvas that draws while it is on the page, at most `fps` times a second. draw(seconds since it began). */
function animate(cv, draw, fps) {
  if (REDUCED) { draw(60); return; }
  const t0 = performance.now(), gap = 1000 / (fps || 60);
  let last = 0;
  (function frame(now) {
    if (!cv.isConnected) return;
    requestAnimationFrame(frame);
    if (document.hidden || now - last < gap - 4) return;
    last = now; draw((now - t0) / 1000);
  })(t0);
}
function liveArt(cv, seed, pal, score) {
  const ctx = cv.getContext("2d"), plan = artPlan(seed, pal, score, cv.width, cv.height), n = plan.shapes.length + 2;
  animate(cv, t => artDraw(ctx, plan, pal, cv.width, cv.height, t >= 50 ? 99 : Math.max(0, t - 0.6) * (n / 2.6), t >= 50 ? 0 : t), 30);
}
function paintArt(root) {
  $$("canvas[data-art]", root).forEach(cv => {
    const [seed, aura, score] = cv.dataset.art.split("~"), pal = AURAS[aura] ? AURAS[aura].c : AURAS.orchid.c;
    if (cv.closest(".piece")) liveArt(cv, seed, pal, +score); else drawArt(cv, seed, pal, +score);
  });
  $$("canvas.appar", root).forEach(liveAppar);
  $$("canvas.stagecv", root).forEach(liveStage);
  $$("canvas.sky", root).forEach(liveSky);
  $$("canvas.luckcv", root).forEach(liveLuck);
  $$("[data-count]", root).forEach((el, i) => countUp(el, +el.dataset.count, el.dataset.dec == null ? 2 : +el.dataset.dec, 500 + i * 450));
}
function countUp(el, to, dec, delay) {
  if (REDUCED) { el.textContent = to.toFixed(dec); return; }
  el.textContent = (0).toFixed(dec);
  setTimeout(() => {
    const t0 = performance.now();
    (function step(now) { const k = Math.min(1, (now - t0) / 800); el.textContent = (to * easeOut(k)).toFixed(dec); if (k < 1 && el.isConnected) requestAnimationFrame(step); })(t0);
  }, delay);
}
const sized = cv => { const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight, ctx = cv.getContext("2d");
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = "round"; ctx.lineJoin = "round"; return { ctx, W, H }; };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
/* The gymnast's result: the day's apparatus, performed in her colours as long as the screen is open. Rope, hoop,
 * ball, clubs, ribbon (APPARATUS); how wide it moves follows her execution score, and a perfect day is in gold. */
function liveAppar(cv) {
  const { ctx, W, H } = sized(cv), kind = +cv.dataset.appar, amp = 0.55 + 0.45 * Math.min(1, (+cv.dataset.e || 0) / 10), gold = cv.dataset.gold === "1";
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, gold ? "#F2C56B" : cssVar("--a1")); grad.addColorStop(0.5, cssVar("--a2")); grad.addColorStop(1, gold ? "#FFE9B0" : cssVar("--a3"));
  const ghosts = (n, step, fn) => { for (let g = n; g >= 0; g--) { ctx.globalAlpha = g ? 0.5 * Math.pow(1 - g / (n + 1), 2) : 1; fn(g * step, g); } ctx.globalAlpha = 1; };
  animate(cv, t => {
    ctx.clearRect(0, 0, W, H); ctx.strokeStyle = grad; ctx.fillStyle = grad;
    if (kind === 4) {            // ribbon: the stick's tip draws loops, and a band follows it, turning over as it goes
      const mid = x => [W / 2 + Math.cos(x * 1.7) * W * 0.34 * amp + Math.cos(x * 3.9) * W * 0.06, H / 2 + Math.sin(x * 2.5) * H * 0.3 * amp + Math.sin(x * 4.7) * H * 0.1];
      let prev = null;
      for (let i = 0, N = 70; i < N; i++) {
        const x = t - i * 0.02, a = mid(x), b = mid(x - 0.02), ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
        const sway = Math.sin(i * 0.28 - t * 7) * Math.min(11, i * 0.5), half = 1 + 7.5 * Math.abs(Math.cos(i * 0.16 - t * 2.4));
        const c = [a[0] + Math.cos(ang) * sway, a[1] + Math.sin(ang) * sway], e = [[c[0] + Math.cos(ang) * half, c[1] + Math.sin(ang) * half], [c[0] - Math.cos(ang) * half, c[1] - Math.sin(ang) * half]];
        if (prev) { ctx.globalAlpha = 0.92 * Math.pow(1 - i / N, 1.2); ctx.beginPath(); ctx.moveTo(prev[0][0], prev[0][1]); ctx.lineTo(e[0][0], e[0][1]); ctx.lineTo(e[1][0], e[1][1]); ctx.lineTo(prev[1][0], prev[1][1]); ctx.fill(); }
        prev = e;
      }
      ctx.globalAlpha = 1; const tip = mid(t), hand = mid(t + 0.09);
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0] + (hand[0] - tip[0]) * 1.6, tip[1] + (hand[1] - tip[1]) * 1.6 + 10); ctx.stroke(); ctx.strokeStyle = grad;
    } else if (kind === 1) {     // hoop: tossed and spinning
      ghosts(6, 0.04, (back, g) => {
        const x = t - back, cx = W / 2 + Math.sin(x * 0.9) * W * 0.3, cy = H * 0.62 - Math.abs(Math.sin(x * 1.6)) * H * 0.24 * amp, R = H * 0.34;
        ctx.lineWidth = g ? 1.8 : 4.2; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1.5, R * Math.abs(Math.cos(x * 3.4))), R, Math.sin(x * 1.3) * 0.5, 0, 7); ctx.stroke();
      });
    } else if (kind === 2) {     // ball: thrown from hand to hand in high arcs, turning, with the path it took behind it
      const pos = x => { const u = x * 0.62, ph = u - Math.floor(u), dir = Math.floor(u) % 2 ? -1 : 1; return [W / 2 + dir * (ph - 0.5) * W * 0.62, H - 30 - Math.sin(ph * Math.PI) * (H - 62) * amp]; };
      const r = H * 0.14, c = pos(t);
      ctx.lineWidth = 2;
      for (let i = 1; i < 26; i++) { const a = pos(t - i * 0.022), b = pos(t - (i + 1) * 0.022); if (Math.abs(a[0] - b[0]) > 40) continue; ctx.globalAlpha = 0.5 * (1 - i / 26); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.clip();        // a band round it, so the turning shows
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(c[0], c[1], r, Math.max(0.5, r * Math.abs(Math.sin(t * 3.1))), t * 1.4, 0, 7); ctx.stroke();
      const hl = ctx.createRadialGradient(c[0] - r * 0.35, c[1] - r * 0.4, 0, c[0], c[1], r); hl.addColorStop(0, "rgba(255,255,255,.55)"); hl.addColorStop(0.5, "rgba(255,255,255,0)");
      ctx.fillStyle = hl; ctx.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); ctx.restore(); ctx.strokeStyle = grad; ctx.fillStyle = grad;
    } else if (kind === 3) {     // clubs: two, turning in opposite hands, tossed in turn
      [-1, 1].forEach(side => ghosts(6, 0.022, (back, g) => {
        const x = t - back, cx = W / 2 + side * W * 0.2 + Math.sin(x * 1.1) * 12, cy = H * 0.56 - Math.pow(Math.abs(Math.sin(x * 1.5 + (side > 0 ? 1.57 : 0))), 2) * H * 0.26 * amp;
        const a = x * 7.5 * side, L = H * 0.3, ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L, sx = cx - Math.cos(a) * L * 0.45, sy = cy - Math.sin(a) * L * 0.45;
        ctx.lineWidth = g ? 2 : 3.2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, g ? 4 : 6.5, 0, 7); ctx.fill();
        if (!g) { ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, 7); ctx.fill(); }
      }));
    } else {                     // rope: turning between two hands, thick as it comes to the front
      const x0 = W * 0.2, x1 = W * 0.8, y0 = H * 0.42;
      ghosts(7, 0.028, (back, g) => {
        const ph = (t - back) * 6.2, depth = (Math.sin(ph) + 1) / 2, sag = Math.cos(ph) * H * 0.5 * amp;
        ctx.lineWidth = (g ? 1.2 : 1.6) + 2.6 * depth; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(W / 2, y0 + sag * 2, x1, y0); ctx.stroke();
      });
      [x0, x1].forEach(x => { ctx.beginPath(); ctx.arc(x, y0, 4.5, 0, 7); ctx.fill(); });
    }
    if (gold) for (let i = 0; i < 9; i++) {   // a perfect routine glitters
      const a = Math.max(0, Math.sin(t * 2.2 + i * 2.1)), x = W * (0.08 + 0.84 * ((i * 0.618) % 1)), y = H * (0.12 + 0.76 * ((i * 0.383 + 0.2) % 1));
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = "#FFE9B0"; ctx.beginPath(); ctx.arc(x, y, 1.2 + a * 1.6, 0, 7); ctx.fill(); ctx.fillStyle = grad; ctx.globalAlpha = 1;
    }
  }, 60);
}
/* The stage: spotlights sweeping in her colours, the sound in bars (as many lit as she got right), the crowd's
 * lights below, and fireworks over an encore. */
function liveStage(cv) {
  const { ctx, W, H } = sized(cv), lit = +cv.dataset.lit || 6, tier = +cv.dataset.tier || 0, cols = [cssVar("--a1"), cssVar("--a2"), cssVar("--a3")];
  const N = 26, bw = W / N, crowd = 14 + tier * 10, r = rng(hash("stage" + TODAY));
  const dots = Array.from({ length: crowd }, () => ({ x: r(), y: r(), p: r() * 6 }));
  animate(cv, t => {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2 + Math.min(2, tier); i++) {   // beams
      const x0 = W * (0.15 + 0.7 * i / Math.max(1, 1 + Math.min(2, tier))), a = Math.sin(t * (0.5 + i * 0.13) + i * 2.1) * 0.5, x1 = x0 + Math.tan(a) * H;
      const g = ctx.createLinearGradient(x0, 0, x1, H); g.addColorStop(0, cols[i % 3] + "88"); g.addColorStop(1, cols[i % 3] + "00");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - 3, 0); ctx.lineTo(x0 + 3, 0); ctx.lineTo(x1 + H * 0.22, H); ctx.lineTo(x1 - H * 0.22, H); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    const base = H - 22, bars = ctx.createLinearGradient(0, base, 0, base - H * 0.5); bars.addColorStop(0, cols[0]); bars.addColorStop(1, cols[1]);
    for (let i = 0; i < N; i++) {                        // the sound
      const on = i < lit, h = on ? H * 0.5 * (0.18 + 0.82 * Math.abs(Math.sin(t * (2.1 + (i % 5) * 0.6) + i * 1.3)) * Math.abs(Math.sin(t * 0.9 + i * 0.37))) : H * 0.05;
      ctx.fillStyle = on ? bars : "rgba(255,255,255,.13)"; ctx.fillRect(i * bw + 1.5, base - h, bw - 3, h);
    }
    for (const d of dots) {                              // the crowd's lights
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + d.p)); ctx.fillStyle = "#FFF3D6";
      ctx.beginPath(); ctx.arc(W * (0.04 + 0.92 * d.x) + Math.sin(t * 1.2 + d.p) * 3, base + 5 + d.y * 14, 1.5, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (tier === 3) for (let b = 0; b < 2; b++) {         // encore
      const cyc = (t / 1.5 + b * 0.5), n = Math.floor(cyc), age = cyc - n, rr = rng(hash("fw" + n + b)), cx = W * (0.2 + 0.6 * rr()), cy = H * (0.15 + 0.25 * rr()), c = b ? "#F2C56B" : cols[n % 3];
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, d = easeOut(age) * H * 0.3; ctx.globalAlpha = Math.max(0, 1 - age * 1.15); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d + age * age * 14, 2, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }, 60);
}
/* The map's sky: a star for every topic her class has reached, in a cluster for each subject. A topic she has begun
 * is a coloured star, one she knows is bright, and the known ones of a subject are joined into its constellation. A
 * topic that became known since she last looked flares up. */
function liveSky(cv) {
  const { ctx, W, H } = sized(cv), p = me(), map = knowMap(p), cols = [cssVar("--a1"), cssVar("--a2")];
  L.sky = L.sky || {};
  const seen = new Set(L.sky[p.id] || []), first = !L.sky[p.id], nowKnown = [], cn = Math.ceil(map.length / 2) || 1, stars = [];
  map.forEach((x, i) => {
    const row = i % 2, col = Math.floor(i / 2), r = rng(hash("sky|" + x.pool));
    const cx = W * ((col + 0.5 + (row ? 0.28 : -0.05)) / (cn + 0.25)), cy = H * (row ? 0.7 : 0.3) + (r() - 0.5) * 16, spin = r() * 6;
    x.at = [cx, cy];
    x.topics.forEach((tp, j) => {
      const a = spin + j * 2.39996, d = 7 + 11.5 * Math.sqrt(j + 0.3), key = x.pool + "|" + tp.t;
      const st = { x: Math.max(8, Math.min(W - 8, cx + Math.cos(a) * d * 1.25)), y: Math.max(8, Math.min(H - 20, cy + Math.sin(a) * d * 0.85)), n: tp.n, ph: r() * 6, i: stars.length, g: i,
                   fade: !!tp.fade, nova: tp.n >= KNOW && !tp.fade && !seen.has(key) && !first };
      if (tp.n >= KNOW && !tp.fade) nowKnown.push(key);
      stars.push(st);
    });
  });
  L.sky[p.id] = nowKnown; save();
  const lines = map.map((x, i) => stars.filter(st => st.g === i && st.n >= KNOW && !st.fade).sort((a, b) => Math.atan2(a.y - x.at[1], a.x - x.at[0]) - Math.atan2(b.y - x.at[1], b.x - x.at[0])));
  const novas = stars.filter(st => st.nova);
  if (novas.length && !REDUCED) setTimeout(() => { if (!cv.isConnected) return; const b = cv.getBoundingClientRect(); novas.forEach(st => sparks(b.left + st.x, b.top + st.y, [cols[0], cols[1], "#ffffff", "#F2C56B"], 40, 4)); SFX.good(); }, 1500);
  animate(cv, t => {
    ctx.clearRect(0, 0, W, H);
    lines.forEach(ls => {                                 // the constellations draw themselves
      if (ls.length < 2) return;
      const k = Math.max(0, Math.min(1, (t - 0.9) / 1.4)) * (ls.length - 1);
      ctx.strokeStyle = "rgba(255,255,255,.34)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ls[0].x, ls[0].y);
      for (let i = 1; i < ls.length; i++) { const e = Math.max(0, Math.min(1, k - (i - 1))); if (e <= 0) break; ctx.lineTo(ls[i - 1].x + (ls[i].x - ls[i - 1].x) * e, ls[i - 1].y + (ls[i].y - ls[i - 1].y) * e); }
      ctx.stroke();
    });
    for (const st of stars) {
      const born = Math.max(0, Math.min(1, (t - st.i * 0.022) / 0.5)), tw = 0.72 + 0.28 * Math.sin(t * (1.1 + (st.i % 4) * 0.35) + st.ph);
      if (!born) continue;
      if (st.fade) {   // a star that has faded: its outline, breathing slowly, waiting to be lit again
        const R = (5.5 + 1.2 * Math.sin(t * 0.9 + st.ph)) * born;
        ctx.globalAlpha = born * 0.5; ctx.strokeStyle = cols[st.i % 2]; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(st.x, st.y, R, 0, 7); ctx.stroke();
        ctx.globalAlpha = born * 0.35; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(st.x, st.y, 1.4, 0, 7); ctx.fill();
      } else if (st.n >= KNOW) {
        const fl = st.nova ? Math.max(0, 1 - Math.abs(t - 1.6) / 0.9) : 0, R = (11 + 3 * tw + fl * 26) * born, g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, R);
        g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.18, cols[st.i % 2] + "cc"); g.addColorStop(1, cols[st.i % 2] + "00");
        ctx.globalAlpha = born * (0.75 + 0.25 * tw); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(st.x, st.y, R, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1; const f = (5 + 3 * tw + fl * 16) * born;
        ctx.beginPath(); ctx.moveTo(st.x - f, st.y); ctx.lineTo(st.x + f, st.y); ctx.moveTo(st.x, st.y - f); ctx.lineTo(st.x, st.y + f); ctx.stroke();
      } else if (st.n > 0) {
        ctx.globalAlpha = born * (0.55 + 0.4 * tw); ctx.fillStyle = cols[st.n - 1] || cols[0]; ctx.beginPath(); ctx.arc(st.x, st.y, 1.6 + st.n * 0.7, 0, 7); ctx.fill();
        ctx.globalAlpha = born * 0.18; ctx.beginPath(); ctx.arc(st.x, st.y, 5 + st.n * 1.5, 0, 7); ctx.fill();
      } else { ctx.globalAlpha = born * 0.3 * tw; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(st.x, st.y, 1.1, 0, 7); ctx.fill(); }
    }
    const sh = (t % 9) / 0.7;                               // now and then, a shooting star
    if (sh < 1) { const x = W * 0.9 - sh * W * 0.5, y = 10 + sh * H * 0.3, g = ctx.createLinearGradient(x + 40, y - 24, x, y); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.8)");
      ctx.globalAlpha = Math.sin(sh * Math.PI); ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 40, y - 24); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.globalAlpha = Math.max(0, Math.min(1, t / 0.8)) * 0.55; ctx.fillStyle = "#F3F1F7"; ctx.font = '500 11px Heebo, system-ui, sans-serif'; ctx.textAlign = "center";
    map.forEach(x => ctx.fillText(SUBJ[subjOf(x.pool)] || "", x.at[0], Math.min(H - 5, x.at[1] + 46)));
    ctx.globalAlpha = 1;
  }, 30);
}
/* A new token is a moment (they are rare: a month won, four full weeks, a gift): the coin spins in under turning
 * rays, the aura turns gold. Shown once, the next time she is on her home screen. */
function tokenCheck() {
  const p = me();
  if (!p || view !== "home" || layer.innerHTML) return;
  L.seenTok = L.seenTok || {};
  const n = +FAM.tokens[p.id] || 0;
  let was = L.seenTok[p.id];
  if (was != null && n > was && L.preTok && L.preTok[p.id]) {   // taken in a month's popup before the Sheet granted it
    const k = Math.min(n - was, L.preTok[p.id]);
    L.preTok[p.id] -= k; was += k; L.seenTok[p.id] = was; save();
  }
  if (was === n) return;
  L.seenTok[p.id] = n; save();
  if (was == null || n < was) return;
  const lastIn = tokenLog().filter(t => t.p === p.id && t.change > 0).sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0)[0];
  auraMood({ energy: 1, gold: 1.4 });
  layer.innerHTML = `<div class="ceremony" role="dialog" aria-modal="true" aria-label="אסימון חדש"><div class="rays" aria-hidden="true"></div>
    <div class="coin3d" aria-hidden="true"><div class="face">${ICON.star.replace("<svg", '<svg fill="currentColor"')}</div><div class="face back"><span class="num">${+FAM.settings.tokenValue || 100}</span></div></div>
    <span class="eyebrow" style="color:var(--gold)">New token</span>
    <h2 class="display">${n - was > 1 ? `${n - was} אסימונים חדשים` : "אסימון חדש"}</h2>
    ${lastIn ? `<p class="muted">${reasonHe(lastIn)}</p>` : ""}
    <button type="button" class="btn btn-primary" data-act="closeQuiz" data-to="vault">לכספת</button></div>`;
  SFX.coin(); buzz([30, 50, 30, 50, 60]);
  setTimeout(() => { if ($(".ceremony", layer)) { sparks(innerWidth / 2, innerHeight * 0.34, ["#F2C56B", "#FFE9B0", "#ffffff"], 170, 9); SFX.done(); } }, 1050);
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
  flag: I('<path d="M6 21V4h11.5l-2.5 4 2.5 4H6"/>'),
  revenge: I('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4.5v4h-4"/>'),
  crown: I('<path d="M4 8l4.2 4L12 6l3.8 6L20 8l-1.6 10H5.6z"/>'),
  star: I('<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 17l-5.3 2.9 1.2-6-4.5-4.1 6-.7z"/>')
};

/* ---------- screens ---------- */
const app = $("#app"), tabsEl = $("#tabs"), layer = $("#layer");
let view = "home", parentOK = false, pin = "", parentPin = "", ptab = "today";
/* Dad's unlock lasts the session: pulling the page down to refresh reloads it, and the PIN was asked again
   (Avsha, 2026-11-14). The browser keeps sessionStorage over a reload and clears it when the app is closed,
   so a refresh stays in, and opening the app again asks for the PIN. */
const UNLOCK = "fq.parent";
function keepUnlock() { try { sessionStorage.setItem(UNLOCK, JSON.stringify({ pin: parentPin, tab: ptab })); } catch (e) { /* no storage: the PIN is asked again */ } }
function dropUnlock() { try { sessionStorage.removeItem(UNLOCK); } catch (e) { /* nothing kept */ } }
function takeUnlock() {
  let u = null;
  try { u = JSON.parse(sessionStorage.getItem(UNLOCK) || "null"); } catch (e) { u = null; }
  if (u && u.pin) { parentOK = true; parentPin = String(u.pin); ptab = u.tab || "today"; }
}
let deferredInstall = null;

function applyAura(key) {
  const a = AURAS[key] || AURAS.orchid, root = document.documentElement;
  root.style.setProperty("--a1", a.c[0]); root.style.setProperty("--a2", a.c[1]); root.style.setProperty("--a3", a.c[2]);
  GLA.colTo = a.c.map(hex3);
  const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", "#09090F");
}
const initial = n => (String(n || "?").trim()[0] || "?");
/* Her photo, for her sisters too (the girls asked, 2026-11-22: "the others should see my profile picture"). It was
 * kept on her own phone only. Now it is also a cell of the family's Sheet (192 px, under 40,000 characters: a cell
 * holds 50,000), the Sheet's state carries a stamp of each girl's photo, and a phone fetches the photos themselves
 * only when a stamp is new to it. Her colours were shared already. */
const PIC_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/, PIC_MAX = 40000;
const canShare = () => LIVE && !SANDBOX && !!FAM && (FAM.api | 0) >= 3;
function fitPhoto(src) {
  return new Promise((done, fail) => {
    const img = new Image();
    img.onload = () => {
      const S = 192, cv = document.createElement("canvas"); cv.width = cv.height = S;
      const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
      cv.getContext("2d").drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      let q = 0.82, out = cv.toDataURL("image/jpeg", q);
      while (out.length > PIC_MAX && q > 0.35) { q -= 0.12; out = cv.toDataURL("image/jpeg", q); }
      done(out);
    };
    img.onerror = fail; img.src = src;
  });
}
/* Sends her photo if the Sheet has not got this one (also the photo she chose before photos were shared). */
async function sharePhoto() {
  const p = me();
  if (!p || !canShare()) return;
  L.picSent = L.picSent || {};
  const mine = L.avatars[p.id] || "", sig = mine ? String(hash(mine)) : "";
  if ((L.picSent[p.id] || "") === sig) return;
  try {
    const d = mine ? await fitPhoto(mine) : "";
    if (d && (!PIC_OK.test(d) || d.length > PIC_MAX)) return;
    await api("profile", { p: p.id, photo: d });
    L.picSent[p.id] = sig; save();
  } catch (e) { /* the next opening tries again */ }
}
async function fetchPhotos() {
  if (!LIVE || !FAM || (FAM.api | 0) < 3) return;
  L.pics = L.pics || {};
  if (!FAM.profiles.some(p => (p.pic || "") !== ((L.pics[p.id] || {}).v || ""))) return;
  try {
    const r = await api("photos");
    FAM.profiles.forEach(p => { const d = r.photos && r.photos[p.id]; if (d && PIC_OK.test(d)) L.pics[p.id] = { v: p.pic || "", d }; else delete L.pics[p.id]; });
    save();
    if (BOOTED && !layer.innerHTML && view === "board") show("board");
  } catch (e) { /* the next opening tries again */ }
}
let BOOTED = false;
function avatar(p, cls) {
  const a = AURAS[auraOf(p)] || AURAS.orchid, img = L.avatars[p.id] || ((L.pics || {})[p.id] || {}).d;
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
function show(v, quiet) {
  view = v;
  layer.innerHTML = "";
  const girlTabs = ["home", "know", "board", "vault", "me"].includes(v);
  tabsEl.hidden = !girlTabs;
  $$("button", tabsEl).forEach(b => b.setAttribute("aria-current", b.dataset.to === v ? "page" : "false"));
  const html = ({ home: renderHome, know: renderKnow, board: renderBoard, vault: renderVault, me: renderMe, parent: renderParent,
                  code: renderCode, who: renderWho, aura: renderAuraPick, error: renderError })[v]();
  app.innerHTML = (SANDBOX && girlTabs ? `<div class="sandbar"><span><b>פרופיל ניסיון</b><br><span class="small">נשאר בטלפון הזה. לא נשמר בגיליון ולא נספר לבנות.</span></span>
    <span class="sandbtns"><button type="button" class="btn btn-ghost btn-sm" data-act="sandReset">איפוס</button><button type="button" class="btn btn-primary btn-sm" data-act="sandExit">חזרה</button></span></div>` : "") + html;
  if (!quiet) { app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter"); }
  paintArt(app);
  if (!quiet) window.scrollTo(0, 0);
  auraMood({ calm: 0, energy: v === "parent" ? 0.15 : v === "know" ? 0.2 : 0.32 });
  if (v === "home") setTimeout(tokenCheck, 500);
}
const flavorTitle = p => ({ portfolio: "Portfolio", routine: "The season", stage: "Setlist" })[p.flavor] || "החודש";

/* A button that starts a round, while the Sheet's answer is on its way (sync): it says so and takes no tap. */
const WAIT_TEXT = "מתעדכן…";
const waitAttr = () => waiting() ? "disabled data-wait" : "";
function renderHome() {
  const p = me(), st = stats(p.id, Y, M), rk = ranking(Y, M), place = placeOf(rk, p.id);
  const done = playedOn(p.id, TODAY), set = dailySet(p, TODAY), rev = done ? null : revengeFor(p, TODAY, set);
  const test = activeTest(p, TODAY), wk = weekStrip(p.id), ws = weeksOf(p.id), h = NOW.getHours();
  const hi = h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 22 ? "ערב טוב" : "לילה טוב";
  let hero;
  if (done) {
    const e = st.byDay[TODAY] || { ok: 0, revOk: 0 }, pts = dayPoints(e, POINTS);
    const left = 24 * 60 - (h * 60 + NOW.getMinutes()), more = canPractice() && practiceLeft(p.id) > 0;
    hero = `<section class="glass hero-card">
      <span class="eyebrow">Done for today</span>
      <div class="row" style="align-items:flex-end"><span class="display big num" dir="ltr">${e.ok}/5</span><span class="display grad-text" style="font-size:40px" dir="ltr">+${pts}</span></div>
      <p class="muted">המשימה הבאה נפתחת בעוד ${Math.floor(left / 60)} שעות ו־${left % 60} דקות.</p>
      ${more ? `<button type="button" class="btn btn-primary wide" data-act="practice" ${waitAttr()}>${waiting() ? WAIT_TEXT : test ? `תרגול למבחן ב${esc(SUBJ[test.subj] || test.subj)}` : "עוד תרגול, בלי נקודות"}</button>
      <p class="small faint">לא חובה. חמש שאלות ממה שעוד לא מלא במפה שלך; נספר למפה וליעד המשפחתי.</p>` : ""}
      <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-ghost wide" data-act="tab" data-to="know">למפה</button>
        <button type="button" class="btn btn-ghost wide" data-act="tab" data-to="board">לטבלה</button></div></section>`;
  } else {
    const subj = {};
    set.forEach(q => { const s = SUBJ[subjOf(q.pool)]; subj[s] = (subj[s] || 0) + 1; });
    const chips = Object.entries(subj).map(([k, n]) => `<span class="chip">${n} ${k}</span>`).join("");
    const resumed = L.progress[p.id] && L.progress[p.id].date === TODAY ? L.progress[p.id].i : 0;
    hero = `<section class="glass hero-card">
      <span class="eyebrow">${DAYS_FULL[NOW.getDay()]} · ${D} ב${MONTHS[M - 1]}</span>
      <h1 class="display">${resumed ? `עוד ${set.length - resumed} שאלות` : "חמש שאלות"}</h1>
      <div class="chips">${chips}${test ? `<span class="chip warn">${ICON.cal.replace("<svg", '<svg width="14" height="14"')} מבחן ב${esc(SUBJ[test.subj] || test.subj)} ${inDays(daysBetween(TODAY, test.date))}</span>` : ""}${rev ? `<span class="chip warn">+1 סיבוב נקמה</span>` : ""}</div>
      <div class="meta"><span>בערך <b>3 דקות</b></span><span>עד <b class="num">${POINTS.day + 5 * POINTS.right + POINTS.perfect + (rev ? POINTS.revenge : 0)}</b> נקודות</span></div>
      <button type="button" class="btn btn-primary wide" data-act="start" ${waitAttr()}>${waiting() ? WAIT_TEXT : resumed ? "להמשיך" : "להתחיל"}</button></section>`;
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
  const fx = fixOffer(p);
  const fixCard = fx ? `<section class="glass pad stack fixcard"><div class="row"><span class="eyebrow">Focus · ${SUBJ[subjOf(fx.st.pool)]}</span><span class="chip"><bdi dir="ltr">+${POINTS.lesson}</bdi></span></div>
    <b class="fixname">חיזוק: ${esc(fx.st.topic)}</b>
    <p class="small muted">בנושא הזה היו לך ${fx.st.miss} טעויות מתוך ${fx.st.n} שאלות בחודש האחרון. שלוש דקות: ${fx.idea ? "הרעיון, " : ""}דוגמה פתורה ו${fx.set.length === 1 ? "שאלה אחת" : `־${fx.set.length} שאלות`}, מהקלה לקשה.</p>
    <button type="button" class="btn btn-aura wide" data-act="fix" ${waitAttr()}>${waiting() ? WAIT_TEXT : "לחיזוק"}</button></section>` : "";
  return `
  <header class="top"><div class="hello">${avatar(p, "ring")}<div><b>${hi}, ${esc(p.name)}</b><span>${esc((TRACKS[p.track] || TRACKS.g7).grade)}</span></div></div>
    <button type="button" class="round" data-act="tab" data-to="me" aria-label="ההגדרות שלי">${ICON.me}</button></header>
  ${hero}
  ${fixCard}
  ${gradeDue(p).slice(0, 1).map(t => `<section class="glass pad stack"><div class="row"><span class="eyebrow">After the exam</span><span class="small muted">${dateHe(t.date)}</span></div>
    <b class="fixname">איך היה המבחן ב${esc(SUBJ[t.subj] || t.subj)}?</b>
    <p class="small muted">כשמגיע הציון אפשר להזין אותו כאן. אבא יראה אותו, ליד מה שתרגלת בשבוע שלפני המבחן. לא חובה.</p>
    <div class="row" style="justify-content:flex-start"><button type="button" class="btn btn-aura" data-act="gradeOpen" data-p="${esc(t.p)}" data-date="${esc(t.date)}" data-subj="${esc(t.subj)}">להזין ציון</button>
      <button type="button" class="link" data-act="gradeLater" data-k="${esc(luckId(t))}">לא עכשיו</button></div></section>`).join("")}
  <section class="glass pad stack"><div class="row"><span class="eyebrow">This week</span><span class="small muted"><b class="num" style="color:var(--text)">${Math.min(wk.n, 5)}/5</b> ימים · שבוע מלא = 15 נק׳</span></div>${wk.html}
    <div class="streak"><span class="flame ${ws.streak ? "on" : ""}">${ICON.flame}</span><b class="n num">${ws.streak}</b>
      <span class="small muted">${ws.streak === 1 ? "שבוע מלא" : "שבועות מלאים ברצף"}</span>${pathDots(ws)}</div>
    <p class="small faint">חמישה ימים בשבוע מספיקים. אימון או שבת בלי משימה לא שוברים כלום. כל ${PATH.every} שבועות מלאים שווים אסימון: עוד ${ws.left}.</p>
    ${homeExtras(p)}</section>
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
    ${upcoming.length ? upcoming.map(t => `<div class="trow"><span>${esc(SUBJ[t.subj] || t.subj)}${t.note ? ` · ${esc(t.note)}` : ""}</span><span class="muted">${DAYS_FULL[parseYmd(t.date).getDay()]} ${+t.date.slice(8)}.${+t.date.slice(5, 7)}</span>${delTest(t)}</div>`).join("")
      : `<p class="small muted">יש מבחן בקרוב? שבוע לפניו, רוב השאלות יהיו מהמקצוע שלו.</p>`}</section>
  ${LIVE ? "" : `<p class="demo">תצוגה לדוגמה: ההיסטוריה עד היום היא נתוני דוגמה.</p>`}`;
}

/* Under her week on the home screen: where she stands against her own last week, the sisters' week, and any stars
 * that have faded on her map. */
function homeExtras(p) {
  if (SANDBOX) return "";
  const self = selfLine(p.id), sis = sisOf(), fading = knowMap(p).reduce((n, x) => n + x.fading, 0);
  return `${self ? `<p class="small">${self}</p>` : ""}
    ${sis ? `<button type="button" class="sismini" data-act="tab" data-to="board"><span class="small muted">רצף האחיות <b class="num" style="color:var(--text)">${sis.streak}</b></span>
      ${sis.now.map(g => { const a = AURAS[auraOf(g.p)]; return `<span class="sm1" style="--a1:${a.c[0]};--a2:${a.c[1]}">${avatar(g.p, "sm")}<span class="num small" dir="ltr">${Math.min(g.n, 5)}/5</span></span>`; }).join("")}</button>` : ""}
    ${fading ? `<button type="button" class="link" style="align-self:flex-start;min-height:0" data-act="tab" data-to="know">${fading === 1 ? "כוכב אחד דוהה במפה שלך" : `${fading} כוכבים דוהים במפה שלך`}: תשובה נכונה מדליקה מחדש</button>` : ""}`;
}
/* Her four-week path: a dot for each full week since the last token. */
const pathDots = ws => `<span class="path" role="img" aria-label="${ws.full % PATH.every} מתוך ${PATH.every} שבועות מלאים לאסימון">${Array.from({ length: PATH.every }, (_, i) => `<i class="${i < ws.full % PATH.every ? "on" : ""}"></i>`).join("")}</span>`;
/* An exam entered wrong can be taken off: hers by her, anyone's by Dad (nobody could, 2026-11-14). The script
 * learns "untest" with the version that sends api 2. */
const canEdit = () => !LIVE || !!SANDBOX || (FAM.api | 0) >= 2;
const delTest = t => canEdit() ? `<button type="button" class="x" data-act="delTest" data-p="${esc(t.p)}" data-date="${esc(t.date)}" data-subj="${esc(t.subj)}" aria-label="מחיקת המבחן">${ICON.close.replace("<svg", '<svg width="16" height="16"')}</button>` : "";
/* The map: every topic her class has reached, by subject, and how far each is to known. */
function renderKnow() {
  const p = me(), map = knowMap(p), all = map.reduce((n, x) => n + x.topics.length, 0), known = map.reduce((n, x) => n + x.known, 0);
  const left = practiceLeft(p.id), fading = map.reduce((n, x) => n + x.fading, 0);
  const cta = !canPractice() ? "" : !playedOn(p.id, TODAY) ? `<p class="small faint">אחרי חמש השאלות של היום אפשר לתרגל כאן עוד, בלי נקודות.</p>`
    : left ? `<button type="button" class="btn btn-aura wide" data-act="practice" ${waitAttr()}>${waiting() ? WAIT_TEXT : "לתרגל עכשיו"}</button>
      <p class="small faint">לא חובה. חמש שאלות ממה שעוד לא מלא, בלי נקודות לטבלה; נספר למפה וליעד המשפחתי.</p>`
    : `<p class="small faint">זה מספיק תרגול להיום. מחר יש עוד.</p>`;
  return `
  <header><span class="eyebrow">What I know</span><h1 class="display" style="font-size:52px">מה אני יודעת</h1></header>
  <section class="glass pad stack skybox"><canvas class="sky" role="img" aria-label="${known} נושאים שאת יודעת מתוך ${all}"></canvas>
    <div class="row"><span><b class="display num" style="font-size:34px">${known}</b> <span class="muted">מתוך ${all} נושאים</span></span></div>
    <div class="bar"><i style="width:${all ? known / all * 100 : 0}%"></i></div>
    <p class="small muted">נושא מתמלא אחרי ${KNOW} תשובות נכונות, בשלושה ימים שונים.</p>
    ${fading ? `<p class="small"><span class="chip warn">${fading === 1 ? "כוכב אחד דוהה" : `${fading} כוכבים דוהים`}</span> נושא שלא ענית עליו נכון ארבעה שבועות דוהה. תשובה נכונה אחת מדליקה אותו מחדש, והתרגול מביא אותם קודם.</p>` : ""}${cta}</section>
  ${map.map(x => `<section class="glass pad"><div class="row"><b style="font-size:17px">${SUBJ[subjOf(x.pool)]}</b>
      <span class="small muted">${x.test ? `<span class="chip warn">מבחן ${inDays(daysBetween(TODAY, x.test.date))}</span> ` : ""}<b class="num" style="color:var(--text)" dir="ltr">${x.known}/${x.topics.length}</b></span></div>
    <div class="kts">${x.topics.map(t => ktRow(t.t, t.n, t.fade)).join("")}</div></section>`).join("")}`;
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
  const fam = everyone().reduce((t, q) => t + stats(q.id, Y, M).right, 0);
  const [ny, nm] = M === 12 ? [Y + 1, 1] : [Y, M + 1], N = pointsOf(monthKey(ny, nm));
  const rules = P => `${P.day} על יום עם משימה, ${P.right} על תשובה נכונה${P.perfect ? `, ${P.perfect} על יום מושלם (חמש מחמש)` : ""}, ${P.revenge} על סיבוב נקמה מוצלח`;
  const [py, pm] = prevMonth(Y, M), last = ranking(py, pm), imp = improved(py, pm);
  const champs = last.filter(r => r.points && placeOf(last, r.id) === 1).map(r => profile(r.id));
  return `
  <header class="month-head"><div><span class="eyebrow">Standings</span><h1 class="display">${MONTHS[M - 1]}</h1></div>
    <span class="small muted">${left > 0 ? `עוד ${left} ימים. ב־1 לחודש המובילה מקבלת אסימון והכול מתאפס.` : "היום האחרון. מחר מתחילים מאפס."}</span></header>
  <ol class="standings">${rowsHTML}</ol>
  ${SANDBOX ? "" : sisCard()}
  ${SANDBOX ? "" : selfCard()}
  <section class="glass pad stack"><div class="row"><span class="eyebrow">Family goal</span><span class="num small" dir="ltr"><b>${fam}</b> / ${goal}</span></div>
    <div class="bar"><i style="width:${Math.min(100, fam / goal * 100)}%"></i></div>
    <p class="small muted">${goal} תשובות נכונות של שלושתכן יחד החודש${canPractice() ? ", גם בתרגול" : ""}: ${esc(s.goalReward || "")}.</p></section>
  ${N !== POINTS ? `<section class="glass pad stack"><span class="eyebrow">From ${nm}.${ny}</span>
    <p class="small"><b>מ־1 ב${MONTHS[nm - 1]} הניקוד משתנה:</b> ${rules(N)}. לדעת שווה יותר, ולהגיע בלי לענות נכון שווה פחות.</p></section>` : ""}
  ${champs.length ? `<section class="glass pad stack"><span class="eyebrow">${MONTHS[pm - 1]}</span>
    <div class="row"><span>${champs.length > 1 ? "האלופות" : "האלופה"}: <b>${champs.map(c => esc(c.name)).join(" ו")}</b></span>${imp ? `<span>השתפרה הכי הרבה: <b>${esc(profile(imp.id).name)}</b> <span class="muted">(+${imp.gain}% דיוק)</span></span>` : ""}</div></section>` : ""}
  <details class="glass pad how"><summary>איך סופרים נקודות <span class="muted">+</span></summary>
    <ul><li>${POINTS.day} על כל יום עם משימה</li><li>${POINTS.right} על כל תשובה נכונה</li>${POINTS.perfect ? `<li>${POINTS.perfect} על יום מושלם, חמש מחמש</li>` : ""}<li>${POINTS.revenge} על סיבוב נקמה מוצלח</li>${canFix() ? `<li>${POINTS.lesson} על חיזוק שהושלם (דוגמה פתורה ושלוש שאלות בנושא שעוד לא יושב)</li>` : ""}<li>${POINTS.week} על שבוע עם ${POINTS.weekDays} ימי משימה</li>
    <li>רק התשובה הראשונה נספרת. מה שפספסת חוזר בסוף הסבב עד שהוא נכון, בלי נקודות.</li>
    <li>כל אחת עונה ברמה של הכיתה שלה, אז הניקוד הוגן בין ז׳ לי׳.</li>${s.improvedReward ? `<li>מי שמשתפרת הכי הרבה בדיוק לעומת החודש הקודם: ${esc(s.improvedReward)}.</li>` : ""}</ul></details>`;
}

function renderVault() {
  const p = me(), n = +FAM.tokens[p.id] || 0, s = FAM.settings, val = +s.tokenValue || 100, ws = weeksOf(p.id);
  const coins = Array.from({ length: Math.max(10, n) }, (_, i) => i < n
    ? `<span class="coin" style="animation-delay:${i * 0.06}s">${ICON.star.replace("<svg", '<svg fill="currentColor"')}</span>`
    : `<span class="coin empty num">${i + 1}</span>`).join("");
  const tier = (k, label, text) => `<div class="glass tier ${n >= k ? "reached" : ""}"><span class="n num">${k}</span>
    <div><b>${esc(text)}</b><div class="small muted">${label}</div></div><span class="small ${n >= k ? "" : "muted"}" style="${n >= k ? "color:var(--gold)" : ""}">${n >= k ? "פתוח" : `עוד ${k - n}`}</span></div>`;
  return `
  <header><span class="eyebrow">Vault</span><h1 class="display" style="font-size:58px">${n} <span class="muted" style="font-size:24px">אסימונים</span></h1></header>
  <section class="glass pad"><div class="coins">${coins}</div></section>
  <section class="glass pad stack"><div class="row"><span class="eyebrow">Your path</span>${pathDots(ws)}</div>
    <p class="small muted">כל ${PATH.every} שבועות מלאים (חמישה ימים עם משימה בשבוע) שווים אסימון, גם אם הם לא ברצף. יש לך ${ws.full % PATH.every} מתוך ${PATH.every}.</p></section>
  ${n >= 10 ? `<div class="blackcard"><span class="eyebrow" style="color:var(--gold)">Black card</span><span class="display">${esc(s.prize10 || "הפרס הענק")}</span></div>` : ""}
  ${tier(1, "אפשר לפדות כל אסימון מתי שרוצים", `${val} ₪`)}
  ${tier(5, "חמישה אסימונים שמורים", s.prize5 || "פרס גדול (אבא עוד מחליט)")}
  ${tier(10, "עשרה אסימונים שמורים", s.prize10 || "פרס ענק (אבא עוד מחליט)")}
  <button type="button" class="btn btn-aura wide" data-act="redeem" ${n ? "" : "disabled"}>לפדות אסימון ב־${val} ₪</button>
  <p class="small muted" style="text-align:center">אלופת החודש מקבלת אסימון ב־1 לחודש הבא, וכל אחת מקבלת אחד על כל ${PATH.every} שבועות מלאים.</p>`;
}

/* Which way her new questions lean in math and English, in words, or "" when they come in the pool's own order. */
function levelLine(p, her) {
  const t = TRACKS[p.track] || TRACKS.g7, bits = [];
  [t.math, t.eng].forEach(pool => { const b = bandOf(p, pool, TODAY); if (b) bits.push(`${SUBJ[subjOf(pool)]}: ${b > 0 ? "קשות יותר" : "קלות יותר"}`); });
  if (!bits.length) return "";
  return her ? `<p class="small"><span class="muted">רמת השאלות החדשות שלך:</span> ${bits.join(" · ")}. <span class="faint">היא עולה כשאת עונה נכון על תשע מכל עשר בשבועיים האחרונים, ויורדת כשזה שש מכל עשר או פחות.</span></p>`
    : `<p class="small"><span class="muted">רמת השאלות החדשות:</span> ${bits.join(" · ")} <span class="faint">(לפי הדיוק שלה בשבועיים האחרונים)</span></p>`;
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
  const others = LIVE || SANDBOX ? "" : `<section class="glass pad stack"><span class="eyebrow">Demo</span><p class="small muted">בתצוגה לדוגמה אפשר לעבור בין הבנות ולראות את המסך של אבא.</p>
    <div class="chips">${FAM.profiles.map(q => `<button type="button" class="chip" data-act="become" data-id="${q.id}">${esc(q.name)}</button>`).join("")}
    <button type="button" class="chip" data-act="parent">${ICON.lock.replace("<svg", '<svg width="14" height="14"')} אבא</button></div></section>`;
  return `
  <header class="top"><span class="eyebrow">Me</span></header>
  <section class="stack" style="align-items:center;text-align:center">
    <button type="button" data-act="photo" aria-label="החלפת תמונה">${avatar(p, "lg ring")}</button>
    <h1 class="display" style="font-size:44px">${esc(p.name)}</h1>
    <button type="button" class="link" data-act="photo">${L.avatars[p.id] ? "להחליף תמונה" : "להוסיף תמונה או ציור שלך"}</button>
    ${canShare() ? `<p class="small faint" style="margin-top:-8px">האחיות שלך ואבא רואים את התמונה ואת הצבעים שלך.${L.avatars[p.id] ? ` <button type="button" class="link" style="min-height:0;font-size:13px" data-act="photoOff">להסיר את התמונה</button>` : ""}</p>` : ""}
    <input type="file" id="photoFile" accept="image/*" hidden></section>
  <section class="glass pad stack"><span class="eyebrow">Your aura</span><div class="swatches">${sw}</div></section>
  <section class="glass pad stack"><div class="row"><span class="eyebrow">What Dad sees</span><span class="small muted">${st.played} ימים · ${st.acc}% דיוק</span></div>
    ${subjectBars(st)}
    ${st.weak.length ? `<p class="small"><span class="muted">כדאי לחזק:</span> ${st.weak.map(esc).join(", ")}</p>` : ""}
    ${levelLine(p, true)}
    <p class="small faint">אבא רואה את זה, אילו שאלות קיבלת ובמה טעית, כמה זמן לקח לך לענות, את השבועות שלמטה ואת הציונים שהזנת. לא יותר.</p></section>
  <section class="glass pad stack"><div class="row"><span class="eyebrow">Over time</span><span class="small muted">הדיוק שלך לפי שבוע</span></div>
    ${trendChart([p])}${overTime(p, false)}</section>
  <button type="button" class="glass pad row" data-act="recap" style="text-align:start"><span>הסיכום של ${MONTHS[prevMonth(Y, M)[1] - 1]}</span>${ICON.back.replace("<svg", '<svg width="18" height="18" style="transform:scaleX(-1)"')}</button>
  <section class="glass pad">
    <div class="toggle" style="border-top:0"><span>צלילים</span><button type="button" class="switch" role="switch" aria-checked="${L.sound}" data-act="toggle" data-k="sound" aria-label="צלילים"></button></div>
    <div class="toggle"><span>רטט <span class="small faint">(באנדרואיד)</span></span><button type="button" class="switch" role="switch" aria-checked="${L.haptics}" data-act="toggle" data-k="haptics" aria-label="רטט"></button></div>
  </section>
  ${!standalone && ios ? `<section class="glass pad stack"><span class="eyebrow">Home screen</span><p class="small muted">באייפון: כפתור השיתוף בספארי ואז ״הוספה למסך הבית״. ככה זה נפתח כמו אפליקציה.</p></section>` : ""}
  ${!standalone && deferredInstall ? `<button type="button" class="btn btn-ghost wide" data-act="install">להוסיף למסך הבית</button>` : ""}
  ${others}
  ${LIVE && !SANDBOX ? `<button type="button" class="link" style="align-self:center" data-act="forget">זה לא הטלפון שלי</button>` : ""}`;
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
  const tabs = [["today", "היום"], ["month", "החודש"], ["life", "מכל הזמנים"], ["settings", "הגדרות"]];
  const body = { today: parentToday, month: parentMonth, life: parentLife, settings: parentSettings }[ptab]();
  return `
  <header class="top"><button type="button" class="round" data-act="leaveParent" aria-label="יציאה">${ICON.back}</button><span class="eyebrow">Parent · ${D}.${M}</span><span style="width:44px"></span></header>
  <h1 class="display" style="font-size:46px">${MONTHS[M - 1]}, יום ${D}</h1>
  <div class="ptabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" data-act="ptab" data-k="${k}" aria-selected="${k === ptab}">${t}</button>`).join("")}</div>
  ${body}`;
}

/* ---------- Dad's tabs: the same tables as the evening email ---------- */
const dot = p => `<i class="dot" style="background:${AURAS[auraOf(p)].c[0]}"></i>`;
const nameCell = p => `<span class="nm">${dot(p)}${esc(p.name)}</span>`;
const table = (heads, rowsHTML) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rowsHTML.join("")}</tbody></table></div>`;
const joinHe = a => a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " ו" + a[a.length - 1];
function todayOf(p) {
  const st = stats(p.id, Y, M), e = st.byDay[TODAY] || { reg: 0, ok: 0, rev: 0, revOk: 0 };
  const mine = rows().filter(r => r.p === p.id && r.d === TODAY), reg = mine.filter(r => !r.r), rev = mine.filter(r => r.r === 1);
  const prac = mine.filter(r => r.r === 2), fix = mine.filter(r => r.r === 3), secs = reg.map(r => +r.s).filter(x => x > 0);
  const played = reg.length >= 5;
  let points = 0;
  if (played) {
    points = dayPoints(e, POINTS);
    /* today's day finished a full week if it is the fifth and last of the week's days so far */
    const wk = st.days.filter(x => Math.floor((+x.d.slice(8) - 1 + new Date(Y, M - 1, 1).getDay()) / 7) === Math.floor((D - 1 + new Date(Y, M - 1, 1).getDay()) / 7));
    if (wk.length === POINTS.weekDays && wk[wk.length - 1].d === TODAY) points += POINTS.week;
  }
  return { played, ok: e.ok, rev: rev.length ? rev[0].ok : null, points, at: (reg[reg.length - 1] || {}).w || "",
           missed: [...new Set(reg.filter(r => !r.ok).map(r => r.t))], asked: reg.map(r => r.t), week: weekStrip(p.id).n,
           secs: secs.length ? median(secs) : 0, fast: fastOnes(reg), rushed: played && fastOnes(reg) >= RUSH.n,
           prac: prac.length, pracOk: prac.filter(r => r.ok).length, wrong: reg.concat(rev).filter(r => !r.ok),
           fix: fix.length, fixOk: fix.filter(r => r.ok).length, fixTopic: fix.length ? fix[0].t : "", stuck: stuckOf(p, addDays(TODAY, 1)) };
}
function parentToday() {
  const ts = FAM.profiles.map(p => [p, todayOf(p)]), n = ts.filter(([, t]) => t.played).length;
  const missing = ts.filter(([, t]) => !t.played).map(([p]) => esc(p.name));
  const rowsHTML = ts.map(([p, t]) => `<tr><td>${nameCell(p)}</td>
    <td>${t.played ? `<span dir="ltr"><b class="big num">${t.ok}</b><span class="faint">/5</span></span>${t.rushed ? `<br><span class="chip bad">מהר מדי</span>` : ""}` : `<span class="bad-t small">לא שיחקה</span>`}</td>
    <td>${t.rev === null ? `<span class="faint">—</span>` : t.rev ? `<span class="good-t" aria-label="ניצחה">✓</span>` : `<span class="bad-t" aria-label="הפסידה">✗</span>`}</td>
    <td class="num">${t.points ? `<b dir="ltr">+${t.points}</b>` : "—"}</td><td class="num">${t.week}</td><td class="num faint">${t.at || "—"}</td></tr>`);
  const detail = ts.map(([p, t]) => `<div class="stack" style="gap:4px"><span class="nm">${dot(p)}<b>${esc(p.name)}</b></span>
    ${t.played ? `<p class="small"><span class="muted">היום:</span> ${t.asked.map(esc).join(" · ")}</p>
      ${t.secs ? `<p class="small"><span class="muted">זמן לשאלה:</span> ${secText(t.secs)} (החציון)${t.rushed ? ` · <span class="bad-t">${t.fast} תשובות בפחות מ־${RUSH.secs} שניות</span>` : ""}</p>` : ""}
      ${t.prac ? `<p class="small"><span class="muted">תרגלה עוד:</span> ${t.prac} שאלות, ${t.pracOk} נכונות</p>` : ""}
      ${t.fix ? `<p class="small"><span class="muted">חיזוק:</span> ${esc(t.fixTopic)}, ${t.fixOk} נכונות מתוך ${t.fix}</p>` : ""}
      ${t.wrong.length ? t.wrong.map(missedRow).join("") : `<p class="small good-t">בלי טעויות</p>`}`
      : `<p class="small"><span class="muted">מחכות לה:</span> ${dailySet(p, TODAY).map(q => esc(q.topic)).join(" · ")}</p>`}
      ${t.stuck ? `<p class="small"><span class="chip warn">תקוע</span> <b>${esc(t.stuck.topic)}</b> <span class="muted">(${SUBJ[subjOf(t.stuck.pool)]})</span>: ${t.stuck.miss} טעויות מתוך ${t.stuck.n} שאלות בארבעה שבועות. שווה לשבת איתה עשר דקות${canFix() ? "; האפליקציה מציעה לה חיזוק בנושא" : ""}.</p>` : ""}</div>`).join("");
  const pairs = {};
  FAM.profiles.filter(p => p.pair).forEach(p => (pairs[p.pair] = pairs[p.pair] || []).push(p));
  const twins = Object.values(pairs).filter(g => g.length > 1).map(g => {
    const [a, b] = g.map(p => new Set(rows().filter(r => r.p === p.id && r.d === TODAY).map(r => r.q).concat(dailySet(p, TODAY).map(q => q.id))));
    const k = [...a].filter(x => b.has(x)).length;
    return `${joinHe(g.map(p => esc(p.name)))} קיבלו היום ${k ? `${k} שאלות משותפות` : "שאלות שונות לגמרי"}.`;
  }).join(" ");
  return `${scriptCard(true)}<section class="glass pad stack"><div class="row"><span class="eyebrow">Today</span><span class="small muted">${n === ts.length ? "כולן שיחקו" : `${n} מתוך ${ts.length} שיחקו${missing.length ? ` · חסרה: ${joinHe(missing)}` : ""}`}</span></div>
    ${table(["", "ציון", "נקמה", "נקודות", "השבוע", "שעה"], rowsHTML)}</section>
  ${examsCard()}
  ${canFlag() ? flagsCard() : ""}
  <section class="glass pad stack" style="gap:14px"><span class="eyebrow">Questions</span>${detail}${twins ? `<p class="small faint">${twins}</p>` : ""}</section>`;
}
/* A question she got wrong, whole, with its right answer, so Dad can talk it through with her (he saw only the
 * topic's name, 2026-11-14), and how long she took over it. */
const secText = x => `${x < 10 ? Math.round(x * 10) / 10 : Math.round(x)} שניות`;
function missedRow(r) {
  const q = QIDX[r.q];
  return `<div class="rv mq"><span class="mk no">✗</span><span class="t"><b>${SUBJ[subjOf(r.pool)] || ""} · ${esc(q ? q.topic : r.t)}${r.r === 1 ? " · נקמה" : ""}</b>${+r.s > 0 ? ` <span class="small faint">${secText(+r.s)}</span>` : ""}
    ${q ? `<br><span class="muted" ${q.ltr ? 'dir="ltr"' : ""}>${fmt(q.q)}</span><br><span class="good-t">✓ <span dir="${optDir(q.options[0])}">${fmt(q.options[0])}</span></span>` : ""}</span></div>`;
}
/* What the girls marked "not learned yet" in the last two weeks, the newest first: who, the question, how she did. */
function flagsCard() {
  const fl = rows().filter(r => r.f && profile(r.p) && daysBetween(r.d, TODAY) <= FLAG.days).sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
  const list = fl.slice(0, 20).map(r => { const q = QIDX[r.q], p = profile(r.p), text = fmt(q ? q.q : r.f);
    return `<div class="rv mq"><span class="mk flagmk">${ICON.flag}</span><span class="t"><span class="nm">${dot(p)}<b>${esc(p.name)}</b></span> <span class="small faint">${+r.d.slice(8)}.${+r.d.slice(5, 7)} · ${r.ok ? "ענתה נכון" : "טעתה"}</span>
      <br><b>${SUBJ[subjOf(r.pool)] || ""} · ${esc(q ? q.topic : r.t)}</b><br><span class="muted" dir="${optDir(q ? q.q : r.f)}">${text}</span></span></div>`; }).join("");
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Not learned yet</span><span class="small muted">עוד לא למדנו</span></div>
    ${list || `<p class="small muted">כשאחת הבנות מסמנת בשאלה ״עוד לא למדנו את זה״, השאלה מופיעה כאן ובמייל של הערב.</p>`}
    ${list ? `<p class="small faint">הן עונות על השאלה בכל מקרה. נושא שבאמת עוד לא נלמד אפשר לכבות עד שהכיתה תגיע אליו.</p>` : ""}</section>`;
}
/* Upcoming exams, every girl's, soonest first, as in the evening email; the week of focus is lit. */
function examsCard() {
  const up = tests().filter(t => t.date >= TODAY && profile(t.p)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const rowsHTML = up.slice(0, 12).map(t => { const n = daysBetween(TODAY, t.date), p = profile(t.p);
    // when it is and how long until it share a cell: a fourth column ran off a phone's width
    return `<tr><td class="num"><b>${dateHe(t.date)}</b><br>${n <= TEST_LEAD ? `<span class="chip warn">${inDays(n)}</span>` : `<span class="small muted">${inDays(n)}</span>`}</td>
      <td>${nameCell(p)}</td><td style="white-space:normal">${esc(SUBJ[t.subj] || t.subj)}${t.note ? `<br><span class="small faint">${esc(t.note)}</span>` : ""}</td>${canEdit() ? `<td style="padding:0">${delTest(t)}</td>` : ""}</tr>`; });
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Exams</span>
      <button type="button" class="btn btn-ghost btn-sm" data-act="addTest">${ICON.plus.replace("<svg", '<svg width="16" height="16"')} מבחן</button></div>
    ${up.length ? table(["מתי", "", "מקצוע"].concat(canEdit() ? [""] : []), rowsHTML) + `<p class="small faint">שבוע לפני מבחן, שלוש מחמש השאלות היומיות שלה מהמקצוע שלו. יום לפני המבחן, כל אחת מכם רואה פעם אחת ״בהצלחה״ עם התמונה שלה. <button type="button" class="link" style="min-height:0;font-size:13px" data-act="luckPreview">לראות איך זה נראה</button></p>`
      : `<p class="small muted">אין מבחנים ברשימה. אפשר להוסיף כאן, והבנות מוסיפות במסך הבית שלהן (״+ מבחן״).</p>`}</section>`;
}
function parentMonth() {
  const rk = ranking(Y, M), s = FAM.settings, lead = rk[0] ? rk[0].points : 0, goal = +s.goal || 250;
  const fam = rk.reduce((t, r) => t + r.right, 0);
  const rowsHTML = rk.map(r => { const p = profile(r.id), pl = placeOf(rk, r.id);
    return `<tr><td class="num" style="${pl === 1 && r.points ? "color:var(--gold)" : "color:var(--text-3)"}"><b>${pl}</b></td><td>${nameCell(p)}</td><td><b class="big num">${r.points}</b></td>
      <td class="num">${r.played}</td><td class="num" dir="ltr" style="text-align:end">${r.acc}%</td><td class="num">${r.fullWeeks}</td><td class="num faint" dir="ltr" style="text-align:end">${lead > r.points ? "−" + (lead - r.points) : "—"}</td></tr>`; });
  const girls = FAM.profiles.map(p => {
    const st = stats(p.id, Y, M), up = tests().filter(t => t.p === p.id && t.date >= TODAY);
    const spark = Array.from({ length: 14 }, (_, i) => { const d = addDays(TODAY, i - 13), x = rows().filter(r => r.p === p.id && r.d === d && !r.r);
      const ok = x.filter(r => r.ok).length; return `<i class="${x.length >= 5 ? "on" : ""}" style="height:${x.length >= 5 ? 20 + ok * 16 : 8}%" title="${d}"></i>`; }).join("");
    const a = AURAS[auraOf(p)];
    return `<details class="glass pad pgirl" style="--a1:${a.c[0]};--a2:${a.c[1]}"><summary><span class="nm">${dot(p)}<b>${esc(p.name)}</b></span><span class="small muted">${st.played} ימים · ${st.acc}% · ${st.points} נק׳</span></summary>
      <div class="stack" style="margin-top:12px"><span class="eyebrow">Last 14 days</span><div class="spark">${spark}</div>${subjectBars(st)}
      ${st.weak.length ? `<p class="small"><span class="muted">כדאי לחזק:</span> ${st.weak.map(esc).join(" · ")}</p>` : ""}
      ${levelLine(p, false)}
      ${up.length ? `<p class="small"><span class="muted">מבחנים:</span> ${up.map(t => `${esc(SUBJ[t.subj] || t.subj)}${t.note ? ` (${esc(t.note)})` : ""} ${+t.date.slice(8)}.${+t.date.slice(5, 7)}`).join(", ")}</p>` : ""}</div></details>`;
  }).join("");
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Standings</span><span class="small muted">עוד ${daysIn(Y, M) - D} ימים</span></div>
    ${table(["#", "", "נקודות", "ימים", "דיוק", "שבועות", "פער"], rowsHTML)}
    <div class="row small" style="margin-top:6px"><span class="muted">יעד משפחתי · ${esc(s.goalReward || "")}</span><span class="num" dir="ltr"><b>${fam}</b> / ${goal}</span></div>
    <div class="bar"><i style="width:${Math.min(100, fam / goal * 100)}%"></i></div></section>
  ${sisCard()}
  ${girls}`;
}
/* All time: from the Sheet (state's lifetime) when live; from the rows and tokens the app holds in the demo. */
function demoTokenLog() {
  const out = [];
  FAM.profiles.forEach(p => { let [y, m] = [Y, M];
    for (let k = 0; k < (+(window.FQ_DEMO && window.FQ_DEMO.tokens || { a: 2, b: 1, c: 3 })[p.id] || 0); k++) {
      [y, m] = prevMonth(y, m); out.push({ d: `${y}-${pad2(m)}-01`, p: p.id, change: 1, reason: `winner ${y}-${pad2(m)}` }); } });
  return out.concat(L.demoLog || []);
}
const tokenLog = () => LIVE ? (FAM.tokenLog || []) : demoTokenLog();
function lifetimeOf(p) {
  if (LIVE && FAM.lifetime && FAM.lifetime[p.id]) return FAM.lifetime[p.id];
  const mine = rows().filter(r => r.p === p.id), reg = mine.filter(r => !r.r), ok = reg.filter(r => r.ok).length;
  let points = 0, days = 0;
  [...new Set(mine.map(r => r.d.slice(0, 7)))].forEach(mk => { const x = stats(p.id, +mk.slice(0, 4), +mk.slice(5, 7)); points += x.points; days += x.played; });
  const log = tokenLog().filter(t => t.p === p.id);
  const earned = log.reduce((a, t) => a + Math.max(0, t.change), 0), redeemed = log.reduce((a, t) => a + Math.max(0, -t.change), 0);
  return { days, answered: reg.length, acc: reg.length ? Math.round(ok / reg.length * 100) : 0, points,
           wins: log.filter(t => /^winner /.test(t.reason)).length, earned, redeemed, balance: +FAM.tokens[p.id] || 0 };
}
function reasonHe(t) {
  const w = /^winner (\d{4})-(\d{2})/.exec(t.reason);
  if (w) return `אלופת ${MONTHS[+w[2] - 1]}`;
  if (/^gift/.test(t.reason)) return "מתנה מאבא";
  if (/^dedication /.test(t.reason)) return "מתנה מאבא על ההתמדה";
  if (/^weeks /.test(t.reason)) return `${PATH.every} שבועות מלאים`;
  if (/^redeemed/.test(t.reason)) return `פדתה ב־${(/\d+/.exec(t.reason) || [FAM.settings.tokenValue || 100])[0]} ₪`;
  return esc(t.reason);
}
function parentLife() {
  const ls = FAM.profiles.map(p => [p, lifetimeOf(p)]);
  const life = ls.map(([p, x]) => `<tr><td>${nameCell(p)}</td><td class="num">${x.days}</td><td class="num">${x.answered}</td><td class="num" dir="ltr" style="text-align:end">${x.acc}%</td><td><b class="big num">${x.points}</b></td></tr>`);
  const toks = ls.map(([p, x]) => `<tr><td>${nameCell(p)}</td><td class="num">${x.wins}</td><td class="num">${x.earned}</td><td class="num">${x.redeemed}</td><td><b class="big num">${x.balance}</b></td></tr>`);
  const log = tokenLog().slice().sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0).slice(0, 15).map(t => { const p = profile(t.p);
    return `<div><span class="nm">${p ? dot(p) + esc(p.name) : esc(t.p)} <span class="muted" style="font-weight:400">· ${reasonHe(t)}</span></span><span class="num ${t.change > 0 ? "good-t" : "bad-t"}" dir="ltr">${t.change > 0 ? "+" : "−"}${Math.abs(t.change)}</span></div>
      <div class="faint small" style="margin-top:-6px">${+t.d.slice(8)}.${+t.d.slice(5, 7)}.${t.d.slice(0, 4)}</div>`; }).join("");
  const legend = trendKey(FAM.profiles);
  const over = FAM.profiles.map(p => { const a = AURAS[auraOf(p)];
    return `<details class="glass pad pgirl" style="--a1:${a.c[0]};--a2:${a.c[1]}"><summary><span class="nm">${dot(p)}<b>${esc(p.name)}</b></span><span class="small muted">שבוע אחרי שבוע, ומבחנים</span></summary>
      <div class="stack" style="margin-top:12px">${overTime(p, true)}</div></details>`; }).join("");
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Over time</span><span class="small muted">דיוק בשאלות היומיות, לפי שבוע</span></div>
    ${trendChart(FAM.profiles)}<div class="chips" style="gap:14px">${legend}</div>
    <p class="small faint">כל נקודה היא שבוע, מיום ראשון. בפירוט של כל אחת: הימים, התרגול, והמבחנים עם השבוע שלפניהם והציון.</p></section>
  ${over}
  <section class="glass pad stack"><span class="eyebrow">All time</span>${table(["", "ימים", "שאלות", "דיוק", "נקודות"], life)}</section>
  <section class="glass pad stack"><span class="eyebrow">Tokens</span>${table(["", "חודשים שניצחה", "קיבלה", "פדתה", "בכספת"], toks)}</section>
  <section class="glass pad stack"><span class="eyebrow">Token history</span><div class="log">${log || `<p class="small muted">עוד אין אסימונים.</p>`}</div></section>`;
}
/* Is the script in the Sheet the one this app was written for? The app is live the minute it is pushed, the script
 * only when Avsha pastes it, and nothing told him (or Claude: the Sheet shows no trace until a girl plays) whether a
 * paste had taken. SCRIPT_API is the `API` of backend/Code.gs: raise both together, and say here what an older
 * script leaves out. */
const SCRIPT_API = 6;
const SCRIPT_ADDS = { 2: "תרגול, מחיקת מבחן, זמן לשאלה, אסימון על ארבעה שבועות מלאים", 3: "תמונות הפרופיל אצל האחיות", 4: "הכפתור ״עוד לא למדנו את זה״", 5: "המתנה בסוף החודש",
  6: "פתיחה מהירה של הגיליון, החיזוק בנושא תקוע, ציון אחרי מבחן, המגמה לאורך זמן ורצף האחיות" };
function scriptCard(brief) {
  if (!LIVE) return "";
  const have = FAM.api | 0;
  if (have >= SCRIPT_API) return brief ? "" : `<section class="glass pad stack"><div class="row"><span class="eyebrow">Script</span><span class="chip good">מעודכן</span></div>
    <p class="small muted">הסקריפט בגיליון הוא הגרסה שהאפליקציה צריכה (<bdi dir="ltr">${have}</bdi>).</p></section>`;
  const missing = Object.keys(SCRIPT_ADDS).filter(k => +k > have).map(k => SCRIPT_ADDS[k]);
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Script</span><span class="chip warn">צריך עדכון</span></div>
    <p class="small">הסקריפט בגיליון הוא גרסה <bdi dir="ltr">${have || 1}</bdi>, והאפליקציה צריכה <bdi dir="ltr">${SCRIPT_API}</bdi>. עד שמדביקים את החדש ומפרסמים ״גרסה חדשה״, לא פועלים: ${missing.join("; ")}.</p>
    <p class="small faint">אם כבר הדבקת: סגור ופתח את האפליקציה. אם זה עדיין כאן, בפרסום נבחרה הגרסה הישנה ולא ״New version״.</p></section>`;
}
/* How long this phone's last opening waited for the Sheet (Avsha, 2026-11-26: half a minute before anything showed).
 * The screen no longer waits for it, so this line is how to know whether the Sheet's script is slow again. */
function loadCard() {
  const x = LIVE && L.load;
  if (!x) return "";
  const secs = n => (Math.round(n / 100) / 10).toFixed(1);
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">Speed</span><span class="small muted">הפתיחה האחרונה בטלפון הזה</span></div>
    <p class="small">${x.ok ? `הגיליון ענה תוך <b dir="ltr">${secs(x.ms)}</b> שניות.` : "הגיליון לא ענה (אין חיבור, או שהוא איטי מאוד)."}${x.shown ? ` המסך הופיע אחרי <b dir="ltr">${secs(x.shown)}</b> שניות.` : ""}</p>
    <p class="small faint">המסך נפתח ממה שהטלפון זוכר ולא מחכה לגיליון. אם הגיליון עונה אחרי יותר מ־6 שניות, שווה לספר ל־Claude.</p></section>`;
}
function parentSettings() {
  const s = FAM.settings;
  return `<section class="glass pad stack"><span class="eyebrow">Prizes</span>
    <div class="field"><label for="p5">הפרס של 5 אסימונים</label><input id="p5" value="${esc(s.prize5 || "")}" placeholder="למשל: הופעה לבחירתה"></div>
    <div class="field"><label for="p10">הפרס של 10 אסימונים</label><input id="p10" value="${esc(s.prize10 || "")}" placeholder="למשל: סוף שבוע באילת"></div>
    <div class="field"><label for="pg">הפרס של היעד המשפחתי</label><input id="pg" value="${esc(s.goalReward || "")}"></div>
    <button type="button" class="btn btn-primary" data-act="savePrizes">שמירה</button></section>
  <section class="glass pad stack"><span class="eyebrow">Give a token</span><p class="small muted">מעבר לאסימון של אלופת החודש. היא תראה אותו בכספת.</p>
    <div class="chips">${FAM.profiles.map(p => `<button type="button" class="chip" data-act="grant" data-id="${p.id}">${dot(p)} +1 ל${esc(p.name)}</button>`).join("")}</div></section>
  ${scriptCard()}
  ${loadCard()}
  ${canGift() ? bonusCard() : ""}
  <section class="glass pad stack"><span class="eyebrow">Test profile</span>
    <p class="small muted">פרופיל ניסיון, כמו של הבנות, שקיים רק בטלפון הזה: אפשר לענות נכון ולא נכון, לתרגל ולראות כל מסך. שום דבר ממנו לא נשלח לגיליון, לא נספר בטבלה של הבנות ולא מגיע למייל. בוחרים של מי השאלות:</p>
    <div class="chips">${FAM.profiles.map(p => `<button type="button" class="chip" data-act="sandbox" data-id="${p.id}">${dot(p)} כמו ${esc(p.name)}</button>`).join("")}</div></section>
  <section class="glass pad stack"><span class="eyebrow">Email</span><p class="small muted">סיכום עם הטבלאות האלה מגיע כל ערב סמוך ל־${+s.digestHour || 21}:00, וב־1 לחודש מגיעה הטבלה הסופית.</p></section>
  ${LIVE ? `<button type="button" class="link" style="align-self:center" data-act="forget">זה לא הטלפון שלי</button>` : ""}`;
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

/* ---------- the month's winner, and Dad's gift (Avsha, 2026-11-22) ----------
 * In a month's first week, the first time the app is opened (by each girl, and by Dad once his screen is unlocked),
 * a popup names last month's winner: her photo under a crown, her points, in her colours and with her own kind of
 * result piece (the artwork, the ribbon, the stage). The winner herself gets a "+1 token" to tap, and the coin
 * comes in. Her own recap follows from its last button.
 * Dad's gift: on his Settings tab he can promise each girl a token at the month's end, for those who played enough
 * days in the month's last full week, with a line of his own. The script grants it on the 1st (bonusTokens_), and
 * her popup comes after the winner's, with its own "+1 token". The first is for November 2026: "I appreciate their
 * dedication so far" (the winner has two).
 * The tokens are in the Sheet whatever she taps: the tap is the moment, and it stands in for the ceremony that a
 * new token would otherwise get (claimTok, tokenCheck). */
const BONUS_NOTE = "אני מעריך מאוד את ההתמדה שלכן החודש. לכל אחת מגיע אסימון.";
const lastFullWeek = (y, m) => { let d = `${monthKey(y, m)}-${pad2(daysIn(y, m))}`; while (parseYmd(d).getDay() !== 6) d = addDays(d, -1); return addDays(d, -6); };
const daysInWeekOf = (pid, w) => { const pl = playedDays(pid); let n = 0; for (let i = 0; i < 7; i++) if (pl.has(addDays(w, i))) n++; return n; };
const bonusOf = () => { const b = FAM && FAM.settings && FAM.settings.bonus; return b && b.month ? b : null; };
const canGift = () => !LIVE || (FAM.api | 0) >= 5;
function giftFor(p, mk) {
  const b = bonusOf();
  return p && b && b.month === mk && b.ids.includes(p.id) && (!(b.days > 0) || daysInWeekOf(p.id, b.week) >= b.days) ? b : null;
}
let POP = null;
function monthCheck(viewer) {
  if (SANDBOX || D > 7 || !FAM || !FAM.profiles.length) return false;
  const who = viewer ? viewer.id : "dad", [py, pm] = prevMonth(Y, M);
  L.seenWin = L.seenWin || {};
  if (L.seenWin[who] === THIS_MONTH || !openPops(py, pm, viewer, false)) return false;
  L.seenWin[who] = THIS_MONTH; save();
  return true;
}
function openPops(y, m, viewer, preview, note) {
  const rk = ranking(y, m), win = rk.filter(r => r.points > 0 && placeOf(rk, r.id) === 1 && profile(r.id));
  if (!win.length) return false;
  const gift = preview ? { note } : giftFor(viewer, monthKey(y, m));
  if (viewer && !preview) { L.seenTok = L.seenTok || {}; if (L.seenTok[viewer.id] == null) L.seenTok[viewer.id] = +FAM.tokens[viewer.id] || 0; }
  POP = { y, m, viewer, preview, win, steps: ["win"].concat(gift && viewer ? ["gift"] : []), i: 0, note: (gift && gift.note) || BONUS_NOTE, back: view };
  renderPop();
  return true;
}
function popButtons() {
  const P = POP, last = P.i === P.steps.length - 1;
  if (!last) return `<button type="button" class="btn btn-primary" data-act="popNext">המשך</button>`;
  const recap = P.viewer && !P.preview && stats(P.viewer.id, P.y, P.m).played > 0;
  return `${recap ? `<button type="button" class="btn btn-primary" data-act="popRecap">לסיכום החודש שלי</button>` : ""}
    <button type="button" class="btn ${recap ? "btn-ghost" : "btn-primary"}" data-act="popNext">סגירה</button>`;
}
function renderPop() {
  const P = POP, kind = P.steps[P.i], v = P.viewer, month = MONTHS[P.m - 1];
  const tokenBtn = `<button type="button" class="btn btn-gold" data-act="popToken">${ICON.star.replace("<svg", '<svg fill="currentColor" width="18" height="18"')}<bdi dir="ltr">+1</bdi> אסימון</button>`;
  const tag = P.preview ? `<span class="chip warn">תצוגה מקדימה</span>` : "";
  if (kind === "win") {
    const top = P.win[0], first = profile(top.id), many = P.win.length > 1, mine = !!v && P.win.some(r => r.id === v.id);
    applyAura(auraOf(first)); auraMood({ calm: 0.15, energy: 1, gold: 0.5 });
    const theme = first.flavor === "stage" ? `<canvas class="stagecv" data-lit="26" data-tier="3" aria-hidden="true"></canvas>`
      : first.flavor === "routine" ? `<canvas class="appar" data-appar="4" data-e="10" data-gold="1" aria-hidden="true"></canvas>`
      : `<div class="piece"><canvas width="640" height="300" data-art="champion|${first.id}|${monthKey(P.y, P.m)}~${auraOf(first)}~5" aria-hidden="true"></canvas></div>`;
    layer.innerHTML = `<div class="ceremony winpop" role="dialog" aria-modal="true" aria-label="אלופת החודש">${tag}
      <span class="eyebrow" style="color:var(--gold)">${many ? "Champions" : "Champion"} · ${month}</span>
      <div class="winavs">${P.win.map(r => `<span class="crowned">${ICON.crown}${avatar(profile(r.id), "xl ring")}</span>`).join("")}</div>
      <h2 class="display">${joinHe(P.win.map(r => esc(profile(r.id).name)))}</h2>
      <p class="muted">${mine && !many ? `${month} היה שלך. את האלופה.` : many ? `האלופות של ${month}` : `האלופה של ${month}`}</p>
      <div class="winscore"><b class="display grad-text num" data-count="${top.points}" data-dec="0" dir="ltr">${top.points}</b>
        <span class="small muted">נקודות · ${top.played} ימים · <bdi dir="ltr">${top.acc}%</bdi> דיוק</span></div>
      <div class="themebox">${theme}</div>
      <div class="coinslot" id="popcoin"></div>
      <div class="popact" id="popact">${mine ? tokenBtn : popButtons()}</div></div>`;
    const a = AURAS[auraOf(first)].c;
    setTimeout(() => { if (POP === P) sparks(innerWidth / 2, innerHeight * 0.26, [a[0], a[1], a[2], "#F2C56B", "#ffffff"], 150, 9); }, 350);
    SFX.done(); buzz([20, 60, 20]);
  } else {
    applyAura(auraOf(v)); auraMood({ calm: 0.2, energy: 0.7, gold: 0.3 });
    layer.innerHTML = `<div class="ceremony giftpop" role="dialog" aria-modal="true" aria-label="מתנה מאבא">${tag}
      <span class="eyebrow" style="color:var(--gold)">From Dad</span>
      <h2 class="display">תודה על ההתמדה</h2>
      <p class="giftnote">${esc(P.note)}</p>
      <p class="small muted">${stats(v.id, P.y, P.m).played} ימים עם משימה ב${month}</p>
      <div class="coinslot" id="popcoin"></div>
      <div class="popact" id="popact">${tokenBtn}</div></div>`;
    SFX.good();
  }
  paintArt(layer);
}
/* The tap on "+1 token": the coin spins in under the rays, and the way on appears when it has landed. */
function popToken() {
  const P = POP, box = $(".ceremony", layer), slot = $("#popcoin", layer), act = $("#popact", layer);
  if (!P || !box || box.classList.contains("coining")) return;
  const kind = P.steps[P.i];
  box.classList.add("coining");
  slot.innerHTML = `<div class="rays" aria-hidden="true"></div><div class="coin3d" aria-hidden="true"><div class="face">${ICON.star.replace("<svg", '<svg fill="currentColor"')}</div><div class="face back"><span class="num">${+FAM.settings.tokenValue || 100}</span></div></div>`;
  act.innerHTML = "";
  auraMood({ energy: 1, gold: 1.4 }); SFX.coin(); buzz([30, 50, 30, 50, 60]);
  if (!P.preview) claimTok(P.viewer.id, (kind === "win" ? "winner " : "dedication ") + monthKey(P.y, P.m));
  setTimeout(() => {
    if (POP !== P || !slot.isConnected) return;
    const r = slot.getBoundingClientRect();
    sparks(r.left + r.width / 2, r.top + r.height / 2, ["#F2C56B", "#FFE9B0", "#ffffff"], 170, 9); SFX.done();
    act.innerHTML = `<p class="goldline">${kind === "win" ? "אסימון האלופה, בכספת שלך" : "עוד אסימון, בכספת שלך"}</p>${popButtons()}`;
  }, 1200);
}
/* She took this token in a popup: it gets no second ceremony, now or when the Sheet's grant reaches the phone. */
function claimTok(pid, reason) {
  L.seenTok = L.seenTok || {}; L.preTok = L.preTok || {};
  const n = +FAM.tokens[pid] || 0, was = L.seenTok[pid];
  if (!tokenLog().some(t => t.p === pid && t.reason === reason)) L.preTok[pid] = (L.preTok[pid] || 0) + 1;
  else if (was != null && n > was) L.seenTok[pid] = was + 1;
  save();
}
function closePops(then) {
  const P = POP;
  POP = null; layer.innerHTML = "";
  if (P.preview || !P.viewer) { applyAura("chrome"); show("parent"); if (!P.preview) luckCheck(null); return; }
  applyAura(auraOf(P.viewer)); show("home");
  if (then === "recap") openRecap(P.viewer.id); else luckCheck(P.viewer);
}
/* Dad's card for the gift: who, how many days of the month's last full week it takes, and his line. */
function bonusCard() {
  const b = bonusOf(), on = !!b && b.month === THIS_MONTH, week = lastFullWeek(Y, M), end = addDays(week, 6), days = on ? b.days : 5;
  const ids = on ? b.ids : FAM.profiles.map(p => p.id), [ny, nm] = M === 12 ? [Y + 1, 1] : [Y, M + 1];
  const span = `${+week.slice(8)}.${+week.slice(5, 7)} עד ${+end.slice(8)}.${+end.slice(5, 7)}`;
  const due = on ? b.ids.map(profile).filter(Boolean).filter(p => !(b.days > 0) || daysInWeekOf(p.id, b.week) >= b.days) : [];
  return `<section class="glass pad stack"><div class="row"><span class="eyebrow">A gift at month's end</span>${on ? `<span class="chip good">מתוזמן</span>` : `<span class="chip">כבוי</span>`}</div>
    <p class="small muted">ב־1 ב${MONTHS[nm - 1]}, אחרי החלון של אלופת החודש, כל מי שמסומנת כאן ועמדה בתנאי מקבלת אסימון, עם המילים שלך וכפתור ״+1 אסימון״.</p>
    <div class="field"><label>מי</label><div class="seg-pick" id="bids">${FAM.profiles.map(p => `<button type="button" data-act="pickBonus" data-id="${p.id}" aria-pressed="${ids.includes(p.id)}">${esc(p.name)} <span class="small" dir="ltr">${daysInWeekOf(p.id, week)}/7</span></button>`).join("")}</div>
      <span class="small faint">ליד כל שם: כמה ימים שיחקה בשבוע של ${span}.</span></div>
    <div class="field"><label>כמה ימים מהשבוע הזה צריך בשביל המתנה</label><div class="seg-pick" id="bdays">${[0, 3, 4, 5, 6, 7].map(k => `<button type="button" data-act="pickDays" data-k="${k}" aria-pressed="${k === days}">${k || "בלי תנאי"}</button>`).join("")}</div></div>
    <div class="field"><label for="bnote">המילים שלך</label><input id="bnote" maxlength="160" value="${esc(on && b.note ? b.note : BONUS_NOTE)}"></div>
    <div class="row" style="justify-content:flex-start"><button type="button" class="btn btn-primary" data-act="saveBonus">${on ? "עדכון" : "לתזמן"}</button>
      <button type="button" class="btn btn-ghost" data-act="popPreview">תצוגה מקדימה</button>${on ? `<button type="button" class="link" data-act="cancelBonus">לבטל את המתנה</button>` : ""}</div>
    ${on ? `<p class="small faint">${due.length ? `לפי הימים עד עכשיו, יקבלו: ${joinHe(due.map(p => esc(p.name)))}.` : "לפי הימים עד עכשיו, אף אחת עוד לא עמדה בתנאי."} אפשר לשנות עד סוף החודש.</p>` : ""}</section>`;
}

/* ---------- good luck (Avsha, 2026-11-26) ----------
 * "An auto-triggered popup that wishes good luck on a test a day before the test is held and appears once for all
 * of us, showing the profile pic/s, name/s and בהצלחה במבחן ב(מקצוע) מחר, with a nice animation and graphic."
 * The day before an exam in the Tests tab, each sister and Dad see it the first time they open the app: her photo
 * (the twins side by side when they sit the same exam on the same day) inside a laurel wreath that grows leaf by
 * leaf in her colours, the wish, and the day. Once per person and exam (L.seenLuck); someone who did not open the
 * app that day sees it on the exam's own morning instead, worded "today". Dad can see one from his Exams card. */
let LUCK = null;
const luckId = t => `${t.date}|${t.subj}|${t.p}`;
function luckDue(who) {
  const seen = (L.seenLuck || {})[who] || {}, groups = {};
  tests().filter(t => profile(t.p) && (t.date === TODAY || t.date === addDays(TODAY, 1)) && !seen[luckId(t)]).forEach(t => {
    const g = groups[t.date + "|" + t.subj] || (groups[t.date + "|" + t.subj] = { date: t.date, subj: t.subj, who: [], notes: [] });
    if (!g.who.includes(t.p)) g.who.push(t.p);
    if (t.note && !g.notes.includes(t.note)) g.notes.push(t.note);
  });
  const order = FAM.profiles.map(p => p.id);
  return Object.values(groups).map(g => Object.assign(g, { who: g.who.sort((a, b) => order.indexOf(a) - order.indexOf(b)) }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.subj < b.subj ? -1 : 1));
}
function luckCheck(viewer) {
  if (SANDBOX || !FAM || !FAM.profiles.length || layer.innerHTML) return false;
  const who = viewer ? viewer.id : "dad", steps = luckDue(who);
  // what is past is forgotten, so the list does not grow
  if (L.seenLuck && L.seenLuck[who]) { Object.keys(L.seenLuck[who]).forEach(k => { if (k.slice(0, 10) < TODAY) delete L.seenLuck[who][k]; }); }
  if (!steps.length) return false;
  LUCK = { steps, i: 0, viewer, who, preview: false, back: view };
  renderLuck();
  return true;
}
function renderLuck() {
  const X = LUCK, g = X.steps[X.i], v = X.viewer, girls = g.who.map(profile).filter(Boolean), today = g.date === TODAY && !X.preview;
  const mine = !!v && g.who.includes(v.id), when = today ? "היום" : "מחר", subj = SUBJ[g.subj] || g.subj;
  if (!X.preview) { L.seenLuck = L.seenLuck || {}; const m = L.seenLuck[X.who] = L.seenLuck[X.who] || {}; g.who.forEach(id => { m[luckId({ date: g.date, subj: g.subj, p: id })] = 1; }); save(); }
  applyAura(auraOf(girls[0])); auraMood({ calm: 0.1, energy: 0.9, gold: 0.25 });
  const line = mine ? (girls.length > 1 ? "בהצלחה לשתיכן. כולנו מחזיקים אצבעות." : "כולנו מחזיקים לך אצבעות.")
    : girls.length > 1 ? `${joinHe(girls.map(p => esc(p.name)))} נבחנות ${when}. שווה לאחל להן בהצלחה.` : `${esc(girls[0].name)} נבחנת ${when}. שווה לאחל לה בהצלחה.`;
  const last = X.i === X.steps.length - 1;
  layer.innerHTML = `<div class="ceremony luckpop n${Math.min(3, girls.length)}" role="dialog" aria-modal="true" aria-label="בהצלחה במבחן">
    ${X.preview ? `<span class="chip warn">תצוגה מקדימה</span>` : ""}
    <span class="eyebrow">Good luck</span>
    <div class="luckbox"><canvas class="luckcv" data-n="${girls.length}" aria-hidden="true"></canvas>
      <div class="luckavs">${girls.map((p, i) => `<span class="luckav" style="animation-delay:${0.25 + i * 0.14}s">${avatar(p, (girls.length > 2 ? "lg" : "xl") + " ring")}<b>${esc(p.name)}</b></span>`).join("")}</div></div>
    <h2 class="display">בהצלחה במבחן ב${esc(subj)} ${when}!</h2>
    <p class="muted">${line}</p>
    <p class="small faint">${dateHe(g.date)}${g.notes.length ? ` · ${g.notes.map(esc).join(" · ")}` : ""}</p>
    <button type="button" class="btn btn-primary" data-act="luckNext">${!last ? "המשך" : mine ? "תודה" : "בהצלחה!"}</button></div>`;
  paintArt(layer);
  const a = AURAS[auraOf(girls[0])].c;
  SFX.good(); buzz([15, 40, 15]);
  setTimeout(() => { if (LUCK === X && X.steps[X.i] === g) comet(a); }, 500);
  setTimeout(() => {
    const cv = $(".luckcv", layer);
    if (LUCK !== X || X.steps[X.i] !== g || !cv) return;
    const r = cv.getBoundingClientRect();
    sparks(r.left + r.width / 2, r.top + r.height * 0.42, [a[0], a[1], a[2], "#F2C56B", "#ffffff"], 110, 8); SFX.done();
  }, 1500);
}
function closeLuck() {
  const X = LUCK;
  LUCK = null; layer.innerHTML = "";
  if (!X) return;
  if (X.preview || !X.viewer) { applyAura("chrome"); show("parent"); return; }
  applyAura(auraOf(X.viewer)); show(X.back === "parent" ? "home" : X.back);
}
/* The wreath: two branches of leaves that grow from the foot up each side of her photo, a light running along them
 * once they are grown, and motes rising behind. Drawn in the colours on screen (hers). */
function liveLuck(cv) {
  const { ctx, W, H } = sized(cv), n = Math.max(1, +cv.dataset.n || 1), cx = W / 2, cy = H / 2 - 12;
  const rx = Math.min(W / 2 - 22, n === 1 ? 92 : n === 2 ? 152 : 164), ry = n === 1 ? 92 : n === 2 ? 92 : 76;
  const cols = [cssVar("--a1") || "#A855F7", cssVar("--a2") || "#EC4899", cssVar("--a3") || "#6366F1"];
  const per = n === 1 ? 12 : 16, leaves = [];
  // A pair of leaves at each node of a branch, one leaning out and one in. A node at angle a on the left branch
  // (90° is the foot, 270° the top), mirrored for the right one; the leaves get smaller toward the tip.
  for (const side of [-1, 1]) for (let i = 0; i < per; i++) {
    const a = (99 + (i + 0.5) / per * 150) * Math.PI / 180, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, tx = -Math.sin(a) * rx, ty = Math.cos(a) * ry;
    const along = Math.atan2(ty, side < 0 ? tx : -tx), size = 1 - 0.3 * (i / per);
    for (const lean of [1, -1]) leaves.push({ i, x: cx + (side < 0 ? ex : -ex), y: cy + ey, dir: along + lean * 0.62 * (side < 0 ? 1 : -1),
      at: 0.3 + i * 0.065 + (lean < 0 ? 0.05 : 0), len: (lean > 0 ? 23 : 18) * size, c: cols[(i + (lean > 0 ? 0 : 1)) % 3] });
  }
  const motes = Array.from({ length: 26 }, (_, i) => { const r = rng(hash("mote" + i)); return { x: r() * W, s: 1 + r() * 2.2, v: 14 + r() * 22, p: r() * 10, c: i % 4 === 3 ? "#ffffff" : cols[i % 3], sw: 6 + r() * 12 }; });
  const grown = 0.3 + per * 0.065 + 0.55;
  animate(cv, t => {
    ctx.clearRect(0, 0, W, H);
    motes.forEach(m => {
      const life = ((t * m.v / (H + 20)) + m.p) % 1, y = H + 10 - life * (H + 20);
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.5; ctx.fillStyle = m.c;
      ctx.beginPath(); ctx.arc(m.x + Math.sin(t * 0.8 + m.p * 7) * m.sw, y, m.s, 0, 7); ctx.fill();
    });
    // the two stems, as far as the leaves have come
    const k = Math.max(0, Math.min(1, (t - 0.2) / (per * 0.065 + 0.3)));
    ctx.lineWidth = 2.4; ctx.lineCap = "round";
    for (let side = -1; side <= 1; side += 2) {
      const g = ctx.createLinearGradient(cx, cy + ry, cx, cy - ry); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
      ctx.strokeStyle = g; ctx.globalAlpha = 0.8; ctx.beginPath();
      for (let j = 0; j <= 40 * k; j++) { const a = (93 + j / 40 * 156) * Math.PI / 180, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; ctx[j ? "lineTo" : "moveTo"](cx + (side < 0 ? ex : -ex), cy + ey); }
      ctx.stroke();
    }
    leaves.forEach(l => {
      const e = easeOut((t - l.at) / 0.45);
      if (e <= 0) return;
      const glow = t > grown ? Math.max(0, Math.sin(t * 2.2 - l.i * 0.42)) : 0;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.dir); ctx.scale(e, e);
      ctx.globalAlpha = 0.72 + 0.28 * glow; ctx.fillStyle = l.c;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(l.len * 0.45, -l.len * 0.42, l.len, 0); ctx.quadraticCurveTo(l.len * 0.45, l.len * 0.42, 0, 0); ctx.fill();
      if (glow > 0.05) { ctx.globalAlpha = glow * 0.55; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(l.len * 0.15, 0); ctx.quadraticCurveTo(l.len * 0.5, -l.len * 0.16, l.len * 0.85, 0); ctx.quadraticCurveTo(l.len * 0.5, l.len * 0.1, l.len * 0.15, 0); ctx.fill(); }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }, 40);
}

/* ---------- the formula sheet (the eldest, 2026-11-22) ----------
 * In a math test her class is handed a sheet of formulas, and the app asked the same questions without it: her
 * example was "what can be said of x² + 2x + 5 = 0?", which wants the roots' formula. A math question now has a
 * "formulas" button that opens the sheet over it: what the Ministry's sheet gives for the topics her class has
 * reached, and no more (the rule about the sign under the root is hers to know). The whole sheet every time, as in
 * the test: picking the formula is part of the question. Add a section when a topic with formulas opens. */
const FORMULAS = {
  "g10-math": [
    ["אלגברה", [["נוסחאות הכפל המקוצר", "{(a ± b)² = a² ± 2ab + b²}"], ["", "{(a + b)(a − b) = a² − b²}"],
                ["שורשי המשוואה {ax² + bx + c = 0}", "{x₁,₂ = (−b ± √(b² − 4ac)) / 2a}"]]],
    ["הישר", [["שיפוע דרך שתי נקודות", "{m = (y₂ − y₁) / (x₂ − x₁)}"], ["משוואת הישר", "{y = mx + n}"],
              ["ישר ששיפועו {m} דרך {(x₁, y₁)}", "{y − y₁ = m(x − x₁)}"], ["ישרים מקבילים", "{m₁ = m₂}"], ["ישרים מאונכים", "{m₁ · m₂ = −1}"]]],
    ["נקודות", [["אמצע קטע", "{x = (x₁ + x₂) / 2}   {y = (y₁ + y₂) / 2}"], ["מרחק בין שתי נקודות", "{d = √((x₂ − x₁)² + (y₂ − y₁)²)}"]]],
    ["גאומטריה", [["משפט פיתגורס", "{a² + b² = c²}"], ["שטח משולש", "{S = (a · h) / 2}"], ["שטח מקבילית", "{S = a · h}"],
                  ["שטח מעוין", "{S = (d₁ · d₂) / 2}"], ["שטח טרפז", "{S = ((a + b) · h) / 2}"]]]
  ]
};
function openFormulas(pool) {
  const f = FORMULAS[pool];
  if (!f || $(".formbg")) return;
  const el = document.createElement("div");
  el.className = "sheet-bg formbg"; el.dataset.act = "closeFormulas";
  el.innerHTML = `<div class="sheet formulas" role="dialog" aria-modal="true" aria-label="דף נוסחאות"><h3>דף נוסחאות</h3>
    ${f.map(([head, list]) => `<section><span class="eyebrow">${esc(head)}</span>${list.map(([name, text]) => `<div class="frow">${name ? `<span class="small muted">${fmt(name)}</span>` : ""}<span class="fx" dir="ltr">${fmt(text)}</span></div>`).join("")}</section>`).join("")}
    <button type="button" class="btn btn-primary wide" data-act="formulasDone">חזרה לשאלה</button></div>`;
  document.body.appendChild(el);
}

/* ---------- the quest ---------- */
let Q = null;
/* A round is the day's five (and a revenge round) or a practice round. Its queue is the items in order, and a
 * question answered wrong joins the end of it again, until she gets it right (Avsha, 2026-11-14: tapping at random
 * finished a day in seconds and nothing made her read the explanation; now reading it is the quickest way out).
 * Only the first answer is recorded and scored, with the seconds it took. */
function newRound(kind, p, items) {
  return { kind, pid: p.id, items, queue: items.map((_, k) => k), i: 0, res: [], secs: [], fixed: [], combo: 0,
           fifty: false, halfAt: -1, locked: false, t0: 0, form: "choice", ord: null, typed: "", m: null, flags: [] };
}
const idsOf = items => items.map(it => it.q.id).join();
const cur = () => Q.items[Q.queue[Q.i]];
const again = () => Q.queue.indexOf(Q.queue[Q.i]) < Q.i;
const tryNo = () => Q.queue.slice(0, Q.i + 1).filter(k => k === Q.queue[Q.i]).length;
function startQuest() {
  const p = me();
  if (waiting()) { toast("רגע, מתעדכן…"); return; }
  if (playedOn(p.id, TODAY)) { show("home"); return; }
  const set = dailySet(p, TODAY), rev = revengeFor(p, TODAY, set);
  const items = set.map(q => ({ q, rev: false }));
  if (rev) items.push({ q: rev, rev: true });
  Q = newRound("day", p, items);
  const sv = L.progress[p.id];
  if (sv && sv.date === TODAY && sv.ids === idsOf(items)) {
    Object.assign(Q, { i: sv.i, res: sv.res || [], secs: sv.secs || [], fixed: sv.fixed || [], fifty: !!sv.fifty, combo: sv.combo || 0,
                       halfAt: sv.halfAt == null ? -1 : sv.halfAt, flags: sv.flags || [] });
    // progress kept by the version before the redo round: what she had missed still comes back
    Q.queue = Array.isArray(sv.queue) ? sv.queue : Q.queue.concat(Q.queue.filter(k => k < sv.i && !Q.res[k]));
    // She answered and left before "next": she has seen the answer, so the round moves on. (It used to show the
    // question again, unanswered: miss, look, leave, come back and get it right.)
    if (sv.locked) { if (Q.i >= Q.queue.length - 1) { finishQuest(); return; } Q.i++; }
  }
  renderQuestion();
}
/* The round opens out of the button that started it: a disc of her colours floods out from where the button was
 * (r, read before the screen changed) and thins away over the first question. It is a picture over the page that
 * takes no taps. The first version clipped the round itself to a growing circle, and a clip also cuts taps: a quick
 * tap outside the circle in the first half second was lost (found by the live test, 2026-11-14). */
function iris(r) {
  const q = $(".quiz", layer);
  if (!q || REDUCED) return;
  const x = r.left + r.width / 2, y = r.top + r.height / 2, d = 2.3 * Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const f = document.createElement("div");
  f.className = "irisfx"; f.style.cssText = `left:${x - d / 2}px;top:${y - d / 2}px;width:${d}px;height:${d}px`;
  document.body.appendChild(f); setTimeout(() => f.remove(), 800);
  q.classList.add("iris");
}
function startPractice() {
  if (waiting()) { toast("רגע, מתעדכן…"); return; }
  const p = me(), set = practiceSet(p);
  if (!set.length) { toast("אין כרגע מה לתרגל. מחר יהיו שאלות חדשות."); return; }
  Q = newRound("practice", p, set.map(q => ({ q, rev: false })));
  renderQuestion();
}
/* The lesson's first screen: the idea and an example worked through. Its questions are a round of kind "fix". */
function startFix() {
  if (waiting()) { toast("רגע, מתעדכן…"); return; }
  const p = me(), fx = fixOffer(p);
  if (!fx) { show("home"); return; }
  Q = newRound("fix", p, fx.set.map(q => ({ q, rev: false })));
  Q.topic = fx.st.topic;
  const ex = fx.example;
  auraMood({ calm: 1, energy: 0.2 });
  layer.innerHTML = quizShell(`
    <div class="row"><span class="eyebrow">Focus · ${SUBJ[subjOf(fx.st.pool)]}</span><button type="button" class="round" data-act="closeQuiz" aria-label="סגירה">${ICON.close}</button></div>
    <h2 class="display fixhead">${esc(fx.st.topic)}</h2>
    ${fx.idea ? `<section class="glass pad stack"><span class="eyebrow">The idea</span><ul class="idea">${fx.idea.map(t => `<li>${fmt(t)}</li>`).join("")}</ul></section>` : ""}
    ${ex ? `<section class="glass pad stack"><span class="eyebrow">Worked example</span>
      <p class="exq" ${ex.ltr ? 'dir="ltr"' : ""}>${fmt(ex.q)}</p>
      <p>התשובה: <b dir="${optDir(ex.options[0])}">${fmt(ex.options[0])}</b></p>
      <p class="muted" ${ex.ltr ? 'dir="ltr"' : ""}>${fmt(ex.explain)}</p></section>` : ""}
    <button type="button" class="btn btn-primary wide" data-act="fixGo">הבנתי, לשאלות</button>
    <p class="small faint" style="text-align:center">${fx.set.length === 1 ? "שאלה אחת" : `${fx.set.length} שאלות`}, מהקלה לקשה. חיזוק שהושלם שווה ${POINTS.lesson} נקודות.</p>`);
  $(".quiz-in", layer).classList.add("reveal");
}
function keepProgress() {
  if (Q.kind !== "day") return;
  L.progress[Q.pid] = { date: TODAY, ids: idsOf(Q.items), queue: Q.queue, i: Q.i, res: Q.res, secs: Q.secs, fixed: Q.fixed,
                        fifty: Q.fifty, halfAt: Q.halfAt, combo: Q.combo, locked: Q.locked, flags: Q.flags };
  save();
}
/* "We have not learned this yet" (Avsha, 2026-11-22: the twins' math is not yet limited to what their class has
 * reached, and a girl has no way to say so but to complain): a mark she can put on any question, before or after
 * answering. She answers it all the same and it counts as any other. The mark goes to the Sheet with her answer
 * (the question's text, so the evening email can quote it), and Dad's Today lists the last two weeks' marks. The
 * script keeps it from version 4 on, so the button waits for that. */
const FLAG = { days: 14 };
const canFlag = () => !LIVE || !!SANDBOX || (FAM.api | 0) >= 4;
const flagText = on => on ? "סימנת שעוד לא למדתן את זה. אבא יראה, ועדיין צריך לענות." : "עוד לא למדנו את זה";
/* How a question is asked (Avsha, 2026-11-14: four options are only recognised, and a tap at random is right a
 * quarter of the time).
 * Typed: a math question whose four options are plain numbers, with the same "x =" before them or unit after, is
 * answered on a number pad; "which of the following" questions and thousands written with a comma stay options,
 * and a question with "choice": true in its bank does too.
 * Match: a "What does “word” mean?" question becomes four words to pair with their meanings, hers and three more
 * of her own share; it is right only with no wrong pair.
 * 50:50 on a typed question shows it with two of its options. */
const NUM_OPT = /^\{?\s*((?:[a-zA-Z]\s*=\s*)?)([-−]?\d+(?:\.\d+)?)\s*([^\d{}]*?)\s*\}?$/;
function typedOf(q) {
  if (q.choice || subjOf(q.pool) !== "math" || /הבאים|הבאות|בקירוב/.test(q.q)) return null;
  const m = q.options.map(o => NUM_OPT.exec(o)), tidy = x => x.replace(/\s+/g, " ").trim();
  if (m.some(x => !x)) return null;
  const pre = tidy(m[0][1]), suf = m[0][3];
  if (m.some(x => tidy(x[1]) !== pre || x[3] !== suf)) return null;
  return { pre, suf, val: parseFloat(m[0][2].replace("−", "-")) };
}
const VOCAB = /^What does [“"](.+?)[”"] mean\??$/;
function matchOf(prof, q) {
  const m = VOCAB.exec(q.q);
  if (!m || optDir(q.options[0]) !== "rtl") return null;
  const pairs = [{ a: m[1], b: q.options[0] }];
  const cand = shuffle(shareOf(prof, q.pool).filter(x => x.id !== q.id && studied(prof, x)), rng(hash("match|" + q.id + "|" + prof.id + "|" + TODAY)));
  for (const x of cand) {
    const w = VOCAB.exec(x.q);
    if (!w || optDir(x.options[0]) !== "rtl" || pairs.some(y => y.a === w[1] || y.b === x.options[0])) continue;
    // A fifth meaning that belongs to none of the four words (Avsha, 2026-11-22: in their first eleven days all
    // three got every matching right, 20 of 20, since the last pair of four is given away by the other three).
    if (pairs.length === 4) { pairs.decoy = x.options[0]; break; }
    pairs.push({ a: w[1], b: x.options[0] });
  }
  return pairs.length === 4 ? pairs : null;
}
const orderOf = (q, n) => shuffle([0, 1, 2, 3], rng(hash(TODAY + "|" + Q.pid + "|" + q.id + (n > 1 ? "|" + n : ""))));
function quizShell(inner) { return `<div class="quiz" role="dialog" aria-modal="true" aria-label="המשימה של היום"><div class="aura calm" aria-hidden="true"><i></i><i></i><i></i></div><div class="quiz-in">${inner}</div></div>`; }
function segs() {
  const at = Q.queue[Q.i], redo = again();
  return `<div class="segs">${Q.items.map((it, k) => {
    const st = Q.res[k] == null ? (k === at ? "cur" : "") : Q.res[k] ? "done" : Q.fixed[k] ? "done fixed" : "done bad";
    return `<span class="seg ${it.rev ? "rev" : ""} ${st} ${redo && k === at ? "now" : ""}"><i></i></span>`;
  }).join("")}</div>`;
}
function renderQuestion(keepClock) {
  const k = Q.queue[Q.i], it = Q.items[k], q = it.q, ltr = !!q.ltr, redo = again(), n = tryNo(), half = Q.halfAt === Q.i;
  const T = half ? null : typedOf(q), pairs = half || T ? null : matchOf(profile(Q.pid), q);
  Q.form = T ? "typed" : pairs ? "match" : "choice"; Q.locked = false; Q.typed = ""; Q.m = null;
  if (!keepClock) Q.t0 = performance.now();
  auraMood({ calm: 1, energy: Math.min(1, Q.combo / 5) });
  const lv = [1, 2, 3].map(x => `<i class="${x <= q.level ? "on" : ""}"></i>`).join("");
  const canSpeak = ltr && !pairs && "speechSynthesis" in window;
  let body;
  if (T) {
    const he = optDir(T.suf) === "rtl";
    body = `<div class="typed" id="typed"><span class="tv" dir="ltr">${T.pre ? `<span>${esc(T.pre)}</span>` : ""}<b id="tval"></b><i class="caret"></i>${T.suf && !he ? `<span>${esc(T.suf)}</span>` : ""}</span>${he ? `<span class="unit">${esc(T.suf)}</span>` : ""}</div>
    <div class="numpad" dir="ltr">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "−", "0", "."].map(c => `<button type="button" data-act="num" data-k="${c}"${c === "−" ? ' aria-label="מינוס"' : ""}>${c}</button>`).join("")}</div>
    <div class="numrow"><button type="button" class="btn btn-ghost" data-act="num" data-k="del" aria-label="מחיקה">⌫</button><button type="button" class="btn btn-primary" data-act="numGo" id="numGo" disabled>בדיקה</button></div>`;
  } else if (pairs) {
    const r = rng(hash("sides|" + q.id + "|" + Q.pid + "|" + TODAY + "|" + n));
    Q.m = { sel: null, done: 0, miss: 0 };
    const col = (side, ord) => `<div class="mcol">${ord.map(i => `<button type="button" class="mbtn" data-act="pair" data-side="${side}" data-k="${i}" aria-pressed="false" dir="${side === "a" ? "ltr" : "rtl"}">${esc(i === "x" ? pairs.decoy : pairs[i][side])}</button>`).join("")}</div>`;
    body = `<div class="match" dir="ltr">${col("a", shuffle([0, 1, 2, 3], r))}${col("b", shuffle(pairs.decoy ? [0, 1, 2, 3, "x"] : [0, 1, 2, 3], r))}</div>`;
  } else {
    const ord = Q.ord = orderOf(q, n), keys = ltr ? ["A", "B", "C", "D"] : ["א", "ב", "ג", "ד"], right = ord.indexOf(0);
    const gone = new Set(half ? shuffle([0, 1, 2, 3].filter(x => x !== right), rng(hash(TODAY + Q.pid + q.id + "half"))).slice(0, 2) : []);
    body = `<div class="opts" ${ltr ? 'dir="ltr"' : ""}>${ord.map((oi, j) => `<button type="button" class="opt ${gone.has(j) ? "gone" : ""}" data-act="answer" data-j="${j}" ${gone.has(j) ? "disabled" : ""}><span class="k">${keys[j]}</span><span dir="${optDir(q.options[oi])}">${fmt(q.options[oi])}</span></button>`).join("")}</div>`;
  }
  const tag = redo ? `<span class="revtag again">${ICON.revenge.replace("<svg", '<svg width="16" height="16"')} שוב, עד שזה נכון</span>`
    : it.rev ? `<span class="revtag">${ICON.revenge.replace("<svg", '<svg width="16" height="16"')} סיבוב נקמה · <bdi dir="ltr">+${POINTS.revenge}</bdi></span>`
    : Q.kind === "practice" ? `<span class="revtag again">תרגול · בלי נקודות</span>` : Q.kind === "fix" ? `<span class="revtag again">חיזוק</span>` : "";
  layer.innerHTML = quizShell(`
    ${segs()}
    <div class="qhead"><button type="button" class="round" data-act="quit" aria-label="${Q.kind === "day" ? "יציאה, ההתקדמות נשמרת" : Q.kind === "fix" ? "סיום החיזוק" : "סיום התרגול"}">${ICON.close}</button>
      <span class="combo" id="combo" ${Q.combo >= 2 ? "" : "hidden"}>${ICON.flame.replace("<svg", '<svg width="20" height="20"')}<span dir="ltr">×${Q.combo}</span></span></div>
    <div class="qsubj"><span class="chip"><i></i>${SUBJ[subjOf(q.pool)]} · ${esc(q.topic)}</span><span class="lvl-dots" aria-label="רמה ${q.level} מתוך 3">${lv}</span>${tag}</div>
    ${pairs ? `<h2 class="q">חברי כל מילה לפירוש שלה</h2>${pairs.decoy ? `<p class="small muted" style="margin-top:-10px">יש פירוש אחד מיותר.</p>` : ""}` : `<h2 class="q" ${ltr ? 'dir="ltr"' : ""}>${fmt(q.q)}</h2>`}
    ${SANDBOX && !pairs ? `<p class="small faint sandhint">ניסיון · התשובה הנכונה: <b dir="${optDir(q.options[0])}">${fmt(q.options[0])}</b></p>` : ""}
    ${body}
    <div class="qtools">${pairs ? "<span></span>" : `<button type="button" class="tool" data-act="fifty" ${Q.fifty ? "disabled" : ""}>${ICON.half} 50:50${Q.fifty ? " · נוצל" : ""}</button>`}
      ${FORMULAS[q.pool] ? `<button type="button" class="tool" data-act="formulas" data-pool="${q.pool}"><b class="fsign" dir="ltr">ƒ</b> נוסחאות</button>` : ""}
      ${canSpeak ? `<button type="button" class="tool" data-act="listen">${ICON.listen} Listen</button>` : ""}
      <span class="small faint num">${redo ? `תיקון · נשארו ${Q.queue.length - Q.i}` : `<bdi dir="ltr">${k + 1} / ${Q.items.length}</bdi>`}</span></div>
    ${canFlag() ? `<button type="button" class="flag" data-act="flag" aria-pressed="${!!Q.flags[k]}">${ICON.flag}<span>${flagText(Q.flags[k])}</span></button>` : ""}
    <div id="explain"></div>`);
}
function answer(j, btn) {
  if (Q.locked || Q.form !== "choice" || btn.disabled) return;
  const right = Q.ord.indexOf(0);
  $$(".opt", layer).forEach((b, x) => { b.disabled = true; b.classList.add(x === right ? "right" : x === j ? "wrong" : "dim"); });
  settle(j === right, btn);
}
function numKey(c) {
  if (Q.locked || Q.form !== "typed") return;
  let t = Q.typed;
  if (c === "del") t = t.slice(0, -1);
  else if (c === "−") t = t.startsWith("−") ? t.slice(1) : "−" + t;
  else if (c === ".") { if (!t.includes(".")) t += /\d$/.test(t) ? "." : "0."; }
  else if (t.replace(/\D/g, "").length < 8) t += c;
  Q.typed = t; SFX.tap();
  $("#tval", layer).textContent = t;
  $("#numGo", layer).disabled = !/\d/.test(t);
}
function numGo() {
  if (Q.locked || Q.form !== "typed" || !/\d/.test(Q.typed)) return;
  const q = cur().q, ok = Math.abs(parseFloat(Q.typed.replace("−", "-")) - typedOf(q).val) < 1e-9, box = $("#typed", layer);
  box.classList.add(ok ? "right" : "wrong");
  $$(".numpad, .numrow", layer).forEach(x => x.remove());
  settle(ok, box, ok ? "" : q.options[0]);
}
function pairTap(b) {
  if (Q.locked || Q.form !== "match" || b.disabled) return;
  const m = Q.m, sel = m.sel;
  if (!sel || sel.dataset.side === b.dataset.side) {
    if (sel) sel.setAttribute("aria-pressed", "false");
    m.sel = sel === b ? null : b;
    if (m.sel) b.setAttribute("aria-pressed", "true");
    SFX.tap(); return;
  }
  sel.setAttribute("aria-pressed", "false"); m.sel = null;
  if (sel.dataset.k === b.dataset.k) {
    [sel, b].forEach(x => { x.disabled = true; x.classList.add("right"); });
    m.done++; buzz(10);
    if (m.done === 4) { $$(".mbtn:not(.right)", layer).forEach(x => { x.disabled = true; x.classList.add("dim"); }); settle(m.miss === 0, b); } else SFX.tap();
  } else {
    m.miss++; SFX.bad(); buzz([30, 40, 30]);
    [sel, b].forEach(x => { x.classList.remove("wrong"); void x.offsetWidth; x.classList.add("wrong"); setTimeout(() => x.classList.remove("wrong"), 450); });
  }
}
/* An answer is in: `shown` is the right answer, when her own does not show it (a typed one). */
function settle(ok, el, shown) {
  Q.locked = true;
  const k = Q.queue[Q.i], it = Q.items[k], q = it.q, redo = again(), day = Q.kind === "day";
  if (!redo) { Q.res[k] = ok; Q.secs[k] = Math.max(0.1, Math.min(999, Math.round((performance.now() - Q.t0) / 100) / 10)); }
  else if (ok) Q.fixed[k] = true;
  if (!ok) Q.queue.push(k);
  const sg = $(".segs", layer); if (sg) sg.outerHTML = segs();
  const rect = el.getBoundingClientRect(), a = AURAS[auraOf(me())].c, c = $("#combo", layer);
  if (ok) {
    SFX.good(); buzz(15);
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, bar = $$(".seg", layer)[k];
    sparks(cx, cy, [a[0], a[1], "#ffffff", "#3EE6A4"], redo ? 10 : 22, redo ? 3 : 5);
    ring(cx, cy, redo ? "#ffffff" : a[0], redo ? 60 : 120); auraPulse(cx, cy);
    if (!redo) {
      Q.combo++;
      if (bar) { const br = bar.getBoundingClientRect(); streamTo(cx, cy, br.left + br.width / 2, br.top + 2, [a[0], a[1], "#ffffff"], 10); }
      auraMood({ energy: Math.min(1, Q.combo / 5) });
      if (Q.combo === 3 || Q.combo === 5) comet(a);
      if (day) {
        const f = document.createElement("div"); f.className = "fly"; f.dir = "ltr"; f.textContent = "+" + (it.rev ? POINTS.revenge : POINTS.right);
        f.style.left = (rect.left + rect.width / 2) + "px"; f.style.top = (rect.top - 10) + "px"; document.body.appendChild(f); setTimeout(() => f.remove(), 1100);
      }
      if (Q.combo >= 2 && c) { c.hidden = false; $("span", c).textContent = "×" + Q.combo; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }
    }
  } else { Q.combo = 0; if (c) c.hidden = true; SFX.bad(); buzz([30, 40, 30]); auraMood({ dim: 1, energy: 0 }); }
  keepProgress();
  const last = Q.i === Q.queue.length - 1, toRedo = !last && Q.i === Q.items.length - 1;
  const head = ok ? (redo ? "עכשיו כן." : ["בול.", "נכון.", "יש.", "מדויק.", "בדיוק ככה."][(Q.i + Q.combo) % 5])
    : redo ? "עוד לא. היא תחזור שוב." : "כמעט. היא תחזור בסוף.";
  $("#explain", layer).innerHTML = `<section class="glass explain ${ok ? "ok" : "no"}"><h3>${head}</h3>
    ${shown ? `<p>התשובה: <b dir="${optDir(shown)}">${fmt(shown)}</b></p>` : ""}<p ${q.ltr ? 'dir="ltr"' : ""}>${fmt(q.explain)}</p>
    <button type="button" class="btn btn-primary wide" data-act="next">${last ? (day ? "לתוצאה" : "לסיכום") : toRedo ? "לתיקונים" : "הבאה"}</button></section>`;
  const nb = $("[data-act=next]", layer);
  nb.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" });
  nb.focus({ preventScroll: true });
}
function useFifty() {
  if (Q.fifty || Q.locked || Q.form === "match") return;
  Q.fifty = true; Q.halfAt = Q.i; SFX.tap(); keepProgress();
  renderQuestion(true);
}
async function finishQuest() {
  const p = me(), day = Q.kind === "day", before = stats(p.id, Y, M), kb = knowOf(p), wb = weeksOf(p.id), add = [];
  const fadedOf = () => knowMap(p).flatMap(x => x.topics.filter(t => t.fade).map(t => t.t)), fb = fadedOf(), sb = SANDBOX ? null : sisOf();
  Q.items.forEach((it, k) => {
    if (Q.res[k] != null) add.push({ d: TODAY, p: p.id, q: it.q.id, pool: it.q.pool, t: it.q.topic, l: it.q.level, ok: Q.res[k] ? 1 : 0,
                                    r: day ? (it.rev ? 1 : 0) : Q.kind === "fix" ? 3 : 2, s: Q.secs[k] || 0, f: Q.flags[k] ? it.q.q.slice(0, 300) : "" });
  });
  if (!add.length) { Q = null; layer.innerHTML = ""; show("home"); return; }
  if (SANDBOX) L.sand.rows.push(...add); else if (LIVE) L.outbox.push({ p: p.id, d: TODAY, rows: add }); else L.rows.push(...add);
  if (day) delete L.progress[p.id];
  save();
  const after = stats(p.id, Y, M), ka = knowOf(p), wa = weeksOf(p.id), lvl = n => Math.min(KNOW, n || 0);
  const grew = Object.keys(ka).filter(k => lvl(ka[k]) > lvl(kb[k])).map(k => ({ t: k.slice(k.indexOf("|") + 1), n: lvl(ka[k]) }));
  const fa = new Set(fadedOf()), relit = fb.filter(t => !fa.has(t)), sa = SANDBOX ? null : sisOf();
  relit.forEach(t => { if (!grew.some(g => g.t === t)) grew.push({ t, n: KNOW }); });
  if (day) {
    const tier = renderResult(p, after.points - before.points, after.fullWeeks > before.fullWeeks, after, { grew, wb, wa, relit, sis: sb && sa && !sb.done && sa.done ? sa : null }), a = AURAS[auraOf(p)].c;
    if (tier) { SFX.done(); buzz([20, 60, 20]); } else buzz(20);
    auraMood({ calm: 0.35, energy: [0.12, 0.45, 0.75, 1][tier], gold: tier === 3 ? 1.3 : 0 });
    if (tier >= 2) setTimeout(() => sparks(innerWidth / 2, innerHeight * 0.28, [a[0], a[1], a[2], "#F2C56B", "#ffffff"], tier === 3 ? 170 : 80, tier === 3 ? 10 : 7), 250);
  } else if (Q.kind === "fix") { renderFixDone(p, grew); SFX.done(); auraMood({ calm: 0.35, energy: 0.6 }); }
  else { renderPractice(p, grew); SFX.done(); auraMood({ calm: 0.35, energy: 0.5 }); }
  if (LIVE && !SANDBOX) flush().then(okd => { if (okd) refresh().then(fetchPhotos).catch(() => {}); });
}
function flavorBlock(p, items, res, st) {
  const ok = res.filter(Boolean).length, total = res.length, reg = items.filter(it => !it.rev).length;
  const regOk = items.reduce((s, it, k) => s + (!it.rev && res[k] ? 1 : 0), 0);
  if (p.flavor === "routine") {
    let dsc = 0; items.forEach((it, k) => { if (res[k]) dsc += 1 + 0.5 * it.q.level; });
    const e = Math.max(0, 10 - 1.3 * (total - ok));
    return `<section class="glass routine"><div class="row"><span class="eyebrow">Routine · ${APPARATUS[mod(dayIndex(TODAY), 5)]}</span><span class="eyebrow num">${D}.${M}</span></div>
      <canvas class="appar" data-appar="${mod(dayIndex(TODAY), 5)}" data-e="${e.toFixed(2)}" data-gold="${ok === total ? 1 : 0}" aria-hidden="true"></canvas>
      <div class="scores num" dir="ltr"><div><small>D</small><b data-count="${dsc.toFixed(2)}">${dsc.toFixed(2)}</b></div><div><small>E</small><b data-count="${e.toFixed(2)}">${e.toFixed(2)}</b></div><div class="tot"><small>TOTAL</small><b class="grad-text" data-count="${(dsc + e).toFixed(2)}">${(dsc + e).toFixed(2)}</b></div></div>
      <p class="small muted">D: כל תשובה נכונה לפי הקושי שלה. E: עשר, פחות 1.30 על כל טעות.</p></section>`;
  }
  if (p.flavor === "stage") {
    const lit = 6 + regOk * 3;
    const head = regOk === reg ? "Encore" : regOk >= reg - 1 ? "Standing ovation" : regOk >= 3 ? "Great set" : "Soundcheck";
    const sub = regOk === reg ? "הקהל לא מוכן ללכת הביתה." : regOk >= 3 ? "הקהל איתך." : "חזרה גנרלית. מחר על הבמה.";
    return `<section class="glass stage"><span class="eyebrow">Live · track ${st.played} · ${MONTHS[M - 1]}</span><canvas class="stagecv" data-lit="${Math.min(26, lit + 2)}" data-tier="${regOk === reg ? 3 : regOk >= reg - 1 ? 2 : regOk >= 3 ? 1 : 0}" aria-hidden="true"></canvas>
      <span class="display grad-text" style="font-size:48px">${head}</span><p class="muted">${sub}</p>
      <div class="stars" aria-label="${regOk} מתוך ${reg}">${Array.from({ length: reg }, (_, i) => `<span class="${i < regOk ? "on" : ""}" style="animation-delay:${0.2 + i * 0.12}s">★</span>`).join("")}</div></section>`;
  }
  const names = ["Study", "Composition", "Fragment", "Étude", "Nocturne"], aura = auraOf(p);
  return `<figure class="glass piece" style="margin:0"><canvas width="640" height="800" data-art="${p.id}|${TODAY}~${aura}~${regOk}"></canvas>
    <figcaption><b dir="ltr">${names[mod(dayIndex(TODAY), 5)]} in ${AURAS[aura].name}</b><span class="small muted" dir="ltr">Nº ${st.played} · ${regOk}/${reg}</span></figcaption></figure>`;
}
const ktRow = (t, n, fade) => `<div class="kt ${fade ? "fade" : n >= KNOW ? "known" : n ? "" : "new"}"><bdi>${esc(t)}</bdi><span class="ktend">${fade ? `<span class="small faint">דוהה</span>` : ""}<span class="pips" role="img" aria-label="${fade ? "דוהה" : `${n} מתוך ${KNOW}`}">${[1, 2, 3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span></span></div>`;
const reviewList = () => Q.items.map((it, k) => Q.res[k] == null ? "" : `<div class="rv"><span class="mk ${Q.res[k] ? "ok" : "no"}">${Q.res[k] ? "✓" : "✗"}</span>
    <span class="t"><b>${SUBJ[subjOf(it.q.pool)]} · ${esc(it.q.topic)}${it.rev ? " · נקמה" : ""}</b>${!Q.res[k] && Q.fixed[k] ? ` <span class="small faint">תיקנת</span>` : ""}<br><span class="muted" ${it.q.ltr ? 'dir="ltr"' : ""}>${fmt(it.q.q)}</span></span></div>`).join("");
/* The screen after the five follows the score (Avsha, 2026-11-14: one right of six got the same big gradient number
 * and artwork as a perfect day): a perfect day is named and showered, four of five gets sparks, three is plain, and
 * below that the number is small and grey, what she missed comes first and her artwork after it. Returns the tier. */
function renderResult(p, gained, weekBonus, st, x) {
  const reg = Q.items.filter(it => !it.rev).length, regOk = Q.items.reduce((n, it, k) => n + (!it.rev && Q.res[k] ? 1 : 0), 0);
  const ok = Q.res.filter(Boolean).length, tier = regOk >= reg ? 3 : regOk === reg - 1 ? 2 : regOk >= 3 ? 1 : 0;
  const fast = Q.secs.filter((t, k) => Q.items[k] && !Q.items[k].rev && t > 0 && t < RUSH.secs).length, notes = [];
  if (tier === 3 && POINTS.perfect) notes.push(`יום מושלם: עוד ${POINTS.perfect} נקודות.`);
  if (tier === 0) notes.push("יום קשה. את מה שפספסת כבר תיקנת, וזה יחזור שוב בסיבוב נקמה.");
  if (x.wa.full > x.wb.full) notes.push(`שבוע מלא${x.wa.streak > 1 ? `, ${x.wa.streak} ברצף` : ""}. ${x.wa.full % PATH.every ? `עוד ${x.wa.left} לאסימון.` : "ארבעה שבועות מלאים: אסימון חדש בכספת."}`);
  if (x.sis) notes.push(`<b>שבוע של שלושתכן.</b> היום שלך השלים אותו${x.sis.streak > 1 ? `: רצף האחיות עומד על ${x.sis.streak} שבועות` : ""}.`);
  const got = x.grew.filter(g => g.n >= KNOW && !(x.relit || []).includes(g.t));
  if (got.length) notes.push(`במפה שלך, עכשיו את יודעת: ${got.map(g => esc(g.t)).join(", ")}.`);
  if ((x.relit || []).length) notes.push(`הדלקת מחדש במפה: ${x.relit.map(esc).join(", ")}.`);
  if (fast >= RUSH.n) notes.push(`${fast} תשובות בפחות מ־${RUSH.secs} שניות. שווה לקרוא עד הסוף.`);
  const review = `<section class="glass pad review"><span class="eyebrow">Today</span>${reviewList()}
      ${Q.res.some(r => r === false) ? `<p class="small faint">מה שפספסת חוזר בעוד יומיים, בסיבוב נקמה.</p>` : ""}</section>`;
  const art = flavorBlock(p, Q.items, Q.res, st), more = canPractice() && practiceLeft(p.id) > 0;
  layer.innerHTML = quizShell(`
    <div class="row"><span class="eyebrow">${["Done", "Done", "Well done", "Perfect"][tier]}</span><button type="button" class="round" data-act="closeQuiz" aria-label="סגירה">${ICON.close}</button></div>
    <div class="res-top ${tier ? "" : "low"}"><span class="display num ${tier ? "grad-text" : "muted"}" id="gain" data-to="${gained}" dir="ltr">+0</span>
      <p class="muted"><bdi dir="ltr">${ok}/${Q.items.length}</bdi> נכונות · נקודות לטבלה${weekBonus ? ", כולל 15 על שבוע מלא" : ""}</p>
      ${notes.map(t => `<p class="small">${t}</p>`).join("")}</div>
    ${tier ? art + review : review + art}
    <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-aura wide" data-act="closeQuiz" data-to="board">לטבלה</button>
      <button type="button" class="btn btn-ghost wide" data-act="closeQuiz">סיום</button></div>
    ${more ? `<button type="button" class="btn btn-ghost wide" data-act="practice">עוד תרגול, בלי נקודות (לא חובה)</button>` : ""}`);
  $(".quiz-in", layer).classList.add("reveal");
  paintArt(layer);
  const el = $("#gain", layer), to = +el.dataset.to;
  if (REDUCED) { el.textContent = "+" + to; return tier; }
  const t0 = performance.now();
  (function step(t) { const k = Math.min(1, (t - t0) / 1000); el.textContent = "+" + Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  return tier;
}
function renderFixDone(p, grew) {
  const n = Q.res.filter(r => r != null).length, ok = Q.res.filter(Boolean).length, done = fixToday(p.id) >= FIX.n, played = playedOn(p.id, TODAY);
  layer.innerHTML = quizShell(`
    <div class="row"><span class="eyebrow">Focus</span><button type="button" class="round" data-act="closeQuiz" aria-label="סגירה">${ICON.close}</button></div>
    <div class="res-top"><span class="display num ${done ? "grad-text" : "muted"}" dir="ltr" style="font-size:72px">${done ? "+" + POINTS.lesson : `${ok}/${n}`}</span>
      <p class="muted">חיזוק: ${esc(Q.topic || "")} · <bdi dir="ltr">${ok}/${n}</bdi> נכונות בפעם הראשונה</p>
      ${done ? `<p class="small">${played ? `החיזוק הושלם: ${POINTS.lesson} נקודות לטבלה.` : `החיזוק הושלם. ${POINTS.lesson} הנקודות נספרות עם חמש השאלות של היום.`}</p>`
        : `<p class="small">עוד ${FIX.n - fixToday(p.id)} שאלות והחיזוק של היום הושלם. אפשר לחזור אליו ממסך הבית.</p>`}</div>
    ${grew.length ? `<section class="glass pad"><span class="eyebrow">On your map</span>${grew.map(g => ktRow(g.t, g.n)).join("")}</section>` : ""}
    <section class="glass pad review"><span class="eyebrow">This round</span>${reviewList()}</section>
    <div class="row" style="flex-wrap:nowrap">${played ? "" : `<button type="button" class="btn btn-aura wide" data-act="start">לשאלות של היום</button>`}
      <button type="button" class="btn btn-ghost wide" data-act="closeQuiz">סיום</button></div>`);
  $(".quiz-in", layer).classList.add("reveal");
}
function renderPractice(p, grew) {
  const n = Q.res.filter(r => r != null).length, ok = Q.res.filter(Boolean).length, left = practiceLeft(p.id);
  layer.innerHTML = quizShell(`
    <div class="row"><span class="eyebrow">Practice</span><button type="button" class="round" data-act="closeQuiz" data-to="know" aria-label="סגירה">${ICON.close}</button></div>
    <div class="res-top"><span class="display num" dir="ltr" style="font-size:72px">${ok}/${n}</span>
      <p class="muted">תרגול, בלי נקודות לטבלה.${ok ? ` ${ok} תשובות נכונות נוספו ליעד המשפחתי.` : ""}</p></div>
    ${grew.length ? `<section class="glass pad"><span class="eyebrow">On your map</span>${grew.map(g => ktRow(g.t, g.n)).join("")}</section>` : ""}
    <section class="glass pad review"><span class="eyebrow">This round</span>${reviewList()}</section>
    <div class="row" style="flex-wrap:nowrap">${left ? `<button type="button" class="btn btn-aura wide" data-act="practice">עוד סבב</button>` : ""}
      <button type="button" class="btn btn-ghost wide" data-act="closeQuiz" data-to="know">למפה</button></div>
    ${left ? "" : `<p class="small faint" style="text-align:center">זה מספיק תרגול להיום. מחר יש עוד.</p>`}`);
  $(".quiz-in", layer).classList.add("reveal");
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
let TS = null;
function testSheet(pid, keep) {
  const dad = view === "parent";
  TS = { p: pid || (dad ? FAM.profiles[0].id : me().id) };
  const p = profile(TS.p), subs = subjectsOf(p);
  // An exam one twin enters is her sister's too (2026-11-26: one twin had entered the English exam of 6.12 and the
  // other, in the same class, had none). Hers to switch off, when they sit different exams.
  const mates = SANDBOX || !p.pair ? [] : FAM.profiles.filter(q => q.id !== p.id && q.pair === p.pair);
  sheet(`<h3>מבחן בקרוב</h3><p class="small muted">שבוע לפני המבחן, רוב השאלות ${dad ? "שלה " : ""}יהיו מהמקצוע הזה.</p>
    ${dad ? `<div class="field"><label>של מי?</label><div class="seg-pick">${FAM.profiles.map(q => `<button type="button" data-act="pickGirl" data-id="${q.id}" aria-pressed="${q.id === TS.p}">${esc(q.name)}</button>`).join("")}</div></div>` : ""}
    <div class="field"><label>מקצוע</label><div class="seg-pick" id="tsub">${subs.map((s, i) => `<button type="button" data-act="pickSub" data-k="${s}" aria-pressed="${i === 0}">${SUBJ[s]}</button>`).join("")}</div></div>
    ${mates.length ? `<div class="field"><div class="seg-pick" id="tmates">${mates.map(q => `<button type="button" data-act="pickMate" data-id="${q.id}" aria-pressed="true">גם ל${esc(q.name)}</button>`).join("")}</div>
      <span class="small faint">אותה כיתה, אותו מבחן: הוא נשמר לשתיהן. אם הוא רק של אחת, מכבים.</span></div>` : ""}
    <div class="field"><label for="tdate">תאריך</label><input id="tdate" type="date" min="${TODAY}" value="${addDays(TODAY, TEST_LEAD)}"></div>
    <div class="field"><label for="tnote">על מה? (לא חובה)</label><input id="tnote" maxlength="40" placeholder="למשל: משוואות"></div>
    <button type="button" class="btn btn-primary wide" data-act="saveTest">שמירה</button>`);
  if (keep) { $("#tdate").value = keep.date; $("#tnote").value = keep.note; }
}
function readPhoto(file) {
  const url = URL.createObjectURL(file);
  fitPhoto(url).then(d => {
    URL.revokeObjectURL(url);
    L.avatars[me().id] = d; save(); show("me");
    if (canShare()) { toast("נשמר. גם האחיות שלך רואות את התמונה."); sharePhoto(); } else toast("נשמר בטלפון שלך בלבד");
  }).catch(() => toast("לא הצלחתי לקרוא את התמונה"));
}

/* ---------- one handler for every tap ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if ((act === "closeSheet" || act === "closeFormulas") && e.target !== b) return;
  if (act === "storyNext" && e.target.closest("[data-act=storyClose]")) return;
  switch (act) {
    case "tab": SFX.tap(); show(b.dataset.to); break;
    case "start": { const r = b.getBoundingClientRect(); startQuest(); if (Q) iris(r); break; }
    case "practice": { const r = b.getBoundingClientRect(); startPractice(); if (Q) iris(r); break; }
    case "fix": { const r = b.getBoundingClientRect(); startFix(); if (Q) iris(r); break; }
    case "fixGo": if (Q && Q.kind === "fix") renderQuestion(); break;
    case "answer": answer(+b.dataset.j, b); break;
    case "num": numKey(b.dataset.k); break;
    case "numGo": numGo(); break;
    case "pair": pairTap(b); break;
    case "fifty": useFifty(); break;
    case "flag": { const k = Q.queue[Q.i]; Q.flags[k] = !Q.flags[k]; keepProgress(); b.setAttribute("aria-pressed", String(!!Q.flags[k])); $("span", b).textContent = flagText(Q.flags[k]); SFX.tap(); break; }
    case "formulas": openFormulas(b.dataset.pool); break;
    case "closeFormulas": case "formulasDone": { const f = $(".formbg"); if (f) f.remove(); break; }
    case "listen": speak(cur().q.q); break;
    case "next": if (Q.i < Q.queue.length - 1) { Q.locked = false; Q.i++; keepProgress(); renderQuestion(); } else finishQuest(); break;
    // leaving the five keeps them for later; leaving a practice round ends it with what she answered
    case "quit": if (Q.kind === "day") { keepProgress(); Q = null; layer.innerHTML = ""; show("home"); } else finishQuest(); break;
    case "closeQuiz": Q = null; layer.innerHTML = ""; show(b.dataset.to || "home"); break;
    case "recap": openRecap(me().id); break;
    case "storyNext": if (STORY.i < STORY.slides.length - 1) { STORY.i++; renderStory(); } else { clearTimeout(STORY.timer); STORY = null; layer.innerHTML = ""; } break;
    case "storyClose": clearTimeout(STORY.timer); STORY = null; layer.innerHTML = ""; break;
    case "aura": {
      const p = me(); L.auras[p.id] = b.dataset.k; save(); applyAura(b.dataset.k); SFX.tap();
      $$("[data-act=aura]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (LIVE && !SANDBOX) api("profile", { p: p.id, aura: b.dataset.k }).catch(() => {});
      break;
    }
    case "photo": $("#photoFile").click(); break;
    case "photoOff": delete L.avatars[me().id]; save(); show("me"); sharePhoto(); toast("התמונה הוסרה"); break;
    case "toggle": L[b.dataset.k] = !L[b.dataset.k]; save(); b.setAttribute("aria-checked", String(L[b.dataset.k])); SFX.tap(); break;
    case "install": if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } break;
    case "become": L.me = b.dataset.id; save(); applyAura(auraOf(me())); show("home"); break;
    case "parent": parentOK = false; pin = ""; dropUnlock(); applyAura("chrome"); show("parent"); break;
    case "leaveParent": parentOK = false; pin = ""; dropUnlock(); if (me()) { applyAura(auraOf(me())); show("home"); } else if (LIVE && L.parent) show("parent"); else show("home"); break;
    case "pin": {
      SFX.tap();
      if (b.dataset.k === "del") pin = pin.slice(0, -1); else if (pin.length < 4) pin += b.dataset.k;
      if (pin.length === 4) {
        let good = false;
        if (LIVE) { try { await api("pin", { pin }); good = true; } catch (err) { good = false; } }
        else good = pin === String(FAM.settings.parentPin || "1234");
        if (good) { parentOK = true; parentPin = pin; pin = ""; keepUnlock(); show("parent"); if (!monthCheck(null)) luckCheck(null); return; }
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
      else { FAM.tokens[id] = (+FAM.tokens[id] || 0) + 1; L.demoTokens = FAM.tokens; L.demoLog = (L.demoLog || []).concat({ d: TODAY, p: id, change: 1, reason: "gift from parent" }); save(); }
      SFX.coin(); show("parent"); toast("ניתן"); break;
    }
    case "pickBonus": b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); break;
    case "pickDays": $$("#bdays button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); break;
    case "saveBonus": case "cancelBonus": {
      const ids = act === "cancelBonus" ? [] : $$("#bids [aria-pressed=true]").map(x => x.dataset.id), days = +(($("#bdays [aria-pressed=true]") || {}).dataset || {}).k || 0;
      const note = $("#bnote").value.trim() || BONUS_NOTE, week = lastFullWeek(Y, M);
      if (LIVE) { try { await api("settings", { pin: parentPin, bonus: ids.length ? `${THIS_MONTH}|${ids.join(",")}|${days}|${week}` : "", bonusNote: note }); await refresh(); } catch (err) { toast("לא נשמר. נסה שוב."); break; } }
      else { L.demoSettings = Object.assign(L.demoSettings || {}, { bonus: ids.length ? { month: THIS_MONTH, ids, days, week, note } : null }); Object.assign(FAM.settings, L.demoSettings); save(); }
      show("parent"); toast(ids.length ? "המתנה מתוזמנת ל־1 בחודש" : "המתנה בוטלה"); break;
    }
    case "popPreview": {
      const rk = ranking(Y, M), lead = rk.find(r => r.points > 0);
      if (!lead || !openPops(Y, M, profile(lead.id), true, ($("#bnote") || {}).value || BONUS_NOTE)) toast("עוד אין נקודות החודש");
      break;
    }
    case "popToken": popToken(); break;
    case "popNext": if (POP.i < POP.steps.length - 1) { POP.i++; renderPop(); } else closePops(); break;
    case "popRecap": closePops("recap"); break;
    case "luckNext": if (LUCK && LUCK.i < LUCK.steps.length - 1) { LUCK.i++; renderLuck(); } else closeLuck(); break;
    case "luckPreview": {
      const up = tests().filter(t => t.date >= TODAY && profile(t.p)).sort((a, b) => a.date < b.date ? -1 : 1)[0];
      const same = up ? tests().filter(t => t.date === up.date && t.subj === up.subj && profile(t.p)) : [];
      const g = up ? { date: up.date, subj: up.subj, who: [...new Set(same.map(t => t.p))], notes: [...new Set(same.map(t => t.note).filter(Boolean))] }
        : { date: addDays(TODAY, 1), subj: "math", who: [FAM.profiles[0].id], notes: [] };
      LUCK = { steps: [g], i: 0, viewer: null, who: "dad", preview: true, back: "parent" };
      renderLuck(); break;
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
      else { FAM.tokens[id] = Math.max(0, (+FAM.tokens[id] || 0) - 1); L.demoTokens = FAM.tokens; L.demoLog = (L.demoLog || []).concat({ d: TODAY, p: id, change: -1, reason: "redeemed for " + (+FAM.settings.tokenValue || 100) }); save(); toast("בגרסה האמיתית אבא מקבל על זה מייל"); }
      SFX.coin(); show("vault"); break;
    }
    case "closeSheet": layer.innerHTML = ""; break;
    case "ptab": ptab = b.dataset.k; if (parentOK) keepUnlock(); SFX.tap(); show("parent"); break;
    case "sandbox": {
      const g = profile(b.dataset.id);
      L.sand = L.sand || { rows: [], tests: [] };
      SANDBOX = { p: { id: "test", name: "ניסיון", track: g.track, pair: "", slot: 0, flavor: g.flavor, aura: g.aura } };
      save(); applyAura(auraOf(SANDBOX.p)); show("home"); break;
    }
    case "sandExit": SANDBOX = null; Q = null; applyAura("chrome"); show("parent"); break;
    case "sandReset":
      L.sand = { rows: [], tests: [] }; delete L.progress.test; if (L.sky) delete L.sky.test; if (L.seenTok) delete L.seenTok.test;
      save(); show("home"); toast("הפרופיל אופס: אפשר לשחק את היום מחדש"); break;
    case "addTest": testSheet(); break;
    case "pickGirl": testSheet(b.dataset.id, { date: $("#tdate").value, note: $("#tnote").value }); break;
    case "delTest": {
      const d = b.dataset;
      sheet(`<h3>למחוק את המבחן?</h3><p class="muted">${esc(SUBJ[d.subj] || d.subj)} · ${dateHe(d.date)}</p>
        <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-primary wide" data-act="delTestYes" data-p="${esc(d.p)}" data-date="${esc(d.date)}" data-subj="${esc(d.subj)}">למחוק</button><button type="button" class="btn btn-ghost wide" data-act="closeSheet">ביטול</button></div>`);
      break;
    }
    case "delTestYes": {
      const d = b.dataset;
      const mine = SANDBOX ? L.sand.tests : L.tests;
      if (LIVE && !SANDBOX) { try { await api("untest", { p: d.p, date: d.date, subj: d.subj }); await refresh(); } catch (err) { toast("לא נמחק. נסו שוב."); break; } }
      else { const i = mine.findIndex(t => t.p === d.p && t.date === d.date && t.subj === d.subj); if (i >= 0) mine.splice(i, 1); save(); }
      show(view); toast("המבחן נמחק"); break;
    }
    case "pickSub": $$("#tsub button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); break;
    case "pickMate": b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); break;
    case "gradeOpen": gradeSheet(b.dataset.p, b.dataset.date, b.dataset.subj); break;
    case "gradeLater": L.gradeLater = L.gradeLater || {}; L.gradeLater[b.dataset.k] = addDays(TODAY, GRADE.later); save(); show("home"); break;
    case "gradeSave": {
      const d = b.dataset, raw = b.dataset.clear ? "" : $("#gval").value.trim(), g = raw === "" ? "" : Math.round(+raw);
      if (!b.dataset.clear && (raw === "" || isNaN(g) || g < 0 || g > 100)) { toast("ציון בין 0 ל־100"); break; }
      if (LIVE && !SANDBOX) { try { await api("grade", { p: d.p, date: d.date, subj: d.subj, grade: g }); await refresh(); } catch (err) { toast("לא נשמר. נסו שוב."); break; } }
      else { const x = (SANDBOX ? L.sand.tests : L.tests).find(z => z.p === d.p && z.date === d.date && z.subj === d.subj); if (x) x.grade = g; save(); }
      show(view); toast(g === "" ? "הציון נמחק" : "הציון נשמר"); break;
    }
    case "saveTest": {
      const sb = $("#tsub [aria-pressed=true]"), date = $("#tdate").value, note = $("#tnote").value.trim();
      if (!sb || !date || date < TODAY) { toast("צריך מקצוע ותאריך"); break; }
      const t = { p: TS ? TS.p : me().id, date, subj: sb.dataset.k, note };
      // her twin too, if she studies the subject and does not have this exam already
      const also = $$("#tmates [aria-pressed=true]").map(x => profile(x.dataset.id)).filter(q => q && subjectsOf(q).includes(t.subj) && !tests().some(z => z.p === q.id && z.date === date && z.subj === t.subj));
      const all = [t].concat(also.map(q => Object.assign({}, t, { p: q.id })));
      if (SANDBOX) { L.sand.tests.push(t); save(); }
      else if (LIVE) { try { for (const x of all) await api("test", x); await refresh(); } catch (err) { toast("לא נשמר. נסו שוב."); break; } }
      else { L.tests.push(...all); save(); }
      show(view === "parent" ? "parent" : "home"); toast(also.length && !SANDBOX ? `המבחן נשמר, גם ל${joinHe(also.map(q => q.name))}` : "המבחן נשמר"); break;
    }
    case "joinCode": {
      const v = $("#code").value.trim();
      if (!v) break;
      L.code = v; save(); $("#codeMsg").textContent = "מתחברת...";
      try { await refresh(); await loadBanks(allPools()); show("who"); } catch (err) { $("#codeMsg").textContent = "הקוד לא נכון, או שאין אינטרנט."; }
      break;
    }
    case "claim": L.me = b.dataset.id; L.parent = false; save(); dropUnlock(); applyAura(auraOf(me())); show(L.auras[L.me] ? "home" : "aura"); break;
    case "claimParent": L.parent = true; L.me = null; save(); applyAura("chrome"); show("parent"); break;
    case "forget":
      sheet(`<h3>להתנתק?</h3><p class="muted">הטלפון ישכח מי את (ההתקדמות שלך שמורה בגיליון של המשפחה).</p>
        <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn-primary wide" data-act="forgetYes">להתנתק</button><button type="button" class="btn btn-ghost wide" data-act="closeSheet">ביטול</button></div>`);
      break;
    case "forgetYes": L.me = null; L.parent = false; save(); dropUnlock(); show("who"); break;
    case "retry": boot(); break;
    case "resetCode": L.code = ""; save(); show("code"); break;
  }
});
document.addEventListener("change", e => { if (e.target.id === "photoFile" && e.target.files[0]) readPhoto(e.target.files[0]); });
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });
window.addEventListener("online", () => { if (LIVE) flush(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && ymd(new Date()) !== TODAY && !$(".quiz", layer)) location.reload(); });

/* ---------- start ---------- */
function allPools() { return [...new Set(FAM.profiles.flatMap(p => trackPools(p.track)))]; }
new MutationObserver(() => {
  document.body.classList.toggle("deep", !!$(".quiz, .story, .ceremony", layer));
  if (STALE && !layer.innerHTML) repaint();
}).observe(layer, { childList: true });
/* ---------- opening (Avsha, 2026-11-26: "I see the purple screen and about 30 seconds later the app loads") ----------
 * The app drew nothing until the Sheet had answered and every bank had come from the site, one after the other,
 * and the Sheet's answer alone took most of that half minute (Code.gs, "reading the tabs"). Now a phone that has
 * opened the app before opens it from what it holds: its last copy of the Sheet (L.cache) and its own copies of the
 * banks. The Sheet and the site are asked meanwhile (sync), and the screen is drawn again when they answer.
 * Until then SYNC is "wait" and a round cannot be started: the day's five are picked from her sisters' rows too
 * (a twin never gets a question her sister has answered) and from the exams entered, which the last copy may lack.
 * The popups (the month's winner, an exam tomorrow) wait for the answer as well. With no connection the wait ends
 * as it always did, on the last copy, and so it does when the Sheet has not answered in SYNC_WAIT. */
let SYNC = "ok", STALE = false, SHOWN = 0;
const SYNC_WAIT = 12000;   // the Sheet's script of before 2026-11-26 took 20 seconds and more
const T0 = performance.now();
const waiting = () => SYNC === "wait";
function repaint() {
  if (!BOOTED) return;
  // a sheet or a round is open, or Dad is typing his settings: drawn again when that is done
  if (layer.innerHTML || (view === "parent" && parentOK && ptab === "settings" && !!$("input", app))) { STALE = true; return; }
  STALE = false;
  const y = window.scrollY;
  show(view, true);
  window.scrollTo(0, y);
}
async function sync() {
  const was = JSON.stringify(FAM);
  let ok = true, ms = 0, banks = false;
  const b = freshBanks(allPools()).then(ch => { banks = ch; }).catch(() => {});
  try { await flush(); const t = performance.now(); await refresh(); ms = performance.now() - t; } catch (err) { ok = false; }
  await b;
  if (ok) await loadBanks(allPools());   // a track the last copy did not have
  L.load = { at: TODAY, ok, ms: Math.round(ms), shown: Math.round(SHOWN - T0) }; save();
  return banks || (ok && JSON.stringify(FAM) !== was);
}
function firstScreen() {
  if (LIVE && L.parent) { takeUnlock(); applyAura("chrome"); show("parent"); }
  else if (LIVE && !me()) show("who");
  else { applyAura(auraOf(me())); show("home"); }
  BOOTED = true; SHOWN = performance.now();
}
/* After the first screen, once the Sheet has answered (or cannot): the photos, and whatever popup is due. */
function greet() {
  if (LIVE) (me() && !L.parent ? sharePhoto() : Promise.resolve()).then(fetchPhotos);
  if (layer.innerHTML || SANDBOX) return;
  if (LIVE && L.parent) { if (parentOK && view === "parent" && !monthCheck(null)) luckCheck(null); return; }
  const p = me();
  if (!p || !["home", "know", "board", "vault", "me"].includes(view)) return;
  if (monthCheck(p)) { L.seenRecap = THIS_MONTH; save(); return; }   // her recap is the popup's last button
  if (LIVE && L.seenRecap !== THIS_MONTH && D <= 7) {
    const [py, pm] = prevMonth(Y, M);
    if (stats(p.id, py, pm).played) { L.seenRecap = THIS_MONTH; save(); openRecap(p.id); return; }
  }
  luckCheck(p);
}
async function boot() {
  auraStart();
  if (LIVE) {
    const k = new URLSearchParams(location.search).get("k");
    /* The code stays in the address: on an iPhone the home-screen copy keeps its own storage, and the address it is saved from carries the code into it. */
    if (k) { L.code = k; save(); }
    if (!L.code) { FAM = { profiles: [], settings: {}, tokens: {}, rows: [], tests: [] }; show("code"); return; }
    if (L.cache && Array.isArray(L.cache.profiles) && L.cache.profiles.length) {
      FAM = L.cache;
      await loadBanks(allPools(), true);
      SYNC = "wait";
      firstScreen();
      // She is never left waiting on the Sheet: after SYNC_WAIT the round can start from the last copy, as it does
      // with no connection, and the answer is taken when it comes (a round in progress keeps its questions).
      // Whatever goes wrong in sync, the wait ends.
      setTimeout(() => { if (waiting()) { SYNC = "ok"; repaint(); } }, SYNC_WAIT);
      sync().catch(() => false).then(changed => { SYNC = "ok"; if (changed || $("[data-wait]", app)) repaint(); greet(); });
      return;
    }
    // a phone's first opening: nothing to show yet but that it is on its way
    app.innerHTML = `<div class="onb"><span class="wordmark" dir="ltr">Aura</span><p class="muted">טוענת…</p></div>`;
    try { await flush(); const t = performance.now(); await refresh(); L.load = { at: TODAY, ok: true, ms: Math.round(performance.now() - t), shown: 0 }; save(); }
    catch (err) { show("error"); return; }
    await loadBanks(allPools());
  } else {
    FAM = demoFamily();
    await loadBanks(allPools());
    EXAMPLE = makeExample();
    if (!me()) L.me = FAM.profiles[0].id;
  }
  firstScreen();
  greet();
}
/* For tools/simulate_days.js: the page's own pick and scoring, driven from a test (never set in the app). */
if (window.FQ_TEST) window.FQ_TEST.api = { dailySet, revengeFor, stats, ranking, placeOf, profile, setRows: r => { EXAMPLE = r; },
  round: () => Q, typedOf, matchOf, weeksOf, knowOf, knowMap, practiceSet, pointsOf, rows, paint: paintArt, mood: auraMood, aura: applyAura, weakTopic,
  shareOf, stuckOf, fixOffer, bandOf, take, pastExams, trendOf, gradeDue, sisOf, versusSelf, me, family: () => FAM, bank: p => BANKS[p] };
if (!PREVIEW && "serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot().catch(err => { console.error(err); app.innerHTML = `<p class="muted">משהו השתבש: ${esc(err.message)}</p>`; });
})();
