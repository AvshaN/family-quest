"""Softer steps, "like walking on a carpet and not a wooden floor" (Avsha), in the waddle's own rhythm: tries to hear.
A step on wood is a sharp start, a bright knock and a ring; on a carpet it starts softly, is dull, and is over at
once. So: (1, 2) his recorded steps with the bass off, the top off, and each step's start eased in; (3) pads made
here from hushed noise. All set three a second from 0.083 s, as the creature shifts its weight. Usage:
    python3 tools/sounds_steps_tries.py REPO RAW_STEPS.wav OUT_DIR
(2026-11-27; nothing of these is in the app until he picks one. The one he picks is then made as the walk's own
two-second loop: CLAUDE.md, "The steps wait for his pick".)"""
import os, subprocess, sys
import numpy as np

repo, raw, out = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, os.path.join(repo, "tools"))
import sounds as S
os.makedirs(out, exist_ok=True)
R = S.RATE
make = lambda name, pieces, *opts: print(subprocess.run([sys.executable, os.path.join(repo, "tools", "sounds.py"), "make", name] + pieces + list(opts) + ["--to=" + out],
                                                         check=True, capture_output=True, text=True).stdout.strip())

# where each of his steps really starts: the first moment it passes a tenth of its own peak
x = S.read(raw)
starts = []
for a, b in S.takes(x):
    seg = np.abs(x[int(a * R):int(b * R)])
    starts.append(a + int(np.argmax(seg > 0.1 * seg.max())) / R)
print("his steps start at", [round(t, 3) for t in starts])

AT = [round(0.083 + k / 3, 3) for k in range(12)]           # four seconds: two of the walk's loops
def his(name, low, ease, tail, extra=""):
    pieces = []
    for k, at in enumerate(AT):
        t0 = starts[k % len(starts)]
        g = 0 if k % 2 == 0 else -2.5
        pieces.append(f"{raw},{t0:.3f},{t0 + tail:.3f}@{at};highpass=250;lowpass={low};in={ease};out={tail * 0.6:.3f};gain={g}{extra}")
    make(name, pieces, "--highpass=200")
his("steps_soft_1", 1200, 0.03, 0.16)
his("steps_soft_2_softer", 700, 0.05, 0.14)

# made here: a pad on a carpet is a short hush of low noise that swells in and dies at once, with a little weight under it
rng = np.random.default_rng(7)
def pad(cut, level):
    n = int(R * 0.17)
    t = np.arange(n) / R
    noise = S.shaped(rng.standard_normal(n + R // 10), [f"highpass=f=260", f"lowpass=f={cut}", f"lowpass=f={cut}"])[R // 20:R // 20 + n]
    env = np.minimum(1, (t / 0.022)) ** 1.5 * np.exp(-np.maximum(0, t - 0.022) / 0.038)
    body = np.sin(2 * np.pi * (230 * t - 260 * t * t)) * np.exp(-t / 0.03) * np.minimum(1, t / 0.018) * 0.12     # a small dull weight, falling from 230 Hz
    y = noise / (np.abs(noise).max() + 1e-9) * env + body
    return y / np.abs(y).max() * level
y = np.zeros(int(R * 4.0))
for k, at in enumerate(AT):
    p = pad(900 if k % 2 == 0 else 760, (1.0 if k % 2 == 0 else 0.8) * (1 + rng.uniform(-0.08, 0.08)))
    i = int((at + rng.uniform(-0.006, 0.006)) * R)
    y[i:i + len(p)] += p
wav = os.path.join(out, "_pads.mp3")
S.write(y * 0.8, wav)
make("steps_soft_3_made_here", [f"{wav},0,4.0"])
os.remove(wav)
