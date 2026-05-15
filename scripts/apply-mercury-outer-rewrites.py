#!/usr/bin/env python3
"""Apply URANUS/NEPTUNE/PLUTO Mercury insight rewrites (9 fields per aspect)."""
from pathlib import Path
import re

PATH = Path(__file__).resolve().parents[1] / "vnext/projection/insight-library/insight-library-aspects-mercury.ts"

FIELDS = [
    "core", "behavioral", "friendship", "romantic", "feed",
    "core_synastry", "behavioral_synastry", "friendship_synastry", "romantic_synastry",
]

def entry(**kwargs):
    return {k: kwargs[k] for k in FIELDS}

UPDATES = {
    # URANUS_MERCURY — user batch
    "URANUS_MERCURY_CONJUNCTION": entry(
        core="Your Uranus meets your Mercury at the same degree. How you think and your capacity for sudden insight, pattern disruption, and innovative perception aren't separate systems. They run on the same current. Your cognitive function and your breakthrough instinct are fused. What you think, you think differently. How you articulate, you do with originality and sudden clarity. Your mind doesn't think conventionally or stay within established patterns. It sees what others miss, connects what seems unrelated, and arrives at conclusions through lateral leaps rather than linear logic. This produces intellectual originality that others read as brilliant, unpredictable, and characteristically ahead of the curve.",
        behavioral="Because your thinking and your innovative instinct are fused, your mental life runs through channels of disruption and sudden insight. You understand systems by seeing where they'll break. You solve problems by thinking around them rather than through them. The conjunction means your communication style is naturally unconventional, sometimes shocking. You say things others haven't thought yet. The shadow is that speed and originality can override coherence. You may think so far ahead that you lose the people you're trying to communicate with, or you may prioritize being different over being accurate. The work is recognizing that thinking originally and thinking clearly are not always the same thing.",
        friendship="Friends experience you as someone who thinks in unexpected ways. Conversation with you goes places others wouldn't predict. You see connections that feel revelatory when you name them.",
        romantic="Partners feel stimulated by how unpredictable your thinking is. You bring intellectual electricity to conversations about the relationship. You think about intimacy in ways that disrupt comfortable patterns.",
        feed="Your Uranus and Mercury meet at the same degree in your natal chart. How you think and your capacity for innovation run on the same frequency. Intellectual originality is part of your identity.",
        core_synastry="Your Uranus meets their Mercury at the same degree. Your capacity for sudden insight and pattern disruption arrives at the precise frequency of how they think and perceive. You experience their mind as something that can be awakened, disrupted, and innovated. They experience your disruptive instinct as something that completely changes how they're allowed to think. This is one of the most electrically charged mental aspects in synastry. It often feels like intellectual awakening and mental destabilization arriving simultaneously.",
        behavioral_synastry="You disrupt their thinking. You see what they haven't seen. You connect ideas in ways that feel revelatory or destabilizing to them. They experience your attention to their thinking as both liberating and disorienting. Your Uranus gives their Mercury permission to think differently but that disruption can also feel like their existing mental patterns are being invalidated. The work is making sure your innovative instinct serves their mental development rather than just shocking their thinking for the sake of being different.",
        friendship_synastry="You wake up how they think. You see possibilities in their mental processes they haven't considered. These friendships often involve you disrupting their thinking and them feeling both intellectually awakened and sometimes cognitively overwhelmed by how different your mind is. The work is making sure innovation doesn't become destabilization.",
        romantic_synastry="You experience their thinking as something that can be awakened and innovated. They experience your disruptive attention as something that makes them think in completely new ways but can also make their previous thinking feel inadequate. The relationship benefits from having intellectual innovation available but the innovation can also create instability. The sustaining work is making sure your Uranus supports their Mercury's evolution rather than just disrupting it for disruption's sake.",
    ),
    # ... script continues in apply script - use read from user message
}

def replace_field(block: str, field: str, value: str) -> str:
    pattern = rf"(\n    {field}: `)(.*?)(`,)"
    repl = rf"\1{value}\3"
    new_block, n = re.subn(pattern, repl, block, count=1, flags=re.DOTALL)
    if n != 1:
        raise RuntimeError(f"Failed to replace {field} (count={n})")
    return new_block

def main():
    text = PATH.read_text(encoding="utf-8")
    for key, fields in UPDATES.items():
        m = re.search(rf"  {key}: \{{\n", text)
        if not m:
            raise RuntimeError(f"Block not found: {key}")
        start = m.start()
        depth = 0
        i = m.end() - 1
        while i < len(text):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
            i += 1
        else:
            raise RuntimeError(f"Unclosed block: {key}")
        block = text[start:end]
        for field in FIELDS:
            block = replace_field(block, field, fields[field])
        text = text[:start] + block + text[end:]
    PATH.write_text(text, encoding="utf-8", newline="\n")
    print(f"Updated {len(UPDATES)} aspects")

if __name__ == "__main__":
    main()
