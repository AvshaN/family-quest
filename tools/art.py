"""The app's art, cut from pictures Meshy made (CLAUDE.md, "Meshy, for the app's art").

    python3 tools/art.py cut DIR             # DIR/<name>/image_0.png for coin, wreath, card, emblems, emblems2 -> art/
    python3 tools/art.py sheet FRAMES NAME   # a turntable's frames (tools/spin/spin.js) -> art/spin/NAME.webp
    python3 tools/art.py check               # every picture app.js names is there; sizes

Meshy draws each object on pure black with no text. A solid object (the coin, the card, an emblem) is cut by clearing
what the black reaches from the frame's edge; a thin or glowing one (the wreath) by taking brightness as opacity.
A 3D model is never shipped: tools/spin draws it from every side, and `sheet` packs those views into one picture of
COLS x rows frames that the app steps through (liveSpin in app.js), so no 3D engine runs on a phone.
A picture's name is its version: the service worker keeps art/ for good, so a changed picture gets a new name.
"""
import glob
import json
import os
import re
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter, ImageStat

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "art")
COLS = 8
# the first sheet of emblems is four by two, the second one row of four: the subject keys of SUBJ in app.js
EMBLEMS = [("emblems", 4, 2, ["math", "eng", "sci", "bible", "hist", "heb", "art", "geo"]),
           ("emblems2", 4, 1, ["civ", "midrash", "bio", "lit"])]


def save(img, rel, quality=88):
    path = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"  {rel}: {img.size[0]} x {img.size[1]}, {os.path.getsize(path) / 1024:.0f} KB")
    return img


def glow_cut(path, size, gain=1.6, floor=0.06):
    """A bright object on black: brightness becomes opacity, and the colour is un-mixed from the black."""
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255
    a = np.clip((im.max(axis=2) - floor) / (1 - floor) * gain, 0, 1)
    rgb = np.clip(im / np.maximum(a[..., None], 1e-3), 0, 1)
    img = Image.fromarray((np.dstack([rgb, a]) * 255).astype(np.uint8), "RGBA")
    ys, xs = np.where(a > 0.08)
    img = img.crop((max(xs.min() - 12, 0), max(ys.min() - 12, 0), min(xs.max() + 12, im.shape[1]), min(ys.max() + 12, im.shape[0])))
    img.thumbnail((size, size), Image.LANCZOS)
    return img


