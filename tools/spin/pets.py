"""The creatures' motions as the app's sheets (CLAUDE.md, "A creature to care for").

    THREE_DIR=.../node_modules/three python3 tools/spin/pets.py ANIM_DIR [kind,kind|all] [motion,motion]

ANIM_DIR/<kind>/<Meshy motion id>.glb are a creature's rigged, animated models as Meshy gives them (the ids are in
CLIPS below). Each motion is drawn by clip.js from one camera a creature and packed into
art/pet/<kind>/<motion>.webp, eight frames a row: the same motions cut the same way for each creature, so one list
of frame counts serves all (PET_CLIPS in app.js; printed at the end). A full set takes about ten minutes a creature.
"""
import json, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 2: sys.exit(__doc__)
ANIM = os.path.abspath(sys.argv[1])
OUT = os.path.join(HERE, "..", "..", "art", "pet")
FPS, FRAME, QUALITY, TAN2 = 12, 272, 74, 0.4251
KINDS = ["fox", "dragon", "axolotl", "bunny", "cat", "spirit"]
# motion: (Meshy's motion, from, to, options). "hop" gets as much lift as the frame holds.
CLIPS = {
    "rest":   ("0", 0, 0.1, []),
    "blink":  ("0", 0, 0.1, ["--eyes=closed"]),
    "smile":  ("0", 0, 0.1, ["--eyes=happy"]),
    "look":   ("0", 0, None, []),
    "hop":    ("466", 0, None, ["--eyes=happy"]),
    "eat":    ("342", 1.0, 5.0, []),
    "play":   ("22", 0, 5.6, []),
    "wash":   ("405", 0.2, 4.7, ["--eyes=happy"]),
    "sit":    ("363", 0, None, []),
    "asleep": ("363", 2.43, 2.53, ["--eyes=closed"]),
    # the walk, seen from three quarters, facing left: from the front it stepped from side to side over a road that
    # passed under it sideways, "crab style" (Avsha, 2026-11-27). ("walk", the front view, is no longer drawn or used.)
    "stroll": ("62", 0, None, ["--turn=-58"]),
    "flip":   ("452", 0, None, ["--rise=0.5", "--eyes=happy"]),
    # asleep in its bed (Avsha, 2026-11-27: "the creature lays in it comfortably"): the end of Meshy's "stand to side
    # lying", curled up on its side, turned to face us. Lying, it is long and low and its head is far from its hips,
    # so it is set back in the middle of its frame with its underside where its feet stand (lying(), kept in
    # cams.json as bedx, bedy for the outfits' layers).
    "abed":   ("370", 9.0, 9.05, ["--eyes=closed", "--turn=-90"]),
}
cams = {}
kinds = sys.argv[2].split(",") if len(sys.argv) > 2 and sys.argv[2] != "all" else KINDS
only = sys.argv[3].split(",") if len(sys.argv) > 3 else None
counts = {}
def node(*a): return subprocess.run(["node", os.path.join(HERE, "clip.js"), *a], capture_output=True, text=True)
def info(glb, *a): return json.loads(node(glb, "--info", *a).stdout.strip().splitlines()[-1])
def lying(glb, c, t):
    """How far a creature lying on its side must be moved (right, up) to be in the middle of its frame, on its floor."""
    import tempfile
    tmp, far, size = tempfile.mkdtemp(prefix="lie_"), c["d"] * 2.2, 408
    r = node(glb, tmp, f"--from={t}", f"--to={t + 0.04}", f"--fps={FPS}", f"--d={far}", f"--aim={c['aim']}", f"--size={size}", "--turn=-90")
    files = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
    if r.returncode or not files: sys.exit(f"lying: {r.stdout[-300:]} {r.stderr[-300:]}")
    x0, y0, x1, y1 = Image.open(os.path.join(tmp, files[0])).convert("RGBA").getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    V = far * TAN2; px = V / size; Vc = c["d"] * TAN2
    low, floor = c["aim"] + V / 2 - y1 * px, c["aim"] - Vc / 2 + 0.07 * Vc
    return round((size / 2 - (x0 + x1) / 2) * px, 3), round(floor - low, 3)
