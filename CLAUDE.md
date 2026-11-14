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
  untest | redeem | pin | grant | settings`. Timers: `nightlyDigest`,
  `monthlyClose`. `state` sends `api` (2 since 2026-11-14): the app is live
  the minute it is pushed, the script only when Avsha pastes it, so anything
  the old script would get wrong (practice rows, deleting an exam) is shown
  only when `api` is 2. Test a build against the old script too.
- **Scoring lives in two places** and must stay identical: `stats()` in
  `app.js` and `scoreMonth_()` in `Code.gs` (`POINTS_BY` in both, by month:
  to change a rule, add a line with the month it starts; never edit a past
  one, or closed months change). Until November 2026 a day was 10, a right
  answer 4, a revenge round 8; from December 5, 5, 5 more for a perfect day,
  and a revenge round 5 (at double, missing on purpose and winning it back
  paid more than knowing). `tools/sheet_sim.js` has `/__score` to compare.
- **An Answers row**: `revenge` is 0 (one of the five), 1 (a revenge round)
  or 2 (practice: no points, counts for the map and the family goal); `secs`
  is how long her first answer took. `r.r` is truthy for both 1 and 2: write
  `r.r === 1` when you mean a revenge round.
- **The round** (`newRound`, `settle`, `finishQuest`; Avsha, 2026-11-14, after
  a review found a day of random taps took seconds and paid half a perfect
  day): only the first answer is recorded; a miss rejoins the end of the
  queue until right. A question is typed on a number pad (`typedOf`: math,
  four plain-number options), matched in pairs (`matchOf`: "What does “x”
  mean?"), or four options; `data/README.md` has the rules. Leaving after an
  answer moves on at the return (it used to show the question again).
- **Rushed** (`RUSH`): three of the five in under three seconds each. Dad's
  Today and the email mark it; her result screen says so too. The Me screen
  tells the girls everything Dad sees: keep that line true.
- **Full weeks** (`weeksOf` / `weeks_`, `PATH`): calendar weeks with five
  days played, from 2026-11-15. The streak is on her home screen; every
  fourth full week, in a row or not, is a token (`pathTokens_`, reason
  "weeks N", an email to Dad), so a girl behind on the board has one to play
  for. A token is 100 ₪ of Avsha's money: he chose this.
- **The map** (`knowOf`, `knowMap`, the `know` tab): a topic is known after
  right answers on three different days (`KNOW`). **Practice**
  (`practiceSet`): after the five, two optional rounds a day, mostly what she
  has seen (missed first), so the pools last. The Sheet sends `path` and
  `know` for what is older than the two months of rows the phones hold.
- **Motion** (Avsha, 2026-11-14: the girls react well to animation and
  interesting graphics, "not a simple drawing with a couple frames"). The
  aura is a small WebGL shader behind everything (`auraStart`, `auraMood`,
  `auraPulse`): 120 px across and stretched, every second frame; it drops to
  72 px, then back to the three CSS discs, on a phone under 20 frames a
  second, and the discs are also what reduced motion or no WebGL gets. While
  a round, story or ceremony is open, `body.deep` hides the page under it so
  the one aura shows through. `#fx` carries the short effects (`sparks`,
  `ring`, `streamTo`, `comet`). `paintArt(root)` starts every living canvas
  in a screen: her artwork assembling (`liveArt`; `artPlan` keeps a day's
  piece the same for ever), the gymnast's apparatus of the day (`liveAppar`),
  the stage (`liveStage`), the map's sky (`liveSky`), all through `animate`,
  which stops when the canvas leaves the page. A new token is a ceremony
  (`tokenCheck`). The oldest phone is an old Xiaomi; the others are iPhone
  14 and 16. None of this was seen on a real phone: ask how it runs there.
  Check motion with frames at set times (Playwright with
  `--use-gl=swiftshader`), and run once with `reducedMotion: 'reduce'`.
  An effect over the page must take no taps (`pointer-events:none`), and a
  clip on a screen also cuts its taps: the round first opened through a
  growing `clip-path` circle and quick taps outside it were lost.
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
  antisemitism); Herzl onward waits off. Her civics (`g10-civ`, added
  2026-11-13): rights (natural, political, social, group), democracy's
  principles and Israel's electoral system. Code.gs knows `civ` only once
  Avsha pastes the script again (a civics test is refused until then).
  Open a topic as the class reaches it.
  **The twins** (one class, one notebook each for everything, and loose
  worksheets; sent 2026-11-13): `STUDYING.g7` serves both tracks. History is
  time and historical thinking, aliyot (push and pull), the melting pot,
  nation and identity (the ancient world first written for them waits);
  science is science and technology, units and SI, the lab, body and
  material, the greenhouse effect; Hebrew is reading skills, question types,
  fact, opinion and rumour, their word lists; a new pool, `g7-midrash`
  (בית מדרש), is their unit on change (Rabbi Akiva, the fork-girl poem,
  eradication or sublimation, the role model); English is their word list,
  reading and the present tenses. Math is not limited: one worksheet (the
  distributive law) is all that came. Worksheets carry the school's name
  and the girls' family name: keep both out of the repo.
  Their books (covers, same day): English "Teamwork" (7th grade, Band II
  word list; no unit started), science Matmon Hadash "Exploring Matter and
  Energy A" (first gate, materials, open; the particle model, the second
  gate, waits).
