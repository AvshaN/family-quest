# Aura: guide for Claude

"Aura" is a working name (2026-11-11); the girls will vote on the real one after
a few days of use. The name is in index.html, manifest.webmanifest, the
wordmark in app.js and the Sheet's `app_name` setting (the emails).

A daily five-question study app for three sisters, built for their dad,
Avsha (Nir). He is a marketing/CRM analyst and a novice coder: he decides,
tests with the girls and gives feedback; Claude writes the code.

## The person and the girls

- **Plain language, step by step** for anything technical he has to do
  (Google, GitHub, phones). Say what you checked and what you couldn't.
- **He never hands over credentials.** Sign-ins, deployments in his Google
  account and repo settings are his; give him the steps.
- **The girls** (13, 13 and 16) are the users. Their first reaction to the
  first prototype was expected to be "too childish": keep the look grown-up
  (dark, glass, editorial type, their own colours), never cartoonish.
- **Privacy:** the girls' names, answers and the family code live only in
  the family's Google Sheet. Keep names out of this repo (the repo may be
  made public for GitHub Pages). Demo names are placeholders.

## How it fits together

- `app.js` is the whole app, no build step. `config.js` holds the Apps
  Script URL; empty means demo mode (example history, localStorage only).
- `backend/Code.gs` runs inside the Sheet. Tabs: Settings, Profiles,
  Answers, Tokens, Tests. API: GET `state`, POST `submit | profile | test |
  redeem | pin | grant | settings`. Timers: `nightlyDigest`, `monthlyClose`.
- **Scoring lives in two places** and must stay identical: `stats()` in
  `app.js` and `scoreMonth_()` in `Code.gs` (POINTS in both).
- **The daily pick** (`shareOf`, `take`): each pool has one fixed shuffled
  order (`permOf`); girls who share a pool (same `pair`) split it by that
  order, alternate questions each, so the twins never share a question. Each
  girl takes the first questions of her share she hasn't answered (history
  before the day only, so the day's five stay put), then the oldest seen.
  A twin never takes a question her sister has answered: adding questions
  reshuffles the order and so the halves (on 2026-11-13 each twin would have
  met two of her sister's first-day questions on 28-29 Nov). So appending is
  safe; deleting or reordering only changes what comes next.
  `tools/simulate_days.js` plays the coming days and reports repeats (from
  2026-11-13: the twins' math runs out on 28-29 Nov; the eldest's none in 30
  days).
- **What each class has reached** (`STUDYING` in `app.js`, by track and
  pool): a listed pool gives only those topics, in the five and in revenge
  rounds. The eldest complained on 2026-11-13 of probability and modals she
  hadn't studied; her math is now her notebook's test list (the straight
  line: slope, line equation, parallel lines, axes and two lines meeting,
  midpoint, distance, triangle area, Pythagoras; then from her notebook the
  test's algebra: shortcut multiplication, quadratic equations, algebraic
  fractions; and the parallelogram and rhombus) and her English the present
  simple and progressive and reading, and from her English notebook George
  Eliot's "Count That Day Lost", simile and metaphor, and two word lists
  (Unit 1; Module E Test 2). Her Bible (`g10-bible`, added the same
  day from her notebook) is Tanakh structure and Genesis 1-3, the sentences
  read as an aetiological story.
  Avsha is sending each subject's notebook pages; build each pool from them.
  **His rule for every round** (2026-11-13): the notebooks don't cover all
  that was taught, so compare them with the curriculum, and a topic or part
  the curriculum states beside one in the notes counts as studied (her
  perpendicular lines, beside parallel lines); the topic that comes after it
  does not (the kinds of verb complement; Herzl after Zionism's causes). Say what
  was added this way; the girls will complain if it's wrong.
  Her Hebrew language (`g10-heb`): the argument text, parts of speech and
  the verb / infinitive / action-noun forms, subject, predicate, noun and
  verb complements, logical connectors and the cardinal numbers.
  Her biology (`g10-bio`): homeostasis, surface-to-volume, the membrane and
  transport (diffusion, osmosis, hypo/iso/hypertonic, passive and active),
  the molecules of life and their elements, and the organelles (taught without
  notes, she said); enzymes and the body's systems are written and wait off.
  Her history (`g10-hist`): time concepts, the five W's, the nation and its
  components, the French Revolution, the causes of Zionism (emancipation,
  antisemitism), Israel's electoral system; Herzl onward waits off.
  Open a topic as the class reaches it; the twins' pools are not limited yet.
- **The emails** (`report_` builds what they show; `shell_`, `todaySection_`, `monthSection_`,
  `focusSection_`, `lifetimeSection_`): tables in inline styles. Never put a name next to a
  score like "3/5": Gmail read a girl's name followed by ": 3/5" as a street address (her name as the street, 3 the number, 5 the flat) and linked it to Maps
  (2026-11-11). Scores are "3 מתוך 5" and `nm_()` puts an invisible joiner in each name.
  The digest timer has `nearMinute(0)`; without it Google fires at any minute of the hour.
- **Dad's screen** has tabs (`parentToday`, `parentMonth`, `parentLife`, `parentSettings`);
  all-time numbers come from `state_().lifetime` and `tokenLog` (all the Answers tab, not just
  the two months of rows the phones get), computed in the demo from what the app holds.
- **Ties share a place** (`placeOf` / `placeOf_`): equal points, accuracy
  and days. A tie for first on the 1st gives each girl in it a token.
- **Banks:** `data/bank/<pool>.json`, format in `data/README.md`;
  `options[0]` is always right; `{...}` marks left-to-right math in Hebrew.
  Run `python3 tools/check_bank.py` after any change.
- **Tracks** (`TRACKS` in `app.js`): `g10-bio` (eldest), `g7` (gymnast
  twin), `g7-art` (art twin). Profiles in the Sheet point at a track.

## Checking work

- `node --check app.js`
- `python3 tools/check_bank.py`
- `python3 tools/build_preview.py /tmp/x.html --names "A,B,C"` and open it
  (or walk it with Playwright) for a demo-mode look at every screen.
- `node tools/sheet_sim.js 8765` runs `Code.gs` on an in-memory Sheet and
  serves the app live against it (`/?k=TEST42`; `/__run?fn=...&now=...`
  runs a timer, `/__sheet?tab=...` shows a tab).
- The real Sheet can be read with the Google Sheets connector (the file is
  "Aura" in Avsha's Drive). Never repeat the family code or PIN in chat.
- After changing app files, bump `VERSION` in `sw.js` so phones update.
- **Check the push reached the site**: the live `sw.js` should show the new
  `VERSION` within a few minutes. GitHub Pages publishes each push to main
  through its own "pages build and deployment" run; during a GitHub outage
  (2026-11-11) two runs ended in "startup failure" and a re-run sat queued
  for over an hour and could not be cancelled, so the site kept the old
  version. A new push starts a new run.

## Monthly

Write more questions before a pool runs out (each girl sees 2 math and 2
English a day; the twins share the grade-7 pools, so those go twice as
fast). Ask Avsha what the girls are learning now, or for their tests, and
keep `STUDYING` in step: a limited pool runs out sooner, so count its
listed topics' questions, not the whole bank.