beds = {}
for kind in kinds:
    # The camera: it stands 70% of the frame tall, its feet 8% up from the foot (room above for a jump), and far
    # enough that its dance stays inside the frame's width.
    A = os.path.join(ANIM, kind); rest = info(os.path.join(A, "0.glb")); h, floor = rest["height"], rest["floor"]
    V = max(h / 0.70, info(os.path.join(A, "22.glb"))["all"]["d"] * 0.9 / 0.97 * TAN2)
    c = cams[kind] = {"d": round(V / TAN2, 3), "aim": round(floor - 0.08 * V + V / 2, 3), "top": round(floor + 0.92 * V, 3), "share": round(h / V, 2)}
    cam = [f"--d={c['d']}", f"--aim={c['aim']}", "--size=408"]
    print(f"{kind}: camera {c}", flush=True)
    total = 0
    for name, (src, a, b, opts) in CLIPS.items():
        if only and name not in only:
            continue
        glb = os.path.join(ANIM, kind, src + ".glb"); opts = list(opts)
        lift = None
        if name == "hop":    # the highest jump that stays in the frame
            for lift in (3.4, 3.0, 2.6, 2.2, 1.9, 1.6, 1.3, 1.0):
                if max(info(glb, f"--lift={lift}")["tops"]) <= c["top"] - 0.02: break
            opts.append(f"--lift={lift}")
        if name == "flip":   # turned over in the air: as high as the frame holds
            opts = [o for o in opts if not o.startswith("--rise")]
            for lift in (0.5, 0.45, 0.4, 0.35, 0.3):
                if max(info(glb, f"--rise={lift}")["tops"]) <= c["top"] - 0.02: break
            opts.append(f"--rise={lift}")
        if name == "abed":
            beds[kind] = lying(glb, c, a); opts += [f"--shift={beds[kind][0]}", f"--raise={beds[kind][1]}"]
        frames = os.path.join(ANIM, "_frames", kind, name)
        cmd = [glb, frames, f"--from={a}", f"--fps={FPS}"] + cam + opts + ([f"--to={b}"] if b is not None else [])
        r = node(*cmd)
        files = sorted(f for f in os.listdir(frames) if f.endswith(".png")) if os.path.isdir(frames) else []
        if r.returncode or not files:
            sys.exit(f"{kind}/{name} failed: {r.stdout[-300:]} {r.stderr[-300:]}")
        cols = min(8, len(files)); rows = -(-len(files) // cols)
        sheet = Image.new("RGBA", (cols * FRAME, rows * FRAME), (0, 0, 0, 0))
        for k, f in enumerate(files):
            sheet.paste(Image.open(os.path.join(frames, f)).convert("RGBA").resize((FRAME, FRAME), Image.LANCZOS), ((k % cols) * FRAME, (k // cols) * FRAME))
        os.makedirs(os.path.join(OUT, kind), exist_ok=True)
        dest = os.path.join(OUT, kind, name + ".webp"); sheet.save(dest, "WEBP", quality=QUALITY, method=6)
        total += os.path.getsize(dest); counts.setdefault(name, set()).add(len(files))
        print(f"{kind}/{name}: {len(files)} frames, {os.path.getsize(dest) // 1024} KB" + (f" (lift {lift})" if lift is not None else ""), flush=True)
    print(f"== {kind}: {total // 1024} KB", flush=True)
if beds:   # where each lies, for the outfits' layers (wear.py reads cams.json)
    path = os.path.join(HERE, "cams.json"); cj = json.load(open(path))
    for kind, (sx, up) in beds.items(): cj[kind]["bedx"], cj[kind]["bedy"] = sx, up
    open(path, "w").write("{\n" + ",\n".join(f' {json.dumps(k) + ":":<10} ' + json.dumps(v).replace("{", "{ ").replace("}", " }") for k, v in cj.items()) + "\n}\n")
    print("lying places:", beds)
print("PET_CLIPS", json.dumps({k: sorted(v) for k, v in counts.items()}), "fps", FPS)
