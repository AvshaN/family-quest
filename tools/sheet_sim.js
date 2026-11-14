/* Runs backend/Code.gs in Node against an in-memory Sheet, and serves the app pointed at it, so the live
 * mode can be tried end to end without a Google account.
 *
 *   node tools/sheet_sim.js [port]        then open http://localhost:PORT/?k=TEST42
 *
 * Extra routes for tests:
 *   /__run?fn=nightlyDigest|monthlyClose[&now=2026-12-01T00:30:00]   runs a timer (at that time) and returns the emails sent
 *   /__sheet?tab=Tokens                                               returns a tab's rows
 *   /__now?t=2026-12-10T18:00:00                                      the script's clock from now on (no t: the real one)
 *   /__load  (POST {tab, rows})                                       appends rows to a tab, to stage a history
 *   /__score?y=2026&m=12                                              the script's ranking for a month
 *   /__mails                                                          the emails sent since last asked
 * The stand-ins below cover only what Code.gs calls. */
const fs = require("fs"), path = require("path"), http = require("http"), vm = require("vm"), url = require("url");
const ROOT = path.join(__dirname, "..");
const PORT = +process.argv[2] || 8765;

class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  getLastRow() { return this.rows.length; }
  appendRow(a) { this.rows.push(a.slice()); }
  deleteRow(n) { this.rows.splice(n - 1, 1); }
  set(r, c, v) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(""); row[c - 1] = v; }
  getRange(r, c, nr, nc) {
    const sh = this;
    if (typeof r === "string") return { setNumberFormat() { return this; } };
    return {
      setValues(v) { v.forEach((row, i) => row.forEach((x, j) => sh.set(r + i, c + j, x))); return this; },
      setValue(v) { sh.set(r, c, v); return this; },
      setFontWeight() { return this; }, setNumberFormat() { return this; }
    };
  }
  getDataRange() {
    const nc = Math.max(1, ...this.rows.map(r => r.length));
    const rows = this.rows.length ? this.rows : [[]];
    return { getValues: () => rows.map(r => { const x = r.slice(); while (x.length < nc) x.push(""); return x; }) };
  }
  setFrozenRows() {}
}
const book = { tabs: [new Sheet("Sheet1")] };
const SS = {
  getSheetByName: n => book.tabs.find(t => t.name === n) || null,
  insertSheet: n => { const s = new Sheet(n); book.tabs.push(s); return s; },
  getSheets: () => book.tabs.slice(),
  deleteSheet: s => { book.tabs = book.tabs.filter(t => t !== s); },
  getUrl: () => "https://docs.google.com/spreadsheets/d/EXAMPLE/edit"
};
let FIXED = null;
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { if (!a.length && FIXED) super(FIXED); else super(...a); }
  static now() { return FIXED ? new RealDate(FIXED).getTime() : RealDate.now(); }
}
const mails = [];
const chain = () => new Proxy({}, { get: () => () => chain() });
const ctx = vm.createContext({
  Date: FakeDate, JSON, Math, Number, String, Object, Array, Error, console,
  SpreadsheetApp: { getActiveSpreadsheet: () => SS },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => chain() },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  MailApp: { sendEmail: m => mails.push(m) },
  Session: { getEffectiveUser: () => ({ getEmail: () => "parent@example.com" }) },
  Logger: { log: s => console.log("[script]", s) },
  ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
  Utilities: { formatDate: (d, tz, f) => f === "HH:mm"
    ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
    : new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d) }
});
vm.runInContext(fs.readFileSync(path.join(ROOT, "backend", "Code.gs"), "utf8"), ctx, { filename: "Code.gs" });
ctx.setup();
ctx.setSetting_("family_code", "TEST42");
SS.getSheetByName("Profiles").getRange(2, 2, 3, 1).setValues([["Maya"], ["Tal"], ["Shir"]]);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  const u = url.parse(req.url, true), cors = { "Access-Control-Allow-Origin": "*" };
  const send = (code, type, body) => { res.writeHead(code, Object.assign({ "Content-Type": type }, cors)); res.end(body); };
  if (u.pathname === "/exec") {
    if (req.method === "GET") return send(200, "application/json", ctx.doGet({ parameter: u.query }).s);
    let body = ""; req.on("data", c => body += c);
    return req.on("end", () => send(200, "application/json", ctx.doPost({ postData: { contents: body } }).s));
  }
  if (u.pathname === "/__run") {
    const was = FIXED;
    if (u.query.now) FIXED = u.query.now;
    mails.length = 0;
    try { ctx[u.query.fn](); } finally { FIXED = was; }
    return send(200, "application/json", JSON.stringify(mails));
  }
  if (u.pathname === "/__now") { FIXED = u.query.t || null; return send(200, "application/json", JSON.stringify({ now: FIXED })); }
  if (u.pathname === "/__mails") { const out = JSON.stringify(mails); mails.length = 0; return send(200, "application/json", out); }
  if (u.pathname === "/__score") {
    const rank = ctx.ranking_(ctx.answers_(), ctx.profiles_(), +u.query.y, +u.query.m);
    return send(200, "application/json", JSON.stringify(rank));
  }
  if (u.pathname === "/__load") {
    let body = ""; req.on("data", c => body += c);
    return req.on("end", () => { const b = JSON.parse(body), t = SS.getSheetByName(b.tab); b.rows.forEach(r => t.appendRow(r)); send(200, "application/json", JSON.stringify({ rows: t.rows.length })); });
  }
  if (u.pathname === "/__sheet") { const t = SS.getSheetByName(u.query.tab); return send(200, "application/json", JSON.stringify(t ? t.rows : null)); }
  if (u.pathname === "/config.js") return send(200, "text/javascript", `window.FQ_CONFIG = { apiUrl: "http://localhost:${PORT}/exec" };`);
  const file = path.join(ROOT, u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, "text/plain", "not found");
  send(200, TYPES[path.extname(file)] || "application/octet-stream", fs.readFileSync(file));
}).listen(PORT, () => console.log(`sheet_sim: http://localhost:${PORT}/?k=TEST42`));
