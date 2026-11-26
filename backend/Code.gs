/**
 * Aura: the family's record, in a Google Sheet.
 *
 * This script lives inside the Sheet (Extensions > Apps Script) and is deployed as a web app
 * (SETUP.md has the steps). The app on the girls' phones talks to it:
 *   GET  ?action=state&code=...   the family, this month's and last month's answers, tokens, tests
 *   GET  ?action=photos&code=...  each girl's photo (state carries only a stamp of each, so phones fetch them rarely)
 *   POST {action, code, ...}      submit | profile | test | untest | redeem | pin | grant | settings
 * and two daily timers run here:
 *   nightlyDigest   the evening email to the parent: today, the month and all time, in tables
 *   monthlyClose    on the 1st: a token to last month's winner(s), and an email with the month's results
 * report_() works out what both emails and the parent screen (state_().lifetime) show.
 *
 * The scoring (scoreMonth_) must match stats() in app.js: the board on the phones and the token
 * awarded here are worked out from the same rows by the same rules.
 */

var TZ = "Asia/Jerusalem";
var TABS = {
  Settings: ["key", "value", "what it is"],
  // photo: her picture as she chose it in the app, as text (a data URL, under 49,000 characters), for her sisters' phones
  Profiles: ["id", "name", "track", "pair", "slot", "flavor", "aura", "photo"],
  // revenge: 0 one of the daily five, 1 a revenge round, 2 practice (no points). secs: how long her first answer took.
  // flag: the question's text, when she marked it "we have not learned this yet" (empty otherwise)
  Answers: ["when", "date", "profile", "question", "pool", "topic", "level", "right", "revenge", "secs", "flag"],
  Tokens: ["when", "profile", "change", "reason"],
  // grade: hers in the exam, 0-100, entered after it (empty until then). photo: the graded exam as she photographed
  // it (its file id in the Drive folder). ok: the parent's word on the grade: "yes", "no", or empty while it waits.
  Tests: ["when", "profile", "date", "subject", "note", "grade", "photo", "ok"],
  // A photo of a notebook page she sent: `file` is its id in the Drive folder; status is empty until its questions
  // are in the app ("done", with how many, or "skip", with why in `questions`), and `done` is the day a phone said so.
  Pages: ["when", "date", "profile", "subject", "note", "file", "status", "questions", "done"]
};
var DEFAULTS = [
  ["app_name", "Aura", "the app's name, at the start of every email"],
  ["family_code", "", "the code each phone types once (setup makes one)"],
  ["parent_pin", "1234", "the code of the parent screen: change it"],
  ["parent_email", "", "where the emails go (empty: the Sheet's owner)"],
  ["digest_hour", 21, "the hour of the evening email, 0-23"],
  ["goal", 250, "the family goal: right answers together in a month"],
  ["goal_reward", "ערב פיצה, ואתן בוחרות סרט", "what the family goal wins"],
  ["prize_5", "", "the prize for 5 tokens"],
  ["prize_10", "", "the prize for 10 tokens"],
  ["token_value", 100, "shekels a token is worth"],
  ["improved_reward", "פרס קטן מאבא", "what the most improved girl of the month gets (given by hand)"]
];
/* Points by month, as POINTS_BY in app.js: the new rule from December 2026 (Avsha, 2026-11-14). */
var POINTS_BY = [["2026-12", { day: 5, right: 5, perfect: 5, revenge: 5, lesson: 5, page: 5, week: 15, weekDays: 5 }],
                 ["", { day: 10, right: 4, perfect: 0, revenge: 8, lesson: 5, page: 5, week: 15, weekDays: 5 }]];
function pointsOf_(mk) { for (var i = 0; i < POINTS_BY.length; i++) if (mk >= POINTS_BY[i][0]) return POINTS_BY[i][1]; }
/* The app's version of this script: the phones turn on practice and deleting an exam only when they see 2. */
var API = 8;   // 3: photos; 4: "not learned yet" marks; 5: the gift at a month's end; 6: one reading of each tab a request, fix-it lessons (kind 3), a grade after an exam, the trend, the sisters' streak; 7: notebook pages, taking a "not learned yet" mark off; 8: the parent decides on a mark (stopping a question or a topic), pending marks in the email, a photo and his yes for a grade, a token for three exams above 85
// (the parent's Settings tab compares this with SCRIPT_API in app.js and says when the script here is behind: raise both together)
/* Her own path to a token: every 4 full weeks (Sunday to Saturday, 5 days played), counted from this Sunday. */
var PATH = { start: "2026-11-15", every: 4 };
var WEEK_DAYS = 5;
/* A day with 3 of the five answered in under 3 seconds each is marked as rushed. */
var RUSH = { secs: 3, n: 3 };
var LESSON_N = 3;   // a fix-it lesson's questions (FIX.n in app.js)
var FIX = { min: 3, days: 28, right: 0.5 };   // when a topic is stuck (FIX in app.js)
var SUBJ = { math: "מתמטיקה", eng: "אנגלית", sci: "מדע", heb: "לשון", hist: "היסטוריה", civ: "אזרחות", midrash: "בית מדרש", bible: "תנ״ך", geo: "גאוגרפיה", art: "אמנות", bio: "ביולוגיה", lit: "ספרות" };
var DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
var AURA_COL = { orchid: "#A855F7", lagoon: "#14B8A6", ember: "#F97316", cherry: "#F43F5E", matcha: "#22C55E", chrome: "#8B95A8" };
var APP_URL = "https://avshan.github.io/family-quest/";
var MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/* ---------- run once, from the editor ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(TABS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, TABS[name].length).setFontWeight("bold");
  });
  // Dates stay text ("2026-11-11"): a Sheet turns them into dates otherwise, in its own time zone.
  ss.getSheetByName("Answers").getRange("B:B").setNumberFormat("@");
  ss.getSheetByName("Tests").getRange("C:C").setNumberFormat("@");
  ss.getSheetByName("Pages").getRange("B:B").setNumberFormat("@");
  ss.getSheetByName("Pages").getRange("I:I").setNumberFormat("@");
  var st = ss.getSheetByName("Settings");
  var have = st.getDataRange().getValues().map(function (r) { return r[0]; });
  DEFAULTS.forEach(function (d) { if (have.indexOf(d[0]) < 0) st.appendRow(d); });
  // The PIN cell holds text, so a PIN that starts with 0 keeps its zero.
  st.getDataRange().getValues().forEach(function (r, i) { if (r[0] === "parent_pin") st.getRange(i + 1, 2).setNumberFormat("@"); });
  if (!setting_("family_code")) setSetting_("family_code", makeCode_());
  // The empty first tab a new Sheet comes with.
  ["Sheet1", "גיליון1"].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  var pr = ss.getSheetByName("Profiles");
  if (pr.getLastRow() < 2) {
    pr.getRange(2, 1, 3, 7).setValues([
      ["a", "השם של הגדולה", "g10-bio", "", 0, "portfolio", "orchid"],
      ["b", "השם של תאומה אחת", "g7", "twins", 0, "routine", "cherry"],
      ["c", "השם של התאומה השנייה", "g7-art", "twins", 1, "stage", "lagoon"]
    ]);
  }
  // The notebook pages are saved in Drive, and only a run from the editor can show Google's question about that
  // (a request from a phone cannot): touching Drive here, without changing anything, makes it ask now.
  DriveApp.getRootFolder();
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var hour = Math.max(0, Math.min(23, Number(setting_("digest_hour")) || 21));
  // nearMinute(0): within about 15 minutes of the hour; without it Google picks any minute in it (21:33 on the first night).
  ScriptApp.newTrigger("nightlyDigest").timeBased().everyDays(1).atHour(hour).nearMinute(0).inTimezone(TZ).create();
  ScriptApp.newTrigger("monthlyClose").timeBased().everyDays(1).atHour(0).nearMinute(30).inTimezone(TZ).create();
  Logger.log("Ready. Family code: " + setting_("family_code") + ". Now type the girls' names in the Profiles tab.");
}

/* ---------- the web app ---------- */
function doGet(e) {
  return guard_(function () {
    wrote_();
    var p = (e && e.parameter) || {};
    checkCode_(p.code);
    if (p.action === "photos") return { ok: true, photos: photos_() };
    if (p.action !== "state") throw new Error("unknown action");
    return state_();
  });
}

function doPost(e) {
  return guard_(function () {
    wrote_();
    var b = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    checkCode_(b.code);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (b.action) {
        case "submit": return submit_(b);
        case "profile": return setProfile_(b);
        case "test": return addTest_(b);
        case "untest": return delTest_(b);
        case "grade": return setGrade_(b);
        case "gradeok": return gradeOk_(b);
        case "unflag": return unflag_(b);
        case "block": return block_(b);
        case "unblock": return unblock_(b);
        case "page": return addPage_(b);
        case "pagedone": return pageDone_(b);
        case "redeem": return redeem_(b);
        case "pin": checkPin_(b.pin); return { ok: true };
        case "grant": checkPin_(b.pin); needProfile_(b.p); addToken_(b.p, 1, "gift from parent"); return { ok: true };
        case "settings": return saveSettings_(b);
        default: throw new Error("unknown action");
      }
    } finally {
      lock.releaseLock();
    }
  });
}

