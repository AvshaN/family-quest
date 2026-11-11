/* Plays the coming days with the app's own pick and scoring, to see that the questions hold up:
 * the twins never share a question, how long until a girl meets a question again, revenge rounds.
 *
 *   python3 tools/build_preview.py /tmp/p.html
 *   node tools/simulate_days.js /tmp/p.html [rows.json] [days=30] [from=YYYY-MM-DD]
 *
 * rows.json: answers to start from, as the Sheet's Answers tab in the app's form
 * ([{d, p, q, pool, t, l, ok, r}]); without it the girls start with no history.
 * Each simulated girl plays every day and gets 70% right. */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");

(async () => {
  const [src, rowsFile, daysArg, fromArg] = process.argv.slice(2);
  const start = rowsFile && rowsFile !== "-" ? JSON.parse(fs.readFileSync(rowsFile, "utf8")) : [];
  const days = +daysArg || 30;
  const page = path.join(path.dirname(path.resolve(src)), "_simulate.html");
  fs.writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"></head><body>${fs.readFileSync(src, "utf8")}</body></html>`);
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.addInitScript(() => { window.FQ_TEST = {}; });
  await p.goto("file://" + page);
  await p.waitForFunction(() => window.FQ_TEST.api && document.querySelector("#app").children.length > 0);
  const out = await p.evaluate(({ start, days, from }) => {
    const T = window.FQ_TEST.api, pad = n => String(n).padStart(2, "0");
    const add = (s, n) => { const [y, m, d] = s.split("-").map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
    let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const rows = start.slice(), ids = ["a", "b", "c"], profs = ids.map(T.profile);
    const first = from || (rows.length ? rows.map(r => r.d).sort().pop() : add(new Date().toISOString().slice(0, 10), -1));
    const rep = {}; ids.forEach(id => rep[id] = { repeats: 0, firstRepeat: null, revenge: 0, pools: {} });
    let overlap = 0; const sample = {};
    for (let i = 1; i <= days; i++) {
      const d = add(first, i);
      T.setRows(rows);
      const sets = profs.map(pr => T.dailySet(pr, d));
      const twins = [sets[1], sets[2]].map(s => new Set(s.map(q => q.id)));
      overlap += [...twins[0]].filter(x => twins[1].has(x)).length;
      profs.forEach((pr, k) => {
        const seen = new Set(rows.filter(r => r.p === pr.id).map(r => r.q));
        const rev = T.revengeFor(pr, d, sets[k]);
        if (i <= 2) sample[d + " " + pr.id] = sets[k].map(q => q.pool.split("-")[1] + ":" + q.topic).concat(rev ? ["REVENGE " + rev.topic] : []);
        sets[k].forEach(q => {
          if (seen.has(q.id)) { rep[pr.id].repeats++; if (!rep[pr.id].firstRepeat) rep[pr.id].firstRepeat = d + " (" + q.pool + ")"; }
          rep[pr.id].pools[q.pool] = (rep[pr.id].pools[q.pool] || 0) + 1;
          rows.push({ d, p: pr.id, q: q.id, pool: q.pool, t: q.topic, l: q.level, ok: rand() < 0.7 ? 1 : 0, r: 0 });
        });
        if (rev) { rep[pr.id].revenge++; rows.push({ d, p: pr.id, q: rev.id, pool: rev.pool, t: rev.topic, l: rev.level, ok: rand() < 0.7 ? 1 : 0, r: 1 }); }
      });
    }
    T.setRows(rows);
    return { first, rep, overlap, sample };
  }, { start, days, from: fromArg });
  console.log(`From ${out.first}, ${days} days, every girl playing every day:`);
  console.log(`  twins: questions shared on the same day, in all: ${out.overlap}`);
  for (const [id, r] of Object.entries(out.rep)) {
    console.log(`  ${id}: first repeat ${r.firstRepeat || "none"}; repeats ${r.repeats}; revenge rounds ${r.revenge}; per pool ${JSON.stringify(r.pools)}`);
  }
  console.log("  the first two days:");
  for (const [k, v] of Object.entries(out.sample)) console.log(`    ${k}: ${v.join(" | ")}`);
  if (errs.length) console.log("page errors:", errs.join("; "));
  await b.close();
  fs.unlinkSync(page);
})().catch(e => { console.error("SIMULATION FAILED", e.message); process.exit(1); });
