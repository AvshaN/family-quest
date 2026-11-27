#!/usr/bin/env python3
"""The creature's sounds: from a download of Avsha's (Suno, SOUNDS.md) to the small files the app plays.

    python3 tools/sounds.py look FILE                 where each take in a download starts and ends, its loudness, and
                                                      where its energy is (a phone's speaker gives little under 300 Hz)
    python3 tools/sounds.py make NAME PIECE [PIECE ...] [options]
                                                      pieces of downloads, each shaped and set at its moment, levelled
                                                      together into audio/NAME.mp3
    python3 tools/sounds.py table                     writes the SOUNDS table in app.js from audio/sounds.json
    python3 tools/sounds.py check                     every sound the table names is in audio/, and each is small

A PIECE is  FILE,FROM,TO[@AT][;key=value ...]  : seconds FROM to TO of FILE, starting AT seconds into the sound (0),
with any of
    gain=DB         louder or softer than the other pieces
    speed=X         faster and higher together, as a tape sped up (5: a deep thump becomes a small pop)
    pitch=N         semitones up (down with a minus), its length kept
    highpass=HZ     without what is under HZ        lowpass=HZ      without what is over HZ
    in=S out=S      its own fades (0.005 and 0.03)
Options of make:
    --highpass=HZ   over the whole sound (none unless said: a sound of his goes in as he made it)
    --gain=DB       louder or softer than the level every sound is brought to
    --out=S         the fade at its end (0.06)
    --loop=S        make it repeat without a seam: its end is faded into its start over S seconds, and the part that
                    repeats is noted for the table (the file carries a little of the sound before and after that part,
                    so the silence an MP3 has at its two ends is never played)
    --v=X --cue=S   kept in audio/sounds.json for the table: its level in the app, the moment a motion should meet
    --to=DIR        write it there and not in audio/, and note nothing: a try for Avsha to hear before it goes in

Every sound is brought to one loudness, measured as a phone gives it (300 to 6000 Hz, its loudest 300 ms), so `v`
alone says how loud each is beside the others. A name with several takes is made as NAME_1, NAME_2 ...; the app plays
them in turn. `table` copies audio/sounds.json into app.js: the table there is never written by hand.
Needs ffmpeg and numpy. MP3 because every phone here decodes it (an iPhone does not play OGG)."""
import json, os, re, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "audio")
META = os.path.join(AUDIO, "sounds.json")
RATE = 44100
LEVEL = 0.10        # the loudest 300 ms of every sound, as a phone gives it (RMS of 300-6000 Hz), before its own gain
TOP = 0.95          # and no sample over this
BITRATE = "96k"
PAD = 0.12          # what a repeating sound carries before and after the part that repeats
BANDS = [(0, 150), (150, 300), (300, 1000), (1000, 3000), (3000, 8000), (8000, 22050)]


def read(path, rate=RATE):
    """A file's sound as one channel of floats."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(rate), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def write(x, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "1", "-ar", str(RATE), "-i", "-", "-ac", "1", "-ar", str(RATE), "-c:a", "libmp3lame", "-b:a", BITRATE, path],
                   input=np.clip(x, -1, 1).astype(np.float32).tobytes(), check=True)


def shaped(x, filters):
    """Floats through ffmpeg's filters, back as floats."""
    if not filters: return x
    out = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ac", "1", "-ar", str(RATE), "-i", "-", "-af", ",".join(filters), "-f", "f32le", "-ac", "1", "-ar", str(RATE), "-"],
                         input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).astype(np.float64).copy()


def envelope(x, win=0.02):
    n = int(RATE * win)
    k = len(x) // n
    return np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(axis=1) + 1e-12), win


def takes(x, quiet_db=-42, gap=0.25, least=0.08):
    """The stretches of sound in a download: quieter than quiet_db for gap seconds parts two of them."""
    env, win = envelope(x)
    loud = 20 * np.log10(env / (np.abs(x).max() + 1e-9) + 1e-9) > quiet_db
    out, start, last = [], None, None
    for i, on in enumerate(loud):
        if on:
            if start is None: start = i
            last = i
        elif start is not None and (i - last) * win >= gap:
            out.append((start * win, (last + 1) * win)); start = None
    if start is not None: out.append((start * win, (last + 1) * win))
    return [(a, b) for a, b in out if b - a >= least]


def bands(seg):
    """Where a stretch's energy is, by band; its strongest pitch."""
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    fr = np.fft.rfftfreq(len(seg), 1 / RATE)
    tot = sp.sum() + 1e-12
    return [sp[(fr >= a) & (fr < b)].sum() / tot for a, b in BANDS], fr[int(sp.argmax())]


