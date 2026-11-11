/**
 * Aura: the family's record, in a Google Sheet.
 *
 * This script lives inside the Sheet (Extensions > Apps Script) and is deployed as a web app
 * (SETUP.md has the steps). The app on the girls' phones talks to it:
 *   GET  ?action=state&code=...   the family, this month's and last month's answers, tokens, tests
 *   POST {action, code, ...}      submit | profile | test | redeem | pin | grant | settings
 * and two daily timers run here:
 *   nightlyDigest   the evening email to the parent
 *   monthlyClose    on the 1st: a token to last month's winner, and an email with the month's results
 *
 * The scoring (scoreMonth_) must match stats() in app.js: the board on the phones and the token
 * awarded here are worked out from the same rows by the same rules.
 */

var TZ = "Asia/Jerusalem";
var TABS = {
  Settings: ["key", "value", "what it is"],
  Profiles: ["id", "name", "track", "pair", "slot", "flavor", "aura"],
  Answers: ["when", "date", "profile", "question", "pool", "topic", "level", "right", "revenge"],
  Tokens: ["when", "profile", "change", "reason"],
  Tests: ["when", "profile", "date", "subject", "note"]
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
var POINTS = { day: 10, right: 4, revenge: 8, week: 15, weekDays: 5 };
var SUBJ = { math: "מתמטיקה", eng: "אנגלית", sci: "מדע", heb: "לשון", hist: "היסטוריה", bible: "תנ״ך", geo: "גאוגרפיה", art: "אמנות", bio: "ביולוגיה", lit: "ספרות" };
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
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var hour = Math.max(0, Math.min(23, Number(setting_("digest_hour")) || 21));
  ScriptApp.newTrigger("nightlyDigest").timeBased().everyDays(1).atHour(hour).inTimezone(TZ).create();
  ScriptApp.newTrigger("monthlyClose").timeBased().everyDays(1).atHour(0).nearMinute(30).inTimezone(TZ).create();
  Logger.log("Ready. Family code: " + setting_("family_code") + ". Now type the girls' names in the Profiles tab.");
}

/* ---------- the web app ---------- */
function doGet(e) {
  return guard_(function () {
    var p = (e && e.parameter) || {};
    checkCode_(p.code);
    if (p.action !== "state") throw new Error("unknown action");
    return state_();
  });
}

function doPost(e) {
  return guard_(function () {
    var b = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    checkCode_(b.code);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (b.action) {
        case "submit": return submit_(b);
        case "profile": return setProfile_(b);
        case "test": return addTest_(b);
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
    today: today,
    profiles: profiles_(),
    settings: {
      goal: Number(setting_("goal")) || 250, goalReward: setting_("goal_reward"), prize5: setting_("prize_5"),
      prize10: setting_("prize_10"), tokenValue: Number(setting_("token_value")) || 100,
      improvedReward: setting_("improved_reward"), digestHour: Number(setting_("digest_hour")) || 21
    },
    tokens: tokens_(),
    rows: answers_().filter(function (r) { return r.d >= from; }),
    tests: tests_().filter(function (t) { return t.date >= addDays_(today, -1); })
  };
}

/* ---------- writes ---------- */
function submit_(b) {
  needProfile_(b.p);
  var rows = Array.isArray(b.rows) ? b.rows : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.d)) || !rows.length || rows.length > 8) throw new Error("bad submission");
  var have = {};
  answers_().forEach(function (r) { if (r.p === b.p && r.d === b.d) have[r.q + "|" + r.r] = true; });
  var now = new Date(), add = [];
  rows.forEach(function (r) {
    var key = String(r.q) + "|" + (r.r ? 1 : 0);
    if (have[key] || r.p !== b.p || r.d !== b.d) return;
    have[key] = true;
    add.push([now, b.d, b.p, String(r.q), String(r.pool), String(r.t || ""), Number(r.l) || 1, r.ok ? 1 : 0, r.r ? 1 : 0]);
  });
  if (add.length) {
    var sh = sheet_("Answers");
    sh.getRange(sh.getLastRow() + 1, 1, add.length, add[0].length).setValues(add);
  }
  return { ok: true, added: add.length };
}

function setProfile_(b) {
  needProfile_(b.p);
  var allowed = ["orchid", "lagoon", "ember", "cherry", "matcha", "chrome"];
  if (allowed.indexOf(b.aura) < 0) throw new Error("bad aura");
  var sh = sheet_("Profiles"), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === b.p) sh.getRange(i + 1, 7).setValue(b.aura);
  return { ok: true };
}

