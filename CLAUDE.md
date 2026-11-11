# Nitzotz: guide for Claude

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
- **The daily pick is deterministic:** each pool has one fixed shuffled
  order (`permOf`), day n reads positions `n·STRIDE·k + STRIDE·slot`. Twins
  (same `pair`) read neighbouring positions, so they never share a question.
  Changing a bank's length reshuffles which question falls on which day.
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
- After changing app files, bump `VERSION` in `sw.js` so phones update.

## Monthly

Write more questions before a pool runs out (each girl sees 2 math and 2
English a day; the twins share the grade-7 pools, so those go twice as
fast). Ask Avsha what the girls are learning now, or for their tests.
