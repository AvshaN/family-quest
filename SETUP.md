# Setting it up

About 20 minutes, once. You need your Google account and the GitHub account
that owns this repo. Nothing here costs money.

There are three parts:

1. **The Sheet**: a Google Sheet in your account is where every answer,
   token and test is kept. You can open it any time.
2. **The script**: a small program inside the Sheet that the app talks to.
   It also sends you the evening email and gives the monthly token.
3. **The app**: this repo, put on the web so each girl can add it to her
   phone's home screen.

## 1. Make the Sheet and paste the script

1. Open <https://sheets.new> (a new, empty Google Sheet). Name it `Aura`
   (top left).
2. In the menu: **Extensions → Apps Script**. A code editor opens in a new tab.
3. Delete the few lines that are there, then paste everything from
   [`backend/Code.gs`](backend/Code.gs). Click the disk icon (**Save**).
4. At the top, next to **Run**, choose `setup` from the list, then click
   **Run**.
5. Google asks for permission, since it's the first time this script runs:
   - Click **Review permissions** and choose your account.
   - Google warns "Google hasn't verified this app". That's normal for a
     script you wrote yourself. Click **Advanced**, then **Go to … (unsafe)**
     (the dots are your script's name), then **Allow**.
   - The script asks for three things: to edit this Sheet, to send email
     as you (only to you), and to run on a timer.
6. When it finishes, the log at the bottom says
   `Ready. Family code: XXXXXX`. Write the code down.

## 2. Fill in the family

Back in the Sheet there are now five tabs.

- **Profiles**: type the girls' names in the `name` column, in place of
  the placeholders. Leave the other columns as they are:
  - row `a` is the eldest: grade 10, biology, the "portfolio" style;
  - row `b` is the twin in gymnastics: grade 7, the gymnastics-score style;
  - row `c` is the twin in the art major: grade 7 with art, the "stage" style.

  (The names are kept only in your Sheet, never in this repo.)
  - `pair` = `twins` tells the app never to give the twins the same
    question.
- **Settings**:
  - change `parent_pin` from `1234` to a code only you know;
  - fill in `prize_5` and `prize_10` when you decide them (you can also do
    this from the parent screen in the app);
  - `digest_hour` is when the evening email comes (21 = 9 pm). If you
    change it, run `setup` again (step 1.4) to move the timer.

Don't type in the **Answers**, **Tokens** and **Tests** tabs; the app
fills them in. To hand out a token yourself, use **+1 אסימון** on the parent
screen, or add a row to **Tokens**: the time, the letter (`a`/`b`/`c`), `1`,
and a reason.

## 3. Publish the script

1. In the Apps Script tab: **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**. "Anyone" only
   means the address works without a Google sign-in, which the girls need.
   Every request still has to carry the family code.
4. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Send that URL to Claude, or paste it yourself into
   [`config.js`](config.js) between the quotes of `apiUrl`.

If you change `Code.gs` later: **Deploy → Manage deployments → ✏️ → Version:
New version → Deploy**. The URL stays the same.

## 4. Put the app on the web

This repo is **private**, and GitHub's free web hosting (GitHub Pages) only
works for public repos. There are two ways:

- **Make the repo public** (simplest). Nothing personal is in it: the names,
  answers and family code are all in your Sheet. What anyone could see is the
  app's code and the questions.
  1. On GitHub, open the repo, **Settings → General**, scroll to the bottom,
     **Change visibility → Make public**.
  2. **Settings → Pages**: Source **Deploy from a branch**, Branch `main`,
     folder `/ (root)`, **Save**.
  3. After a minute or two the app is at
     `https://avshan.github.io/family-quest/`.
- **Keep it private** and host it on Cloudflare Pages (free, needs a
  Cloudflare account that you sign up for). Ask Claude for the steps.

## 5. On each phone

Send each girl this link, with your family code at the end:

```
https://avshan.github.io/family-quest/?k=XXXXXX
```

- **iPhone**: open it in Safari, tap the Share button, then **Add to Home
  Screen**.
- **Android**: open it in Chrome; tap **Install** if Chrome offers it, or
  ⋮ → **Add to Home screen**.

Then she taps her own name (the phone stays hers) and picks her colours.
On your phone, tap **אבא** and enter your PIN.

## What happens by itself

- Every evening at `digest_hour` you get an email: who played, the score,
  what was missed, how the week is going, any tests coming up.
- On the 1st of each month, at half past midnight, last month's winner gets
  a token and you get an email with the month's table.
- When a girl redeems a token, you get an email.
