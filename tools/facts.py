#!/usr/bin/env python3
"""The fact of the day: its pictures and a check of data/facts.json.

  python3 tools/facts.py check
      every fact has its fields, a picture of the right size, a credit, and a line in data/facts/CREDITS.md

  python3 tools/facts.py image <id> <source file> [--focus 0.5,0.4] [--zoom 1.2] [--box x0,y0,x1,y1] [--pad 0,0,0]
      writes data/facts/<id>.webp, 900 x 600. The picture is cut to 3:2 round --focus (fractions of its width and
      height), tighter with --zoom; --box first cuts a part of it (fractions); --pad does not cut at all but sets
      the whole picture on a ground of that colour (a planet on black, a drawing on white).

A fact is { id, cat, title, text, credit }: title and text in Hebrew, credit the short line shown on the picture
(author and licence). The full credit, with the licence and where the picture came from, is a row of CREDITS.md:
a Creative Commons licence asks for all three. Only public domain, CC0, CC BY and CC BY-SA pictures.
Needs Pillow.
"""
import argparse, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACTS = os.path.join(ROOT, "data", "facts.json")
DIR = os.path.join(ROOT, "data", "facts")
W, H = 900, 600
CATS = {"space", "animals", "body", "earth", "physics", "numbers", "invent", "history"}
LIMITS = {"title": 62, "text": 300}


def make_image(fid, src, focus=(0.5, 0.5), zoom=1.0, box=None, pad=None, quality=74):
    from PIL import Image
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        ground = Image.new("RGBA", im.size, tuple(pad or (255, 255, 255)) + (255,))
        im = Image.alpha_composite(ground, im)
    im = im.convert("RGB")
    if box:
        w, h = im.size
        im = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    w, h = im.size
    if pad is not None:
        k = min(W / w, H / h) * zoom
        im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        out = Image.new("RGB", (W, H), tuple(pad))
        out.paste(im, ((W - im.size[0]) // 2, (H - im.size[1]) // 2))
    else:
        bw = min(w, h * W / H) / zoom
        bh = bw * H / W
        x0 = min(max(focus[0] * w - bw / 2, 0), w - bw)
        y0 = min(max(focus[1] * h - bh / 2, 0), h - bh)
        out = im.crop((round(x0), round(y0), round(x0 + bw), round(y0 + bh))).resize((W, H), Image.LANCZOS)
    os.makedirs(DIR, exist_ok=True)
    path = os.path.join(DIR, fid + ".webp")
    out.save(path, "WEBP", quality=quality, method=6)
    return path


def check():
    with open(FACTS, encoding="utf-8") as f:
        data = json.load(f)
    bad = []
    if not (isinstance(data.get("start"), str) and len(data["start"]) == 10):
        bad.append("start must be a date, YYYY-MM-DD")
    credits = ""
    cp = os.path.join(DIR, "CREDITS.md")
    if os.path.exists(cp):
        with open(cp, encoding="utf-8") as f:
            credits = f.read()
    seen, total = set(), 0
    for k, x in enumerate(data.get("facts", [])):
        fid = x.get("id", f"#{k}")
        for field in ("id", "cat", "title", "text", "credit"):
            if not str(x.get(field, "")).strip():
                bad.append(f"{fid}: no {field}")
        if fid in seen:
            bad.append(f"{fid}: twice")
        seen.add(fid)
        if x.get("cat") not in CATS:
            bad.append(f"{fid}: unknown cat {x.get('cat')!r}")
        for field, n in LIMITS.items():
            if len(x.get(field, "")) > n:
                bad.append(f"{fid}: {field} is {len(x[field])} characters, over {n}")
        img = os.path.join(DIR, fid + ".webp")
        if not os.path.exists(img):
            bad.append(f"{fid}: no picture")
        else:
            size = os.path.getsize(img)
            total += size
            if size > 140_000:
                bad.append(f"{fid}: picture is {size // 1024} KB, over 140")
        if f"| {fid} |" not in credits:
            bad.append(f"{fid}: no row in CREDITS.md")
    n = len(data.get("facts", []))
    for b in bad:
        print("  " + b)
    print(f"{n} facts from {data.get('start')}, pictures {total // 1024} KB" + ("" if bad else ": all pass"))
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    im = sub.add_parser("image")
    im.add_argument("id"); im.add_argument("src")
    im.add_argument("--focus", default="0.5,0.5"); im.add_argument("--zoom", type=float, default=1.0)
    im.add_argument("--box"); im.add_argument("--pad")
    a = ap.parse_args()
    if a.cmd == "check":
        sys.exit(check())
    nums = lambda s: tuple(float(v) for v in s.split(","))
    path = make_image(a.id, a.src, nums(a.focus), a.zoom, nums(a.box) if a.box else None, tuple(int(v) for v in a.pad.split(",")) if a.pad else None)
    print("wrote", path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