function guard_(fn) {
  var out;
  try { out = fn(); } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function state_() {
  var now = new Date(), today = ymd_(now), y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var pm = m === 1 ? [y - 1, 12] : [y, m - 1];
  var from = pm[0] + "-" + pad_(pm[1]) + "-01";
  return {
    ok: true,
    api: API,
    today: today,
    profiles: profiles_(),
    settings: {
      goal: Number(setting_("goal")) || 250, goalReward: setting_("goal_reward"), prize5: setting_("prize_5"),
      prize10: setting_("prize_10"), tokenValue: Number(setting_("token_value")) || 100,
      improvedReward: setting_("improved_reward"), digestHour: Number(setting_("digest_hour")) || 21, bonus: bonus_(),
      blocked: blocked_()
    },
    tokens: tokens_(),
    lifetime: lifetimeAll_(),
    tokenLog: tokenRows_().slice(-30),
    // the full weeks before this one, and the right days older than the rows below: the phones add what they hold
    path: pathAll_(today),
    know: knowAll_(from),
    rows: answers_().filter(function (r) { return r.d >= from; }),
    tests: tests_().filter(function (t) { return t.date >= addDays_(today, -1); }),
    // what the phones cannot work out from two months of rows: the exams that have passed, each girl's weeks, and
    // the weeks all of them filled
    exams: examsPast_(today),
    trend: trend_(),
    sis: sisters_(today),
    pages: pagesRecent_(from, today),
    examTok: examTokAll_(),
    pagesUrl: pagesUrl_()
  };
}

/* ---------- writes ---------- */
function submit_(b) {
  needProfile_(b.p);
  var rows = Array.isArray(b.rows) ? b.rows : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.d)) || !rows.length || rows.length > 8) throw new Error("bad submission");
  // A day is five questions and at most one revenge round: a phone that played a day twice (22.11.2026, before the
  // app held on to what it had sent) had its five dropped here as known, but its second revenge round was new.
  var have = {}, regular = 0, revenge = 0, lesson = 0;
  answers_().forEach(function (r) {
    if (r.p !== b.p || r.d !== b.d) return;
    have[r.q + "|" + r.r] = true;
    if (r.r === 0) regular++; else if (r.r === 1) revenge++; else if (r.r === 3) lesson++;
  });
  var now = new Date(), add = [];
  rows.forEach(function (r) {
    var kind = Number(r.r) === 2 ? 2 : Number(r.r) === 3 ? 3 : r.r ? 1 : 0, key = String(r.q) + "|" + kind;
    if (have[key] || r.p !== b.p || r.d !== b.d) return;
    if (kind === 0 && regular++ >= 5) return;
    if (kind === 1 && revenge++ >= 1) return;
    if (kind === 3 && lesson++ >= 2 * LESSON_N) return;   // a fix-it lesson is three questions; one left and taken up again, six
    have[key] = true;
    add.push([now, b.d, b.p, String(r.q), String(r.pool), String(r.t || ""), Number(r.l) || 1, r.ok ? 1 : 0, kind,
              Math.max(0, Math.min(999, Number(r.s) || 0)), String(r.f || "").slice(0, 300)]);
  });
  var tokens = 0;
  if (add.length) {
    var sh = sheet_("Answers");
    // a Sheet set up before the seconds were kept has no heading for them
    var head = values_("Answers")[0] || [];
    if (String(head[9] || "") !== "secs") sh.getRange(1, 10).setValue("secs");
    if (String(head[10] || "") !== "flag") sh.getRange(1, 11).setValue("flag");
    sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
    wrote_();
    tokens = pathTokens_(b.p);
  }
  return { ok: true, added: add.length, tokens: tokens };
}

/* A "not learned yet" mark that was a slip of the finger, or on a topic that was taught (Avsha, 2026-11-26: the art
 * twin marked a rectangle's perimeter by mistake, and the mark kept her fix-it lesson on perimeter from being
 * offered): the parent takes it off from his Today tab. The answer itself stays as it was. */
function unflag_(b) {
  checkPin_(b.pin);
  needProfile_(b.p);
  var sh = sheet_("Answers"), v = values_("Answers"), n = 0;
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][2]) === b.p && dateText_(v[i][1]) === String(b.d) && String(v[i][3]) === String(b.q) && String(v[i][10] || "") !== "") { sh.getRange(i + 1, 11).setValue(""); n++; }
  }
  if (n) wrote_();
  return { ok: true, removed: n };
}

/* ---------- what the parent stopped (Avsha, 2026-11-26) ----------
 * "If a flag is clicked, notify me ... and I'll decide if to block or remove the flag." A mark now does nothing by
 * itself. The parent removes it (unflag_), or stops what it is about until the class gets there: the one question,
 * or its whole topic. What is stopped is kept in the setting `blocked`, a JSON list of
 * { s: whom (the pair's name, as "twins", or a profile's id), pool, t: topic, q: the question's id when only it is
 * stopped, d: the day, by: who marked it, text: the question }. The app leaves stopped questions out of
 * everything (studied() in app.js), for her and for the girl she shares a class with. */
function blocked_() {
  var raw = String(setting_("blocked") || "");
  if (!raw) return [];
  try { var v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (err) { return []; }
}
function scope_(prof) { return prof.pair || prof.id; }
function sameBlock_(a, b) { return a.s === b.s && a.pool === b.pool && String(a.q || "") === String(b.q || "") && (a.q ? true : a.t === b.t); }
function block_(b) {
  checkPin_(b.pin);
  var prof = needProfile_(b.p), profs = profiles_(), s = scope_(prof);
  var e = { s: s, pool: String(b.pool || ""), t: String(b.t || "").slice(0, 80), d: ymd_(new Date()), by: prof.id, text: String(b.text || "").slice(0, 300) };
  if (b.q) e.q = String(b.q);
  if (!e.pool || !e.t) throw new Error("bad block");
  var list = blocked_();
  if (!list.some(function (x) { return sameBlock_(x, e); })) list.push(e);
  setSetting_("blocked", JSON.stringify(list.slice(-200)));
  // the marks this settles are taken off: the one on that question, or every waiting mark of the class in the topic
  var mates = {}, sh = sheet_("Answers"), v = values_("Answers"), n = 0;
  profs.forEach(function (x) { if (scope_(x) === s) mates[x.id] = true; });
  for (var i = 1; i < v.length; i++) {
    if (!mates[String(v[i][2])] || String(v[i][10] || "") === "" || String(v[i][4]) !== e.pool) continue;
    if (String(v[i][3]) !== String(b.mark || "") && (e.q ? String(v[i][3]) !== e.q : String(v[i][5]) !== e.t)) continue;
    sh.getRange(i + 1, 11).setValue(""); n++;
  }
  wrote_();
  return { ok: true, cleared: n };
}
function unblock_(b) {
  checkPin_(b.pin);
  var e = { s: String(b.s || ""), pool: String(b.pool || ""), t: String(b.t || ""), q: b.q ? String(b.q) : "" };
  var list = blocked_(), left = list.filter(function (x) { return !sameBlock_(x, e); });
  setSetting_("blocked", left.length ? JSON.stringify(left) : "");
  return { ok: true, removed: list.length - left.length };
}

var PIC_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
function setProfile_(b) {
  needProfile_(b.p);
  var sh = sheet_("Profiles"), v = values_("Profiles"), row = 0;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === b.p) row = i + 1;
  if (b.aura !== undefined) {
    if (["orchid", "lagoon", "ember", "cherry", "matcha", "chrome"].indexOf(b.aura) < 0) throw new Error("bad aura");
    sh.getRange(row, 7).setValue(b.aura);
  }
  if (b.photo !== undefined) {   // "" takes her photo off
    var ph = String(b.photo);
    if (ph && (!PIC_OK.test(ph) || ph.length > 49000)) throw new Error("bad photo");
    if (String(v[0][7] || "") !== "photo") sh.getRange(1, 8).setValue("photo");
    sh.getRange(row, 8).setValue(ph);
  }
  wrote_();
  return { ok: true };
}
function photos_() {
  var out = {};
  values_("Profiles").slice(1).forEach(function (r) { if (r[0] !== "" && PIC_OK.test(String(r[7] || ""))) out[String(r[0])] = String(r[7]); });
  return out;
}
/* A short stamp of a photo: its length and a sum over it, so a phone can tell a new photo without fetching it. */
function picStamp_(v) {
  var t = String(v || ""), h = 7;
  if (!t) return "";
  for (var i = 0; i < t.length; i += 53) h = (h * 31 + t.charCodeAt(i)) % 1000000007;
  return t.length + "." + h;
}

function addTest_(b) {
  needProfile_(b.p);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) || !SUBJ[b.subj]) throw new Error("bad test");
  sheet_("Tests").appendRow([new Date(), b.p, b.date, b.subj, String(b.note || "").slice(0, 40)]);
  wrote_();
  return { ok: true };
}

