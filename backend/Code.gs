/**
 * Aura: the family's record, in a Google Sheet.
 *
 * This script lives inside the Sheet (Extensions > Apps Script) and is deployed as a web app
 * (SETUP.md has the steps). The app on the girls' phones talks to it:
 *   GET  ?action=state&code=...   the family, this month's and last month's answers, tokens, tests
 *   POST {action, code, ...}      submit | profile | test | redeem | pin | grant | settings
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
var SUBJ = { math: "מתמטיקה", eng: "אנגלית", sci: "מדע", heb: "לשון", hist: "היסטוריה", civ: "אזרחות", bible: "תנ״ך", geo: "גאוגרפיה", art: "אמנות", bio: "ביולוגיה", lit: "ספרות" };
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
  // nearMinute(0): within about 15 minutes of the hour; without it Google picks any minute in it (21:33 on the first night).
  ScriptApp.newTrigger("nightlyDigest").timeBased().everyDays(1).atHour(hour).nearMinute(0).inTimezone(TZ).create();
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
    lifetime: lifetimeAll_(),
    tokenLog: tokenRows_().slice(-30),
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
  return { ok: true };
}

/* ---------- timers ---------- */
function nightlyDigest() {
  var today = ymd_(new Date()), y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var r = report_(today, y, m), n = r.girls.filter(function (g) { return g.today.played; }).length;
  var missing = r.girls.filter(function (g) { return !g.today.played; }).map(function (g) { return g.name; });
  var dow = DAYS_FULL[new Date(y, m - 1, Number(today.slice(8))).getDay()];
  var headline = n === r.girls.length ? "כולן שיחקו היום" : n + " מתוך " + r.girls.length + " שיחקו היום" + (missing.length ? " · חסרה: " + joinHe_(missing.map(nm_)) : "");
  var sub = "יום " + dow + ", " + Number(today.slice(8)) + " ב" + MONTHS[m - 1] + " · נשארו " + r.daysLeft + " ימים לחודש";
  mail_(appName_() + " · " + dow + " " + Number(today.slice(8)) + "." + m + " · " + (n === r.girls.length ? "כולן שיחקו" : n + " מתוך " + r.girls.length + " שיחקו"),
    shell_(headline, sub, [todaySection_(r), monthSection_(r, "החודש · " + MONTHS[m - 1]), focusSection_(r), lifetimeSection_(r)], footer_(r)));
}

function monthlyClose() {
  var today = ymd_(new Date());
  if (today.slice(8) !== "01") return;
  var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var pm = m === 1 ? [y - 1, 12] : [y, m - 1], key = pm[0] + "-" + pad_(pm[1]);
  var reason = "winner " + key;
  var done = sheet_("Tokens").getDataRange().getValues().some(function (row) { return String(row[3]) === reason; });
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
    shell_(headline, sub, [monthSection_(r, "הטבלה הסופית · " + month), impHtml ? section_("Most improved", "", impHtml) : "", lifetimeSection_(r)], footer_(r)));
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
    var reg = todays.filter(function (x) { return !x.r; }), rev = todays.filter(function (x) { return x.r; });
    var mo = rank.filter(function (x) { return x.id === p.id; })[0];
    var without = scoreMonth_(rows.filter(function (x) { return !(x.p === p.id && x.d === today); }), p.id, y, m);
    return {
      id: p.id, name: p.name, color: AURA_COL[p.aura] || AURA_COL.orchid,
      today: { played: reg.length >= 5, ok: reg.filter(function (x) { return x.ok; }).length, rev: rev.length ? rev[0].ok : null,
               points: inMonth ? mo.points - without.points : 0, at: reg.length ? reg[reg.length - 1].w : "",
               missed: unique_(reg.filter(function (x) { return !x.ok; }).map(function (x) { return x.t; })) },
      week: weekDays_(rows, p.id, today),
      month: { place: placeOf_(rank, mo), points: mo.points, played: mo.played, acc: mo.acc, weeks: mo.full,
               right: mo.ok + mo.revOk, gap: lead - mo.points, weak: weak_(rows, p.id, mk) },
      life: lifetime_(rows, toks, p.id)
    };
  });
  var soon = tests_().filter(function (t) { return t.date >= today && t.date <= addDays_(today, 7); });
  return { today: today, y: y, m: m, elapsed: elapsed, daysLeft: inMonth ? dim - elapsed : 0, girls: girls,
           goal: Number(setting_("goal")) || 250, goalReward: String(setting_("goal_reward") || ""),
           family: girls.reduce(function (t, g) { return t + g.month.right; }, 0), tests: soon };
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
      td_(t.played ? "<b>" + t.ok + "</b> מתוך 5" : "<span style='color:" + C.bad + "'>לא שיחקה</span>") +
      td_(t.rev === null ? "<span style='color:" + C.soft + "'>—</span>" : t.rev ? "<span style='color:" + C.good + "'>ניצחה</span>" : "<span style='color:" + C.bad + "'>הפסידה</span>") +
      td_(t.points ? "<b>" + ltr_("+" + t.points) + "</b>" : "—") +
      td_(g.week) +
      td_(t.at || "—", "color:" + C.soft) + "</tr>";
  });
  return section_("Today", "היום", table_(["", "ציון", "נקמה", "נקודות", "ימים השבוע", "שעה"], rows));
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
    if (g.today.missed.length) bits.push("פספסה היום: " + g.today.missed.map(esc_).join(" · "));
    if (g.month.weak.length) bits.push("כדאי לחזק החודש: " + g.month.weak.map(esc_).join(" · "));
    return bits.length ? "<p style='margin:0 0 10px;font-size:14px;line-height:1.6'>" + who_(g) + "<br>" + bits.join("<br>") + "</p>" : "";
  }).join("");
  var tests = r.tests.map(function (t) {
    var g = r.girls.filter(function (x) { return x.id === t.p; })[0];
    return "<li style='margin-bottom:4px'>" + (g ? nm_(g.name) : esc_(t.p)) + ": " + (SUBJ[t.subj] || esc_(t.subj)) + (t.note ? " (" + esc_(t.note) + ")" : "") +
      ", יום " + DAYS_FULL[new Date(Number(t.date.slice(0, 4)), Number(t.date.slice(5, 7)) - 1, Number(t.date.slice(8))).getDay()] + " " + Number(t.date.slice(8)) + "." + Number(t.date.slice(5, 7)) + "</li>";
  }).join("");
  if (!lines && !tests) return "";
  return section_("Focus", "על מה לשים לב", lines + (tests ? "<div style='font-size:14px;font-weight:700;margin-top:6px'>מבחנים בשבוע הקרוב</div><ul style='margin:6px 0 0;padding-right:18px;font-size:14px'>" + tests + "</ul>" : ""));
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
  return { id: pid, played: days.length, acc: reg ? Math.round(ok / reg * 100) : 0, ok: ok, revOk: revOk, full: full,
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
             ok: Number(r[7]) ? 1 : 0, r: Number(r[8]) ? 1 : 0, w: r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, "HH:mm") : "" };
  });
}
function tokenRows_() {
  return sheet_("Tokens").getDataRange().getValues().slice(1).filter(function (r) { return r[1] !== ""; }).map(function (r) {
    return { d: dateText_(r[0]), p: String(r[1]), change: Number(r[2]) || 0, reason: String(r[3] || "") };
  });
}
function tokens_() {
  var t = {};
  tokenRows_().forEach(function (x) { t[x.p] = (t[x.p] || 0) + x.change; });
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
