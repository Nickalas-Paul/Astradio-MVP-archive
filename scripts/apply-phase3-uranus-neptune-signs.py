"""Apply Phase 3 Uranus in-sign and Neptune in-sign rewrites to insight-library-placements-sign.ts."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SIGN_PATH = ROOT / "vnext/projection/insight-library/insight-library-placements-sign.ts"
DIR = Path(__file__).resolve().parent

DATA_FILES = (DIR / "phase3-uranus-signs.json", DIR / "phase3-neptune-signs.json")


def escape_ts(s: str) -> str:
    return s.replace("\\", "\\\\").replace("`", "\\`")


def replace_field(block: str, field: str, value: str) -> str:
    pattern = rf"(    {field}: `)(?:[^`\\]|\\.)*(`)"
    repl = rf"\1{escape_ts(value)}\2"
    new_block, n = re.subn(pattern, repl, block, count=1, flags=re.DOTALL)
    if n != 1:
        raise ValueError(f"Failed to replace {field} in block")
    return new_block


def apply_updates(path: Path, updates: dict[str, dict[str, str]]) -> int:
    text = path.read_text(encoding="utf-8")
    for key, fields in updates.items():
        m = re.search(rf"  {key}: \{{(.*?)\n  \}},", text, re.DOTALL)
        if not m:
            raise SystemExit(f"Entry not found: {key} in {path.name}")
        block = m.group(0)
        for field in ("core", "behavioral", "feed", "sonic"):
            block = replace_field(block, field, fields[field])
        text = text[: m.start()] + block + text[m.end() :]
    path.write_text(text, encoding="utf-8")
    return len(updates)


def main() -> None:
    merged: dict[str, dict[str, str]] = {}
    for data_path in DATA_FILES:
        blob = json.loads(data_path.read_text(encoding="utf-8"))
        overlap = set(merged) & set(blob)
        if overlap:
            raise SystemExit(f"Duplicate keys: {overlap}")
        merged.update(blob)
    n = apply_updates(SIGN_PATH, merged)
    print(f"Updated {n} entries in {SIGN_PATH.name}")


if __name__ == "__main__":
    main()