def phone(x):
    """Its loudest 300 ms as a phone's speaker gives it: the RMS of what is between 300 and 6000 Hz."""
    y = shaped(x, ["highpass=f=300", "lowpass=f=6000"])
    n = int(RATE * 0.3)
    if len(y) <= n: return float(np.sqrt((y ** 2).mean() + 1e-12))
    c = np.concatenate([[0], np.cumsum(y ** 2)])
    return float(np.sqrt(((c[n:] - c[:-n]) / n).max() + 1e-12))


def meta():
    try: return json.load(open(META, encoding="utf-8"))
    except FileNotFoundError: return {}


def keep(m):
    os.makedirs(AUDIO, exist_ok=True)
    json.dump(m, open(META, "w", encoding="utf-8"), indent=1, sort_keys=True)


def note(name, o, loop=None):
    """After a sound is made: its takes counted from the files, the part that repeats, and what was said of it."""
    m = meta()
    base = re.match(r"(.+)_\d+$", name).group(1) if re.match(r".+_\d+$", name) else name
    e = m.setdefault(base, {})
    n = len([f for f in os.listdir(AUDIO) if re.fullmatch(re.escape(base) + r"_\d+\.mp3", f)])
    e["n"] = n if n else 1
    e.setdefault("v", 0.7)
    if "v" in o: e["v"] = float(o["v"])
    if "cue" in o: e["cue"] = float(o["cue"])
    if loop: e["loop"] = [round(loop[0], 3), round(loop[1], 3)]
    elif "loop" in e: del e["loop"]
    keep(m)


def opts(args):
    o, rest = {}, []
    for a in args:
        if a.startswith("--"): k, _, v = a[2:].partition("="); o[k] = v
        else: rest.append(a)
    return o, rest


