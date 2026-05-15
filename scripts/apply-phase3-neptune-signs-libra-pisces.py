"""Apply Neptune in-sign rewrites for Libra through Pisces (core, behavioral, feed, sonic)."""
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from phase3_neptune_signs_libra_pisces_data import UPDATES  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SIGN_PATH = ROOT / "vnext/projection/insight-library/insight-library-placements-sign.ts"


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
    n = apply_updates(SIGN_PATH, UPDATES)
    print(f"Updated {n} Neptune sign entries in {SIGN_PATH.name}")


if __name__ == "__main__":
    main()