/* An exam entered wrong: hers taken off by her, anyone's by the parent. */
function delTest_(b) {
  needProfile_(b.p);
  var sh = sheet_("Tests"), v = values_("Tests");
  for (var i = v.length - 1; i >= 1; i--) {
    if (String(v[i][1]) === b.p && dateText_(v[i][2]) === String(b.date) && String(v[i][3]) === String(b.subj)) { sh.deleteRow(i + 1); wrote_(); return { ok: true, removed: 1 }; }
  }
  return { ok: true, removed: 0 };
}

/* Her grade in an exam that has passed (2026-11-26), entered by her or by the parent; "" takes it off. The app sets
 * it beside what she did in the week before the exam (examsPast_).
 * Three exams above 85 are a token (Avsha, the same day: "3 exams above 85 grants a token, each will need to add an
 * image of the graded test, not only enter the grade"). She sends the photo with the grade and it is saved in the
 * Drive folder; the grade then waits for the parent's yes (gradeOk_), since a token is his 100 shekels. A grade he
 * enters himself (the request carries his PIN) needs no photo and is a yes at once. A grade or photo she changes
 * waits again. Every third exam above EXAM.min with his yes grants a token, once each ("exams 3", "exams 6", ...);
 * one already granted is not taken back if a grade is later changed. */
var EXAM = { min: 85, n: 3 };
function testRow_(b) {
  var v = values_("Tests");
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][1]) === b.p && dateText_(v[i][2]) === String(b.date) && String(v[i][3]) === String(b.subj)) return i;
  return 0;
}
function testHeads_() {
  var sh = sheet_("Tests"), head = values_("Tests")[0] || [];
  ["grade", "photo", "ok"].forEach(function (h, k) { if (String(head[5 + k] || "") !== h) sh.getRange(1, 6 + k).setValue(h); });
}
function setGrade_(b) {
  needProfile_(b.p);
  var dad = b.pin !== undefined && b.pin !== null && String(b.pin) !== "";
  if (dad) checkPin_(b.pin);
  var g = b.grade === "" || b.grade === null || b.grade === undefined ? "" : Number(b.grade);
  if (g !== "" && (isNaN(g) || g < 0 || g > 100)) throw new Error("bad grade");
  var bytes = b.data ? photoBytes_(b.data) : null;
  testHeads_();
  var sh = sheet_("Tests"), i = testRow_(b), v = values_("Tests");
  if (!i) { wrote_(); return { ok: true, saved: 0 }; }
  var file = String(v[i][6] || "");
  if (bytes && g !== "") file = pagesFolder_().createFile(Utilities.newBlob(bytes, "image/jpeg", String(b.date) + " " + b.p + " " + b.subj + " exam.jpg")).getId();
  sh.getRange(i + 1, 6, 1, 3).setValues([g === "" ? ["", "", ""] : [Math.round(g), file, dad ? "yes" : ""]]);
  wrote_();
  return { ok: true, saved: 1, tokens: dad && g !== "" ? examTokens_(b.p) : 0 };
}
/* The parent's word on a grade she entered: yes (it counts for the token) or no. */
function gradeOk_(b) {
  checkPin_(b.pin);
  needProfile_(b.p);
  testHeads_();
  var i = testRow_(b);
  if (!i || gradeOf_(values_("Tests")[i][5]) === "") return { ok: true, saved: 0 };
  sheet_("Tests").getRange(i + 1, 8).setValue(b.yes ? "yes" : "no");
  wrote_();
  return { ok: true, saved: 1, tokens: b.yes ? examTokens_(b.p) : 0 };
}
function examCount_(pid) { return tests_().filter(function (t) { return t.p === pid && t.grade !== "" && t.grade > EXAM.min && t.yes === "yes"; }).length; }
function examTokens_(pid) {
  var due = Math.floor(examCount_(pid) / EXAM.n), n = 0;
  var given = tokenRows_().filter(function (t) { return t.p === pid && /^exams /.test(t.reason); }).length;
  for (; given < due; given++, n++) addToken_(pid, 1, "exams " + (given + 1) * EXAM.n);
  if (n) {
    var prof = needProfile_(pid);
    mail_(appName_() + " · " + prof.name + " קיבלה אסימון על " + EXAM.n + " מבחנים מעל " + EXAM.min,
      shell_(nm_(prof.name) + " קיבלה אסימון", EXAM.n + " מבחנים מעל " + EXAM.min + ", כל אחד עם צילום ובאישור שלך · " + (tokens_()[pid] || 0) + " אסימונים בכספת", [], footer_()));
  }
  return n;
}
/* For each girl: her exams above EXAM.min with the parent's yes, of all time (every EXAM.n of them is a token). */
function examTokAll_() {
  var out = {};
  profiles_().forEach(function (p) { out[p.id] = examCount_(p.id); });
  return out;
}
/* The exams of the last year that have passed, the newest first, each with her grade (if entered) and what she did
 * in its subject in the seven days before it: questions answered, how many right, and how many of them were
 * practice or lessons, beyond the daily five. */
function examsPast_(today) {
  var rows = answers_(), from = addDays_(today, -365);
  return tests_().filter(function (t) { return t.date < today && t.date >= from; })
    .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 60).map(function (t) {
      var lo = addDays_(t.date, -7), n = 0, ok = 0, extra = 0;
      rows.forEach(function (r) {
        if (r.p !== t.p || r.d < lo || r.d >= t.date || String(r.pool).split("-")[1] !== t.subj) return;
        n++; if (r.ok) ok++; if (r.r >= 2) extra++;
      });
      return { p: t.p, date: t.date, subj: t.subj, note: t.note, grade: t.grade, n: n, ok: ok, extra: extra, f: t.f, yes: t.yes };
    });
}
/* Each girl's weeks (Sunday to Saturday), the oldest first: the daily questions she answered and got right, the days
 * she played, and the practice and lesson questions beyond them. All the Answers tab, for the view over time. */
function trend_() {
  var by = {}, out = {};
  answers_().forEach(function (r) {
    var d = new Date(Number(r.d.slice(0, 4)), Number(r.d.slice(5, 7)) - 1, Number(r.d.slice(8)));
    var w = addDays_(r.d, -d.getDay()), k = r.p + "|" + w, e = by[k] || (by[k] = { p: r.p, w: w, n: 0, ok: 0, extra: 0, day: {} });
    if (r.r >= 2) { e.extra++; return; }
    if (r.r) return;
    e.n++; if (r.ok) e.ok++; e.day[r.d] = (e.day[r.d] || 0) + 1;
  });
  Object.keys(by).sort().forEach(function (k) {
    var e = by[k], days = Object.keys(e.day).filter(function (d) { return e.day[d] >= 5; }).length;
    (out[e.p] = out[e.p] || []).push({ w: e.w, n: e.n, ok: e.ok, days: days, extra: e.extra });
  });
  Object.keys(out).forEach(function (p) { out[p].sort(function (a, b) { return a.w < b.w ? -1 : 1; }); });
  return out;
}
/* The sisters' streak (sisOf in app.js): the weeks before this one in which every girl had a full week, in all and
 * in a row. The phones add the week still running. */
function sisters_(today) {
  var rows = answers_(), profs = profiles_(), played = {};
  profs.forEach(function (p) {
    var n = {}; played[p.id] = {};
    rows.forEach(function (r) { if (r.p === p.id && !r.r) n[r.d] = (n[r.d] || 0) + 1; });
    Object.keys(n).forEach(function (d) { if (n[d] >= 5) played[p.id][d] = true; });
  });
  var cur = addDays_(today, -new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8))).getDay());
  var full = 0, streak = 0;
  for (var w = PATH.start; w < cur; w = addDays_(w, 7)) {
    var all = profs.length > 0 && profs.every(function (p) { var k = 0; for (var i = 0; i < 7; i++) if (played[p.id][addDays_(w, i)]) k++; return k >= WEEK_DAYS; });
    if (all) { full++; streak++; } else streak = 0;
  }
  return { full: full, streak: streak };
}

/* ---------- a page from her notebook (Avsha, 2026-11-26) ----------
 * She photographs a notebook page or a worksheet in the app; the photo is saved in a folder of the parent's Drive
 * (made on the first photo; its id is the setting pages_folder) and a row is added to the Pages tab. Claude reads
 * the waiting rows and their photos when Avsha asks, writes questions into the banks, and lists each page's file in
 * the app's data/pages.json with how many questions it gave; the first phone to see that tells the script
 * (pagedone), which marks the row. A page that became questions earns `page` points in the month it was marked,
 * the first two of each calendar week (pagesCounted in app.js: keep the two in step). */
