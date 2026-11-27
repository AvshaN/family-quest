# Sounds for the creature

The app's only sounds today are short beeps made in code (`SFX` in app.js). Avsha makes sounds in Suno's Sounds
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

Later, if the first round sits well: a voice for each of the six creatures (the fox's chirp, the dragon's little
growl, the axolotl's bubble), and sounds for the tricks.