def solid_cut(path, size, thr=0.085, box=None, feather=1.2):
    """A solid object on black: everything the black can reach from the frame's edge is cleared."""
    src = Image.open(path).convert("RGB")
    if box:
        src = src.crop(box)
    im = np.asarray(src).astype(np.float32) / 255
    dark = im.max(axis=2) < thr
    h, w = dark.shape
    seen = np.zeros_like(dark)
    q = deque()
    for y, x in [(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)]:
        if dark[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    a = Image.fromarray(((~seen) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))
    img = src.convert("RGBA")
    img.putalpha(a)
    ys, xs = np.where(~seen)
    img = img.crop((max(xs.min() - 6, 0), max(ys.min() - 6, 0), min(xs.max() + 6, w), min(ys.max() + 6, h)))
    img.thumbnail((size, size), Image.LANCZOS)
    return img


def hole(img):
    """The round clear middle of a wreath: its centre and radius as shares of the picture's width (for WREATH in app.js)."""
    a = np.asarray(img)[..., 3] > 40
    h, w = a.shape
    ys, xs = np.nonzero(a)
    best = (0, 0, 0)
    for cy in range(int(h * 0.3), int(h * 0.6), 4):
        for cx in range(int(w * 0.44), int(w * 0.56), 4):
            r = np.sqrt(((ys - cy) ** 2 + (xs - cx) ** 2).min())
            if r > best[0]:
                best = (r, cx, cy)
    r, cx, cy = best
    return round(cx / w, 3), round(cy / w, 3), round(r / w, 3), round(h / w, 3)


def cut(src):
    one = lambda name: os.path.join(src, name, "image_0.png")
    print("cut from", src)
    # the vault's small coins; a ceremony's coin is the 3D one (art/spin/coin.webp)
    save(solid_cut(one("coin"), 144), "coin-s.webp", 86)
    wreath = save(glow_cut(one("wreath"), 600), "wreath.webp", 84)
    print("  wreath's hole (cx, cy, r, height; shares of its width):", hole(wreath))
    save(solid_cut(one("card"), 760, thr=0.06), "card.webp", 86)
    for name, cols, rows, keys in EMBLEMS:
        W, H = Image.open(one(name)).size
        for k, key in enumerate(keys):
            c, r = k % cols, k // cols
            box = (int(c * W / cols), int(r * H / rows), int((c + 1) * W / cols), int((r + 1) * H / rows))
            save(solid_cut(one(name), 176, thr=0.07, box=box), f"em/{key}.webp", 86)


def sheet(frames_dir, name, size=256, quality=80):
    files = sorted(glob.glob(os.path.join(frames_dir, "*.png")))
    if not files:
        sys.exit("no frames in " + frames_dir)
    rows = -(-len(files) // COLS)
    out = Image.new("RGBA", (COLS * size, rows * size), (0, 0, 0, 0))
    for k, f in enumerate(files):
        fr = Image.open(f).convert("RGBA")
        if fr.size != (size, size):
            fr = fr.resize((size, size), Image.LANCZOS)
        out.paste(fr, ((k % COLS) * size, (k // COLS) * size))
    save(out, f"spin/{name}.webp", quality)
    print(f"  {len(files)} frames of {size} px, {COLS} a row: SPIN in app.js wants n: {len(files)}")


def check():
    js = open(os.path.join(ROOT, "app.js"), encoding="utf-8").read()
    named = set(re.findall(r'["`/]((?:spin/|em/)?[a-z0-9-]+\.webp)', js))
    m = re.search(r"const SUBJ = \{(.*?)\};", js, re.S)
    named |= {f"em/{k}.webp" for k in re.findall(r"(\w+):", m.group(1))}
    m = re.search(r"const SPIN = \{(.*?)\n\};", js, re.S)
    spins = dict(re.findall(r"(\w+):\s*\{ src: \"([^\"]+)\"", m.group(1))) if m else {}
    named |= set(spins.values())
    # each creature's motions: art/pet/<kind>/<motion>.webp, the frame counts of PET_CLIPS, eight a row
    kinds = re.findall(r"(\w+):", re.search(r"const PET_KINDS = \{(.*?)\};", js, re.S).group(1)) if "const PET_KINDS" in js else []
    clips = {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", re.search(r"const PET_CLIPS = \{(.*?)\};", js, re.S).group(1))} if kinds else {}
    named |= {f"pet/{k}/{c}.webp" for k in kinds for c in clips}
    # what each creature wears: art/pet/<kind>/<item>/<motion>.webp, a layer for every motion but the two that only
    # close its eyes (they use the resting layer), frame for frame with the creature's sheet and a quarter larger
    m = re.search(r"const PET_WEAR = \{(.*?)\n\};", js, re.S)
    wear = re.findall(r"^\s*(\w+):\s*\{ slot:", m.group(1), re.M) if m else []
    layers = [c for c in clips if c not in ("blink", "smile")]
    # where each layer's sheet sits in the layer's frame: the table tools/spin/wear.py writes into app.js
    m = re.search(r"/\* PET_BOX:begin \*/\nconst PET_BOX = (\{.*?\});\n/\* PET_BOX:end \*/", js, re.S)
    boxes = json.loads(m.group(1)) if m else {}
    named |= {f"pet/{k}/{w}/{c}.webp" for k in kinds for w in wear for c in layers}
    bad, total = 0, 0
    for rel in sorted(named):
        path = os.path.join(ART, rel)
        if rel.startswith("facts") or "${" in rel or ("/" not in rel and rel[:-5] in clips):   # a motion's name, read off a template
            continue
        if not os.path.exists(path):
            if os.path.exists(os.path.join(ROOT, "data", "facts", os.path.basename(rel))):
                continue
            print("MISSING", rel)
            bad += 1
            continue
        total += os.path.getsize(path)
    have = {os.path.relpath(p, ART).replace(os.sep, "/") for p in glob.glob(os.path.join(ART, "**", "*.webp"), recursive=True)}
    for rel in sorted(have - named):
        print("not named in app.js:", rel)
    for key, rel in spins.items():
        n = int(re.search(key + r":\s*\{ src: \"[^\"]+\", n: (\d+)", js).group(1))
        w, h = Image.open(os.path.join(ART, rel)).size
        if w % COLS or h * COLS != w * -(-n // COLS):
            print("SHEET", rel, f"is {w} x {h}, not {COLS} a row of {n} square frames")
            bad += 1
    for k in kinds:
        for c, n in clips.items():
            f = os.path.join(ART, "pet", k, c + ".webp")
            if not os.path.exists(f):
                continue
            w, h = Image.open(f).size
            cols = min(COLS, n); side = w // cols
            if w % cols or h != side * -(-n // cols):
                print("SHEET", f"pet/{k}/{c}.webp is {w} x {h}, not {cols} a row of {n} square frames")
                bad += 1
            for item in wear if c in layers else []:
                g = os.path.join(ART, "pet", k, item, c + ".webp")
                if not os.path.exists(g):
                    continue
                box = ((boxes.get(k) or {}).get(item) or {}).get(c)
                w2, h2 = Image.open(g).size
                if not box:
                    print("LAYER", f"pet/{k}/{item}/{c}.webp has no place in PET_BOX")
                    bad += 1
                elif w2 != cols * box[2] or h2 != box[3] * -(-n // cols) or box[0] + box[2] > side * 5 // 4 or box[1] + box[3] > side * 5 // 4:
                    print("LAYER", f"pet/{k}/{item}/{c}.webp is {w2} x {h2}, not {cols} a row of {n} frames of {box[2]} x {box[3]} (PET_BOX)")
                    bad += 1
    # A run of the renderer that lost its WebGL context draws everything about half as bright (two layer runs and one
    # creature's flip did, on a busy machine): a sheet much darker or lighter than the same thing's other motions.
    def light(path):
        im = Image.open(path).convert("RGBA")
        st = ImageStat.Stat(im.convert("RGB"), im.getchannel("A").point(lambda v: 255 if v > 200 else 0))
        return 0.3 * st.mean[0] + 0.59 * st.mean[1] + 0.11 * st.mean[2] if st.count[0] > 50 else None
    for k in kinds:
        for group in [[f"pet/{k}/{c}.webp" for c in clips]] + [[f"pet/{k}/{w}/{c}.webp" for c in layers] for w in wear]:
            vals = {r: light(os.path.join(ART, r)) for r in group if os.path.exists(os.path.join(ART, r))}
            vals = {r: v for r, v in vals.items() if v is not None}
            if len(vals) < 3:
                continue
            mid = sorted(vals.values())[len(vals) // 2]
            for r, v in vals.items():
                if v < mid * 0.8 or v > mid * 1.3:
                    print("LIGHT", f"{r} is {v:.0f}, its other motions about {mid:.0f}: drawn by a run that lost its light?")
                    bad += 1
    print(f"{len(have)} pictures in art/, {sum(os.path.getsize(os.path.join(ART, r)) for r in have) / 1024:.0f} KB; {bad} problems")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "cut" and len(sys.argv) == 3:
        cut(sys.argv[2])
    elif cmd == "sheet" and len(sys.argv) >= 4:
        sheet(sys.argv[2], sys.argv[3], *(int(x) for x in sys.argv[4:6]))
    elif cmd == "check":
        check()
    else:
        sys.exit(__doc__)