var PAGE = { max: 1500000, day: 10, week: 2 };
function pagesSheet_() {
  var sh = sheet_("Pages");
  if (!sh) {   // a Sheet set up before the pages
    sh = SS_.insertSheet("Pages");
    sh.appendRow(TABS.Pages); sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, TABS.Pages.length).setFontWeight("bold");
    sh.getRange("B:B").setNumberFormat("@"); sh.getRange("I:I").setNumberFormat("@");
    wrote_();
  }
  return sh;
}
function pages_() {
  if (!sheet_("Pages")) return [];
  return values_("Pages").slice(1).map(function (r, i) {
    var st = String(r[6] || "").trim();
    return { i: i, d: dateText_(r[1]), p: String(r[2]), subj: String(r[3]), note: String(r[4] || ""), f: String(r[5] || ""), st: st,
             n: st === "done" ? Number(r[7]) || 0 : 0, why: st === "skip" ? String(r[7] || "") : "", done: r[8] === "" || r[8] === null || r[8] === undefined ? "" : dateText_(r[8]) };
  }).filter(function (x) { return x.p !== ""; });
}
function pagesFolder_() {
  var id = String(setting_("pages_folder") || ""), f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (err) { f = null; } }
  if (!f) { f = DriveApp.createFolder(appName_() + " · מחברות"); setSetting_("pages_folder", f.getId()); }
  return f;
}
function pagesUrl_() { var id = String(setting_("pages_folder") || ""); return id ? "https://drive.google.com/drive/folders/" + id : ""; }
/* A photo as the app sends it (a JPEG as a data URL, under PAGE.max characters), as bytes; anything else is refused. */
function photoBytes_(d) {
  var data = String(d || ""), head = "data:image/jpeg;base64,";
  if (data.length > PAGE.max || data.slice(0, head.length) !== head || !/^[A-Za-z0-9+\/=]+$/.test(data.slice(head.length))) throw new Error("bad photo");
  return Utilities.base64Decode(data.slice(head.length));
}
function addPage_(b) {
  needProfile_(b.p);
  if (!SUBJ[b.subj]) throw new Error("bad subject");
  var bytes = photoBytes_(b.data);
  var today = ymd_(new Date()), sh = pagesSheet_();
  var mine = pages_().filter(function (x) { return x.p === b.p && x.d === today; }).length;
  if (mine >= PAGE.day) throw new Error("too many pages today");
  var name = today + " " + b.p + " " + b.subj + " " + (mine + 1) + ".jpg";
  var file = pagesFolder_().createFile(Utilities.newBlob(bytes, "image/jpeg", name));
  sh.appendRow([new Date(), today, b.p, b.subj, String(b.note || "").slice(0, 60), file.getId(), "", "", ""]);
  wrote_();
  return { ok: true, n: mine + 1 };
}
/* A phone has seen in the app's data/pages.json what became of a page: n questions, or skipped (and why). Marked
 * once; the day is the script's own, so the points fall in the month that is open. */
function pageDone_(b) {
  var f = String(b.f || ""), skip = String(b.skip || "").slice(0, 80), n = Math.max(0, Math.min(80, Math.round(Number(b.n) || 0)));
  if (!f || !sheet_("Pages")) return { ok: true, saved: 0 };
  var sh = sheet_("Pages"), v = values_("Pages");
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][5]) !== f) continue;
    if (String(v[i][6] || "").trim() !== "") return { ok: true, saved: 0 };
    sh.getRange(i + 1, 7, 1, 3).setValues([[skip ? "skip" : "done", skip ? skip : n, ymd_(new Date())]]);
    wrote_();
    return { ok: true, saved: 1 };
  }
  return { ok: true, saved: 0 };
}
/* Her pages that earn points: those that became questions, the first two of each calendar week by the day they
 * were marked (and by their row within a day). */
function pagesCounted_(pid) {
  var per = {};
  return pages_().filter(function (x) { return x.p === pid && x.st === "done" && x.done; })
    .sort(function (a, b) { return a.done < b.done ? -1 : a.done > b.done ? 1 : a.i - b.i; })
    .filter(function (x) {
      var w = addDays_(x.done, -new Date(Number(x.done.slice(0, 4)), Number(x.done.slice(5, 7)) - 1, Number(x.done.slice(8))).getDay());
      per[w] = (per[w] || 0) + 1;
      return per[w] <= PAGE.week;
    });
}
/* For the phones: the pages still waiting (two months back), and those marked since the Sunday on or before the
 * first row they hold, so that a phone counts whole weeks as the script does. */
function pagesRecent_(from, today) {
  var lo = addDays_(from, -new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8))).getDay()), old = addDays_(today, -60);
  return pages_().filter(function (x) { return x.st === "" ? x.d >= old : (x.done >= lo || x.d >= lo); });
}

/* ---------- full weeks: the streak and the four-week path (weeksOf in app.js) ---------- */
function weeks_(rows, pid, today) {
  var n = {}, played = {};
  rows.forEach(function (r) { if (r.p === pid && !r.r) n[r.d] = (n[r.d] || 0) + 1; });
  Object.keys(n).forEach(function (d) { if (n[d] >= 5) played[d] = true; });
  var inWeek = function (w) { var k = 0; for (var i = 0; i < 7; i++) if (played[addDays_(w, i)]) k++; return k; };
  var cur = addDays_(today, -new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8))).getDay());
  var full = 0, streak = 0;
  for (var w = PATH.start; w < cur; w = addDays_(w, 7)) { if (inWeek(w) >= WEEK_DAYS) { full++; streak++; } else streak = 0; }
  var now = cur >= PATH.start ? inWeek(cur) : 0;
  return { full: full, streak: streak, now: now, total: full + (now >= WEEK_DAYS ? 1 : 0) };
}
function pathAll_(today) {
  var rows = answers_(), out = {};
  profiles_().forEach(function (p) { var w = weeks_(rows, p.id, today); out[p.id] = { full: w.full, streak: w.streak }; });
  return out;
}
/* A token for every fourth full week, given as her answers arrive, once each ("weeks 4", "weeks 8", ...). */
function pathTokens_(pid) {
  var w = weeks_(answers_(), pid, ymd_(new Date())), due = Math.floor(w.total / PATH.every), n = 0;
  var given = tokenRows_().filter(function (t) { return t.p === pid && /^weeks /.test(t.reason); }).length;
  for (; given < due; given++, n++) addToken_(pid, 1, "weeks " + (given + 1) * PATH.every);
  if (n) {
    var prof = needProfile_(pid);
    mail_(appName_() + " · " + prof.name + " קיבלה אסימון על " + PATH.every + " שבועות מלאים",
      shell_(nm_(prof.name) + " קיבלה אסימון", PATH.every + " שבועות מלאים, חמישה ימים עם משימה בכל אחד · " + (tokens_()[pid] || 0) + " אסימונים בכספת", [], footer_()));
  }
  return n;
}
/* For the map: on how many different days each girl answered each topic right, before the rows the phones get. */
function knowAll_(from) {
  var days = {}, out = {};
  answers_().forEach(function (r) {
    if (!r.ok || r.d >= from) return;
    var k = r.p + "\n" + r.pool + "|" + r.t;
    (days[k] = days[k] || {})[r.d] = true;
  });
  Object.keys(days).forEach(function (k) {
    var i = k.indexOf("\n"), pid = k.slice(0, i);
    (out[pid] = out[pid] || {})[k.slice(i + 1)] = Object.keys(days[k]).length;
  });
  return out;
}

function redeem_(b) {
  var prof = needProfile_(b.p), have = tokens_()[b.p] || 0;
  if (have < 1) throw new Error("no tokens");
  addToken_(b.p, -1, "redeemed for " + (Number(setting_("token_value")) || 100) + " ₪");
  var value = Number(setting_("token_value")) || 100;
  mail_(appName_() + " · " + prof.name + " פדתה אסימון",
    shell_(nm_(prof.name) + " פדתה אסימון", value + " ₪ · נשארו לה " + (have - 1) + " אסימונים בכספת", [], footer_()));
  return { ok: true };
}

function saveSettings_(b) {
  checkPin_(b.pin);
  if (b.prize5 !== undefined) setSetting_("prize_5", String(b.prize5).slice(0, 80));
  if (b.prize10 !== undefined) setSetting_("prize_10", String(b.prize10).slice(0, 80));
  if (b.goalReward !== undefined) setSetting_("goal_reward", String(b.goalReward).slice(0, 80));
  if (b.bonus !== undefined) {
    if (String(b.bonus) && !BONUS_OK.test(String(b.bonus))) throw new Error("bad bonus");
    setSetting_("bonus", String(b.bonus));
  }
  if (b.bonusNote !== undefined) setSetting_("bonus_note", String(b.bonusNote).slice(0, 160));
  return { ok: true };
}

/* ---------- the parent's gift at a month's end (bonusCard in app.js) ----------
 * One setting, "month|who|days|week" ("2026-11|a,b,c|5|2026-11-22"): at the close of that month, each girl listed
 * who played at least that many days in the week that starts on that date gets a token (days 0: whoever is listed).
 * Kept as one text with bars so that the Sheet does not read its parts as dates. bonus_note is the parent's line. */
