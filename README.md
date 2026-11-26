# Aura

(A working name: the girls will vote on the real one.)

A daily study quest for three sisters: five questions a day from what they
learn at school, math and English first, each girl at her own grade, with a
monthly leaderboard, tokens worth real prizes, and an evening email to their
dad. A web app they add to their home screens; a Google Sheet as the record.
No accounts, no server, no cost.

- **Setting it up:** [SETUP.md](SETUP.md)
- **The questions:** [data/README.md](data/README.md)
- **For Claude:** [CLAUDE.md](CLAUDE.md)

## What's in it

| | |
|---|---|
| The daily five | 2 math, 2 English, 1 from her other subjects (biology for the eldest, art for one twin). The twins never get the same question. |
| The round | Only her first answer counts, and it is timed (no clock on her screen). A question she misses comes back at the end of the round until she gets it right. Math with a number for an answer is typed on a number pad; vocabulary is four words to match with their meanings. |
| "Not learned yet" | A mark she can put on any question. She still answers it, and the mark changes nothing by itself: Dad is told (the evening email, a popup once) and decides to remove it or to stop the question or its topic until the class gets there. |
| What waits for Dad | When he opens the app, one sheet of what is new and needs him: marks to decide, a token to pay, a topic a girl is stuck in, notebook pages, exams added, grades. Each once. |
| Weakest topic | One of her two math questions a day comes from the topic she misses most. |
| Revenge round | A question she missed comes back two days later for points. |
| The map | "What I know": every topic her class has reached, filling up with right answers on three different days. |
| Practice | After the five, up to two optional rounds a day on what the map still lacks. No points for the board; it counts for the map and the family goal. |
| Full weeks | A week with five days played is full. Her streak of full weeks is on her home screen, and every four full weeks, in a row or not, earn her a token. |
| Test mode | She adds a test (or it is entered from her notebook); for a week before it three of her five come from that subject. Dad's screen and the evening email list every upcoming exam. |
| The board | Points for days played, right answers, perfect days and full weeks (5 of 7 days); from December 2026 a right answer is worth as much as showing up. Resets on the 1st; the winner gets a token. |
| The vault | Tokens: one is worth 100 ₪, or save 5 or 10 for bigger prizes. |
| Exam weeks | When an exam's material is known, its week's questions and practice come from it first, with more practice rounds allowed. |
| Formula sheet | Math questions for the eldest have the formula sheet her class gets in tests, one tap away. |
| Her own look | Each girl picks her colours ("aura") and her photo or drawing, and her sisters see both on the board. Each has her own result screen: a generative art piece, a gymnastics score (D + E), or a live set. |
| Motion | Her colours are a living background that brightens with a streak of right answers, greys at a miss and turns gold on a perfect day. Her result piece moves: the artwork assembles, the gymnast's apparatus of the day performs, the stage plays. The map has a sky of stars, one per topic, and a new token arrives with a ceremony. |
| The month's winner | On the first opening of a new month, a popup congratulates last month's winner in her own colours, and she taps for her token. Dad can add a gift token for everyone who kept playing, with his own words. |
| Monthly recap | Her last month, as a story. |
| Opening | The app opens at once from what the phone holds and asks the Sheet meanwhile; the start button waits for its answer. |
| Fix-it lesson | A topic she keeps missing is offered as a lesson: the idea, a worked example, three questions. Five points for doing it. |
| Difficulty | Nine in ten right over two weeks, and her new questions come hardest first; six in ten or fewer, easiest first. |
| Stars that fade | A topic she knows dims on the map after four weeks without a right answer, until she answers it again. |
| Sisters' streak | Weeks in which all three had a full week, in a row: the one count they raise only together. |
| Against yourself | Her points this week against the same day last week, on the board and on her home screen. |
| Good luck | The day before an exam, each of us sees once her photo in a wreath and a wish. |
| After an exam | An exam a twin enters is her sister's too. Once it has passed she can enter its grade, and Dad sees each girl's weeks and each exam beside the week before it. |
| A page from her notebook | She photographs a notebook page or a worksheet; it is saved in Dad's Drive, questions are written from it, and a page that became questions earns 5 points (two a week). |
| Dad's test profile | From his Settings tab: a profile like the girls', on his phone only, to try right and wrong answers, practice and every screen. Nothing of it reaches the Sheet or the girls' board. |
| Dad's screen | Behind a PIN: each girl's month, weak topics, today's questions, what she got wrong with the right answers, how long she took (a rushed day is marked), exams he can add or take off, and the evening email. |

## Files

- `index.html`, `app.css`, `app.js`, `config.js`: the app (no build step).
- `sw.js`, `manifest.webmanifest`, `icons/`: what makes it install and work offline.
- `data/bank/*.json`: the question banks.
- `backend/Code.gs`: the Apps Script that runs inside the family's Sheet.
- `tools/`: `check_bank.py` (checks the banks), `build_preview.py` (one-file demo),
  `make_icons.js` (the icons).

Run it locally with any static server from the repo root, e.g.
`python3 -m http.server 8000`, then open <http://localhost:8000>. With
`config.js`'s `apiUrl` empty it runs as a demo with example data.
