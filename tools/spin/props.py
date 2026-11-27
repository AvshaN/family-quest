"""The care scenes' props (Avsha, 2026-11-27: a bath, a swing, a seesaw and a bed that drop down to the creature).

    python3 tools/spin/props.py MODELS IMAGES [name ...]

MODELS/<tub|bed|seesaw>/model.glb are Meshy's models, IMAGES/<swingseat|sponge>/image_0.png its pictures (the task
ids are in CLAUDE.md; both can be downloaded again from his account). Writes art/prop/*.webp and prints each one's
size. THREE_DIR points at the three package, as for the other tools here.

A thing the creature sits in (the bath, the bed) is drawn in two halves, what is behind the creature and what is
before it (prop.html), both cut to one box, so the app sets them at one place with the creature between. The seesaw
is drawn whole and parted by colour: its butter-yellow foot stays put and the rest (plank and handles) is a picture
of its own, with the place the foot covered filled in and the middle of the plank at the picture's middle, so that it
can be turned about it. The swing's seat and the sponge are pictures only, cut off their grounds.
"""
import os
import subprocess
import sys
import tempfile
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "..", "art", "prop")


def save(img, name, quality=90):
    os.makedirs(ART, exist_ok=True)
    path = os.path.join(ART, name + ".webp")
    img.save(path, "WEBP", quality=quality, method=6)
    print(f"  prop/{name}.webp: {img.size[0]} x {img.size[1]}, {os.path.getsize(path) / 1024:.0f} KB")


def draw(model, shots, **opt):
    out = tempfile.mkdtemp(prefix="prop_")
    cmd = ["node", os.path.join(HERE, "prop.js"), model, out, "--shots=" + ",".join(shots)] + [f"--{k}={v}" for k, v in opt.items()]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit("prop.js failed: " + (r.stdout + r.stderr)[-600:])
    return {s: Image.open(os.path.join(out, s + ".png")).convert("RGBA") for s in shots}


def box_of(*imgs, pad=4):
    """One box round what is opaque in any of them, the same margin left and right of the picture's middle."""
    a = np.max([np.asarray(im.getchannel("A")) for im in imgs], axis=0) > 12
    ys, xs = np.where(a)
    w = a.shape[1]
    half = max(w / 2 - xs.min(), xs.max() + 1 - w / 2) + pad
    return (int(w / 2 - half), max(ys.min() - pad, 0), int(w / 2 + half), min(ys.max() + 1 + pad, a.shape[0]))


def halves(model, name, width, tilt):
    """Back and front of a thing the creature sits in."""
    sh = draw(model, ["back", "front"], size=1000, tilt=tilt)
    box = box_of(sh["back"], sh["front"])
    for s in ("back", "front"):
        im = sh[s].crop(box)
        save(im.resize((width, round(im.height * width / im.width)), Image.LANCZOS), f"{name}-{s}")


def seesaw(model, width):
    full = draw(model, ["full"], size=1000, tilt=6)["full"]
    px = np.asarray(full).astype(np.float32) / 255
    r, g, b, a = px[..., 0], px[..., 1], px[..., 2], px[..., 3]
    # the foot is butter yellow: red and green high and alike, blue well under them (the plank is mint: green over red; the handles coral: red over green)
    foot = (a > 0.6) & (b < np.minimum(r, g) - 0.10) & (np.abs(r - g) < 0.13)
    foot[:, : full.width // 3] = False; foot[:, full.width * 2 // 3 :] = False   # it stands under the middle; a stray pixel of an edge elsewhere is not it
    # its small holes closed (a speck of shade inside it is still the foot), and the rim round it taken with it
    foot = np.asarray(Image.fromarray((foot * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(7))) > 0
    foot &= (a > 0.02) & (g - r < 0.07)   # but none of the plank beside it
    base = np.asarray(full).copy(); base[~foot] = 0
    plank = np.asarray(full).copy()
    ys, xs = np.where(foot & (a > 0.05))
    # the plank's own rows: where the picture is opaque far from the middle
    far = np.asarray(full.getchannel("A"))[:, : full.width // 6].max(axis=1) > 128
    top, bottom = np.where(far)[0].min(), np.where(far)[0].max()
    # what the foot covered of the plank: filled from the plank a little to its left, row by row
    x0, x1 = xs[(ys >= top) & (ys <= bottom)].min(), xs[(ys >= top) & (ys <= bottom)].max()
    span = x1 - x0 + 8
    for y in range(top, bottom + 1):
        plank[y, x0 - 2 : x1 + 3] = plank[y, x0 - 2 - span : x1 + 3 - span]
    plank[bottom + 1 :, :] = 0
    hole = foot.copy(); hole[top : bottom + 1, :] = False
    plank[hole] = 0
    plank, base = Image.fromarray(plank), Image.fromarray(base)
    # the plank turns about its own middle: its picture is cut with that point at its centre
    mid = (top + bottom) // 2
    bx = box_of(plank)
    half_h = max(mid - bx[1], bx[3] - mid)
    plank = plank.crop((bx[0], mid - half_h, bx[2], mid + half_h))
    scale = width / plank.width
    save(plank.resize((width, round(plank.height * scale)), Image.LANCZOS), "seesaw-plank")
    bb = box_of(base)
    base = base.crop(bb)
    save(base.resize((round(base.width * scale), round(base.height * scale)), Image.LANCZOS), "seesaw-base")
    print(f"    the plank's middle is {(bb[3] - 4 - mid) * scale / width:.3f} of the plank's width over the foot's bottom; the foot is {base.width * scale / width:.3f} of it wide")


def off_ground(path, size, white, thr=0.08, feather=1.0):
    """A solid object cut off a plain ground, black or white: what the ground reaches from the frame's edge is cleared."""
    src = Image.open(path).convert("RGB")
    im = np.asarray(src).astype(np.float32) / 255
    ground = (im.min(axis=2) > 1 - thr) if white else (im.max(axis=2) < thr)
    h, w = ground.shape
    seen = np.zeros_like(ground)
    q = deque()
    for y, x in [(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)]:
        if ground[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and ground[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    keep = Image.fromarray(((~seen) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3) if white else ImageFilter.GaussianBlur(0))
    img = src.convert("RGBA")
    img.putalpha(keep.filter(ImageFilter.GaussianBlur(feather)))
    ys, xs = np.where(~seen)
    img = img.crop((max(xs.min() - 6, 0), max(ys.min() - 6, 0), min(xs.max() + 6, w), min(ys.max() + 6, h)))
    return img.resize((size, round(img.height * size / img.width)), Image.LANCZOS)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    models, images, only = sys.argv[1], sys.argv[2], sys.argv[3:]
    want = lambda n: not only or n in only
    glb = lambda n: os.path.join(models, n, "model.glb")
    png = lambda n: os.path.join(images, n, "image_0.png")
    if want("tub"):
        halves(glb("tub"), "tub", 600, 12)
    if want("bed"):
        halves(glb("bed"), "bed", 640, 18)
    if want("seesaw"):
        seesaw(glb("seesaw"), 720)
    if want("swingseat"):
        save(off_ground(png("swingseat"), 560, white=False), "swing-seat")
    if want("sponge"):
        save(off_ground(png("sponge"), 240, white=True, thr=0.035), "sponge")