var BONUS_OK = /^(\d{4}-\d{2})\|([A-Za-z0-9,]*)\|(\d)\|(\d{4}-\d{2}-\d{2})$/;
function bonus_() {
  var m = BONUS_OK.exec(String(setting_("bonus") || ""));
  if (!m) return null;
  return { month: m[1], ids: m[2] ? m[2].split(",") : [], days: Number(m[3]), week: m[4], note: String(setting_("bonus_note") || "") };
}
function daysInWeek_(rows, pid, week) {
  var n = {}, k = 0;
  rows.forEach(function (r) { if (r.p === pid && !r.r) n[r.d] = (n[r.d] || 0) + 1; });
  for (var i = 0; i < 7; i++) if (n[addDays_(week, i)] >= 5) k++;
  return k;
}
/* Grants the gift for the month just closed, once each ("dedication 2026-11"); returns who got it now. */
function bonusTokens_(key) {
  var b = bonus_(), out = [];
  if (!b || b.month !== key) return out;
  var rows = answers_(), toks = tokenRows_(), profs = profiles_(), reason = "dedication " + key;
  b.ids.forEach(function (id) {
    if (!profs.some(function (p) { return p.id === id; })) return;
    if (toks.some(function (t) { return t.p === id && t.reason === reason; })) return;
    if (b.days > 0 && daysInWeek_(rows, id, b.week) < b.days) return;
    addToken_(id, 1, reason); out.push(id);
  });
  return out;
}

/* ---------- timers ---------- */
function nightlyDigest() {
  wrote_();
  var today = ymd_(new Date()), y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var r = report_(today, y, m), n = r.girls.filter(function (g) { return g.today.played; }).length;
  var missing = r.girls.filter(function (g) { return !g.today.played; }).map(function (g) { return g.name; });
  var dow = DAYS_FULL[new Date(y, m - 1, Number(today.slice(8))).getDay()];
  var headline = n === r.girls.length ? "כולן שיחקו היום" : n + " מתוך " + r.girls.length + " שיחקו היום" + (missing.length ? " · חסרה: " + joinHe_(missing.map(nm_)) : "");
  var sub = "יום " + dow + ", " + Number(today.slice(8)) + " ב" + MONTHS[m - 1] + " · נשארו " + r.daysLeft + " ימים לחודש";
  mail_(appName_() + " · " + dow + " " + Number(today.slice(8)) + "." + m + " · " + (n === r.girls.length ? "כולן שיחקו" : n + " מתוך " + r.girls.length + " שיחקו"),
    shell_(headline, sub, [todaySection_(r), marksSection_(r), gradesSection_(r), examsSection_(r), pagesSection_(r), monthSection_(r, "החודש · " + MONTHS[m - 1]), focusSection_(r), lifetimeSection_(r)], footer_(r)));
}

function monthlyClose() {
  wrote_();
  var today = ymd_(new Date());
  if (today.slice(8) !== "01") return;
  var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var pm = m === 1 ? [y - 1, 12] : [y, m - 1], key = pm[0] + "-" + pad_(pm[1]);
  var gifted = bonusTokens_(key);   // the parent's gift, whether or not the month had a winner
  var reason = "winner " + key;
  var done = values_("Tokens").some(function (row) { return String(row[3]) === reason; });
  if (done) return;
  var profs = profiles_(), rank = ranking_(answers_(), profs, pm[0], pm[1]);
  if (!rank.length || !rank[0].points) return;
  // A tie for first (points, then accuracy, then days) gives every girl in it a token.
  var winners = rank.filter(function (x) { return placeOf_(rank, x) === 1; });
  winners.forEach(function (x) { addToken_(x.id, 1, reason); });
  var names = winners.map(function (x) { return name_(profs, x.id); });
  var r = report_(today, pm[0], pm[1]), imp = improved_(answers_(), profs, pm[0], pm[1]);
  var month = MONTHS[pm[1] - 1];
  var headline = joinHe_(names.map(nm_)) + (names.length > 1 ? " אלופות " : " אלופת ") + month;
  var sub = names.length > 1 ? "כל אחת מהן קיבלה אסימון" : "היא קיבלה אסימון";
  var impHtml = imp ? "<p style='margin:0;font-size:14px'>השתפרה הכי הרבה: " + who_(r.girls.filter(function (g) { return g.id === imp.id; })[0]) +
    " <span dir='ltr'>(+" + imp.gain + "%</span> דיוק). " + esc_(setting_("improved_reward")) + ".</p>" : "";
  mail_(appName_() + " · " + month + ": " + names.join(" ו") + (names.length > 1 ? " אלופות החודש" : " אלופת החודש"),
    shell_(headline, sub, [monthSection_(r, "הטבלה הסופית · " + month), impHtml ? section_("Most improved", "", impHtml) : "",
      gifted.length ? section_("A gift", "", "<p style='margin:0;font-size:14px'>אסימון על ההתמדה, כפי שתזמנת: " + joinHe_(gifted.map(function (id) { return nm_(name_(profs, id)); })) + ".</p>") : "",
      examsSection_(r), lifetimeSection_(r)], footer_(r)));
}

