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
| Revenge round | A question she missed comes back two days later, worth double. |
| Test mode | She adds a test; for three days before it most questions come from that subject. |
| The board | Points for days played, right answers and full weeks (5 of 7 days). Resets on the 1st; the winner gets a token. |
| The vault | Tokens: one is worth 100 ₪, or save 5 or 10 for bigger prizes. |
| Her own look | Each girl picks her colours ("aura") and her photo or drawing. Each has her own result screen: a generative art piece, a gymnastics score (D + E), or a live set. |
| Monthly recap | Her last month, as a story. |
| Dad's screen | Behind a PIN: each girl's month, weak topics, tests, today's questions, and the evening email. |

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
