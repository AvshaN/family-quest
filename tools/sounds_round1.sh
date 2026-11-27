#!/bin/bash
# The creature's sounds, round 1: from Avsha's Suno downloads (the folder sounds/ of the branch `sounds`,
# 2026-11-27: fifteen WAVs) to audio/*.mp3. Run from the repo's root with that folder:
#     git archive origin/sounds sounds | tar -x -C /somewhere
#     bash tools/sounds_round1.sh /somewhere/sounds
# (Run so on the day the last two were pushed, it made every file of audio/ again, byte for byte.)
# Every number here was read off `tools/sounds.py look` (where a take starts and ends, where its energy is), not
# chosen by ear. A sound is cut and levelled and otherwise left as he made it: the first try reshaped two of them
# (a pitched copy over the adoption's swoosh, the wash laid out six times) and he heard both as worse. What is still
# reshaped is said at its line. Change a line, run it again, and send him the file to hear.
R="$1"
[ -f "$R/adopt.wav" ] || { echo "usage: bash tools/sounds_round1.sh FOLDER_OF_THE_DOWNLOADS"; exit 1; }
S="python3 tools/sounds.py make"
# everything this makes is made afresh; the steps only when their download is in the folder too (below)
find audio -name "*.mp3" ! -name "pet_walk.mp3" -delete 2>/dev/null

# "This creature is mine": a chord that rises (0.3 - 1.9 s), then the swoosh he liked, as he made it: only its
# length is cut. The swoosh is nearly all under 150 Hz (strongest at 64 Hz), which a phone's speaker gives little of;
# a copy of it two and a half octaves up was laid over it to be heard there, and the low part filtered off, and he
# said it "sounds terrible, far from the original, especially the sound at the end". So nothing is added and nothing
# filtered: on a phone the swoosh is soft, on earphones it is all there. The creature appears at the swoosh (cue).
$S adopt "$R/adopt.wav,0,3.6" --out=0.4 --v=0.85 --cue=2.05

# A new level: the rising run of bells and all of its tail (cut at 2.7 s it "gets cut off too quickly", he said).
$S level_up "$R/level_up.wav,0,4.9" --out=1.2 --v=0.8
# A choice reached, a thing taken: it fades by itself at 2.7 s.
$S new_item "$R/new_item.wav,0,2.75" --out=0.3 --v=0.75
# A gift sent or received: a pop and a shimmer with a long tail, shortened.
$S heart "$R/heart.wav,0.04,1.9" --out=0.6 --v=0.6

# A stroke. One chirp every time was too much of one sound, and too loud ("a few more cheers to avoid
# repetitiveness when petted, softer than the current"): until he makes more in Suno there are two, played in turn
# and lower, each a plain cut of a sound of his: the chirp (the first take of its download: the second is a blip at
# 5 kHz) and the giggle that opens the play sound. A third, the small "ah" that closes the waking sound
# (pet_wake.wav, 1.92 to 2.30 s), he heard and did not like.
$S pet_chirp_1 "$R/pet_chirp.wav,0,0.66" --out=0.12 --v=0.4
$S pet_chirp_2 "$R/pet_play.wav,0,0.84" --out=0.08 --v=0.4
# Feeding: a crunch, then four small bites a second later, as it came.
$S pet_eat "$R/pet_eat.wav,0.26,2.40" --v=0.6
# Play: a giggle, a hum and a run of bouncy notes, as it came.
$S pet_play "$R/pet_play.wav,0,3.16" --out=0.1 --v=0.65
# The wash: he could not get splashes and bubbles in one sound, so there are two downloads, each under a second.
# Laid out six times over the wash's four and a half seconds, a little higher or lower each time, they were "too
# repetitive" (his words). So each is heard once, as it came: the splash, then the bubbles. The rest of the wash is
# quiet; a longer download of bubbles would fill it.
$S pet_wash "$R/water_splash.wav,0.36,1.16@0" "$R/bubbles.wav,0.08,0.92@0.55;gain=-2" --out=0.15 --v=0.6
# Going to sleep: two yawns in the download, played in turn.
$S pet_yawn_1 "$R/pet_yawn.wav,0.30,1.24" --out=0.1 --v=0.6
$S pet_yawn_2 "$R/pet_yawn.wav,2.58,3.58" --out=0.15 --v=0.6
# While it sleeps. The download has six breaths: three deep ones (most of them under 300 Hz: "too deep and bassy",
# he said) and three light whistling ones near 1 kHz. Two of the light ones, with the quiet between them, repeat.
$S pet_sleep "$R/pet_sleep.wav,3.76,8.92" --loop=0.25 --v=0.3
# Waking: a bright squeak, a softer one and a small "ah", as it came. The squeaks are very high (most of the first is
# over 3 kHz, its strongest note at 6): it is played low, and if it is sharp on a phone, `;lowpass=5000` softens it.
$S pet_wake "$R/pet_wake.wav,0.10,2.30" --out=0.08 --v=0.45

# Putting a thing on: the two takes are thumps at 63 and 44 Hz, which a phone does not give. Each is played five or
# six times faster, as a tape sped up, which makes a deep thump a small pop near 300 Hz, over what there is of the
# take above 300 Hz at its own speed. (Reshaped: he heard both and did not object.)
$S wear_on_1 "$R/wear_on.wav,0.02,0.28;speed=5" "$R/wear_on.wav,0.02,0.28;highpass=300;gain=-4" --highpass=200 --out=0.04 --v=0.6
$S wear_on_2 "$R/wear_on.wav,0.76,0.96;speed=6" "$R/wear_on.wav,0.76,0.96;highpass=300;gain=-4" --highpass=200 --out=0.04 --v=0.6

# The walk's steps. Suno gave heavy steps, "like a grown human", twice (pet_walk.wav, then steps.wav: four thumps
# 0.8 s apart, strongest at 50 Hz, on what sounds like a wooden floor), and he wanted "a softer sound, like walking on
# a carpet". After five rounds of tries he chose this one ("steps_soft_2b_most_muffled"): the four steps of steps.wav
# with what is under 250 Hz and over 380 Hz taken off (twice over, for a sharp edge), each start eased in over 60 ms,
# set three a second from 0.083 s, as the creature's waddle shifts its weight (its 24 frames are three sways). The
# part that repeats is four seconds, twelve steps, exactly what he heard: twice over for the walk's eight seconds.
# (The last piece is a moment of the download's silence, to make the arrangement 4.06 s: 4 s and the loop's fade.)
if [ -f "$R/steps.wav" ]; then
  P=(); K=0
  for T0 in 0.074 0.796 1.630 2.474 0.074 0.796 1.630 2.474 0.074 0.796 1.630 2.474; do
    AT=$(python3 -c "print(round(0.083 + $K / 3, 3))"); END=$(python3 -c "print(round($T0 + 0.14, 3))")
    G=$([ $((K % 2)) = 0 ] && echo 0 || echo -2.5)
    P+=("$R/steps.wav,$T0,$END@$AT;highpass=250;lowpass=380;steep=2;in=0.06;out=0.084;gain=$G"); K=$((K + 1))
  done
  $S pet_walk "${P[@]}" "$R/steps.wav,0.30,0.31@4.05;gain=-80" --highpass=200 --loop=0.06 --v=0.9
else
  echo "steps.wav is not in $R: audio/pet_walk.mp3 is left as it is"
fi

python3 tools/sounds.py table && python3 tools/sounds.py check