function addTest_(b) {
  needProfile_(b.p);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) || !SUBJ[b.subj]) throw new Error("bad test");
  sheet_("Tests").appendRow([new Date(), b.p, b.date, b.subj, String(b.note || "").slice(0, 40)]);
  return { ok: true };
}

function redeem_(b) {
  var prof = needProfile_(b.p), have = tokens_()[b.p] || 0;
  if (have < 1) throw new Error("no tokens");
  addToken_(b.p, -1, "redeemed for " + (Number(setting_("token_value")) || 100) + " ₪");
  mail_(appName_() + " · " + prof.name + " פדתה אסימון",
    "<p><b>" + esc_(prof.name) + "</b> פדתה אסימון אחד, " + (Number(setting_("token_value")) || 100) + " ₪.</p>" +
    "<p>נשארו לה " + (have - 1) + " אסימונים.</p>");
  return { ok: true };
}

function saveSettings_(b) {
  checkPin_(b.pin);
  if (b.prize5 !== undefined) setSetting_("prize_5", String(b.prize5).slice(0, 80));
  if (b.prize10 !== undefined) setSetting_("prize_10", String(b.prize10).slice(0, 80));
  if (b.goalReward !== undefined) setSetting_("goal_reward", String(b.goalReward).slice(0, 80));
  return { ok: true };
}

/* ---------- timers ---------- */
function nightlyDigest() {
  var today = ymd_(new Date()), y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var profs = profiles_(), rows = answers_(), rank = ranking_(rows, profs, y, m);
  var lines = profs.map(function (p) {
    var mine = rows.filter(function (r) { return r.p === p.id && r.d === today && !r.r; });
    var ok = mine.filter(function (r) { return r.ok; }).length;
    var miss = unique_(mine.filter(function (r) { return !r.ok; }).map(function (r) { return r.t; }));
    var week = weekDays_(rows, p.id, today);
    var line = mine.length >= 5 ? ok + "/5" + (miss.length ? ". פספסה: " + miss.map(esc_).join(", ") : ", בלי טעויות") : "<span style='color:#c0392b'>לא שיחקה היום</span>";
    return "<p><b>" + esc_(p.name) + ":</b> " + line + ". השבוע " + week + " ימים.</p>";
  });
  var leads = rank.filter(function (r) { return r.points && placeOf_(rank, r) === 1; });
  var daysLeft = new Date(y, m, 0).getDate() - Number(today.slice(8));
  var soon = tests_().filter(function (t) { return t.date >= today && t.date <= addDays_(today, 3); });
  var html = lines.join("") +
    (soon.length ? "<p>מבחנים בקרוב: " + soon.map(function (t) { return esc_(name_(profs, t.p)) + ", " + (SUBJ[t.subj] || t.subj) + " ב־" + t.date.slice(8) + "." + t.date.slice(5, 7); }).join("; ") + "</p>" : "") +
    "<p style='color:#666'>" + (leads.length ? leads.map(function (r) { return esc_(name_(profs, r.id)); }).join(" ו") + (leads.length > 1 ? " מובילות" : " מובילה") + " עם " + leads[0].points + " נקודות. " : "") + "נשארו " + daysLeft + " ימים לחודש.</p>";
  mail_(appName_() + " · הסיכום של היום", html);
}

function monthlyClose() {
  var today = ymd_(new Date());
  if (today.slice(8) !== "01") return;
  var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var pm = m === 1 ? [y - 1, 12] : [y, m - 1], key = pm[0] + "-" + pad_(pm[1]);
  var reason = "winner " + key;
  var done = sheet_("Tokens").getDataRange().getValues().some(function (r) { return String(r[3]) === reason; });
  if (done) return;
  var profs = profiles_(), rows = answers_(), rank = ranking_(rows, profs, pm[0], pm[1]);
  if (!rank.length || !rank[0].points) return;
  // A tie for first (points, then accuracy, then days) gives every girl in it a token.
  var winners = rank.filter(function (r) { return placeOf_(rank, r) === 1; });
  winners.forEach(function (r) { addToken_(r.id, 1, reason); });
  var names = winners.map(function (r) { return name_(profs, r.id); });
  var imp = improved_(rows, profs, pm[0], pm[1]);
  var table = rank.map(function (r) {
    return "<tr><td>" + placeOf_(rank, r) + "</td><td>" + esc_(name_(profs, r.id)) + "</td><td>" + r.points + "</td><td>" + r.played + "</td><td>" + r.acc + "%</td></tr>";
  }).join("");
  mail_(appName_() + " · " + MONTHS[pm[1] - 1] + ": " + names.join(" ו") + (names.length > 1 ? " אלופות החודש" : " אלופת החודש"),
    "<p><b>" + names.map(esc_).join(" ו") + "</b> " + (names.length > 1 ? "ניצחו יחד ב" + MONTHS[pm[1] - 1] + ", וכל אחת קיבלה אסימון." : "ניצחה ב" + MONTHS[pm[1] - 1] + " וקיבלה אסימון.") + "</p>" +
    (imp ? "<p>השתפרה הכי הרבה: <b>" + esc_(name_(profs, imp.id)) + "</b> (+" + imp.gain + "% דיוק). " + esc_(setting_("improved_reward")) + ".</p>" : "") +
    "<table cellpadding='6' style='border-collapse:collapse'><tr><th>#</th><th>שם</th><th>נקודות</th><th>ימים</th><th>דיוק</th></tr>" + table + "</table>");
}

