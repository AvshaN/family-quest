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
| Revenge round | A question she missed comes back two days later for points. |
| The map | "What I know": every topic her class has reached, filling up with right answers on three different days. |
| Practice | After the five, up to two optional rounds a day on what the map still lacks. No points for the board; it counts for the map and the family goal. |
| Full weeks | A week with five days played is full. Her streak of full weeks is on her home screen, and every four full weeks, in a row or not, earn her a token. |
| Test mode | She adds a test (or it is entered from her notebook); for a week before it three of her five come from that subject. Dad's screen and the evening email list every upcoming exam. |
| The board | Points for days played, right answers, perfect days and full weeks (5 of 7 days); from December 2026 a right answer is worth as much as showing up. Resets on the 1st; the winner gets a token. |
| The vault | Tokens: one is worth 100 ₪, or save 5 or 10 for bigger prizes. |
| Her own look | Each girl picks her colours ("aura") and her photo or drawing. Each has her own result screen: a generative art piece, a gymnastics score (D + E), or a live set. |
| Monthly recap | Her last month, as a story. |
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