/* ---------- what the emails and the parent screen show ---------- */
/* Today, the month (y, m) and all time, for each girl. */
function report_(today, y, m) {
  var profs = profiles_(), rows = answers_(), toks = tokenRows_(), rank = ranking_(rows, profs, y, m);
  var mk = y + "-" + pad_(m), inMonth = mk === today.slice(0, 7), dim = new Date(y, m, 0).getDate();
  var elapsed = inMonth ? Number(today.slice(8)) : dim;
  var lead = rank.length ? rank[0].points : 0;
  var girls = profs.map(function (p) {
    var todays = rows.filter(function (x) { return x.p === p.id && x.d === today; });
    var reg = todays.filter(function (x) { return !x.r; }), rev = todays.filter(function (x) { return x.r === 1; });
    var prac = todays.filter(function (x) { return x.r === 2; }), fix = todays.filter(function (x) { return x.r === 3; });
    var secs = reg.map(function (x) { return x.s; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    var fast = secs.filter(function (x) { return x < RUSH.secs; }).length, half = Math.floor(secs.length / 2);
    var mo = rank.filter(function (x) { return x.id === p.id; })[0];
    var without = scoreMonth_(rows.filter(function (x) { return !(x.p === p.id && x.d === today); }), p.id, y, m);
    return {
      id: p.id, name: p.name, color: AURA_COL[p.aura] || AURA_COL.orchid,
      today: { played: reg.length >= 5, ok: reg.filter(function (x) { return x.ok; }).length, rev: rev.length ? rev[0].ok : null,
               points: inMonth ? mo.points - without.points : 0, at: reg.length ? reg[reg.length - 1].w : "",
               missed: unique_(reg.filter(function (x) { return !x.ok; }).map(function (x) { return x.t; })),
               secs: secs.length ? (secs.length % 2 ? secs[half] : (secs[half - 1] + secs[half]) / 2) : 0,
               fast: fast, rushed: reg.length >= 5 && fast >= RUSH.n,
               prac: prac.length, pracOk: prac.filter(function (x) { return x.ok; }).length,
               fix: fix.length, fixOk: fix.filter(function (x) { return x.ok; }).length, fixTopic: fix.length ? fix[0].t : "",
               flags: todays.filter(function (x) { return x.f; }).map(function (x) { return { t: x.t, q: x.f, ok: x.ok }; }) },
      week: weekDays_(rows, p.id, today), stuck: stuck_(rows, profs, p, today),
      month: { place: placeOf_(rank, mo), points: mo.points, played: mo.played, acc: mo.acc, weeks: mo.full,
               right: mo.right, gap: lead - mo.points, weak: weak_(rows, p.id, mk) },
      life: lifetime_(rows, toks, p.id)
    };
  });
  var exams = tests_().filter(function (t) { return t.date >= today; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var waiting = pages_().filter(function (x) { return x.st === ""; });
  var marks = rows.filter(function (x) { return x.f && daysTo_(x.d, today) <= 30 && daysTo_(x.d, today) >= 0; });
  return { today: today, y: y, m: m, elapsed: elapsed, daysLeft: inMonth ? dim - elapsed : 0, girls: girls, waiting: waiting, marks: marks,
           goal: Number(setting_("goal")) || 250, goalReward: String(setting_("goal_reward") || ""),
           family: girls.reduce(function (t, g) { return t + g.month.right; }, 0), exams: exams };
}
function lifetime_(rows, toks, pid) {
  var mine = rows.filter(function (x) { return x.p === pid; }), points = 0, days = 0;
  unique_(mine.map(function (x) { return x.d.slice(0, 7); })).forEach(function (mk) {
    var sc = scoreMonth_(rows, pid, Number(mk.slice(0, 4)), Number(mk.slice(5, 7)));
    points += sc.points; days += sc.played;
  });
  var reg = mine.filter(function (x) { return !x.r; }), ok = reg.filter(function (x) { return x.ok; }).length;
  var t = toks.filter(function (x) { return x.p === pid; });
  var earned = t.reduce(function (a, x) { return a + Math.max(0, x.change); }, 0);
  var redeemed = t.reduce(function (a, x) { return a + Math.max(0, -x.change); }, 0);
  return { days: days, answered: reg.length, acc: reg.length ? Math.round(ok / reg.length * 100) : 0, points: points,
           wins: t.filter(function (x) { return /^winner /.test(x.reason); }).length, earned: earned, redeemed: redeemed, balance: earned - redeemed };
}
function lifetimeAll_() {
  var rows = answers_(), toks = tokenRows_(), out = {};
  profiles_().forEach(function (p) { out[p.id] = lifetime_(rows, toks, p.id); });
  return out;
}
/* The topic she is most stuck in (stuckOf in app.js): over four weeks her misses less half her right answers come to
 * three or more. What the parent stopped for her class is left out; a "not learned yet" mark alone changes
 * nothing. The app also leaves out topics her class has not reached (STUDYING, which only the app knows): one
 * switched off since then may show here until its rows are four weeks old. */
function stuck_(rows, profs, prof, today) {
  var by = {}, off = {}, stopped = blocked_().filter(function (x) { return x.s === scope_(prof); });
  stopped.forEach(function (x) { if (!x.q) off[x.pool + "|" + x.t] = true; });
  rows.forEach(function (r) {
    if (r.p !== prof.id || r.d > today || daysTo_(r.d, today) > FIX.days) return;
    if (stopped.some(function (x) { return x.q && x.q === r.q; })) return;
    var k = r.pool + "|" + r.t;
    var e = by[k] || (by[k] = { pool: r.pool, topic: r.t, n: 0, miss: 0, score: 0, last: "" });
    e.n++; e.score += r.ok ? -FIX.right : 1;
    if (!r.ok) { e.miss++; if (r.d > e.last) e.last = r.d; }
  });
  return Object.keys(by).filter(function (k) { return by[k].score >= FIX.min && !off[k]; }).map(function (k) { return by[k]; })
    .sort(function (a, b) { return b.score - a.score || (a.last < b.last ? 1 : a.last > b.last ? -1 : (a.topic < b.topic ? -1 : 1)); })[0] || null;
}
function weak_(rows, pid, mk) {
  var miss = {};
  rows.forEach(function (x) { if (x.p === pid && x.d.slice(0, 7) === mk && !x.ok) miss[x.t] = (miss[x.t] || 0) + 1; });
  return Object.keys(miss).sort(function (a, b) { return miss[b] - miss[a] || (a < b ? -1 : 1); }).slice(0, 3);
}

/* ---------- the emails' design: tables in inline styles, which every mail app keeps ----------
 * Names never stand next to a score like "3/5": Gmail read a name followed by ": 3/5" as an address (Name Street 3,
 * flat 5) and linked it to Maps. Scores are "3 מתוך 5", and nm_() puts an invisible joiner in each name. */
var C = { ink: "#17161F", soft: "#6E6A84", line: "#ECEAF3", bg: "#F3F2F8", head: "#0B0B12", good: "#0E9F6E", bad: "#D63A52" };
function nm_(name) { var s = String(name); return esc_(s.charAt(0)) + "&#8204;" + esc_(s.slice(1)); }
function joinHe_(items) { return items.length < 2 ? (items[0] || "") : items.slice(0, -1).join(", ") + " ו" + items[items.length - 1]; }
function ltr_(t) { return "<span dir='ltr'>" + t + "</span>"; }
function who_(g) {
  return "<span style='display:inline-block;width:9px;height:9px;border-radius:50%;background:" + g.color + ";margin-left:6px'></span><b>" + nm_(g.name) + "</b>";
}
function th_(t) { return "<th style='padding:7px 5px;font-size:11px;font-weight:600;color:" + C.soft + ";text-align:right;border-bottom:1px solid " + C.line + ";white-space:nowrap'>" + t + "</th>"; }
function td_(t, extra) { return "<td style='padding:9px 5px;font-size:13px;color:" + C.ink + ";text-align:right;border-bottom:1px solid " + C.line + ";" + (extra || "") + "'>" + t + "</td>"; }
function table_(heads, rows) {
  return "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' dir='rtl' style='border-collapse:collapse'><tr>" + heads.map(th_).join("") + "</tr>" + rows.join("") + "</table>";
}
function section_(title, sub, inner) {
  return "<tr><td style='padding:20px 16px 4px'><div style='font-size:11px;letter-spacing:.14em;color:#8C88A4;font-weight:700;text-transform:uppercase'>" + title + "</div>" +
    (sub ? "<div style='font-size:15px;color:" + C.ink + ";font-weight:700;margin-top:3px'>" + sub + "</div>" : "") + "</td></tr>" +
    "<tr><td style='padding:8px 16px 4px'>" + inner + "</td></tr>";
}
function shell_(headline, sub, sections, footer) {
  var strip = profiles_().map(function (p) { return "<td style='height:4px;background:" + (AURA_COL[p.aura] || AURA_COL.orchid) + "'></td>"; }).join("");
  return "<!doctype html><html dir='rtl'><head><meta charset='utf-8'><meta name='format-detection' content='telephone=no,date=no,address=no,email=no'>" +
    "<style>a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}</style></head>" +
    "<body style='margin:0;padding:0;background:" + C.bg + "'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:" + C.bg + "'><tr><td align='center' style='padding:14px 6px'>" +
    "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' dir='rtl' style='max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;direction:rtl'>" +
    "<tr><td style='background:" + C.head + ";padding:20px 18px 18px;color:#ffffff'><div style='font-family:Georgia,\"Times New Roman\",serif;font-size:26px;color:#ffffff'>" + esc_(appName_()) + "</div>" +
    "<div style='font-size:21px;font-weight:700;margin-top:12px;color:#ffffff'>" + headline + "</div><div style='font-size:13px;color:#B8B4CE;margin-top:4px'>" + sub + "</div></td></tr>" +
    "<tr><td style='padding:0'><table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr>" + strip + "</tr></table></td></tr>" +
    sections.join("") +
    "<tr><td style='padding:20px 16px 22px;font-size:13px;color:" + C.soft + ";line-height:1.6'>" + footer + "</td></tr></table></td></tr></table></body></html>";
}
function todaySection_(r) {
  var rows = r.girls.map(function (g) {
    var t = g.today;
    return "<tr>" + td_(who_(g)) +
      td_((t.played ? "<b>" + t.ok + "</b> מתוך 5" : "<span style='color:" + C.bad + "'>לא שיחקה</span>") + paceLine_(t)) +
      td_(t.rev === null ? "<span style='color:" + C.soft + "'>—</span>" : t.rev ? "<span style='color:" + C.good + "'>ניצחה</span>" : "<span style='color:" + C.bad + "'>הפסידה</span>") +
      td_(t.points ? "<b>" + ltr_("+" + t.points) + "</b>" : "—") +
      td_(g.week) +
      td_(t.at || "—", "color:" + C.soft) + "</tr>";
  });
  return section_("Today", "היום", table_(["", "ציון", "נקמה", "נקודות", "ימים השבוע", "שעה"], rows));
}
/* Under her score: how long a question took her (the median), or "too fast" in red on a rushed day. Kept short:
 * the column is narrow on a phone, and the Focus section says the rest. */
function paceLine_(t) {
  if (!t.played || !t.secs) return "";
  var sec = t.secs < 10 ? Math.round(t.secs * 10) / 10 : Math.round(t.secs);
  return "<br><span style='font-size:12px;white-space:nowrap;color:" + (t.rushed ? C.bad : C.soft) + "'>" + (t.rushed ? "מהר מדי" : sec + " שנ׳ לשאלה") + "</span>";
}
function monthSection_(r, title) {
  var rows = r.girls.slice().sort(function (a, b) { return a.month.place - b.month.place || (a.id < b.id ? -1 : 1); }).map(function (g) {
    var x = g.month;
    return "<tr>" + td_("<b>" + x.place + "</b>", "width:22px;color:" + (x.place === 1 && x.points ? "#B7862A" : C.soft)) + td_(who_(g)) +
      td_("<b>" + x.points + "</b>") + td_(x.played) + td_(ltr_(x.acc + "%")) + td_(x.weeks) +
      td_(x.gap > 0 ? ltr_("−" + x.gap) : "—", "color:" + C.soft) + "</tr>";
  });
  var pct = Math.min(100, Math.round(r.family / r.goal * 100));
  var bar = "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin-top:14px'><tr><td style='font-size:13px;color:" + C.soft + ";padding-bottom:6px'>" +
    "יעד משפחתי: <b style='color:" + C.ink + "'>" + r.family + "</b> מתוך " + r.goal + " תשובות נכונות" + (r.goalReward ? " · " + esc_(r.goalReward) : "") + "</td></tr>" +
    "<tr><td><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:" + C.line + ";border-radius:6px'><tr>" +
    (pct > 0 ? "<td width='" + pct + "%' style='height:8px;background:#7C5CFF;border-radius:6px;font-size:0;line-height:0'>&nbsp;</td>" : "") +
    "<td style='height:8px;font-size:0;line-height:0'>&nbsp;</td></tr></table></td></tr></table>";
  return section_("Month", title, table_(["#", "", "נקודות", "ימים מתוך " + r.elapsed, "דיוק", "שבועות", "פער"], rows) + bar);
}
function focusSection_(r) {
  var lines = r.girls.map(function (g) {
    var bits = [];
    if (g.today.rushed) bits.push("<span style='color:" + C.bad + "'>ענתה מהר מדי: " + g.today.fast + " מחמש התשובות בפחות מ־" + RUSH.secs + " שניות</span>");
    if (g.today.missed.length) bits.push("פספסה היום: " + g.today.missed.map(esc_).join(" · "));
    if (g.today.prac) bits.push("תרגלה עוד, בלי נקודות: " + g.today.pracOk + " נכונות מתוך " + g.today.prac);
    if (g.today.fix) bits.push("עשתה חיזוק ב" + esc_(g.today.fixTopic) + ": " + g.today.fixOk + " נכונות מתוך " + g.today.fix);
    if (g.stuck) bits.push("<b>תקוע אצלה: " + esc_(g.stuck.topic) + "</b> (" + esc_(SUBJ[String(g.stuck.pool).split("-")[1]] || "") + "): " + g.stuck.miss + " טעויות מתוך " + g.stuck.n +
      " שאלות בארבעה שבועות. שווה לשבת איתה עשר דקות; האפליקציה מציעה לה חיזוק בנושא.");
    if (g.month.weak.length) bits.push("כדאי לחזק החודש: " + g.month.weak.map(esc_).join(" · "));
    return bits.length ? "<p style='margin:0 0 10px;font-size:14px;line-height:1.6'>" + who_(g) + "<br>" + bits.join("<br>") + "</p>" : "";
  }).join("");
  if (!lines) return "";
  return section_("Focus", "על מה לשים לב", lines);
}
/* Every upcoming exam, soonest first (Avsha, 2026-11-13): the date, whose, the subject, how long until it. A week
 * before an exam three of her five come from its subject (TEST_LEAD in app.js), and that week is lit. */
var TEST_LEAD = 7;
function examsSection_(r) {
  var rows = r.exams.slice(0, 12).map(function (t) {
    var g = r.girls.filter(function (x) { return x.id === t.p; })[0];
    if (!g) return "";
    var n = daysTo_(r.today, t.date), when = n <= 0 ? "היום" : n === 1 ? "מחר" : n === 2 ? "מחרתיים" : "בעוד " + n + " ימים";
    var d = new Date(Number(t.date.slice(0, 4)), Number(t.date.slice(5, 7)) - 1, Number(t.date.slice(8)));
    return "<tr>" + td_("יום " + DAYS_FULL[d.getDay()] + " " + ltr_(d.getDate() + "." + (d.getMonth() + 1)), "white-space:nowrap") + td_(who_(g)) +
      td_(esc_(SUBJ[t.subj] || t.subj) + (t.note ? "<br><span style='font-size:12px;color:" + C.soft + "'>" + esc_(t.note) + "</span>" : "")) +
      td_(n <= TEST_LEAD ? "<b style='color:#B7862A'>" + when + "</b>" : when, n <= TEST_LEAD ? "" : "color:" + C.soft) + "</tr>";
  }).filter(String);
  if (!rows.length) return "";
  return section_("Exams", "מבחנים קרובים", table_(["תאריך", "", "מקצוע", ""], rows) +
    "<p style='margin:8px 0 0;font-size:12px;color:" + C.soft + "'>שבוע לפני מבחן, שלוש מחמש השאלות היומיות שלה מהמקצוע שלו.</p>");
}
/* Every "not learned yet" mark that waits for the parent's word, the newest first, each with its question quoted:
 * a mark does nothing until he removes it or stops the question or its topic, in the app. */
function marksSection_(r) {
  if (!r.marks || !r.marks.length) return "";
  var lines = r.marks.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; }).slice(0, 12).map(function (x) {
    var g = r.girls.filter(function (y) { return y.id === x.p; })[0];
    if (!g) return "";
    return "<p style='margin:0 0 12px;font-size:14px;line-height:1.6'>" + who_(g) + " · " + esc_(SUBJ[String(x.pool).split("-")[1]] || "") + " · " + esc_(x.t) +
      " <span style='color:" + C.soft + "'>(" + ltr_(Number(x.d.slice(8)) + "." + Number(x.d.slice(5, 7))) + ", " + (x.ok ? "ענתה נכון" : "טעתה") + ")</span><br>" +
      "<span dir='" + (/[\u0590-\u05FF]/.test(x.f) ? "rtl" : "ltr") + "' style='display:block;color:" + C.soft + "'>" +
      esc_(x.f).replace(/\{([^}]*)\}/g, "<span dir='ltr' style='unicode-bidi:isolate;display:inline-block'>$1</span>") + "</span></p>";
  }).join("");
  return section_("Your call", "סומן ״עוד לא למדנו״ ומחכה להחלטה שלך", lines +
    "<p style='margin:0;font-size:12px;color:" + C.soft + "'>סימון לא משנה כלום עד שתחליט. באפליקציה, במסך שלך: להסיר אותו אם זה נלמד, או לעצור את השאלה או את כל הנושא עד שהכיתה תגיע אליו.</p>");
}
/* Notebook pages the girls photographed that have not become questions yet, by girl and subject. */
function pagesSection_(r) {
  if (!r.waiting || !r.waiting.length) return "";
  var lines = r.girls.map(function (g) {
    var mine = r.waiting.filter(function (x) { return x.p === g.id; }), by = {};
    if (!mine.length) return "";
    mine.forEach(function (x) { var k = SUBJ[x.subj] || x.subj; by[k] = (by[k] || 0) + 1; });
    return "<p style='margin:0 0 8px;font-size:14px;line-height:1.6'>" + who_(g) + ": " + Object.keys(by).map(function (k) { return esc_(k) + " (" + by[k] + ")"; }).join(" · ") + "</p>";
  }).join("");
  var url = pagesUrl_();
  return section_("Notebook", "דפים מהמחברת שמחכים", lines +
    "<p style='margin:6px 0 0;font-size:12px;color:" + C.soft + "'>כדי שיהפכו לשאלות, אומרים ל־Claude: ״יש דפים חדשים מהמחברות״." +
    (url ? " <a href='" + url + "' style='color:" + C.soft + "'>התיקייה ב־Drive</a>" : "") + "</p>");
}
/* Grades above EXAM.min that wait for the parent's yes: the email names them, the app's Today tab has the buttons. */
function gradesSection_(r) {
  var wait = tests_().filter(function (t) { return t.grade !== "" && t.grade > EXAM.min && !t.yes; });
  var lines = r.girls.map(function (g) {
    var mine = wait.filter(function (t) { return t.p === g.id; });
    if (!mine.length) return "";
    return "<p style='margin:0 0 8px;font-size:14px;line-height:1.6'>" + who_(g) + ": " + mine.map(function (t) {
      return esc_(SUBJ[t.subj] || t.subj) + ", ציון " + t.grade + (t.f ? "" : " (בלי צילום)"); }).join(" · ") + "</p>";
  }).join("");
  if (!lines) return "";
  return section_("Grades", "ציונים שמחכים לאישור שלך", lines +
    "<p style='margin:6px 0 0;font-size:12px;color:" + C.soft + "'>" + EXAM.n + " מבחנים מעל " + EXAM.min + " שווים אסימון. מאשרים באפליקציה, בלשונית ״היום״, ושם גם הצילום.</p>");
}
function daysTo_(a, b) {
  var x = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8)));
  var y = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8)));
  return Math.round((y - x) / 86400000);
}
function lifetimeSection_(r) {
  var life = r.girls.map(function (g) {
    var x = g.life;
    return "<tr>" + td_(who_(g)) + td_(x.days) + td_(x.answered) + td_(ltr_(x.acc + "%")) + td_("<b>" + x.points + "</b>") + "</tr>";
  });
  var toks = r.girls.map(function (g) {
    var x = g.life;
    return "<tr>" + td_(who_(g)) + td_(x.wins) + td_(x.earned) + td_(x.redeemed) + td_("<b>" + x.balance + "</b>") + "</tr>";
  });
  return section_("All time", "מכל הזמנים", table_(["", "ימים", "שאלות", "דיוק", "נקודות"], life)) +
    section_("Tokens", "אסימונים", table_(["", "חודשים שניצחה", "קיבלה", "פדתה", "בכספת"], toks));
}
function footer_(r) {
  var p5 = String(setting_("prize_5") || ""), p10 = String(setting_("prize_10") || "");
  var url = SpreadsheetApp.getActiveSpreadsheet().getUrl ? SpreadsheetApp.getActiveSpreadsheet().getUrl() : "";
  var link = function (href, text) { return "<a href='" + href + "' style='display:inline-block;padding:9px 16px;border-radius:999px;background:" + C.head + ";color:#ffffff;text-decoration:none;font-weight:700;margin:0 0 6px 6px'>" + text + "</a>"; };
  return (p5 || p10 ? "פרסים: " + (p5 ? "5 אסימונים = " + esc_(p5) : "") + (p5 && p10 ? " · " : "") + (p10 ? "10 אסימונים = " + esc_(p10) : "") + "<br><br>" : "") +
    link(APP_URL, "לאפליקציה") + (url ? link(url, "לגיליון") : "");
}

