# Sounds for the creature

**Where it stands (2026-11-27):** all thirteen are in the app. Avsha made them in Suno and pushed the WAVs on the
branch `sounds` (the two takes of the steps came as uploads and are still to be pushed there);
`tools/sounds_round1.sh` cut them into `audio/` (fifteen MP3s, 390 KB, from some 11 MB). Its numbers were read off
measures, not chosen by ear: he listens in his test profile and says what does not fit. His notes on the downloads,
what was found in them and what was done are under the table.

Before these the app's only sounds were short beeps made in code (`SFX` in app.js); where a sound cannot be had
the beep still plays. Avsha makes sounds in Suno's Sounds
tab from prompts Claude writes (as for his football game), downloads them, and hands the files over: dropped into
the chat, or put in a Drive folder he names. Claude cuts each take, levels it, and turns it into a small file the
phones can play (M4A or MP3: an iPhone does not play OGG), in `audio/`, with a line of credit here.

They follow the app's sound switch (Settings, "צלילים"), and on an iPhone the side switch for silence mutes them.
No background music is asked for: the phones are mostly on silent, a loop is a large file, and an iPhone plays
nothing until the first tap.

## Round 1 (asked 2026-11-27)

One thing to add to every prompt: **"No words, no music bed, no background noise. Close and dry, very little
reverb. Three or four different short takes with a second of silence between them."** The feel throughout: cute
but not babyish, soft, warm, a little magical, for a dark and elegant app used by teenagers.

| File | Where it plays | Length | Prompt |
|---|---|---|---|
| `pet_chirp` | A stroke of the finger | under 1 s | A tiny cute creature's happy chirp: a short soft squeak that melts into a purr of delight, like a small plush animal being petted. Warm, round and gentle, high but not shrill. |
| `pet_eat` | Feeding | about 1.5 s | A small cute creature eating a treat: three or four soft quick munching bites, light and a little crunchy, ending with a tiny satisfied hum. |
| `pet_play` | Play (its dance) | about 2 s | A small cute creature giggling with joy as it dances: a short bubbly giggle and a light bouncy "boing", playful and bright. |
| `pet_wash` | The wash | 3 to 4 s | Bath time for a tiny creature: soft bubbles popping and gentle little water splashes with a light squeaky-clean rub, playful. |
| `pet_walk` | The walk | 2 s, can repeat | Tiny soft footsteps of a small plush creature pattering along: light quick steps on a soft floor in an even rhythm, so that the two seconds can repeat without a seam. |
| `pet_yawn` | Going to sleep | about 1.5 s | A tiny cute creature's sleepy yawn, soft and high, ending in a small sigh. |
| `pet_sleep` | While it sleeps | 4 s, can repeat | A tiny creature asleep: slow soft breathing with a very quiet whistling snore, calm, so that the four seconds can repeat without a seam. |
| `pet_wake` | Waking it | about 1 s | A tiny cute creature waking up: a short stretchy squeak and a bright little "ah", cheerful. |
| `level_up` | A new level | under 2 s | A level-up jingle for an elegant game: a quick rising arpeggio on small bells and a soft synth, ending on one bright sparkling chord. Magical and satisfying, no drums, a clean ending. |
| `new_item` | Something new to wear | about 1.5 s | A magical reveal: a shimmer of chimes rising into a soft sparkle, like a gift appearing. No voice. |
| `heart` | A heart sent, and one received | under 1 s | A warm little pop followed by a soft glittery shimmer, like sending a heart: gentle and sweet. |
| `wear_on` | Putting a thing on or taking it off | half a second | A quick soft swish of cloth and a small pop, like putting on a hat. |
| `adopt` | "This creature is mine" | 2 to 3 s | A magical welcome: a soft whoosh, a sparkle of small bells and a warm rising chord, like a new friend appearing. A clean ending, no voice. |

If a download holds several takes in one file, that is fine: say which sound it is and they are cut apart here. A
take can be asked for again in other words when none of them fits (the chirp and the giggle are the likeliest to
come out too childish: add "subtle, understated" if so).

**His notes on the downloads (2026-11-27)**, and what was done with each:
- The bath came as two files, a splash and bubbles: each is heard once, the splash and then the bubbles. (Laid out
  six times over the wash's four seconds they were "too repetitive".) A longer download of bubbles, three or four
  seconds, would fill the rest of the wash.
- The steps came out heavy, "like a grown human", twice (four thumps 0.8 s apart, strongest at 50 to 70 Hz, as on
  a wooden floor), where he had asked Suno for a carpet. After five rounds of tries sent to him to hear, the walk has
  the four steps of his second take with what is under 250 Hz and over 380 Hz taken off and each start eased in, set
  three a second in time with the creature's waddle: his pick. It is the one sound here that is reshaped and not only
  cut, and every step of the reshaping was his word on a file he heard.
- `wear_on` holds two like sounds: both are kept and played in turn.
- `pet_sleep` is deep and bassy: of its six breaths three are deep and three are light whistles near 1 kHz; two of the
  light ones, with the quiet between them, repeat.
- `adopt` ends in a swoosh: the creature appears with it (`cue` 2.05 s). The sound is as he made it, trimmed.

**Found by measuring them** (`tools/sounds.py look`): a phone's speaker gives little under 300 Hz, and the swoosh of
`adopt` and both takes of `wear_on` were nearly all under 150 Hz (strongest at 64, 63 and 44 Hz): heard on a
computer, they are soft or silent on a phone. The swoosh is left as he made it: a copy two and a half octaves up was
laid over it at first, and he said it "sounds terrible, far from the original, especially the sound at the end". Each
`wear_on` thump is played five or six times faster, which makes it a small pop near 300 Hz. **The rule since: a sound
is cut and levelled, not reshaped; anything more is a file for him to hear first.** `level_up` is the first
2.7 s of five (after its run of bells comes a long low tail), `new_item` 2.75 s, `heart` 1.9 s. The waking squeak's
strongest note is at 6 kHz: it is played low, and can be softened (`lowpass`) if it is sharp on a phone. `pet_chirp` is the first of its
two takes (the second is a blip at 5 kHz).

**From a download to the app:** `python3 tools/sounds.py look FILE` lists the takes in it; `make NAME PIECE ...`
makes `audio/NAME.mp3` from pieces of downloads (a second take is `NAME_2`); `table` writes the app's list; `check`
says what is missing. The recipe of this round, line by line, is `tools/sounds_round1.sh`. A sound that is cut again
reaches the phones with the app's next version (`VERSION` in sw.js), under the same name.

**Credit:** every file in `audio/` is cut from a sound Avsha generated with Suno (its Sounds tab), November 2026.

Later, if the first round sits well: a voice for each of the six creatures (the fox's chirp, the dragon's little
growl, the axolotl's bubble), and sounds for the tricks.
