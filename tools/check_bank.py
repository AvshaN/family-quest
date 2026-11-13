"""Check the question banks in data/bank/ before the app reads them.

Run from the repo root:  python3 tools/check_bank.py [data/bank/g7-math.json ...]
With no arguments it checks every bank. Exit code 0 means every file passed.

The format (data/README.md has it in full): each file is a JSON list of questions,
    {"id": "g7-math-001", "topic": "משוואות", "level": 2,
     "q": "פתרי: {3x − 7 = 14}", "options": ["{x = 7}", "{x = 3}", "{x = 21}", "{x = 7/3}"],
     "explain": "...", "ltr": false}
options[0] is always the right answer (the app shuffles them).
{...} marks a left-to-right run (math) inside Hebrew text.
"""
import json
import os
import re
import sys
from collections import Counter

BANK_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "bank")
POOLS = {
    "g7-math", "g7-eng", "g7-sci", "g7-heb", "g7-hist", "g7-bible", "g7-geo", "g7-art", "g7-midrash",
    "g10-math", "g10-eng", "g10-bio", "g10-hist", "g10-lit", "g10-heb", "g10-bible", "g10-civ",
}
HEBREW = re.compile(r"[֐-׿]")


def check_file(path):
    errors, warnings = [], []
    pool = os.path.splitext(os.path.basename(path))[0]
    if pool not in POOLS:
        errors.append(f"file name {pool!r} is not a known pool ({', '.join(sorted(POOLS))})")
    try:
        with open(path, encoding="utf-8") as f:
            items = json.load(f)
    except Exception as e:  # noqa: BLE001 - report any parse failure plainly
        return [f"not valid JSON: {e}"], [], None
    if not isinstance(items, list):
        return ["the file must be a JSON list"], [], None
    ids, texts = set(), set()
    for n, it in enumerate(items):
        where = f"#{n} ({it.get('id', '?') if isinstance(it, dict) else '?'})"
        if not isinstance(it, dict):
            errors.append(f"{where}: not an object")
            continue
        for key in ("id", "topic", "level", "q", "options", "explain"):
            if key not in it:
                errors.append(f"{where}: missing {key!r}")
        extra = set(it) - {"id", "topic", "level", "q", "options", "explain", "ltr"}
        if extra:
            errors.append(f"{where}: unknown fields {sorted(extra)}")
        qid = it.get("id", "")
        if not str(qid).startswith(pool + "-"):
            errors.append(f"{where}: id must start with '{pool}-'")
        if qid in ids:
            errors.append(f"{where}: duplicate id")
        ids.add(qid)
        if it.get("level") not in (1, 2, 3):
            errors.append(f"{where}: level must be 1, 2 or 3")
        opts = it.get("options", [])
        if not isinstance(opts, list) or len(opts) != 4:
            errors.append(f"{where}: exactly 4 options")
        elif len({o.strip() for o in opts}) != 4:
            errors.append(f"{where}: options repeat")
        for field in ["q", "explain"] + [f"options[{i}]" for i in range(len(opts) if isinstance(opts, list) else 0)]:
            text = it.get(field) if not field.startswith("options") else opts[int(field[8:-1])]
            if not isinstance(text, str) or not text.strip():
                errors.append(f"{where}: {field} is empty")
                continue
            if text.count("{") != text.count("}") or re.search(r"\{[^}]*\{", text):
                errors.append(f"{where}: unbalanced {{...}} in {field}")
            if len(text) > (260 if field != "explain" else 320):
                warnings.append(f"{where}: {field} is long ({len(text)} chars)")
        q = it.get("q", "")
        key = re.sub(r"\s+", " ", q).strip()
        if key in texts:
            errors.append(f"{where}: same question text as an earlier one")
        texts.add(key)
        if it.get("ltr") and HEBREW.search(q):
            warnings.append(f"{where}: ltr question contains Hebrew letters")
        if not it.get("ltr") and not HEBREW.search(q):
            warnings.append(f"{where}: question has no Hebrew; should it be ltr: true?")
    return errors, warnings, items


def main(paths):
    if not paths:
        paths = sorted(os.path.join(BANK_DIR, f) for f in os.listdir(BANK_DIR) if f.endswith(".json"))
    bad = 0
    for path in paths:
        errors, warnings, items = check_file(path)
        name = os.path.basename(path)
        if items is not None:
            levels = Counter(it.get("level") for it in items if isinstance(it, dict))
            topics = Counter(it.get("topic") for it in items if isinstance(it, dict))
            print(f"{name}: {len(items)} questions, levels {dict(sorted(levels.items()))}, {len(topics)} topics")
        for w in warnings:
            print(f"  warning {w}")
        for e in errors:
            print(f"  ERROR {e}")
        bad += bool(errors)
    print("all banks pass" if not bad else f"{bad} file(s) with errors")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
