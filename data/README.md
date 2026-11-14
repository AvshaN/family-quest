# The question banks

Each file in `bank/` is one pool of questions: a grade and a subject. The app
picks five a day from the pools of each girl's track (see `TRACKS` in
`app.js`), the same five on every phone that day, and never the same
question to both twins.

| Pool | Who | What |
|---|---|---|
| `g7-math` | the twins | grade 7 math |
| `g7-eng` | the twins | grade 7 English |
| `g7-sci` | the twins | grade 7 science and technology |
| `g7-heb` | the twins | grade 7 Hebrew language (לשון) |
| `g7-hist` | the twins | grade 7 history |
| `g7-bible` | the twins | grade 7 Bible (תנ״ך) |
| `g7-geo` | the twins | grade 7 geography |
| `g7-midrash` | the twins | their class's beit midrash unit on change (בית מדרש), from their worksheets |
| `g7-art` | the art twin | her art major, grade 7 level |
| `g10-math` | the eldest | grade 10 math, 4 units |
| `g10-eng` | the eldest | grade 10 English, 5 points |
| `g10-bio` | the eldest | her biology major, grade 10 |
| `g10-hist` | the eldest | grade 10 history |
| `g10-lit` | the eldest | grade 10 literature |
| `g10-heb` | the eldest | grade 10 Hebrew language (לשון) |
| `g10-bible` | the eldest | grade 10 Bible (תנ״ך), from her notebook |
| `g10-civ` | the eldest | grade 10 civics (אזרחות), from her notebook |

## One question

```json
{
  "id": "g7-math-001",
  "topic": "משוואות",
  "level": 2,
  "q": "פתרי את המשוואה: {3x − 7 = 14}",
  "options": ["{x = 7}", "{x = 3}", "{x = 21}", "{x = 7/3}"],
  "explain": "מוסיפים 7 לשני האגפים: {3x = 21}. מחלקים ב־3: {x = 7}.",
  "ltr": false
}
```

- `options[0]` is always the right answer. The app shuffles them, a
  different order for each girl.
- `{...}` marks math (or any left-to-right run) inside Hebrew text. Without
  it the browser flips it: "−1" shows as "1−". An option with no Hebrew at
  all is laid out left to right by itself, so `"−1"` needs no braces.
- `ltr: true` for English questions: the question and explanation are laid
  out left to right.
- `level`: 1 easy, 2 standard, 3 a stretch.
- `topic`: the unit, as the school names it. The parent dashboard groups
  mistakes by it, and `STUDYING` in `app.js` limits a girl to the topics her
  class has reached, so spell a unit the same way every time.

## How a question is asked

Every question is written with four options, and the app decides how to ask
it (`typedOf`, `matchOf` in `app.js`):

- **Typed on a number pad:** a math question whose four options are plain
  numbers, all with the same `x =` before them or the same unit after them
  (`"12"`, `"x = −5"`, `"40 סמ״ר"`, `"25%"`). She types the number. A question
  that says "which of the following" (הבאים) or "approximately" (בקירוב), or
  writes thousands with a comma (`"72,250"`), stays four options. To keep any
  other question as options, add `"choice": true` to it.
- **Matched in pairs:** an English question of the exact form
  `What does “word” mean?` with a Hebrew first option becomes four words to
  pair with their meanings: its own and three more of the same pool.
- **Four options:** everything else.

Check a bank before using it: `python3 tools/check_bank.py`.
