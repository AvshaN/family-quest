"""What the creatures wear, as the app's sheets (CLAUDE.md, "What a creature wears").

    THREE_DIR=.../node_modules/three python3 tools/spin/wear.py look ANIM_DIR WEAR_DIR OUT.jpg item,item [kind,kind]
    THREE_DIR=.../node_modules/three python3 tools/spin/wear.py draw ANIM_DIR WEAR_DIR [kind,kind|all] [item,item|all] [motion,motion]
    python3 tools/spin/wear.py pack ANIM_DIR WEAR_DIR [kind,kind|all] [item,item|all] [motion,motion]     the sheets again, from frames already drawn

ANIM_DIR is the creatures' animated models, as for pets.py; WEAR_DIR holds the outfits' models (<file> in ITEMS:
Meshy's GLBs, slimmed by slim.mjs to 25,000 triangles). SLIM=DIR in the environment names a folder of the creatures'
models slimmed the same way (DIR/<kind>/<motion id>.glb, 40,000 triangles): the layers are then drawn from those,
which is some five times quicker (from Meshy's own, 135,000 to 300,000 triangles drawn once for every item of every
frame, the full set took three hours), and the places on each body are still measured on Meshy's own. "look" shows the
creatures at rest wearing the named items, from the front and a side, to judge how they sit. "draw" makes, for each
creature, item and motion, art/pet/<kind>/<item>/<motion>.webp: only what shows of the item, frame for frame with the
creature's own sheet (the same camera, jump and cut: cams.json, and CLIPS of pets.py), to be laid over it. A layer's
frame is a quarter larger than the creature's (an eighth more on each side, a quarter more above: a hat at the top
of a jump, wings past its sides), the creature's frame being its bottom middle; a sheet holds only the part of that
frame its item ever touches in the motion, and where that part sits is written into app.js (PET_BOX), so "draw" and
"pack" change app.js too.
An item's place is given from an anchor that clip.html finds on each body (the top of its skull, its face between
the eyes, its chest under the chin, its back), in shares of the creature's height; KIND corrects what the finder
cannot know (a crest or ears standing where the skull's top is looked for) and gives each skull's width, by which
what sits on a head is sized.
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "art", "pet")
FPS, FRAME, QUALITY, ALPHA, PADDED = 12, 272, 64, 70, 1.25
REF = 0.55   # the skull's width, in shares of the creature's height, that the sizes below are given for
ITEMS = {
    # on its head
    "beanie":     dict(type="glb", file="beanie.glb", anchor="top", w=0.56, at=[0, -0.15, -0.01]),
    "gradcap":    dict(type="glb", file="gradcap.glb", anchor="top", w=0.5, at=[0, -0.045, 0.02]),
    "flowers":    dict(type="glb", file="flowers.glb", anchor="top", w=0.52, at=[0, -0.1, 0.0], rot=[8, 0, 0]),
    "wizard":     dict(type="glb", file="wizard.glb", anchor="top", w=0.66, at=[0, -0.06, 0.0]),
    "crown":      dict(type="glb", file="crown2.glb", anchor="top", w=0.44, at=[0, -0.05, 0.0]),
    "halo":       dict(type="halo", anchor="top", r=0.15, at=[0, 0.11, 0]),
    "headphones": dict(type="glb", file="headphones.glb", anchor="top", base="top", w=0.78, squash=[1, 0.84, 1], at=[0, 0.045, -0.02]),
    # on its face
    "glasses":    dict(type="glasses", anchor="face", at=[0, 0, 0.012]),
    "hearts":     dict(type="hearts", anchor="face", at=[0, 0, 0.012]),
    # under its chin
    "bow":        dict(type="glb", file="bow.glb", anchor="chest", base="center", w=0.24, at=[0, 0, 0.02]),
    # on its back
    "wings":      dict(type="glb", file="wings.glb", anchor="back", base="center", w=0.95, at=[0, 0.05, -0.02]),
}
KIND = {
    "fox":     dict(top=[0, 0, 0], hw=0.58),
    "dragon":  dict(top=[0, -0.07, 0], hw=0.56),          # its crest stands where the skull's top is looked for
    "axolotl": dict(top=[0, 0, 0], hw=0.53),
    "bunny":   dict(top=[0, -0.2, 0.07], hw=0.44),        # its ears: a hat sits before them, on its forehead
    "cat":     dict(top=[0, -0.02, 0], hw=0.64),
    "spirit":  dict(top=[0, 0, 0], hw=0.52),
}
# what one creature needs differently for one item
ONE = {("axolotl", "headphones"): dict(w=0.9)}
# motion: (Meshy's motion, from, to): pets.py's CLIPS without the eyelids, which are the creature's own
CLIPS = {"rest": ("0", 0, 0.1), "look": ("0", 0, None), "hop": ("466", 0, None), "eat": ("342", 1.0, 5.0), "play": ("22", 0, 5.6),
         "wash": ("405", 0.2, 4.7), "sit": ("363", 0, None), "asleep": ("363", 2.43, 2.53), "walk": ("62", 0, None), "flip": ("452", 0, None)}
cams = json.load(open(os.path.join(HERE, "cams.json")))

def spec(kind, keys):
    out = []
    for key in keys:
        it = dict(ITEMS[key]); it["key"] = key; k = KIND[kind]; it["at"] = list(it.get("at", [0, 0, 0]))
        if it["anchor"] == "top":   # what sits on its head grows and sinks with the skull's size, from the corrected top
            s = k["hw"] / REF
            it["at"] = [a * (s if i != 1 or a < 0 else 1) + b for i, (a, b) in enumerate(zip(it["at"], k["top"]))]
            for f in ("w", "r"):
                if f in it: it[f] = round(it[f] * s, 4)
        it.update(ONE.get((kind, key), {}))
        out.append(it)
    return out

def node(*a): return subprocess.run(["node", os.path.join(HERE, "clip.js"), *a], capture_output=True, text=True)

def outfit(kind, keys, path):
    """The list clip.html reads: the items, and the creature's measures, taken once from Meshy's own model."""
    m = os.path.join(WORK, kind, "measure.json"); os.makedirs(os.path.dirname(m), exist_ok=True)
    if not os.path.exists(m):
        one = os.path.join(WORK, kind, "one.json"); json.dump(spec(kind, ["halo"]), open(one, "w"))
        r = node(os.path.join(ANIM, kind, "0.glb"), "--info", "--anchors", f"--outfit={one}", f"--weardir={WEAR}")
        try: raw = json.loads(r.stdout.strip().splitlines()[0])["raw"]
        except Exception: sys.exit(f"{kind}: could not be measured: {r.stdout[-300:]} {r.stderr[-300:]}")
        json.dump(raw, open(m, "w"))
    json.dump({"items": spec(kind, keys), "given": json.load(open(m))}, open(path, "w"))

def model(kind, motion):
    slim = os.environ.get("SLIM") and os.path.join(os.path.abspath(os.environ["SLIM"]), kind, motion + ".glb")
    return slim if slim and os.path.exists(slim) else os.path.join(ANIM, kind, motion + ".glb")

if len(sys.argv) < 4: sys.exit(__doc__)
mode, ANIM, WEAR = sys.argv[1], os.path.abspath(sys.argv[2]), os.path.abspath(sys.argv[3])
WORK = os.path.join(ANIM, "_wear")
def listed(i, full): return sys.argv[i].split(",") if len(sys.argv) > i and sys.argv[i] != "all" else list(full)

if mode == "look":
    out, keys, kinds, size, looks = sys.argv[4], sys.argv[5].split(","), listed(6, KIND), 300, ["0", "60"]
    tag = os.path.splitext(os.path.basename(out))[0]
    def one(kind):
        c = cams[kind]; d = os.path.join(WORK, "look", tag, kind); os.makedirs(d, exist_ok=True)
        lst = os.path.join(d, "outfit.json"); outfit(kind, keys, lst)
        r = node(model(kind, "0"), d, f"--d={c['d']}", f"--aim={c['aim']}", f"--size={size}", "--pad=1", f"--outfit={lst}", f"--weardir={WEAR}", "--look=" + ",".join(looks))
        if r.returncode: print(kind, "FAILED", r.stdout[-300:], r.stderr[-300:])
    with ThreadPoolExecutor(3) as ex: list(ex.map(one, kinds))
    w = int(size * PADDED); sheet = Image.new("RGB", (w * len(kinds), w * len(looks)), (38, 30, 60))
    for i, kind in enumerate(kinds):
        for j, y in enumerate(looks):
            f = os.path.join(WORK, "look", tag, kind, f"look_{y}.png")
            if os.path.exists(f): im = Image.open(f).convert("RGBA"); sheet.paste(im, (i * w, j * w), im)
    sheet.save(out, quality=88); print(out, sheet.size)
elif mode in ("draw", "pack"):
    kinds, keys, only = listed(4, KIND), listed(5, ITEMS), (sys.argv[6].split(",") if len(sys.argv) > 6 else None)
    F = round(FRAME * PADDED)
    def pack(kind, name):
        """One motion's frames of each item as the app's sheet: only the part of the frame the item ever touches in
        the motion (two pixels to spare), eight frames a row. Returns where that part sits, by item, and the bytes."""
        boxes, size = {}, 0
        for key in keys:
            d = os.path.join(WORK, kind, name, key)
            ims = [Image.open(os.path.join(d, f)).convert("RGBA") for f in sorted(os.listdir(d)) if f.endswith(".png")]
            ims = [im if im.size == (F, F) else im.resize((F, F), Image.LANCZOS) for im in ims]
            box = None
            for im in ims:
                bb = im.getchannel("A").point(lambda v: 255 if v > 6 else 0).getbbox()
                if bb: box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
            if box is None: box = (0, 0, 2, 2)   # hidden all through the motion
            x0, y0, x1, y1 = max(0, box[0] - 2), max(0, box[1] - 2), min(F, box[2] + 2), min(F, box[3] + 2)
            w, h = x1 - x0, y1 - y0; cols = min(8, len(ims)); rows = -(-len(ims) // cols)
            sheet = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
            for k, im in enumerate(ims): sheet.paste(im.crop((x0, y0, x1, y1)), ((k % cols) * w, (k // cols) * h))
            dest = os.path.join(OUT, kind, key, name + ".webp"); os.makedirs(os.path.dirname(dest), exist_ok=True)
            sheet.save(dest, "WEBP", quality=QUALITY, alpha_quality=ALPHA, method=6); size += os.path.getsize(dest)
            boxes[key] = [x0, y0, w, h]
        return boxes, size, len(ims)
    def one(kind):
        c = cams[kind]; total = 0; got = {}
        lst = os.path.join(WORK, kind, "outfit.json")
        if mode == "draw": outfit(kind, keys, lst)
        for name, (src, a, b) in CLIPS.items():
            if only and name not in only: continue
            if mode == "draw":
                cmd = [model(kind, src), os.path.join(WORK, kind, name), f"--from={a}", f"--fps={FPS}", f"--d={c['d']}", f"--aim={c['aim']}", f"--size={FRAME}", "--pad=1", "--layer=1", f"--outfit={lst}", f"--weardir={WEAR}"]
                if b is not None: cmd.append(f"--to={b}")
                if name == "hop": cmd.append(f"--lift={c['hop']}")
                if name == "flip": cmd.append(f"--rise={c['flip']}")
                for go in range(3):   # a run whose WebGL context was lost is drawn again
                    r = node(*cmd)
                    if not r.returncode: break
                if r.returncode: sys.exit(f"{kind}/{name} failed: {r.stdout[-300:]} {r.stderr[-300:]}")
            boxes, size, n = pack(kind, name); total += size
            for key, bx in boxes.items(): got.setdefault(key, {})[name] = bx
            print(f"{kind}/{name}: {n} frames of {len(keys)} items", flush=True)
        print(f"== {kind}: {total // 1024} KB", flush=True)
        return kind, got
    with ThreadPoolExecutor(int(os.environ.get("JOBS", "2"))) as ex: done = list(ex.map(one, kinds))
    # The table of where each sheet's part sits goes into app.js (PET_BOX), joined with what is there of other
    # creatures, items and motions: the sheets and the table are made together or the layers are drawn out of place.
    app = os.path.join(HERE, "..", "..", "app.js"); js = open(app, encoding="utf-8").read()
    A, B = "/* PET_BOX:begin */\n", "/* PET_BOX:end */"
    if A not in js or B not in js: sys.exit("app.js has no PET_BOX table to write into")
    i, j = js.index(A) + len(A), js.index(B)
    table = json.loads(js[i:j].strip()[len("const PET_BOX = "):].rstrip(";") or "{}")
    for kind, got in done:
        for key, by in got.items(): table.setdefault(kind, {}).setdefault(key, {}).update(by)
    rows = ",\n".join(f"  {json.dumps(k)}: " + json.dumps(table[k], separators=(",", ":")) for k in KIND if k in table)
    open(app, "w", encoding="utf-8").write(js[:i] + "const PET_BOX = {\n" + rows + "\n};\n" + js[j:])
    print("PET_BOX in app.js:", sum(len(m) for k in table.values() for m in k.values()), "sheets")
else:
    sys.exit(__doc__)
