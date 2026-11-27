# Sounds for the creature

**Where it stands (2026-11-27):** all thirteen are in the app, and since that evening a fourteenth, the music of
the creature's section (round 3, at the foot). Avsha made them in Suno and pushed the WAVs on the
branch `sounds` (fifteen of them, in its folder `sounds/`);
`tools/sounds_round1.sh` cut them into `audio/` (fifteen MP3s, 390 KB, from some 11 MB). Its numbers were read off
measures, not chosen by ear: he listens in his test profile and says what does not fit. His notes on the downloads,
what was found in them and what was done are under the table.

Before these the app's only sounds were short beeps made in code (`SFX` in app.js); where a sound cannot be had
the beep still plays. Avsha makes sounds in Suno's Sounds
tab from prompts Claude writes (as for his football game), downloads them, and hands the files over: dropped into
the chat, or put in a Drive folder he names. Claude cuts each take, levels it, and turns it into a small file the
phones can play (M4A or MP3: an iPhone does not play OGG), in `audio/`, with a line of credit here.

They follow the app's sound switch (Settings, "צלילים"), and on an iPhone the side switch for silence mutes them.
There was to be no background music (the phones are mostly on silent, a loop is a large file, and an iPhone plays
nothing until the first tap); then Avsha asked for it in the creature's section and made the song: round 3.

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

## Round 2 (asked 2026-11-27, from his first try on his phone)

| File | Where it plays | Length | Prompt |
|---|---|---|---|
| `pet_chirp` (more takes) | A stroke of the finger: one of several, in turn | under 1 s each | Four different tiny happy sounds of a small cute creature being petted, each under a second, with a second of silence between them: a soft coo, a little purr-trill, a quiet delighted hum, a tiny contented sigh. Very soft and gentle, quieter and rounder than a squeak, no sharp start. No words, no music, close and dry. |
| `pet_wash` (longer bubbles) | The wash, which lasts four seconds | 3 to 4 s | Soft bubbles popping and fizzing in a small bath for three or four seconds, gentle and continuous, no splash, no music. |
| `wear_on` (only if he wants another) | Putting a thing on | half a second | A light swish of cloth and one small soft pop, bright and airy, with no bass and no thump. |

Until the new cheers come, a stroke plays one of two plain cuts in turn, lower than before: the chirp and the giggle
that opens the play sound (a third, the small "ah" that closes the waking sound, he heard and did not like). `level_up` is the whole of his sound now
(cut at 2.7 s it "gets cut off too quickly"). `wear_on` was "too fast": of three slower tries (as he made it, twice
as fast, three times) he chose the first, so both takes are in as he made them. They are deep thumps (63 and 44 Hz):
soft on a phone's speaker, full on earphones.

## Round 3 (2026-11-27): the music, the sleeping sound, and sounds for the care scenes

| File | Where it plays | Length | Prompt |
|---|---|---|---|
| `pet_theme` | Under everything, while one of the creature's screens is open | his song, 2:04 | His own: "Quest for the Crown", made in Suno as a song. In as he made it, whole, mono, at a seventh of an effect's level (`v` 0.14). |
| `pet_scrub` | The bath, while she scrubs with the sponge | 2 to 3 s, can repeat | A wet sponge scrubbing something soft and squeaky clean: quick little squeaks and foamy fizz, playful and light. No music, no splash, close and dry. |
| `pet_shine` | The moment after the bath, when it shines | about 1 s | A bright magical sparkle, a quick rising glitter of tiny bells: something just became sparkling clean. Soft, not sharp. No music bed. |
| `pet_swing` | The swing, at each pass | under 1 s each | Three or four different soft playful whooshes with a tiny happy "whee" of a small creature, each under a second, a second of silence between them. No music. |
| `pet_bump` | The seesaw, as an end meets the ground | under half a second each | Three or four different soft cartoon boings and wooden bumps, small and cute, each under half a second, a second of silence between them. No music. |
| `pet_bed` | The bed landing, the creature settling into it | about 1 s | A soft fluffy "poof" of something small landing in a thick cushion, then a tiny contented sigh of a small creature. Gentle, no bass thump. |

**The music.** Avsha: "we can have soft audio while they're in the creature section? I can have suno generate a
theme", and then his song with "is this song can be used for the creature section bg music or is it too complex?".
Measured (it cannot be judged here by ear): 124 s, steady in loudness from end to end (its loudest five seconds are
1.9 times its quietest), mellow (almost nothing over 2 kHz, so nothing sharp over the creature's sounds), two and a
half to three notes a second, about 160 beats a minute. Two half-minute demos of it under the creature's sounds went
to him to hear. In the app (`petTheme`): the whole song, then a second and a half of quiet, and again; it fades in
and out with the creature's screens, goes on from where it stopped, and a note button in the header turns it off.
986 KB at 64 kbit (the effects are 96): `tools/sounds.py check` lets the music be that large. Its original came in
the chat first and is on the `sounds` branch since his next push, as `pet_theme.wav` (the same file, byte for byte).

**The sleeping sound.** In the app it was "a bit deep, sounds like a bigger creature". Three higher tries went to him
(sped up a quarter, sped up a half, seven semitones up at its own pace) and his word was: "let's just leave it as is
but less frequent". So the same two breaths, as he made them, five seconds apart (they came 2.6 s apart).

**The care scenes' own sounds are in** (2026-11-27, late: he pushed eight more WAVs on the `sounds` branch, the song
among them). His notes on the downloads, and what was done with each:
- `scrub`: "only use the first 2 sounds". Two short scrubs (`pet_scrub_1`, `_2`), played in turn for as long as the
  sponge is moving on the creature, and quiet half a second after it stops.
- `swing`: "it's one sound that can be the creature's when swinged, maybe we can use the same one but with different
  speeds to mix it up. tried generating more but I'm mostly getting whale sounds". One file (`pet_swing`); the app
  plays it once a swing and at her push, at 0.9, 1, 1.1 or 1.2 of its speed, never the same twice running and never
  two within a second (`SWING_RATES`). The old play sound is no longer heard on the swing (it still opens the seesaw).
- `bump`: "very long, only use one of those first sounds". Fourteen seconds of bumps; the first (`pet_bump`), at each
  end of the seesaw meeting the ground, her end softer.
- `bed`: "use only the 2nd sound. it's only the creature's sigh, wasn't able to generate the poof sound". Its sigh
  (`pet_bed`) as it settles into the bed, after the yawn and before its breathing.
- `shine`: came with the others, with no note: the whole of it as the creature shines after its bath (`pet_shine`).
- `bubbles2`: two seconds of bubbles, in the wash sound after the splash, in place of the first, shorter ones.
- `cheers`: "not all are useable". Its seven takes went to him cut and numbered (`cheer_1` to `cheer_7`), to say
  which to keep: **waits for his numbers**; a stroke still plays the two it had.

**Echo.** "One thing I've noticed in most if not all of suno's generations - too much echo." It is inside the sounds
as Suno makes them and cannot be taken out here; what can be done is to turn down the ring after each note
(`dry=K` on a piece, in tools/sounds.py: what is more than 12 dB under the sound's loudest moment is turned down K dB
more for each dB). Three sounds went to him to hear, each as it is, a little drier (`dry=0.8`) and much drier
(`dry=2;knee=-8`): **waits for his word** before anything is changed. For new prompts, put this first and not last:
"Recorded completely dry in a small padded vocal booth, close microphone: no reverb, no echo, no room, no delay."

Later, if the first round sits well: a voice for each of the six creatures (the fox's chirp, the dragon's little
growl, the axolotl's bubble), and sounds for the tricks.
