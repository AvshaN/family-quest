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
  Answers, Tokens, Tests, Pages. API: GET `state | photos`, POST `submit |
  profile | test | untest | grade | gradeok | unflag | block | unblock |
  page | pagedone | redeem | pin | grant | settings`. Timers: `nightlyDigest`,
  `monthlyClose`. `state` sends `api` (2 since 2026-11-14, 3 since
  2026-11-22: photos, 4 the same day: "not learned yet" marks, 5: the gift at
  a month's end, 6 since 2026-11-26: one reading of each tab a request,
  fix-it lessons, a grade after an exam, `exams`, `trend` and `sis`; 7 the
  same day: notebook pages; 8 the same day: the parent's word on a mark,
  a photo and his yes for a grade, the token for three exams):
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

## Meshy, for the app's art (tested 2026-11-26, nothing built into the app yet)

Avsha has a Meshy subscription and added its skill ("meshy-3d-agent"), as in
his football project, and asked to "test for ideas to elevate the app's
design, added animations, appealing graphics". What was found:
- **Access**: the CLI runs with `npm exec --yes --package=meshy-cli@0.4.0 --
  meshy`. A new machine is signed out: `auth login --device` prints a link
  and a code for him to approve in his browser (he did, in a minute); keep
  the turn alive until it exits. 4,500 credits then; the test used 75.
- **Prices** (Meshy's list, read that day): an image 9 credits
  (`text-to-image`, model `nano-banana-pro`), a textured 3D model from an
  image 30 (`image-to-3d --should-texture true`).
- **Made**: five images in the app's look, each asked for "on pure solid
  black, no text" (a gold token coin with a star, a gold laurel wreath with
  an empty middle, a slender crown with amethysts, eight glass-and-gold
  subject emblems on one sheet, a black card with an aurora), and the crown
  as a 3D model. Text-to-image tasks 01a2193b-d57b…, -d9bc…, -de30…, -e2ab…,
  -e73c…; the model is image-to-3d 01a2193d-7e6c-7207-8e4a-99cdc148bf28.
  They can be downloaded again from his account at no cost.
- **How they become app art**: a solid object is cut off the black by a
  flood from the frame's edges; a glowing or thin one by brightness as
  opacity; the emblem sheet is cut in eight. As WebP they weigh 9 to 110
  KB. A 3D model is never shipped (the GLB is 16 MB): it is drawn as a
  turntable by three.js in headless Chromium (a room environment turned
  down, a warm key, the aura's two colours as rim lights) and the 32 frames
  go in one strip stepped through with CSS `steps(32)`: 234 KB for the
  crown. So no 3D engine runs in the app, which matters for the old Xiaomi.
- **Shown to him** as a mock page (not the app): the token coin flipping in
  under rays with a sheen, the winner's photo in the gold wreath with the 3D
  crown dropping on and turning, the emblems on the day's chips and the map,
  the black card tilting. He is to say which of it to build in. Keep the
  rule for the facts: no AI picture standing for a real animal or planet;
  these are objects and emblems. No text inside a picture: the app is Hebrew.

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