def look(path):
    x = read(path)
    print(f"{os.path.basename(path)}: {len(x) / RATE:.2f} s, peak {np.abs(x).max():.2f}   bands: " + " ".join(f"{a}-{b}" for a, b in BANDS))
    for i, (a, b) in enumerate(takes(x), 1):
        seg = x[int(a * RATE):int(b * RATE)]
        env, win = envelope(seg)
        bs, top = bands(seg)
        bars = "".join(" ▁▂▃▄▅▆▇█"[min(8, int(v / env.max() * 8.99))] for v in env[::max(1, len(env) // 60)])
        print(f"  take {i}: {a:6.2f} - {b:6.2f} s ({b - a:.2f} s)  peak {np.abs(seg).max():.2f}  loudest at {a + int(env.argmax()) * win:.2f} s  strongest {top:.0f} Hz"
              f"  bands {' '.join(f'{v:.0%}' for v in bs)}\n          {bars}")


def piece(spec):
    """FILE,FROM,TO[@AT][;key=value ...] -> (the sound, where it starts)."""
    head, *kv = spec.split(";")
    src, _, at = head.partition("@")
    path, a, b = src.rsplit(",", 2)
    o = dict(x.split("=", 1) for x in kv)
    x = read(path)[int(float(a) * RATE):int(float(b) * RATE)].copy()
    f = []
    if "speed" in o: f += [f"asetrate={RATE * float(o['speed']):.0f}", f"aresample={RATE}"]
    if "pitch" in o: f.append(f"rubberband=pitch={2 ** (float(o['pitch']) / 12):.5f}")
    if "highpass" in o: f.append(f"highpass=f={o['highpass']}")
    if "lowpass" in o: f.append(f"lowpass=f={o['lowpass']}")
    x = shaped(x, f)
    i, u = min(len(x) // 2, int(float(o.get("in", 0.005)) * RATE)), min(len(x) // 2, int(float(o.get("out", 0.03)) * RATE))
    if i: x[:i] *= np.linspace(0, 1, i)
    if u: x[-u:] *= np.linspace(1, 0, u)
    return x * 10 ** (float(o.get("gain", 0)) / 20), float(at or 0)


def make(name, specs, o):
    parts = [piece(s) for s in specs]
    x = np.zeros(max(int(at * RATE) + len(p) for p, at in parts))
    for p, at in parts: x[int(at * RATE):int(at * RATE) + len(p)] += p
    hp = float(o.get("highpass", 0))
    if hp: x = shaped(x, [f"highpass=f={hp}"])
    was = phone(x)
    g = LEVEL / was * 10 ** (float(o.get("gain", 0)) / 20)
    held = np.abs(x).max() * g > TOP      # brought to the level, a peak of it would be cut: it is left a little softer
    if held: g = TOP / np.abs(x).max()
    x = x * g
    loop = None
    if "loop" in o:
        # its end faded into its start; then a little of what comes before and after the repeating part at both ends
        c = int(float(o["loop"]) * RATE)
        body = x[:len(x) - c].copy()
        ramp = np.linspace(0, 1, c)
        body[:c] = x[:c] * ramp + x[len(x) - c:] * (1 - ramp)
        pad = int(PAD * RATE)
        x = np.concatenate([body[-pad:], body, body[:pad]])
        loop = (PAD, PAD + len(body) / RATE)
    else:
        u = int(float(o.get("out", 0.06)) * RATE)
        if u: x[-u:] *= np.linspace(1, 0, u)
    out = os.path.join(o.get("to") or AUDIO, name + ".mp3")
    write(x, out)
    if "to" not in o: note(name, o, loop)
    bs, top = bands(x)
    print(f"{name}.mp3: {len(x) / RATE:.2f} s, {os.path.getsize(out) / 1024:.0f} KB, as a phone gives it {phone(x):.3f}{' (held by its peak)' if held else ''}, peak {np.abs(x).max():.2f},"
          f" strongest {top:.0f} Hz, under 300 Hz {bs[0] + bs[1]:.0%}" + (f", repeats {loop[0]:.3f} - {loop[1]:.3f}" if loop else ""))


def table():
    m = meta()
    rows = []
    for nm in sorted(m):
        e = m[nm]
        parts = [f"n: {e.get('n', 1)}", f"v: {e.get('v', 0.7)}"]
        if "cue" in e: parts.append(f"cue: {e['cue']}")
        if "loop" in e: parts.append(f"loop: [{e['loop'][0]}, {e['loop'][1]}]")
        rows.append(f"  {nm}: {{ {', '.join(parts)} }}")
    body = "const SOUNDS = {" + ("\n" + ",\n".join(rows) + "\n" if rows else "") + "};"
    p = os.path.join(ROOT, "app.js")
    s = open(p, encoding="utf-8").read()
    new, k = re.subn(r"(/\* SOUNDS:begin[^\n]*\*/\n).*?(\n/\* SOUNDS:end \*/)", lambda mm: mm.group(1) + body + mm.group(2), s, flags=re.S)
    if k != 1: sys.exit("the SOUNDS markers are not in app.js")
    open(p, "w", encoding="utf-8").write(new)
    print(f"app.js: {len(rows)} sounds in the table")


def check():
    s = open(os.path.join(ROOT, "app.js"), encoding="utf-8").read()
    mm = re.search(r"/\* SOUNDS:begin[^\n]*\*/\nconst SOUNDS = \{(.*?)\};\n/\* SOUNDS:end \*/", s, flags=re.S)
    if not mm: sys.exit("the SOUNDS table is not in app.js")
    named = {nm: int(n) for nm, n in re.findall(r"^\s*(\w+): \{ n: (\d+)", mm.group(1), flags=re.M)}
    bad, total, files = [], 0, set()
    for nm, n in named.items():
        for f in ([f"{nm}_{k + 1}.mp3" for k in range(n)] if n > 1 else [nm + ".mp3"]):
            files.add(f)
            p = os.path.join(AUDIO, f)
            if not os.path.exists(p): bad.append(f"{f}: named in app.js and not in audio/"); continue
            kb = os.path.getsize(p) / 1024; total += kb
            if kb > 120: bad.append(f"{f}: {kb:.0f} KB (over 120)")
    m = meta()
    for nm in m:
        if nm not in named: bad.append(f"{nm}: in audio/sounds.json and not in app.js (run: table)")
    for f in (os.listdir(AUDIO) if os.path.isdir(AUDIO) else []):
        if f.endswith(".mp3") and f not in files: bad.append(f"{f}: in audio/ and not a sound of the table")
    # every name the app asks for by a plain string is a sound of SOUNDS.md: a slip in a name plays nothing
    ps = re.search(r"PET_SND = \{([^}]*)\}", s)
    asked = set(re.findall(r'snd\("(\w+)"', s)) | set(re.findall(r'snd: "(\w+)"', s)) | set(re.findall(r'"(\w+)"', ps.group(1)) if ps else [])
    known = set(re.findall(r"^\| `(\w+)` \|", open(os.path.join(ROOT, "SOUNDS.md"), encoding="utf-8").read(), flags=re.M))
    for nm in sorted(asked - known): bad.append(f"{nm}: asked for in app.js and not a sound of SOUNDS.md")
    quiet = sorted(asked - set(named))
    print(f"{len(named)} sounds in the table, {total:.0f} KB; the app asks for {len(asked)}" + (f" (not made yet: {', '.join(quiet)})" if quiet else "") + f": {len(bad)} problems")
    for b in bad: print("  " + b)
    if bad: sys.exit(1)


if __name__ == "__main__":
    o, a = opts(sys.argv[1:])
    if not a: sys.exit(__doc__)
    if a[0] == "look": look(a[1])
    elif a[0] == "make": make(a[1], a[2:], o)
    elif a[0] == "table": table()
    elif a[0] == "check": check()
    else: sys.exit(__doc__)
