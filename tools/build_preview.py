"""Bundle the app into one HTML file that runs on its own, in demo mode: for a quick look in a browser
or a preview page, with no server and no Sheet.

    python3 tools/build_preview.py OUT.html [--names "Name1,Name2,Name3"]

The names are the three profiles' display names for the preview only. They are not kept in the repo:
the real names live in the family's Google Sheet.
The output has no <html>/<head> of its own (a host page wraps it); a browser shows it fine as it is.
"""
import argparse
import glob
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--names", default="")
    a = ap.parse_args()

    html = read("index.html")
    body = html.split("<!--BODY-->")[1].split("<!--/BODY-->")[0]
    banks = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "bank", "*.json"))):
        with open(path, encoding="utf-8") as f:
            banks[os.path.splitext(os.path.basename(path))[0]] = json.load(f)
    demo = {}
    if a.names:
        n = [x.strip() for x in a.names.split(",")]
        demo["profiles"] = [
            {"id": "a", "name": n[0], "track": "g10-bio", "pair": "", "slot": 0, "flavor": "portfolio", "aura": "orchid"},
            {"id": "b", "name": n[1], "track": "g7", "pair": "twins", "slot": 0, "flavor": "routine", "aura": "cherry"},
            {"id": "c", "name": n[2], "track": "g7-art", "pair": "twins", "slot": 1, "flavor": "stage", "aura": "lagoon"},
        ]
    data = json.dumps(banks, ensure_ascii=False).replace("</", "<\\/")
    demo_js = json.dumps(demo, ensure_ascii=False).replace("</", "<\\/")
    out = (
        "<title>Nitzotz Daily Quest</title>\n"
        '<meta name="claude:viewport-fit-sides" content="cover">\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bellefair&family=Heebo:wght@300;400;500;600;700&display=swap">\n'
        f"<style>\n{read('app.css')}\n</style>\n"
        f'<div dir="rtl" lang="he">\n{body}\n</div>\n'
        "<script>\n"
        'window.FQ_CONFIG = { apiUrl: "" };\nwindow.FQ_PREVIEW = true;\n'
        f"window.FQ_DEMO = {demo_js};\nwindow.FQ_BANKS = {data};\n"
        "</script>\n"
        f"<script>\n{read('app.js')}\n</script>\n"
    )
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"wrote {a.out}: {len(out) // 1024} KB, {sum(len(v) for v in banks.values())} questions in {len(banks)} banks")


if __name__ == "__main__":
    main()