- **Exams** (Avsha, 2026-11-13): every exam found in a notebook goes into the
  Sheet's Tests tab (profile id, date as text, subject key, note), as the
  girls' "+ מבחן" does; the eldest's Hebrew 21.12, 8.3 and the internal bagrut
  23.5 were entered that day. For `TEST_LEAD` (7) days before one, three of
  her five come from its subject (`activeTest`, `dailySet`), her home screen
  chip says how long is left, and Dad's Today tab (`examsCard`) and the
  evening and monthly emails (`examsSection_`) list every upcoming exam.
- **The emails** (`report_` builds what they show; `shell_`, `todaySection_`, `monthSection_`,
  `focusSection_`, `lifetimeSection_`): tables in inline styles. Never put a name next to a
  score like "3/5": Gmail read a girl's name followed by ": 3/5" as a street address (her name as the street, 3 the number, 5 the flat) and linked it to Maps
  (2026-11-11). Scores are "3 מתוך 5" and `nm_()` puts an invisible joiner in each name.
  The digest timer has `nearMinute(0)`; without it Google fires at any minute of the hour.
- **Dad's screen** has tabs (`parentToday`, `parentMonth`, `parentLife`, `parentSettings`);
  all-time numbers come from `state_().lifetime` and `tokenLog` (all the Answers tab, not just
  the two months of rows the phones get), computed in the demo from what the app holds.
  His PIN unlock lasts the session (`keepUnlock`, sessionStorage): the phone's pull-down
  reload keeps him in, on the same tab; reopening the app, leaving his screen or a girl
  claiming the phone asks for it again (2026-11-14).
- **Dad's test profile** (`SANDBOX`, entered from his Settings tab; Avsha,
  2026-11-14): a girl's app for a profile "test" that only his phone knows,
  following the questions of the girl he picks. Its answers and exams live
  in `L.sand`; nothing of it is sent (every `api` call and the outbox are
  skipped while `SANDBOX` is set), it is on the board only on his phone and
  only while he is in it, the right answer is written under each question,
  and "reset" lets him play the day again. A new write to the Sheet needs
  the same `!SANDBOX` guard; `walk`-style tests should count POSTs.
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
  runs a timer, `/__sheet?tab=...` shows a tab, `/__now?t=...` sets the
  script's clock, `/__load` stages rows, `/__score` gives its ranking,
  `/__mails` the emails sent). With Playwright's `page.clock.setFixedTime`
  on the phone's side, any date can be played.
- With `window.FQ_TEST = {}` set before the app loads, `FQ_TEST.api` gives a
  test the round on screen (`round()`), `typedOf`, `weeksOf`, `knowMap`,
  `ranking` and more, to answer right or wrong through real taps.
- The real Sheet can be read with the Google Sheets connector (the file is
  "Aura" in Avsha's Drive). Never repeat the family code or PIN in chat.
- **A failed test stops the push.** On 2026-11-14 a live walk failed, the
  output was piped through a grep that hid the reason, and the push in the
  same command went out: the tap-blocking opening was live for ten minutes.
  Run the tests, read their end, then push in a separate step.
- After changing app files, bump `VERSION` in `sw.js` so phones update.
- **Check the push reached the site**: the live `sw.js` should show the new
  `VERSION` within a few minutes. GitHub Pages publishes each push to main
  through its own "pages build and deployment" run; during a GitHub outage
  (2026-11-11) two runs ended in "startup failure" and a re-run sat queued
  for over an hour and could not be cancelled, so the site kept the old
  version. A new push starts a new run.

## Reminders (looked into 2026-11-14, not built)

Avsha asked whether a girl who hasn't played can get an evening reminder on
her phone. Possible, untested: standard Web Push with no payload, sent by
Code.gs from an evening timer (it knows who played). Apps Script has no
ECDSA, so the VAPID signature (ES256) must be written in plain JS, and
BigInt may not work there (use a non-BigInt bignum). iPhones need iOS 16.4+
and the app on the Home Screen, and drop a subscription that shows no
notification. A Telegram bot is the simple fallback if the girls use
Telegram. Ruled out: ntfy (weak on iPhone), Firebase (needs a project, and
has an open issue with sites under a subpath like ours), Calendar (can't
set another person's reminder), WhatsApp (paid), email (ignored). Ask which
phones the girls have before building.

## Monthly

Write more questions before a pool runs out (each girl sees 2 math and 2
English a day; the twins share the grade-7 pools, so those go twice as
fast). Ask Avsha what the girls are learning now, or for their tests, and
keep `STUDYING` in step: a limited pool runs out sooner, so count its
listed topics' questions, not the whole bank.
