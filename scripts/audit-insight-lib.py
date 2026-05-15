import re
from pathlib import Path

base = Path(r"c:\Users\nicka\OneDrive\Astradio_MVP\vnext\projection\insight-library")
files = {
    "signs": "insight-library-signs.ts",
    "houses": "insight-library-houses.ts",
    "placements_sign": "insight-library-placements-sign.ts",
    "placements_house": "insight-library-placements-house.ts",
}

META = {"key", "sign", "planet", "house", "element", "modality", "title", "domain"}


def wc(s):
    return len(s.split())


def parse_entries(text):
    parts = re.split(r"\n  ([A-Z][A-Z0-9_]+): \{", text)
    entries = {}
    for i in range(1, len(parts), 2):
        k = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        fields = {}
        for m in re.finditer(r"    (\w+): `((?:[^`\\]|\\.)*)`", body, re.DOTALL):
            fields[m.group(1)] = m.group(2)
        if fields:
            entries[k] = fields
    return entries


def voice_flags(text):
    t = text.lower()
    return {
        "you": bool(re.search(r"\byou\b|\byour\b", t)),
        "third_person": bool(
            re.search(
                r"\bthe person\b|\bthis person\b|\ba person with\b|\bthis chart-bearer\b|\bchart-bearer\b",
                t,
            )
        ),
    }


for name, fn in files.items():
    text = (base / fn).read_text(encoding="utf-8")
    entries = parse_entries(text)
    all_fields = sorted({f for e in entries.values() for f in e})
    content_fields = [f for f in all_fields if f not in META]
    print(f"=== {name} ===")
    print("count", len(entries))
    print("all_fields", all_fields)
    print("content_fields", content_fields)
    stats = {f: [] for f in content_fields}
    empty = {f: 0 for f in content_fields}
    you_c = {f: 0 for f in content_fields}
    tp_c = {f: 0 for f in content_fields}
    for e in entries.values():
        for f in content_fields:
            v = e.get(f, "")
            if not v.strip():
                empty[f] += 1
            stats[f].append(wc(v))
            vf = voice_flags(v)
            if vf["you"]:
                you_c[f] += 1
            if vf["third_person"]:
                tp_c[f] += 1
    for f in content_fields:
        arr = stats[f]
        print(
            f"  {f}: avg={sum(arr)/len(arr):.0f} min={min(arr)} max={max(arr)} "
            f"empty={empty[f]} you={you_c[f]}/{len(entries)} third={tp_c[f]}/{len(entries)}"
        )
    print()