/* ---------- scoring: keep in step with stats() in app.js ---------- */
function scoreMonth_(rows, pid, y, m) {
  var mk = y + "-" + pad_(m), P = pointsOf_(mk), firstDow = new Date(y, m - 1, 1).getDay(), byDay = {}, pracOk = 0, fixOk = 0;
  rows.forEach(function (r) {
    if (r.p !== pid || r.d.slice(0, 7) !== mk) return;
    if (r.r === 2) { if (r.ok) pracOk++; return; }   // practice: no points, only the family goal
    var e = byDay[r.d] || (byDay[r.d] = { reg: 0, ok: 0, revOk: 0, fix: 0 });
    if (r.r === 3) { e.fix++; if (r.ok) fixOk++; }   // a fix-it lesson: `lesson` points once its three are answered
    else if (r.r) { if (r.ok) e.revOk++; } else { e.reg++; if (r.ok) e.ok++; }
  });
  var days = Object.keys(byDay).filter(function (d) { return byDay[d].reg >= 5; });
  var weeks = {}, reg = 0, ok = 0, revOk = 0, perfect = 0, lessons = 0;
  days.forEach(function (d) {
    if (byDay[d].ok >= 5) perfect++;
    if (byDay[d].fix >= LESSON_N) lessons++;
    var w = Math.floor((Number(d.slice(8)) - 1 + firstDow) / 7);
    weeks[w] = (weeks[w] || 0) + 1;
    reg += byDay[d].reg; ok += byDay[d].ok; revOk += byDay[d].revOk;
  });
  var full = Object.keys(weeks).filter(function (w) { return weeks[w] >= P.weekDays; }).length;
  var pages = pagesCounted_(pid).filter(function (x) { return x.done.slice(0, 7) === mk; }).length;   // notebook pages that became questions
  return { id: pid, played: days.length, acc: reg ? Math.round(ok / reg * 100) : 0, ok: ok, revOk: revOk, full: full,
           pracOk: pracOk, fixOk: fixOk, perfect: perfect, lessons: lessons, pages: pages, right: ok + revOk + pracOk + fixOk,
           points: days.length * P.day + ok * P.right + perfect * P.perfect + revOk * P.revenge + lessons * P.lesson + pages * P.page + full * P.week };
}
function ranking_(rows, profs, y, m) {
  return profs.map(function (p) { return scoreMonth_(rows, p.id, y, m); }).sort(function (a, b) {
    return b.points - a.points || b.acc - a.acc || b.played - a.played || (a.id < b.id ? -1 : 1);
  });
}
/* Equal points, accuracy and days share a place, as placeOf() in app.js. */
function placeOf_(rank, me) {
  var ahead = function (a, b) { return a.points !== b.points ? a.points > b.points : a.acc !== b.acc ? a.acc > b.acc : a.played > b.played; };
  return 1 + rank.filter(function (r) { return ahead(r, me); }).length;
}
function improved_(rows, profs, y, m) {
  var pm = m === 1 ? [y - 1, 12] : [y, m - 1], best = null;
  profs.forEach(function (p) {
    var a = scoreMonth_(rows, p.id, y, m), b = scoreMonth_(rows, p.id, pm[0], pm[1]);
    if (a.played < 8 || b.played < 8) return;
    var gain = a.acc - b.acc;
    if (gain > 0 && (!best || gain > best.gain)) best = { id: p.id, gain: gain };
  });
  return best;
}
function weekDays_(rows, pid, today) {
  var dow = new Date(today.slice(0, 4), Number(today.slice(5, 7)) - 1, Number(today.slice(8))).getDay();
  var n = 0;
  for (var i = 0; i <= dow; i++) {
    var d = addDays_(today, i - dow);
    if (rows.filter(function (r) { return r.p === pid && r.d === d && !r.r; }).length >= 5) n++;
  }
  return n;
}