/* ---------- scoring: keep in step with stats() in app.js ---------- */
function scoreMonth_(rows, pid, y, m) {
  var mk = y + "-" + pad_(m), firstDow = new Date(y, m - 1, 1).getDay(), byDay = {};
  rows.forEach(function (r) {
    if (r.p !== pid || r.d.slice(0, 7) !== mk) return;
    var e = byDay[r.d] || (byDay[r.d] = { reg: 0, ok: 0, revOk: 0 });
    if (r.r) { if (r.ok) e.revOk++; } else { e.reg++; if (r.ok) e.ok++; }
  });
  var days = Object.keys(byDay).filter(function (d) { return byDay[d].reg >= 5; });
  var weeks = {}, reg = 0, ok = 0, revOk = 0;
  days.forEach(function (d) {
    var w = Math.floor((Number(d.slice(8)) - 1 + firstDow) / 7);
    weeks[w] = (weeks[w] || 0) + 1;
    reg += byDay[d].reg; ok += byDay[d].ok; revOk += byDay[d].revOk;
  });
  var full = Object.keys(weeks).filter(function (w) { return weeks[w] >= POINTS.weekDays; }).length;
  return { id: pid, played: days.length, acc: reg ? Math.round(ok / reg * 100) : 0,
           points: days.length * POINTS.day + ok * POINTS.right + revOk * POINTS.revenge + full * POINTS.week };
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

/* ---------- reading the tabs ---------- */
function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function settingsMap_() {
  var map = {};
  sheet_("Settings").getDataRange().getValues().slice(1).forEach(function (r) { map[String(r[0])] = r[1]; });
  return map;
}
function setting_(k) { var v = settingsMap_()[k]; return v === undefined || v === null ? "" : v; }
function setSetting_(k, v) {
  var sh = sheet_("Settings"), vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) if (vals[i][0] === k) { sh.getRange(i + 1, 2).setValue(v); return; }
  sh.appendRow([k, v, ""]);
}
function profiles_() {
  return sheet_("Profiles").getDataRange().getValues().slice(1).filter(function (r) { return r[0] !== ""; }).map(function (r) {
    return { id: String(r[0]), name: String(r[1]), track: String(r[2]), pair: String(r[3] || ""), slot: Number(r[4]) || 0,
             flavor: String(r[5] || ""), aura: String(r[6] || "orchid") };
  });
}
function answers_() {
  return sheet_("Answers").getDataRange().getValues().slice(1).filter(function (r) { return r[2] !== ""; }).map(function (r) {
    return { d: dateText_(r[1]), p: String(r[2]), q: String(r[3]), pool: String(r[4]), t: String(r[5]), l: Number(r[6]) || 1,
             ok: Number(r[7]) ? 1 : 0, r: Number(r[8]) ? 1 : 0 };
  });
}
function tokens_() {
  var t = {};
  sheet_("Tokens").getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[1] === "") return;
    t[String(r[1])] = (t[String(r[1])] || 0) + (Number(r[2]) || 0);
  });
  return t;
}
function tests_() {
  return sheet_("Tests").getDataRange().getValues().slice(1).filter(function (r) { return r[1] !== ""; }).map(function (r) {
    return { p: String(r[1]), date: dateText_(r[2]), subj: String(r[3]), note: String(r[4] || "") };
  });
}
function addToken_(pid, change, reason) { sheet_("Tokens").appendRow([new Date(), pid, change, reason]); }

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
function ymd_(d) { return Utilities.formatDate(d, TZ, "yyyy-MM-dd"); }
function dateText_(v) { return v instanceof Date ? ymd_(v) : String(v).slice(0, 10); }
function addDays_(s, n) {
  var d = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8)) + n);
  return d.getFullYear() + "-" + pad_(d.getMonth() + 1) + "-" + pad_(d.getDate());
}
function pad_(n) { return (n < 10 ? "0" : "") + n; }
function unique_(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
