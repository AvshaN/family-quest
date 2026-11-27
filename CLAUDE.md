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
- **Show it, do not say it** (Avsha, 2026-11-27, of the whole app:
  "whatever can be communicated by visual cues rather than with text,
  should be implemented in this way. for example, the banners 'push with
  your finger' and such could be replaced by an animated glow on an object
  when an action needed. if text can be avoided by clear visual cues,
  that's the route we should take in all aspects of this project, not only
  the creature section"). Before a banner, a hint or a label is written,
  look for the cue that says it: the thing to touch glows or moves, the
  field that is missing shakes, the number that changed pops, a card
  arrives in a glow. Words stay where a cue cannot carry it (who sent a
  gift, an error from the Sheet). The tools (app.js beside `toast`):
  `nope(el)` shakes and glows what is missing or wrong, `arrived(el)`
  brings into view and glows what was just saved or given, `waitCue()`
  pulses the buttons that wait for the Sheet, `examEl(p, date, subj)` finds
  an exam's row on the screen. **Each says whether it found its element,
  and where it did not the caller still says it in words**, so nothing
  passes in silence: keep that shape (`if (!arrived(el)) toast(...)`).
  Done in the creature's section: the care scenes have no hints (below); a
  name not given shakes its field; a new level pops its number; a choice
  reached arrives as its card in a glow; a thing not hers shakes and the
  choices that can give it glow; a thing taken is simply seen on it.
  Done in the rest of the app (his "yes" to a list of them, the same
  evening): an exam form with no date or subject shakes what is missing; an
  exam saved, and a grade saved, glow their row (a grade saved from her
  home screen, where no row of it is left, is still said in words); a
  grade that is not a grade shakes its field; a token Dad gives bursts in
  gold on her name; a tap on a round's button while the Sheet answers
  pulses the waiting buttons. **Still in words, and candidates for the
  next pass** (mostly Dad's own confirmations): "הסימון הוסר" and its
  three siblings, "אושר: המבחן נספר", "המבחן נמחק", "התמונה הוסרה",
  "נשמר. הבנות יראו את זה בכספת.", the notebook page sent, the gift's
  schedule. Scratch `t_cues.js` walks the ones done.

## How it fits together

- `app.js` is the whole app, no build step. `config.js` holds the Apps
  Script URL; empty means demo mode (example history, localStorage only).
- `backend/Code.gs` runs inside the Sheet. Tabs: Settings, Profiles,
  Answers, Tokens, Tests, Pages. API: GET `state | photos`, POST `submit |
  profile | test | untest | grade | gradeok | unflag | block | unblock |
  page | pagedone | redeem | pin | grant | settings`. Timers: `nightlyDigest`,
  `monthlyClose`. `state` sends `api` (2 since 2026-11-14, 3 since
  2026-11-22: photos, 4 the same day: "not learned yet" marks, 5: the gift at
  a month's end, 6 since 2026-11-26: one reading of each tab a request,
  fix-it lessons, a grade after an exam, `exams`, `trend` and `sis`; 7 the
  same day: notebook pages; 8 the same day: the parent's word on a mark,
  a photo and his yes for a grade, the token for three exams; 9 since
  2026-11-27: each girl's creature in her profile):
  the app is live
  the minute it is pushed, the script only when Avsha pastes it, so anything
  the old script would get wrong (practice rows, deleting an exam) is shown
  only when `api` is 2. Test a build against the old script too.
  Dad's Settings tab says whether the script in the Sheet is current
  (`scriptCard`: `SCRIPT_API` in app.js against the `api` it got), and his
  Today tab warns when it is behind: raise `SCRIPT_API` with `API`, and add a
  line to `SCRIPT_ADDS`. The Sheet shows no trace of a paste until a girl
  plays, and the web app tells nothing without the family code, so this card
  is how to know; ask him what it says.
- **Opening** (`boot`, `sync`, `repaint`, `greet`; Avsha, 2026-11-26: "the
  purple screen and about 30 seconds later the app loads"). A phone that has
  opened the app before opens it from its last copy of the Sheet (`L.cache`)
  and its own copies of the banks (the cache `fq-banks`, which `sw.js` keeps
  over a version), and asks the Sheet and the site meanwhile. Until they
  answer `waiting()` is true: a round cannot start (`waitAttr`, the guards
  in `startQuest`, `startPractice`, `startFix`) and the popups wait, because
  the day's five read her sisters' rows and the exams. A new button that
  starts a round needs the same two things. `repaint` draws the screen again
  quietly when the answer changed anything, and waits while a sheet or a
  round is open or Dad is typing his settings. The script reads each tab
  once a request (`values_`, dropped by `wrote_()` after every write and at
  each entry point: add `wrote_()` after any new write) and formats a row's
  hour only for yesterday's and today's rows. Before: 20 readings and 1,261
  date formats for 315 rows; after, 5 and 22. `sw.js` serves its copy of a
  file when the site has not answered in 2.5 s, so `index.html` and `app.js`
  can be of two versions for one opening: keep a change to one harmless to
  the other. Dad's Settings tab says how long the Sheet took (`loadCard`):
  ask him what it says. `tools/sheet_sim.js` has `/__lag?ms=` and `/__reads`.
- **Scoring lives in two places** and must stay identical: `stats()` in
  `app.js` and `scoreMonth_()` in `Code.gs` (`POINTS_BY` in both, by month:
  to change a rule, add a line with the month it starts; never edit a past
  one, or closed months change). Until November 2026 a day was 10, a right
  answer 4, a revenge round 8; from December 5, 5, 5 more for a perfect day,
  and a revenge round 5 (at double, missing on purpose and winning it back
  paid more than knowing). `tools/sheet_sim.js` has `/__score` to compare.
  From 2026-11-26 `lesson` (5) is in both lines of both lists, for a day
  with three fix-it answers; no row of that kind is older, so no closed
  month changed.
- **An Answers row**: `revenge` is 0 (one of the five), 1 (a revenge round),
  2 (practice: no points, counts for the map and the family goal) or 3 (a
  fix-it lesson's question); `secs` is how long her first answer took. `r.r`
  is truthy for 1, 2 and 3: write `r.r === 1` when you mean a revenge round.
- **The fix-it lesson** (`stuckOf`, `fixOffer`, `startFix`, `LESSONS`; from
  their first fifteen days, 2026-11-26: one twin had signed numbers wrong 7
  of 12 times, the other perimeter and area 6 of 10). A topic is stuck when,
  over four weeks, her misses less half her right answers come to three or
  more (`FIX`; `stuck_` in Code.gs for the email). The most stuck is offered
  on her home screen from the next day, once a day: the idea (`LESSONS`, by
  pool and topic, written for 22 math topics; add a topic's lines when it
  shows up stuck in another subject), a worked example (a question of her
  twin's half of the pool, which she is never asked), then three questions,
  easiest first, the one she last missed to close. Three answers of kind 3
  in a day earn `lesson` points on a day that counts. A "not learned yet"
  mark does not keep a lesson away; what Dad stopped does. Dad's Today and
  the evening email name what is stuck. Needs api 6: the older script stores
  kind 3 as a revenge round.
- **Difficulty** (`bandOf`, `LEVEL`): over her last two weeks in a pool, nine
  in ten right and her new questions come hardest first; six in ten or
  fewer, easiest first. The eldest got 43 of 45 right once her questions
  were limited to her class's topics; 28 level-3 questions were added for
  her math (g10-math-156 to 183). Write more level 3 when a girl stays in
  the upper band: count them with the loop in the commit of that date.
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
  has seen (missed first), so the pools last (eight rounds in an exam week). The Sheet sends `path` and
  `know` for what is older than the two months of rows the phones hold.
- **A page from her notebook** (`pageSheet`, `pageSend`, `fitPage`,
  `pagesCard`, `syncPages`; `addPage_`, `pageDone_`, `pagesCounted_` in
  Code.gs; Avsha, 2026-11-26, his option A). She photographs a notebook page
  or a worksheet from her home screen ("דף"): the app shrinks it (1800 px,
  JPEG) and the script saves it in a folder of his Drive ("Aura · מחברות",
  its id in the setting `pages_folder`) with a row in the Pages tab (when,
  date, profile, subject, note, file id, status, questions, done). Dad's
  Today and the evening email list what waits.
  **When he says there are new notebook pages:** read `Pages!A1:I` with the
  Sheets connector and take the rows with an empty status; open each photo
  with the Drive connector's `download_file_content` on its file id (it
  arrives as a picture; tested 2026-11-26); write the questions by his rule
  for every round (what the curriculum states beside what is on the page
  counts, the next topic does not) and open the topic in `STUDYING`; then
  add each page to `data/pages.json`, `"<file id>": { "n": 12 }` for the
  questions it gave or `{ "skip": "why, in Hebrew" }` for one that cannot be
  read; run the checks; publish. The first phone that opens the app marks
  the rows through the script (`pagedone`) and she sees "12 שאלות · +5".
  **Do not write the Sheet yourself**: a write of Claude's to the Sheet was
  refused on that day, and this way the questions and the mark arrive
  together. A photo may show the school's name, the family name or an exam
  date: none of it goes into the repo, and an exam date is told to Avsha.
  A page that became questions earns `page` (5) in the month it was marked,
  the first two of each calendar week (`pagesCounted`, in both places).
  The script needs Drive permission: after pasting, he runs `setup` once
  and allows it (SETUP.md), or every request and timer fails.
- **Stars that fade** (`FADE`, `knowLast`, `fadedIn`): a known topic with no
  right answer in four weeks dims on the map and is not counted as known
  until one right answer lights it again; practice brings faded topics
  right after what she missed. The first can fade about 2026-12-09.
- **The sisters' streak** (`sisOf`, `sisCard`; `sisters_` in Code.gs): weeks
  in which every sister had a full week, in a row. Weeks and not days, so a
  rest day breaks nothing. **Against yourself** (`versusSelf`, `selfCard`):
  her points this week so far against the same weekday last week. Both are
  on the board, and one line of each under her week on the home screen.
- **Good luck** (`luckCheck`, `renderLuck`, `liveLuck`; Avsha, 2026-11-26):
  the day before an exam each sister and Dad see, once, her photo in a
  laurel wreath and "בהצלחה במבחן ב… מחר"; twins sitting the same exam share
  one. Not opened that day: shown on the exam's morning, worded "today".
  Dad's Exams card has a preview link.
- **"Not learned yet"** (`canFlag`, `marksWaiting`, `markRow`, `flagsCard`,
  `stoppedCard`; `unflag_`, `block_`, `unblock_`, `marksSection_` in Code.gs).
  A girl can mark any question "we have not learned this yet" (Avsha,
  2026-11-22). She answers it all the same and it counts; the mark is the
  question's text in the Answers tab's `flag` column. **His rule since
  2026-11-26: a mark changes nothing by itself. He is told and decides.**
  The evening email lists every waiting mark with its question, a popup
  shows it once when he opens the app, and it stays on his Today tab ("Your
  call") until he takes one of three ways: "זה נלמד" removes the mark;
  "לעצור רק את השאלה" stops that one question; "לעצור את כל הנושא" stops its
  topic. Stopping is for her and the girl she shares a class with (the
  pair), is kept in the setting `blocked` (a JSON list: s, pool, t, q, d,
  by, text), clears the marks it settles, and is undone from the "Stopped"
  card ("הכיתה הגיעה לזה: לפתוח"). A stopped question is as one her class
  has not reached (`stopped`, inside `studied()`): out of the five, the
  revenge rounds, practice, the lesson and the map. Until that day a mark
  of hers or her twin's left its topic out of the weakest-topic question
  by itself, and for some hours out of the lesson; two of the first two
  marks were not that (a slip on a rectangle's perimeter; one hard
  question, `−3²`, in the twins' main topic). **At the start of a session,
  read the flag column** and the `blocked` setting's effect in `state`:
  tell Avsha what waits, and never switch a topic off in `STUDYING` for a
  mark; that is his word to give in the app. Stopping needs api 8; with
  api 7 he can only remove.
- **What waits for Dad** (`newsItems`, `newsCheck`, `renderNews`,
  `dadPopups`; Avsha, 2026-11-26: "any other changes that require my
  attention to appear as a popup once when opening the app (along with the
  current), like when a new test is added or notebook images"). After the
  month's popup and the good-luck one, a sheet lists what is new since his
  phone last showed it: the waiting marks with their buttons, a token
  redeemed (to pay), a topic a girl is newly stuck in, notebook pages that
  wait, exams added, grades entered. Each is shown once (`L.dadSeen`, on
  his phone; the first time everything but the marks is taken as seen; what
  he enters himself on his phone is not news). A new thing that needs him
  is a new kind in `newsItems`, with a key that names it.
- **Her weakest topic** (`weakTopic`, `WEAK`): of her two math questions a
  day, the second is from the studied topic with most misses left over the
  last four weeks (a miss one, a right answer half off), a question she has
  not met or met a week ago or more. A mark no longer leaves a topic out
  (2026-11-26); a topic Dad stopped is out, as everywhere.
- **Matching has a fifth meaning** (`pairs.decoy`): in their first eleven
  days all three got every matching right, 20 of 20.
- **A day is played once.** `flush` keeps a batch in `FAM.rows` when the
  Sheet has taken it. It used to drop it from the outbox and wait for the
  next `state`: for a second or three the day looked unplayed, the home
  screen drawn then kept its start button, and on 2026-11-22 one twin played
  her day twice for a second revenge round. `startQuest` also refuses a
  played day, and `submit_` takes five questions and one revenge round a day.
- **What an exam covers** (`EXAM_TOPICS`, by track, subject and date): when
  Avsha sends an exam's page, list its topics there, and for its week the
  subject's three questions and the practice come from them first (four
  practice rounds a day in an exam week, two otherwise). The eldest's
  English test of 24.11.2026 was her sheet "Module E - Test 2 Vocabulary":
  each of its 43 words is asked by translation (matched), by definition and
  in a sentence (`Vocabulary: Test 2`, 129 questions).
- **The formula sheet** (`FORMULAS`, `openFormulas`; the eldest, 2026-11-22):
  a math question has a "formulas" button that opens the sheet her class is
  handed in tests, whole, over the question. Only what the Ministry's sheet
  gives, for the topics her class has reached: add a section as a topic with
  formulas opens (trigonometry and probability wait). The twins have none.
- **Photos** (the girls, 2026-11-22: "the others should see my picture"):
  her photo is also a cell of the Profiles tab (192 px, under 40,000
  characters), `state` carries a stamp of each (`pic`), and a phone fetches
  the photos (`photos`) only when a stamp is new (`sharePhoto`,
  `fetchPhotos`, `L.pics`). Her Me screen says who sees it and lets her take
  it off. Never in the repo, never in the test profile.
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
  days; from 2026-11-22, with 36 more grade-7 questions on signed numbers and
  on perimeter and area, the twins' math first repeats on 4-5 Dec).
- **The day's "other" subject** (`otherPool`, `OTHER_FAIR`, `OTHER_DAYS`):
  two math, two English and one question from her other subjects, by the
  weights in `TRACKS`. Until 2026-11-26 the subject was drawn at random
  each day. After sixteen days the art twin had met art eight times and
  science and Bible never (her one science day fell in her Hebrew exam's
  week, when the exam's subject takes the place; her one Bible day she did
  not play), and Avsha asked why she had no accuracy in them beside her
  twin of the same class. From 2026-11-27 it is the subject she is most
  owed: the one her daily questions of the last 21 days held on the fewest
  days for its weight, never the subject of the last day she played when
  there is another, a tie settled by the date's seeded draw. It reads only
  rows before the day, so the day's five stay put, and Dad's phone works
  out the same five. Dates before `OTHER_FAIR` keep the old draw. Played
  from their real history, the art twin gets science the first day and
  Bible the second. The same day he asked to "dial back a bit the art
  questions": art's weight went from 3 to 2, the same as science (the old
  draw keeps 3 for past days, `OTHER_OLD`). Geography had come up for neither twin by chance and now will:
  its pool and the Bible's are not limited in `STUDYING` (no notebook of
  either came), so expect "not learned yet" marks there. Dad's month tab
  names under each girl's accuracy bars the subjects with no answer yet.
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
  From 2026-11-26: an exam a twin enters is saved for her sister too (a
  switch on the sheet, `#tmates`; Avsha, the same day: the twins share every
  class, English and math too, but their major: art for one, "role models",
  דמויות מופת, for the other); an exam that has passed
  asks for its grade on her home screen (`gradeDue`, `gradeSheet`, the
  script's `grade` action, column F of Tests), and Dad's all-time tab shows
  each girl's weeks as a chart and each exam with the week before it and
  the grade (`trendChart`, `overTime`; the script's `trend_`, `examsPast_`).
  Her Me screen shows her own, and says Dad sees them: keep that true.
  The app's own form takes only a date from today on; the script takes any
  date. So an exam that has already passed (she wants to enter its grade)
  is a row appended to the Tests tab with the Sheets connector, and only
  when Avsha asks for those rows in so many words: on 2026-11-26 he sent
  the eldest's English tests and quizzes of the year (her class group's
  list) and nine were appended (when as text, profile, date as text, `eng`,
  note "מבחן" or "בוחן"); an append he had not asked for was refused
  earlier that day. Read the tab first and do not add an exam that may be
  one already there: her list's 22.11 was held back, because every date on
  it is a Sunday and she already had an English test on 24.11 (two rows for
  one test would count twice for the token). Dates on such a list may be
  the week's Sunday and not the day: the week of focus and the good-luck
  popup follow the row, so say so.
- **Three exams above 85 are a token** (`EXAMTOK` / `EXAM`, `counts`,
  `examCount`, `gradesCard`, `gradeRow`; `setGrade_`, `gradeOk_`,
  `examTokens_` in Code.gs; Avsha, 2026-11-26: "3 exams above 85 grants a
  token, each will need to add an image of the graded test, not only enter
  the grade"). "Above" is 86 and up. She enters the grade with a photo of
  the graded exam (`#gradeFile`, shrunk by `fitPage`, saved in the notebook
  folder of his Drive; its file id is column G of Tests) and it waits for
  his yes (column H: "yes", "no" or empty). His yes is asked for on his
  Today tab ("Grades to confirm", with a link to the photo), in the popup
  of what waits for him and in the evening email (`gradesSection_`); a
  grade he enters himself on his screen (the PIN goes with it) counts at
  once, with no photo. A girl changing a grade empties his yes. Every third
  counted exam the script grants a token, reason "exams 3", "exams 6", and
  emails him; un-approving later takes no token back. A token is 100 ₪ of
  his money, which is why his yes is in the way: he did not ask for the
  approval step in so many words, so take it out if he says so. Her vault
  shows the dots; chips by each grade say where it stands. Needs api 8.
- **The token's popup, seen by all of us** (`starDue`, `starCheck`,
  `renderStar`, `starToken`, `closeStar`; his words: "another 'congrats'
  popup, animated and personalized as possible, shared once between all of
  us"). Each sister and Dad see it once (`L.seenStar`, by viewer), for a
  token of the last three weeks: her photo in a gold wreath in her colours
  (`liveLuck` with `data-gold`), her three grades as medals that turn in
  and count up, her own kind of piece, a comet and sparks. She taps "+1
  token" for the coin and gets no second ceremony (`claimTok`; `tokenCheck`
  leaves an exam token to this popup). Dad sees it the moment his yes
  grants it. A preview link is on his Exams card.
- **The popups of an opening** come in one order (`POPS`, `popupsFrom`):
  the month's winner, the exam token, good luck, for Dad what waits, and
  last the fact of the day. Closing one calls `popupsFrom` with the place
  after its own. A new popup is a new entry there, not a call from another
  popup's close.
- **The fact of the day** (`loadFacts`, `factOf`, `factCheck`, `openFact`,
  `factPicture`, `factShare`, `factRow`; `data/facts.json`,
  `data/facts/<id>.webp`, `tools/facts.py`; Avsha, 2026-11-26: "a shared
  daily popup once when opening the app with an interesting fact of the
  day, a general fact not from their classes ... something impressive they
  can share with their friends", with a picture). The file lists the facts
  in order from its `start` date, so all four read the same one on a day;
  each sees its popup once that day (`L.seenFact`, by viewer) and it stays
  as a card on her home screen and at the foot of Dad's Today. It never
  follows another popup in one opening (`POPPED`, set by the layer's
  observer): then it is on the card and pops up at the day's next opening.
  Nothing of it touches the Sheet, so it needs no script. Sharing sends one
  picture made in the page (photo, headline, text, credit; a JPEG, because
  WhatsApp takes a WebP for a sticker), prepared when the popup opens
  because a share sheet opens only straight from a tap. **Never share the
  app's address: it carries the family code.**
  The first 61 run from 2026-11-26 to 2027-01-25; after the last the list
  goes round again, so add at the end before that. **Every fact is checked
  against a published source before it goes in** (he was told so): the
  first 61 were checked by three agents with web search, which corrected
  about twenty (the Eiffel Tower grows centimetres, not 15; a blue whale's
  heart is a golf cart, not a car; "honey still edible after 3,000 years"
  is unproven) and found one disputed (more stars than grains of sand: out).
  Leave out what experts dispute, and keep to what the source says: the
  girls repeat these to friends. The source is the last column of
  `data/facts/CREDITS.md`.
  **Pictures**: public domain, CC0, CC BY or CC BY-SA only, never an
  AI-made picture of a real animal or planet; the short credit is shown on
  the picture and travels on the shared one, the full one is a row of
  CREDITS.md. `python3 tools/facts.py image <id> <file>` cuts one to
  900 x 600; look at every picture after cutting it. From this machine
  NASA's library answers freely (`images-api.nasa.gov/search?q=`, then
  `/asset/<id>`). Wikimedia's API and its `Special:FilePath` refuse after a
  few requests (429); what works is one batched request (the lead picture
  of up to 50 Wikipedia articles: `prop=pageimages&piprop=name`), the
  files straight from `upload.wikimedia.org/wikipedia/commons/<a>/<ab>/
  <File_name>` (a and ab from the MD5 of the name with underscores; a
  `thumb/.../1280px-` copy when there is one), and the licences through a
  web-fetch agent on the API address (`prop=imageinfo&iiprop=extmetadata`).
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
- **The month's winner, and Dad's gift** (`monthCheck`, `openPops`,
  `renderPop`; Avsha, 2026-11-22). In a month's first week, the first time
  each girl opens the app (and Dad unlocks his screen), a popup names last
  month's winner: her photo under a crown, her points, in her colours and
  with her kind of result piece. The winner taps "+1 token" and the coin
  comes in. Dad can schedule a gift on his Settings tab (`bonusCard`): a
  token on the 1st for each girl he ticks who played enough days in the
  month's last full week, with a line of his own; the script grants it
  (`bonusTokens_`, reason "dedication YYYY-MM", setting `bonus` as
  "month|ids|days|week") and her popup follows the winner's. The first was
  for November 2026, for their dedication. A token taken in a popup gets no
  second ceremony (`claimTok`, `L.preTok`). A preview button shows him both.
  An app left open overnight reloads when she returns to it on a new day.
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
- `python3 tools/facts.py check` after touching the facts or their pictures.
- `python3 tools/art.py check` after touching the art or a line that names a
  picture: every picture app.js names is in `art/`, and each sheet fits.
- `python3 tools/sounds.py check` after touching the sounds or a line that
  plays one: every sound the table names is in `audio/`, and every name the
  app asks for is one of SOUNDS.md.
- `python3 tools/build_preview.py /tmp/x.html --names "A,B,C"` and open it
  (or walk it with Playwright) for a demo-mode look at every screen.
- The walks of 2026-11-26 are the pattern for a new feature: stage rows with
  `/__load`, open a phone with Playwright, answer through real taps (the
  round's form is `FQ_TEST.api.round().form`), then compare `stats()` with
  `/__score`. Run a build against the script of `origin/main` too (a copy of
  the repo with that `Code.gs`, on another port), and Dad's test profile
  with the POSTs counted.
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

## Asked, waiting on Avsha (2026-11-26)

From the research of that day (what brings learners back; rivals) he liked
seven ideas. Six are built (the notebook pages last, above). Waiting:
- **The evening reminder** (below): which phones, and whether the girls
  use Telegram.
  He is still to confirm, and may replace one twin's phone in a few days.
- **The creatures wait for his review** (2026-11-27). He said "push to
  main" for it, so they are on the site switched off for the girls
  (`PET_LIVE`), and he is trying them in his test profile on his phone.
  The care scenes, the music and the cues went to main the same evening on
  his "push to main" (fq-38, then fq-39 with the new word, the dressing
  sound as he made it and the cues in the rest of the app): **ask how the
  scenes felt under a finger, and how loud the music is**.
  Ask what he thought of each creature, its motions and its outfits,
  whether the numbers (care a day, what each outfit takes) feel right, and
  how it ran on his phone: it is the first real phone any of this has been
  on. When he says go: `PET_LIVE` true, a new version, a push, and the
  script of api 9 pasted.
- **Tricks and a glow, after the creatures are live** (2026-11-27, his
  "yes but after the app is live"): a new trick at certain levels, as in
  Adopt Me (a Meshy motion is 3 credits a creature, then its sheet and the
  eleven layers for each creature, about an hour of drawing a motion), and
  a glow round it at a high level, drawn by the app with no new art. A new
  grown-up body was offered and not chosen: about 59 credits a creature and
  every sheet and layer drawn again.
- **The design review, and its eight points built** (2026-11-27; his "do
  all eight"). He added the "UI Design Review" and "Design" plugins and said
  yes to a review of the creature's screens. It was done from rendered
  screens at 390 x 844 and 360 x 640 with measures (scratch `rev.js`: no
  tap target under 44 px, no sideways scroll), without the plugin's UXKIN
  library: its connector asked him to buy a subscription with no clear way
  on, "which lowered my trust in its usefulness", so do not lean on it or
  send him there. Two faults were fixed at once (a tall hat stood on the
  name above the stage: the stage grows to what is worn, `petRise`,
  `--rise`; the keyboard's Done on a name did nothing). The eight, as
  built: the wardrobe's small lines and the "who sees it" sentence are
  12.5 px and the muted colour, not the faint; "this creature is mine"
  and the choice's "take" stay in sight at the foot of a short screen
  (`.petfoot`: sticky, a soft dark halo round the button and no band
  behind it: a band with hard edges stood in the middle of the screen);
  before her five the wish's card has no second button to the five; the
  home invitation's button is the quiet kind until she has played; Dad's
  three creatures stand in one row (`.petfam.n3`); the list is headed
  "Growth"; a toast over a creature's screen is shown at the top
  (`.toast.high`), clear of the care buttons; today's care is said in
  words beside its hearts (`petCareLine`). Light mode, the phone's largest
  text size and a real phone were not looked at.
- **The creature's sounds are in, all thirteen; nobody has heard them as
  the app plays them** (SOUNDS.md, 2026-11-27). He made twelve of the
  thirteen in Suno at first (all but the steps) and pushed thirteen WAVs, 9.6 MB, on the branch
  `sounds`, in a folder "sound effects", since renamed `sounds/` (a cloud session cannot reach a
  folder on his computer, and nothing was in his Drive: a push from his
  computer is the way; a Claude session there did it for him). They are
  cut into fifteen MP3s, 390 KB, in `audio/` by `tools/sounds_round1.sh`,
  whose every number was read off measures and none chosen by ear: **ask
  him how each sounds on his phone**, in his test profile, and change the
  script's line for what does not fit (louder or softer is `--v`).
  **Cut, do not reshape** (his word on the first try, the same day): the
  adoption's sound with a pitched copy laid over it "sounds terrible, far
  from the original, especially the sound at the end", and the wash laid
  out six times was "too repetitive". A sound of his goes in as he made
  it, trimmed and levelled; anything more (a pitch, a speed, a filter, a
  repeat) is shown to him first as a file to listen to, beside the plain
  cut. `SendUserFile` with the MP3s reaches his phone in a minute. The
  WAVs stay on `sounds` and are not merged: to make the sounds again,
  `git archive origin/sounds sounds | tar -x -C SOMEWHERE` and run
  the script on `SOMEWHERE/sounds`. What was done for his notes: the bath came as
  a splash and bubbles in two files, each heard once, the splash and then
  the bubbles (1.4 s; the rest of the wash is quiet, and a longer download
  of bubbles would fill it);
  `wear_on` held two takes, both kept and played in turn; `pet_sleep` was
  "too deep and bassy": of its six breaths three are deep and three are
  light whistles near 1 kHz, and two of the light ones repeat; the `adopt`
  sound's swoosh is met by the creature's entrance (below). **Two things
  found by measuring**: the swoosh and both `wear_on` takes were nearly all
  under 150 Hz (64, 63 and 44 Hz), which a phone's speaker does not give,
  though his computer's does. The swoosh is left as he made it (above), so
  on a phone's speaker it is soft and on earphones it is all there. Each
  `wear_on` thump is sped up five or six times into a small pop near 300
  Hz: he heard both and did not object, and they are the likeliest to be
  wrong still. The waking squeak is very high (its strongest note at 6 kHz): it
  plays low, and `;lowpass=5000` softens it if he finds it sharp. **The steps took five rounds
  of tries, and are in** (`pet_walk`, the same evening). Suno gave heavy
  steps twice ("sounds like a grown human"; `pet_walk.wav`, then
  `steps.wav`, "still too bassy but better": four thumps 0.8 s apart,
  strongest at 50 Hz, on what sounds like wood), though his prompt asked
  for a carpet. What he said, in order: the rhythm "should be determined
  by the animation" (the waddle is three sways in its 24 frames, so a step
  every third of a second, from 0.083 s); "a softer sound, like walking on
  a carpet and not a wooden floor"; of the soft tries, the second, with
  "increase the muffle"; then "more muffled"; then his pick, the fourth
  round's `steps_soft_2b_most_muffled`: the four steps of `steps.wav` with
  what is under 250 Hz and over 380 Hz taken off (`steep=2`), each start
  eased in over 60 ms. The two tries muffled further (300 and 220 Hz) he
  passed over. It is in the recipe as a loop of four seconds, twelve
  steps, exactly the file he chose (checked: correlation 1.000), played
  twice over the walk's eight seconds, at `v` 0.9 because most of it is
  under 500 Hz and a phone gives that softly: **ask how loud it is on his
  phone**. What worked: every try was a file sent with `SendUserFile`
  (`make ... --to=DIR`), two or three a round, each named for what it is,
  and he answered in a line. `tools/sounds_steps_tries.py` still makes
  all the tries. Both takes of the steps came as uploads first; he then
  pushed them on the `sounds` branch with the others (fifteen WAVs, in
  `sounds/` since that push). Checked the same evening: the branch's files
  are the ones the sounds were made from, and the recipe run on the
  branch's folder alone makes every file of `audio/` again, byte for byte.
  **The player** (app.js "recorded sounds": `SOUNDS`, `snd`, `sndWarm`,
  `sndBuf`, `sndWatch`, `acOn`): files of `audio/` decoded into the beeps'
  AudioContext and played from memory, so a sound a second after a tap
  still plays on an iPhone. `snd(name)` is false when the table has no
  such sound, and the caller beeps as before. A motion's sound starts with
  the motion (`snd` on an item of `E.play`'s list, `sndAt` seconds in: the
  munching starts as the treat reaches its mouth), a walk's steps repeat
  for the motion's length, its breathing repeats while it sleeps on screen
  (`petSnore`). **The adoption** (`renderPet(true)`, `.petstage.arriving`):
  while the sound's chord rises there are only sparks gathering over the
  floor's glow, and the creature appears in a flip at the sound's `cue`
  (2.05 s, the swoosh); with sound off it is there at once as before.
  Takes of one name play in turn. A sound stops when its screen is gone
  (`alive`) and all follow the sound switch. The service worker serves
  the phone's copy of a sound without asking, and keeps it with the
  version and not for good (unlike `art/`): a sound cut again arrives with
  the next version under the same name. `tools/sounds.py`: `look` (the
  takes in a download and where each one's energy is), `make NAME PIECE
  ...` (pieces of downloads, each with its own `speed`, `pitch`, `highpass`,
  `gain`, set at its moment; `--loop`, `--v`, `--cue`), `table` (writes
  `SOUNDS` in app.js from `audio/sounds.json`: never by hand), `check`.
  Every sound is brought to one loudness as a phone gives it (300 to 6000
  Hz), so `v` alone says how loud each is. A repeating sound is made with
  `--loop`: its end is faded into its start and the file carries a little
  before and after the repeating part, because an MP3 has silence at both
  ends. The walk of the sounds is scratch `t_snd.js` on `snd_setup.sh` (a
  copy of the repo, with a stand-in of tones for any sound not made): it
  checks what plays and when, not how it sounds. No Suno connector was found in the
  directory.
- **The script of api 9 waits for his paste** (2026-11-27: the creature's
  copy in the Sheet). Api 8 is in the Sheet (he said so on 2026-11-26 and
  the Sheet showed it). Until he pastes, a creature lives on its phone
  alone and is lost with the phone.
- **The script of api 7 is in the Sheet** (pasted 2026-11-26; the Pages tab
  exists, the mark on perimeter is gone, the Sheet answers in 4.2 seconds
  by his Speed line, against about 30 before). **The script of api 8 waits
  for his paste** (his word on a mark; the photo and his yes for a grade;
  the token for three exams). He held the paste back on purpose until the
  exam token was in it.
- **Powers of negative numbers are not taught yet** (the art twin told him,
  2026-11-26, after her mark on `−3²`, `g7-math-100`). The five
  signed-number questions with a power (007, 008, 099, 100, 101) now have
  a topic of their own, "חזקות של מספרים מכוונים", with its own lesson
  lines. He said to stop it for the twins; the stopping is his tap, because
  Claude does not write the Sheet: after the paste, the mark's row offers
  "לעצור את כל הנושא (5 שאלות)". Ask whether he tapped it, and read
  `blocked` in `state` to see. Until then one of the other four can still
  come up for a twin.
- **The exam token was never seen on a real phone**: the photo's upload to
  Drive from a grade, and the popup's motion on the old Xiaomi. Ask.
- **The fact of the day was never seen on a real phone**: whether the share
  button sends the picture to WhatsApp on the iPhones and the Xiaomi (it
  was tested with a stand-in for the phone's share sheet), and whether the
  popup arriving a few seconds after the home screen gets in the way of a
  girl about to start her five. Ask.
- **The other twin's major** (exemplary figures): is the pool `g7-midrash`
  that major, and so hers alone, or a class both take? Both tracks draw on
  it. He does not know (the classes are new to him and the notebooks say
  little): the girls can say, or the art twin can mark its questions "not
  learned yet". The pool came from worksheets sent on 2026-11-13 (change,
  Rabbi Akiva, a poem, the role model).

## The app's art, from Meshy (built 2026-11-26)

Avsha has a Meshy subscription and added its skill ("meshy-3d-agent"), as in
his football project. He asked to "test for ideas to elevate the app's
design, added animations, appealing graphics", saw a mock page, and said:
"build all five in and the 3d pieces for each girl, I don't mind investing
up to 1-2K credits on this app (probably more if we'll find worthy additions
in the future)". So far 231 credits are spent (4,269 of 4,500 left).

- **What is in the app** (`art/`, 20 pictures, 1.8 MB; app.js "the app's
  art"; app.css, the last block):
  - **The token coin**, a 3D model: it spins in and comes to rest on its
    face in every token ceremony (`coinBox`: a new token, the winner's and
    the exam token's "+1" tap), and is the small coin of the vault.
  - **The laurel wreath** round her photo (`wreathed`, `liveWreath`): gold
    for what she won (the month's winner, the exam token), and for a
    good-luck wish the same leaves in her own colours (`tinted`: the gold's
    light and dark over her two colours). Each girl of a shared wish has her
    own. It grows from the foot up and a light runs along it.
  - **The crown**, a 3D model, drops onto the month's winner and turns (one
    each when two share the month).
  - **An emblem for each of the twelve subjects** (`emb`): on the day's
    chips, the question's chip, the map (a tile for each subject that
    scrolls to its topics, dim until a topic is known, and by each subject's
    name), her exams, the good-luck popup, the accuracy bars (hers and
    Dad's) and Dad's exam table.
  - **The black card** is the vault's ten-token prize (`.bcard`,
    `liveCard`): always there as what she is saving for, muted until she
    has ten, then shining; it sways and leans to a finger.
  - **Her own piece** (`PIECE`, `pieceOf`, `pieceCv`), a 3D model for each
    kind of result: a paint palette for `portfolio`, a rhythmic gymnast's
    hoop, ball and clubs for `routine`, a stage microphone for `stage`. It
    stands over her points on a good day's result (larger on a perfect day,
    when a finger can turn it), on her Me screen (to turn), small by her
    month on the home screen, and before her backdrop in the winner's and
    the exam token's popups. He was told which piece each girl got and that
    one can be swapped (39 credits); ask if he wants another.
- **No 3D engine runs on a phone** (the old Xiaomi). A model is drawn once,
  here, from every side: `node tools/spin/spin.js MODEL.glb DIR` (three.js
  in headless Chromium; `--axis=base` turns a trophy round its foot,
  `--half=1` is a coin with two like faces) and `python3 tools/art.py sheet
  DIR NAME` packs the views into one sheet, eight a row (250 to 390 KB).
  `liveSpin` shows the view for the angle, blended with the next
  (`data-turn`, `data-rock`, `data-in`, `data-hold`, `data-drag`). Do not
  name a new attribute `data-wait`: that is the app's mark of a button
  waiting for the Sheet, and a walk waited for ever on a canvas that had it.
- **Each picture has its fallback**, what the app drew before: a picture
  that fails is taken out (`pic`, the `error` listener) and the CSS coin,
  the drawn wreath (`drawnWreath`), the plain chip show. Tested with every
  request for `art/` refused.
- **The service worker keeps `art/` for good** (`fq-art` in sw.js, served
  without asking the site), so 1.8 MB is not fetched again at every
  version. **A changed picture therefore gets a new name.** `artWarm`
  fetches the coin, the wreath and her piece while the phone is idle.
- **Making more.** The CLI: `npm exec --yes --package=meshy-cli@0.4.0 --
  meshy`. A new machine is signed out: `auth login --device` prints a link
  and a code for him to approve in his browser; keep the turn alive until it
  exits. An image is 9 credits (`text-to-image`, model `nano-banana-pro`,
  or `image-to-image` with one of ours as the reference, which is how the
  four later emblems match the first eight), a textured 3D model from an
  image 30 (`image-to-3d --should-texture true`; download with
  `--model-format glb`). Ask for "pure solid black background, no text";
  for a piece, "a small trophy sculpture ... on a small round black base,
  polished gold and dark smoked glass", neutral light, so it suits whichever
  colours she picked. `python3 tools/art.py cut DIR` cuts the flat ones (a
  solid object by clearing what the black reaches from the frame's edge, a
  thin one by brightness as opacity). The GLBs (16 to 58 MB) and Meshy's
  PNGs are not in the repo; they can be downloaded again from his account
  at no cost. Tasks: images coin 01a2193b-d57b-77ea-8076-ac649483b9d9,
  wreath 01a2193b-d9bc-7556-8f6f-5a6df5a0a8da, crown
  01a2193b-de30-73fa-ba25-1835f06a00af, emblems
  01a2193b-e2ab-7219-9660-9b9f8bb63ba2, card
  01a2193b-e73c-7480-9aeb-877ca06ca693, palette
  01a2194f-2dbc-720a-99db-8db7c5f8c4ff, gym
  01a2194f-32c9-7236-bf03-513854dba8c9, mic
  01a2194f-3704-740b-aedb-34827dcb8f16, emblems2 (image-to-image)
  01a2194f-3bdf-77d1-b655-8afb14207f1e; models crown
  01a2193d-7e6c-7207-8e4a-99cdc148bf28, palette
  01a2194f-cebb-743e-8760-eb73b65ee104, gym
  01a2194f-d61a-7466-b9be-21b79d997157, mic
  01a2194f-debf-7572-b8d7-1f995c56e920, coin
  01a2194f-e69c-722d-bc24-b1fdb8769edd.
- **Rules.** No AI picture standing for a real animal or planet (the facts
  keep their free photographs); these are objects and emblems. No text
  inside a picture: the app is Hebrew. Propose a spend before making it
  beyond what he has said.
- **Never seen on a real phone**: how the turning pieces run on the old
  Xiaomi, and whether the coin's sheet (386 KB) arrives in time for a
  ceremony on the phones' first opening after the update. Ask.

## A creature to care for (its first stage built 2026-11-27)

Avsha, 2026-11-26: the girls play Adopt Me! on Roblox (the eldest confirmed
it, and that they enjoy all of it: raising, dressing up, collecting, showing
each other), and it reminded him of the Tamagotchi. His idea: each girl
picks a cute creature and cares for it by answering questions, "daily points
are also translated to the amount of actions allowed each day", with "proper
animations as reactions to the actions picked, maybe a reaction to a pet by
swiping on the screen", perhaps a second creature and a house after a high
threshold. "This is an added layer on the current, all other systems like
rewards stay the same." The eldest also sent a screenshot of a streak pet
(it looks like TikTok's): a simple round creature with outfits, a level bar
of growth points and a "grow your pet" list of daily tasks. He saw a mock
page and said the animations are good, bar one whose face turned upside
down (a wash made of a head rub: replaced), and: "let them choose in the app
from the 6 designs ... eventually I'm sure they'll all be used".

- **Not open to the girls yet** (`PET_LIVE` false, `petOn`, `petReview`).
  Avsha, 2026-11-27: "I'd like to review the creatures, animations and
  process before it's actually live". Until he says so a girl sees nothing
  of creatures (no card, no line on her Me screen, nothing sent), Dad's
  Today has no card, and the whole of it is in his test profile, on his own
  phone: the choice, care, the wardrobe, and two made-up creatures for the
  girls to visit (`petDemo` in review, kept apart in `L.petSand`, never in
  `L.pet`, so a made-up one can never be sent as a girl's). His creature's
  screen there has four review buttons (`petTry`: 100 growth, another
  choice, which reaches the next milestone for him, every outfit, another
  creature). His Settings say so by the test profile's
  door. **To open it: set `PET_LIVE` to true, bump the version, push, and
  ask him to paste the script of api 9 first.** The walks run with it open
  (`FQ_TEST.petLive`, set in the walks' lib.js; `PET_OFF=1` for the state
  before).
- **His rules**: a creature never gets sick and never dies; a day off costs
  it nothing, as with full weeks. Tokens, the board and the prizes do not
  know it exists, and nothing of it is bought with tokens.
- **What is built** (app.js "a creature to care for"; app.css, the last
  block): a card on her home screen; the choice among the six (fox, dragon,
  axolotl, bunny, cat, a star spirit: `PET_KINDS`) with a name; its screen.
  **A day's points are that day's care** (`petCare`: an action for every
  `PET.per` points, `PET.max` at most; none until she has played): feeding,
  play, a wash, a walk, sleep. A stroke of the finger is free. **Growth**
  (`PET_PTS`, `petGrowth`, `petLevel`): 3 for each care action, and what she
  learns: 5 for the five, 3 more for a perfect day, 6 for a fix-it lesson, 2
  for a practice round (two a day), 4 for **its wish of the day**
  (`petWish`: her lesson when one is offered, the five until she has
  played, else a practice round; chosen once a day and kept). The first
  level takes 100, each next 30 more; it is drawn a little larger each level
  up to the seventh. The day's result has a button to it when care waits.
- **Where it lives** (`L.pet`, by profile id; Dad's test profile has its
  own, and sends nothing): `{ k kind, n name, d the day chosen, c: { date:
  letters }, g0, t, v, s }`, and from the second stage `o`, `w`, `wv`,
  `nw`, `h`, `hs`, `hf`, `hn`, `sw`, `m`, `pm` (below). A day's letters are what it
  was given: e p w k s for care, F the five, P a perfect day, L a lesson, R
  a practice round, W its wish, h a gift from a sister. `petCredit` writes
  the learning letters from the rows of the last ten days (called when her home screen is drawn and when its screen
  opens), and folds days older than `PET.keep` into `g0` and their letters
  into the counts `t` (what an outfit is earned by is counted over all its
  days: `petCount`). `s` is the growth she has been shown: the difference
  is played to her when she comes.
  **The Sheet's copy** (api 9; `canPetSync`, `petSync`, `petSend`): the same
  JSON in a ninth column of Profiles, `pet`, through the `profile` action
  (the script checks it is a creature: a known kind, a short name, under
  6,000 characters), and `state` carries it, so a new phone gets it back and
  a sister's phone and Dad's hold it. Two
  copies that differ are merged, a day's letters joined, so no phone's care
  is lost; what it owns is the union, what it wears is as it was last
  dressed (`wv`), hearts are joined (`petCanon` tells whether two copies say
  the same). `sent`, `s`, `nw`, `hn` are a phone's own notes and are not
  sent. **With the script of api 8 it lives on her phone alone**: tell
  him to paste before a phone is replaced.
- **The pictures** (`art/pet/<kind>/<motion>.webp`, about 2 MB a creature,
  fetched a motion at a time and kept by the service worker): each creature
  is a Meshy model (image-to-3d with `--pose-mode a-pose`), rigged
  (`rigging create`, 5 credits) and given eight of Meshy's 680 ready-made
  motions (3 credits each; `animate create --rig-task-id --action-id`; the
  list with preview GIFs is public at
  api.meshy.ai/web/public/animations/resources): 0 (rest, a blink, a smile,
  looking about), 466 a hop, 342 hand to mouth (eating), 22 a dance (play),
  405 a sway (the wash), 363 sitting down (sleep), 62 a waddle (the walk, drawn from three quarters as `stroll`),
  452 a backflip (a new level). `PET_CLIPS` has each sheet's frames, the
  same for every creature, twelve a second (`petEngine` shows them one at a
  time: blended, as the turning objects are, a fast arm came out double).
  **They are human motion capture**: on a creature with a big head and
  short arms the whole-body ones read well and the ones with hands by the
  head do not (290 a wave, 27 a heart, 316 a head rub, 298 a cheer: not
  used). Models, rigs and motions can be downloaded again from his account.
- **Drawing them**: `tools/spin/clip.html` and `clip.js` render a rigged
  GLB's motion from one camera (`--d --aim`, `--from --to --fps`; `--info`
  measures it; its hips are kept over one spot; `--lift` and `--rise` make
  a jump leave the floor, which on legs this short it hardly does).
  **Eyelids** (`--eyes=closed|happy`): a face is painted on and cannot
  blink, so the tool finds the eyes at rest (the pair of dark patches that
  mirror each other on the front of the face; a fox's dark ear tips were
  taken for eyes before it looked only there) and sets over each a small
  dome in the colour of the skin round it with a curved line, carried by
  the head bone. **Something worn** (`--wear=FILE.glb`): a second model
  handed to the head bone (the first trial, with the crown; the outfits
  are made with `outfit=1`, below). A bug worth remembering: `--info` moved the camera and left it
  there, so every frame was drawn from too near and a hop left the frame.
  `tools/spin/pets.py ANIM_DIR` makes the app's sheets from a folder of
  the animated models (a camera for each creature at 70% of the frame, the
  highest hop and flip that stay in it, the packing); about ten minutes a
  creature on this machine.
- **What it wears** (2026-11-27; Avsha: "I'd like to continue with ...
  Outfits, seeing each other's creatures, a second creature with a house
  (this can wait as a 2nd creature should be granted after a certain high
  threshold/s), and your own view of them"). Eleven things in four places
  (`PET_WEAR`, `PET_SLOTS`: head, face, neck, back; one to a place), each
  earned and never bought.
  **A milestone gives a choice, not a named thing** (the same day, his
  words: "for the milestones rewards, let's allow them to choose an
  accessory from 2-3 options so they won't be forced to get the same one
  as the others, if you can identify other points where they can have
  choices, instead of getting the exact reward, please update them too").
  A thing is everyday (`tier` 1: bow tie, heart glasses, wool hat,
  glasses, flower crown, headphones, graduation cap) or special (`tier` 2:
  halo, wings, wizard hat, crown). The milestones (`PET_MILES`): level 2,
  5 gifts sent to her sisters' creatures, 5 days of the five, 3 perfect
  days, 8 practice rounds, 60 care actions give an everyday thing; level
  4, a week in which every sister played five days (`petSisWeek`, from the
  week it was chosen) and level 7 a special one. Each offers up to three
  things of its tier that she does not have (`petOptions`: the order is
  drawn once for the girl and the milestone, so it is the same whenever she
  looks, and differs between sisters); she tries each on her creature and
  keeps one (`renderChoose`, `petTryOn`, `petTakeTap`, `petTake`). There
  are fewer milestones than things in each tier (six for seven, three for
  four), so the last choice is still between two and no two wardrobes need
  be the same. An only child has no sisters' milestones (`petMiles`), and
  the gifts one waits for the script of api 9. The numbers are a first
  guess at a spread. `petTally` counts; `petEarn` writes a milestone newly
  reached into `m` (milestone: the day) and notes it in `nw` until she has
  been told; `pm` is what each gave her (milestone: the item), `o` what
  she owns, `w` what is on; a choice that waits is a milestone in `m` and
  not in `pm` (`petPending`: shown as a card on her creature's screen,
  `petGiftCard`, a line on her home card and a button in the wardrobe's
  list). A choice does not expire and she is not hurried. `petEarn` runs
  after her learning is credited, after each care action and after a gift
  is sent. `renderWardrobe`: what she has (a tap puts on or takes off,
  `petWear`), the list of milestones with how far she is and what each
  gave, and what is still to choose from. Nothing is ever taken back. A
  creature from before there were choices keeps what it was given, each
  thing standing for one of the milestones it had reached (`petEarn`, the
  branch for a copy with no `m`); with every thing hers no choice waits.
  **Where a choice was left out, on purpose**: tokens, the month's prize
  and Dad's gift are his money and his rule ("all other systems like
  rewards stay the same"); the creature's wish of the day is the thing
  that helps her most (her lesson when one is offered), and letting her
  swap it would undo that. Say so if he asks for more.
- **How the outfits are drawn.** A thing worn is a layer of its own over
  the creature's frame: `art/pet/<kind>/<item>/<motion>.webp`, frame for
  frame with the creature's sheet (ten motions: blink and smile use the
  resting layer), each frame a quarter larger than the creature's (340 px;
  `PET_OVER`: an eighth more on each side, a quarter more above), because a
  hat rises over the creature's frame at the top of a jump and wings reach
  past its sides; the creature's frame is the layer's bottom middle. So
  any four can be worn together with no sheet per combination. `petEngine`
  puts the frame and its layers together on a canvas of its own (`compose`)
  and draws again only when the picture changes; its canvas is 1.25 times
  `--pw`. `petPic` does the same for the small pictures with layered CSS
  backgrounds (it steps back a little when something is on the head or the
  back). A motion's layers are fetched with the motion; a layer that cannot
  be had is left out for that motion.
  **Memory** (the old Xiaomi): a sheet as a picture in memory is four bytes
  a pixel, and full 340 px frames of four layers were several hundred
  megabytes over a creature's motions. So a layer's sheet holds only the
  part of the frame its item ever touches in that motion, and where that
  part sits is the table `PET_BOX` in app.js (`petBox`), which
  `wear.py draw` and `wear.py pack` write between its two marker comments
  together with the sheets: never one without the other, and never by
  hand. And the engine lets go of a long motion's sheets when it has played
  (`letGo`, `artImg.drop`; rest, blink, smile, asleep, hop and look are
  kept), fetching them again from the phone's own copy the next time. The
  service worker keeps art by name for good, so layers drawn again need new
  names (a new folder), like every changed picture.
  The pipeline (`tools/spin/wear.py`, its head says how to run it):
  `clip.html` with `outfit=1` hangs each item on a bone at a place found on
  the body at rest (`top` of the skull over the forehead, `face` between
  the eyes the eyelid finder found, `chest` under the chin, `back`), in
  shares of the creature's height; `KIND` in wear.py corrects what cannot
  be found (the dragon's crest and the bunny's ears stand where the skull's
  top is looked for) and gives each skull's width, by which hats are sized.
  `layer=1` draws the creature into the depth only, so each item comes out
  as what shows of it; `pad=1` gives the larger frame. Round glasses, heart
  glasses and the halo are built in code (the glasses from the eyes'
  places); the other eight are Meshy models. `look` shows all six at rest
  wearing the named items, front and side: use it before `draw`. `pack`
  makes the sheets again from frames already drawn (they stay in
  ANIM_DIR/_wear).
  **Speed**: drawn from Meshy's own models (135,000 to 300,000 triangles a
  creature, drawn again for every item of every frame) the full set was
  three hours. `slim.mjs` (gltf-transform) makes stand-ins: items at 25,000
  triangles, creatures at 15,000 (`SLIM=`), and the places are still
  measured on Meshy's own model and handed over (`given`); then it is
  about 0.13 s a picture, 21,000 pictures (some fifty minutes; the 660
  sheets are 27 MB, `art/` 39 MB in all). Run two jobs at most on four
  cores: three were slower than one. **A fault to know**: on a busy machine
  a run can lose its WebGL context, and everything it draws after that is
  about half as bright (two layer runs of 54, and the cat's flip of the
  first stage, were). `clip.js` now refuses such a run and `wear.py` draws
  it again, and `art.py check` compares each sheet's lightness with the
  same thing's other motions (LIGHT). A scarf and a medal were tried and
  dropped: these creatures' heads sit on their bodies with no neck, and
  their hands rest on the tummy. The month's trophy crown was too spindly
  as a hat; a chunky toy crown was made for this.
- **Sisters** (`petAny`, `petSisters`, `petShared`, `petFamily`,
  `renderVisit`, `petHeart`, `PET_GIFTS`): with the script of api 9 every
  phone holds every creature's copy, so her creature's screen shows her
  sisters' creatures, dressed, and a tap visits one. After her own five
  she can leave it a gift, once a day for each sister, and which is her
  pick of three (another of the choices he asked for): a heart, a cookie
  or a star. All three are the same growth (`PET.heart`, 2); what differs
  is what the creature does with it when its owner opens it (hearts and a
  hop, eating, sparks and a flip) and the word she is told ("... sent a
  cookie"). `h` is sister: the days, a day written alone for a heart and
  as "day:t" or "day:s" for a cookie or a star (`petGiftOf`); `hs` is how
  many in all. The gift is written in the sender's creature; the
  receiver's phone finds it there (`petCredit`), gives her creature the
  letter `h` once for each sender and day (`hf`), and says who sent what
  the next time she opens it (`hn`: "sister:gift", `petNews`). Nothing new
  in the script: it is all inside the creature's JSON. With the script of
  api 8 no creature is shared and the sisters' part is not shown. In the
  demo two sisters' creatures are made up (`petDemo`), one of which has
  sent a cookie, so the preview shows it. Two phones' copies are joined
  when a phone gets the other's (`petSync`: a milestone is reached once,
  the newer copy's choice stands); a phone that changes something before
  it has heard of the other sends its own copy, and the other joins the
  two at its next opening.
- **Dad** (`petsCard` on his Today, `renderVisit(id, true)`): each girl's
  creature with its level, what it wears and today's care; his look has no
  gift. Her Me screen's line of what Dad sees names the creature, and her
  creature's screen says her sisters and Dad see it: keep both true. The
  evening email says nothing of creatures.
- **Credits**: the six designs 54, each creature about 59 (model 30, rig 5,
  eight motions 24), the trial's extra motions 39: 423 for the creatures;
  the outfits 312 (eight items, an image 9 and a model 30 each): 966 for
  the app in all (see `auth status` for what is left). Outfit tasks
  (image, model): beanie 01a21cbf-8c48-7104-b8cd-f5557b928d26, gradcap
  01a21cbf-918d-77ed-b691-38e8a6e259a6, flowers
  01a21cbf-9785-7445-ad82-7f5685cc3a0d, headphones
  01a21cbf-9bea-77f0-b1de-85fb6168bd0d, wings
  01a21cbf-a04a-7164-a5c2-70a612f89c5c, wizard
  01a21cbf-a484-76c0-8af6-8b2d2f6ae31c, bow
  01a21cbf-a8f1-7253-a678-3a5a09672583, crown
  01a21ccb-9493-75b8-a67e-fdb52ee07ab1 (its model
  01a21ccc-2a4b-7762-bad1-d0810e21930d); the other models' ids are in his
  Meshy account by date.
- **His first notes from his phone** (2026-11-27, seven of them, the first
  time any of this was on a real phone), and what was done:
  - *The word "יצור" is "a bit off, any other ideas?"* Of פֶּט, גור, קמע,
    מלווה and חיה he said: "let's go with חיה for now". It is in fifteen
    strings of the creature's module (`grep -n "חיה\|חיות" app.js`), and
    being feminine it turned the words round it ("נותנים לה שם", "החיות
    עוד לא פתוחות"); the code's names and these notes still say creature.
    "For now": the girls may yet choose another.
  - *"איך קוראים לו is forcing its gender, maybe add /ה".* The label is "איך
    קוראים לו/ה?", and the other lines that took a named creature for a
    "he" say it another way (no "קיבל", "נחלש", "לו"). Keep new lines so.
  - *The walk was "crab style".* It was drawn from the front, stepping side
    to side over a road that passed under it. Then: "let the creature walk
    to one side of the screen until he disappears and emerge from the
    other side walking back to the center". So the walk is a new motion,
    `stroll`: Meshy's waddle drawn from three quarters, facing left
    (`--turn=-58` of clip.html, which turns the model after everything was
    measured and hung on it facing the camera; pets.py and wear.py have it
    in their CLIPS, a fourth item of a motion being more options). In the
    app (`PET_ACTS.k`) it goes off the left of the screen in the walk's
    first four seconds and comes in from the right in the last four
    (`step(p)` on the motion's item sets `--walk` on the stage, which moves
    the canvas and its shadow; `.petscr .quiz-in{overflow-x:hidden}` keeps
    the screen from scrolling sideways), and its steps go with it across
    the speakers (`pan`). The road (`.petway`) is gone, and the old `walk`
    sheets are deleted.
  - *"Feeding is very simple, a star moving to creature's mouth without
    any reaction from it."* The eat motion's first second is standing
    still, so it is entered at frame 10 (`from`); the treat is a cookie
    that lands as its head goes down, is eaten in three bites (crumbs, a
    squash of the canvas, `E.pulse`, and a buzz at each: `E.treat.bites`,
    seconds from the tap), and it ends with hearts and a hop. Its mouth is
    found for each creature under its glasses' place (`petBox(kind,
    "glasses", "rest")`): a cat's is far lower in its frame than a fox's.
  - *"A few more cheers to avoid repetitiveness when petted, softer than
    the current. A couple different animations as well."* `petJoy`,
    `PET_JOYS`: a hop, a shimmy where it stands (`E.wiggle`, CSS), a sway
    with its eyes shut (the wash's first 22 frames), a dance step (the
    play's first 20), and seldom a spin (the play from frame 42) or the
    flip; none twice running; the first is the hop while the others'
    sheets are fetched (`E.warm`). All from motions it already had: **a new
    Meshy motion made for being stroked was offered** (3 credits a
    creature and about an hour of drawing with its layers). The cheer is
    one of two, in turn and lower (`pet_chirp_1`, `_2`, `v` 0.4): the chirp
    and the giggle that opens the play sound, each a plain cut (a third,
    the "ah" that closes the waking sound, he heard and did not like);
    **he was asked for more in Suno** (SOUNDS.md, round 2).
  - *"The wear on sound is too fast."* It was his two thumps sped up five
    and six times. Of three slower tries (as he made it, twice as fast,
    three times) he chose "the 1st one": both takes are in as he made
    them. They are nearly all under 150 Hz, so on a phone's speaker they
    are soft and on earphones full: his choice, heard as a file.
  - *"Level up sound gets cut off too quickly."* It is the whole of his
    sound now (4.9 s), not its first 2.7.
  The engine learned three things for these, all on an item of `E.play`'s
  list: `from` and `to` (a part of a motion, in frames), `step(p)` (called
  each frame with how far through it is) and `pan` (where its sound is).
  The walk of these is scratch `t_feedback.js`: it samples the page
  against its own clock from the tap, because a screenshot takes a third
  of a second there and threw a first version's times off.
- **The care scenes** (2026-11-27, his second notes from his phone; app.js
  "the care scenes", app.css beside `.petprops`). His words: "bath: we can
  generate an actual bath via meshy that drops down from the top of the
  screen to the creature who looks like is in it ... allow the girls to
  'hold' a sponge and scrub the creature for a couple of seconds before the
  task is complete, the bath is pulled back up and the creature shines
  clean for a second"; "play: too simple, we need a few options, maybe a
  swing drops down and she can push it ... another rotating option is a
  seesaw drops down where she can use her finger to be on the other side";
  "sleep: we need a pet's bed to drop down and the creature lays in it
  comfortably, maybe circular and fluffy, we can add better beds as
  upgrades later on, especially when we'll get to the 'house' part".
  - **The props** (`art/prop/`, eight pictures, 130 KB; `PET_PROP`):
    Meshy models of a tub, a round bed and a seesaw, and pictures of a
    swing's seat and a sponge. `tools/spin/props.py MODELS IMAGES` makes
    them all (`prop.html`, `prop.js` draw a model whole or cut by a plane):
    the tub and the bed in two halves, behind the creature and before it,
    so it is seen inside (the tub from 12 degrees up, the bed from 18, to
    show their openings; the creatures are drawn from 6 and it does not
    jar); the seesaw parted by colour into its plank, which turns about
    its middle, and its foot. In the page two holders stand at the point
    on the floor the creature is scaled about, one before its canvas and
    one after (`#propback`, `#propfront`); every place is a share of
    `--pw`, so a prop is the creature's size at every level. A prop drops
    from above the screen (`propMount`, `.propset.drop`, landing at
    `PROP_LAND` 0.38 s) and `lift()` pulls it up.
  - **A scene** (`petScene`, `petSceneRun`, `PET_SCENES`) holds the
    creature (`E.lock`: no other care, no stroke, no cheer begins) and has
    her finger (`PETUI.scene.down / move / up`, routed in `petStroke`).
    The care is written at the tap as before, so leaving in the middle
    loses nothing; what it gave (the +3, the heart spent) is painted when
    the scene ends. A scene she does not join plays itself after about
    three seconds; with reduced motion, or pictures that have not come in
    2.5 s, each is the plain motion it was (`petSuds`, `petDance`). The
    creature is moved by three CSS properties of its own, which leave its
    transform (its size, its breathing, its squash) alone: `--py` lifts it
    (`translate`), `--pr` leans it (`rotate`), `--sz` draws creature and
    prop smaller together (`scale`); side to side is `--walk`. The engine
    gained `E.tick`, `E.paint` (the scene's own frame and drawing),
    `E.tween`, `E.pose(name, frame)`, `E.rest()`, `E.unlock()`, and on an
    item of a motion `off` (what to undo however it stops: the walk's
    `--walk`).
  - **The bath** (`petBath`): the tub lands round it with a splash and
    the wash sound; the sponge follows her finger over the creature, foam
    stays where it has been, a meter under the tub fills (about 1,200 px
    of scrubbing); then the foam runs off, the tub goes up, and it shines
    for a second (`.petcv.shine`) before its happy hop.
  - **Play** is the swing and the seesaw in turn, by how many times it has
    played (`petCount`). **The swing** (`petSwing`): a seat on two ropes;
    it hops on, seated (the last frame of `sit`); a drag across or a tap
    pushes it; seen from the front it swings side to side, the seat level
    on its ropes; less far on a narrow screen; after 3.4 s of real
    swinging it slows and the creature hops off. **The seesaw**
    (`petSeesaw`): it sits on the left end; her finger anywhere on the
    stage is the weight on the other; pressed, the creature goes up and
    leaves its seat for a moment; four flights and it hops back.
    A chooser between the two was thought of (he likes choices) and not
    built: his word was "rotating".
  - **The bed and the lying pose** (`petBed`, `BED`, `E.sleepPose`): the
    bed comes down, the creature hops in and lies curled up on its side,
    and the bed stays while it sleeps (and is there, with no drop, when
    the screen opens on a sleeper; with reduced motion too). The pose is
    one new frame a creature, `abed`: the end of Meshy's motion 370,
    "Stand to Side Lying", turned to face us (`--turn=-90`: as it comes,
    its head is toward the camera and no face shows) and set back in the
    middle of its frame with its underside on the floor (`--shift`,
    `--raise` of clip.html; `lying()` in pets.py measures them and keeps
    them in cams.json as `bedx`, `bedy` for the outfits' layers). With no
    bed pictures it sits down and shuts its eyes as before.
  - **No words in a scene** (the rule at the top of this guide): the
    sponge glows and bobs until she holds it; the swing's seat glows and
    arrows run outward at its two sides until she pushes; the seesaw's
    other end has a glowing spot, a ring and an arrow down onto it. The
    three banners first written for these are gone.
  - **Sounds**: what there was (the splash as the tub lands, the play
    sound at the first swing or flight, the yawn, a beep as it shines);
    five of their own are asked of him (SOUNDS.md, round 3). **The
    section's music** (`petTheme`, `THEME`): his song "Quest for the
    Crown" ("the melody fits well", after two demos of it under the
    creature's sounds), whole, at `v` 0.14, fading in and out with the
    creature's screens, going on from where it stopped, switched by a note
    button in the header (`L.petMusic`). Its original is not on the
    `sounds` branch: he said he had added it, and on 2026-11-27 the
    branch's folder still held the fifteen effects only (not pushed from
    his computer, perhaps). The recipe makes the music only when
    `pet_theme.wav` is in the folder; the copy sent in the chat is gone
    with the session, so ask again before the sounds are next rebuilt. **The sleeping sound**: of three
    higher tries he said "let's just leave it as is but less frequent":
    the same two breaths, five seconds apart.
  - **A fault the sounds' walk found**: the hop after a bath was begun a
    second after the creature was let go, and cut short a walk begun in
    that second (which would have left it off the middle). A scene now
    lets go only as its last hop begins, and a new level's cheer looks
    again when its moment comes.
  - **Walks**: scratch `t_scenes.js` (each scene by hand and left alone,
    leaving in the middle, the bed found asleep, reduced motion, no
    banners) and `look_scenes.js KIND LEVEL w,p,p2,s [WIDTH HEIGHT]`,
    which takes pictures at set times: every creature was looked at in
    each scene, a large axolotl at 360 x 640, a dressed cat lying down.
  - **Meshy**: 153 credits (five pictures 45, three models 90, the lying
    motion for six creatures 18); 1,119 for the app in all. Pictures: tub
    01a21e65-2229-7680-96ee-53fa17e30246, bed
    01a21e65-2763-7460-a159-8fed0853ebcf, seesaw
    01a21e65-2b65-7024-899a-f0eaee0d8966, swing seat
    01a21e65-3029-73d9-9ef9-680371cb9dda, sponge
    01a21e65-3483-754e-bf8b-2d204ce5ac40; models: tub
    01a21e6b-0adf-72f8-bb68-46b05e471ff7, bed
    01a21e6b-11f8-7725-80c9-89c73d58b155, seesaw
    01a21e6b-1c52-70b8-a251-5889676207d1; the motions are in his account
    by date (the fox's: 01a21e87-44a7-72c0-8d96-0758611ff8d4).
  - **Never seen on a real phone**, and to ask: whether the sponge, the
    push and the press feel right under a finger (they were driven by a
    mouse here), how the CSS `translate` / `rotate` / `scale` properties
    behave on the old Xiaomi's browser (they need Chrome 104 or Safari
    14.1), how loud the music is beside the sounds, and whether a tall hat
    on a lying creature running off the screen's edge matters.
- **Next, when he says so**: a second creature and a house, which he said
  can wait, "granted after a certain high threshold/s" (ask what
  threshold; level 7 is about five weeks of good days), with better beds
  as upgrades there; more outfits (39 credits and about seven minutes of
  drawing each); more games to play (a prop is a picture and some eighty
  lines); a line of the creatures in the evening email. **Never seen on a
  real phone**: how the layered creature runs on the old Xiaomi (up to
  five pictures drawn a frame while it moves).

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

The facts of the day run out on 2027-01-25: add a month's worth before
then (above: checked against a source, a free picture, a row of credits).
Ask him which ones the girls talked about, and write more of that kind.
