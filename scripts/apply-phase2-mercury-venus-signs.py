"""Apply Phase 2 Mercury and Venus in-sign placement rewrites to insight-library-placements-sign.ts."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "vnext/projection/insight-library/insight-library-placements-sign.ts"
DIR = Path(__file__).resolve().parent
DATA_FILES = (DIR / "phase2-mercury-signs.json", DIR / "phase2-venus-signs.json")


def escape_ts(s: str) -> str:
    return s.replace("\\", "\\\\").replace("`", "\\`")


def replace_field(block: str, field: str, value: str) -> str:
    pattern = rf"(    {field}: `)(?:[^`\\]|\\.)*(`)"
    repl = rf"\1{escape_ts(value)}\2"
    new_block, n = re.subn(pattern, repl, block, count=1, flags=re.DOTALL)
    if n != 1:
        raise ValueError(f"Failed to replace {field} in block")
    return new_block


def main() -> None:
    updates: dict[str, dict[str, str]] = {}
    for data_path in DATA_FILES:
        blob = json.loads(data_path.read_text(encoding="utf-8"))
        overlap = set(updates) & set(blob)
        if overlap:
            raise SystemExit(f"Duplicate keys between data files: {overlap}")
        updates.update(blob)
    text = PATH.read_text(encoding="utf-8")
    for key, fields in updates.items():
        m = re.search(rf"  {key}: \{{(.*?)\n  \}},", text, re.DOTALL)
        if not m:
            raise SystemExit(f"Entry not found: {key}")
        block = m.group(0)
        for field in ("core", "behavioral", "feed", "sonic"):
            block = replace_field(block, field, fields[field])
        text = text[: m.start()] + block + text[m.end() :]
    PATH.write_text(text, encoding="utf-8")
    print(f"Updated {len(updates)} entries in {PATH.name}")


if __name__ == "__main__":
    main()