/* ---------- reading the tabs ----------
 * Each tab is read once a request and kept (Avsha, 2026-11-26: the app took about 30 seconds to open). One `state`
 * read the Sheet about twenty times over (Settings once for every setting it sends, Answers four times, Profiles and
 * Tokens three each), and every reading of Answers asked Google to format each row's time of day: with 330 rows,
 * over 1,300 calls, and more with every day played. A request that only checks the family code took 2.8 seconds,
 * so each reading and each call counts. Now a reading is kept until something is written (wrote_), the rows of
 * Answers are worked out once, and a row's time of day is formatted only for yesterday's and today's rows, the only
 * ones whose hour is shown (the evening email's and Dad's Today). */
var SS_ = null, TAB_ = {}, ROWS_ = null, FMT_ = {};
function sheet_(name) { return (SS_ || (SS_ = SpreadsheetApp.getActiveSpreadsheet())).getSheetByName(name); }
function values_(name) { return TAB_[name] || (TAB_[name] = sheet_(name).getDataRange().getValues()); }
/* Something was written, or a request begins: what was read is read again. */
function wrote_() { TAB_ = {}; ROWS_ = null; }
function settingsMap_() {
  var map = {};
  values_("Settings").slice(1).forEach(function (r) { map[String(r[0])] = r[1]; });
  return map;
}
function setting_(k) { var v = settingsMap_()[k]; return v === undefined || v === null ? "" : v; }
function setSetting_(k, v) {
  var sh = sheet_("Settings"), vals = values_("Settings");
  for (var i = 1; i < vals.length; i++) if (vals[i][0] === k) { sh.getRange(i + 1, 2).setValue(v); wrote_(); return; }
  sh.appendRow([k, v, ""]);
  wrote_();
}
function profiles_() {
  return values_("Profiles").slice(1).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return { id: String(r[0]), name: String(r[1]), track: String(r[2]), pair: String(r[3] || ""), slot: Number(r[4]) || 0,
             flavor: String(r[5] || ""), aura: String(r[6] || "orchid"), pic: picStamp_(r[7]) };
  });
}
function answers_() {
  if (ROWS_) return ROWS_;
  var recent = addDays_(ymd_(new Date()), -1);
  return (ROWS_ = values_("Answers").slice(1).filter(function (r) { return r[2] !== ""; }).map(function (r) {
    var d = dateText_(r[1]), k = Number(r[8]);
    return { d: d, p: String(r[2]), q: String(r[3]), pool: String(r[4]), t: String(r[5]), l: Number(r[6]) || 1,
             ok: Number(r[7]) ? 1 : 0, r: k === 2 ? 2 : k === 3 ? 3 : k ? 1 : 0, s: Number(r[9]) || 0, f: String(r[10] || ""),
             w: d >= recent && r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, "HH:mm") : "" };
  }));
}
function tokenRows_() {
  return values_("Tokens").slice(1).filter(function (r) { return r[1] !== ""; }).map(function (r) {
    return { d: dateText_(r[0]), p: String(r[1]), change: Number(r[2]) || 0, reason: String(r[3] || "") };
  });
}
function tokens_() {
  var t = {};
  tokenRows_().forEach(function (x) { t[x.p] = (t[x.p] || 0) + x.change; });
  return t;
}
function tests_() {
  return values_("Tests").slice(1).filter(function (r) { return r[1] !== ""; }).map(function (r) {
    return { p: String(r[1]), date: dateText_(r[2]), subj: String(r[3]), note: String(r[4] || ""), grade: gradeOf_(r[5]),
             f: String(r[6] || ""), yes: String(r[7] || "").trim().toLowerCase() };
  });
}
function gradeOf_(v) { var n = Number(v); return v === "" || v === null || v === undefined || isNaN(n) ? "" : Math.max(0, Math.min(100, Math.round(n))); }
function addToken_(pid, change, reason) { sheet_("Tokens").appendRow([new Date(), pid, change, reason]); wrote_(); }

/* ---------- small helpers ---------- */
function checkCode_(code) {
  var want = String(setting_("family_code") || "");
  if (!want || String(code || "").trim().toUpperCase() !== want.toUpperCase()) throw new Error("wrong family code");
}
function appName_() { return String(setting_("app_name") || "Aura"); }
function checkPin_(pin) {
  // A PIN typed into the Sheet as 0123 is kept as the number 123, so compare both without leading zeros.
  var norm = function (s) { return String(s == null ? "" : s).trim().replace(/^0+(?=\d)/, ""); };
  if (!String(pin || "") || norm(pin) !== norm(setting_("parent_pin"))) throw new Error("wrong pin");
}
function needProfile_(pid) {
  var p = profiles_().filter(function (x) { return x.id === pid; })[0];
  if (!p) throw new Error("unknown profile");
  return p;
}
function name_(profs, id) { var p = profs.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; }
function mail_(subject, html) {
  var to = String(setting_("parent_email") || Session.getEffectiveUser().getEmail());
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: "<div dir='rtl' style='font-family:Arial,sans-serif;font-size:15px;line-height:1.6'>" + html + "</div>" });
}
function makeCode_() {
  var abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "";
  for (var i = 0; i < 6; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
  return s;
}
function ymd_(d) { var k = d.getTime(); return FMT_[k] || (FMT_[k] = Utilities.formatDate(d, TZ, "yyyy-MM-dd")); }
function dateText_(v) { return v instanceof Date ? ymd_(v) : String(v).slice(0, 10); }
function addDays_(s, n) {
  var d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8)) + n);
  return d.getFullYear() + "-" + pad_(d.getMonth() + 1) + "-" + pad_(d.getDate());
}
function pad_(n) { return (n < 10 ? "0" : "") + n; }
function unique_(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
