from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from programs import DraftProgram, VerifyProgram  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate compiled DSPy programs")
    parser.add_argument("--task", choices=["draft", "verify"], required=True)
    parser.add_argument("--dataset", required=True, help="Path to JSONL evaluation examples")
    parser.add_argument("--artifact", required=True, help="Compiled program artifact path")
    return parser.parse_args()


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if line:
                rows.append(json.loads(line))
    if not rows:
        raise ValueError("Dataset is empty")
    return rows


def evaluate_draft(program: DraftProgram, rows: list[dict[str, Any]]) -> dict[str, Any]:
    scored = 0
    non_empty = 0

    for row in rows:
        evidence = row.get("evidence")
        if evidence is None:
            continue
        scored += 1
        draft = program(evidence_json=json.dumps(evidence, separators=(",", ":")))
        if isinstance(draft, str) and draft.strip():
            non_empty += 1

    return {
        "examples": scored,
        "non_empty_rate": (non_empty / scored) if scored else 0.0,
    }


def evaluate_verify(program: VerifyProgram, rows: list[dict[str, Any]]) -> dict[str, Any]:
    scored = 0
    pass_match = 0

    for row in rows:
        evidence = row.get("evidence")
        draft_text = row.get("draftText")
        expected_pass = row.get("pass")
        if evidence is None or not isinstance(draft_text, str) or not isinstance(expected_pass, bool):
            continue

        scored += 1
        result = program(
            evidence_json=json.dumps(evidence, separators=(",", ":")),
            draft_text=draft_text,
            policy_json=json.dumps(row.get("policy", {}), separators=(",", ":")),
        )
        if bool(result.get("pass")) == expected_pass:
            pass_match += 1

    return {
        "examples": scored,
        "pass_match_rate": (pass_match / scored) if scored else 0.0,
    }


def main() -> None:
    args = parse_args()
    rows = load_jsonl(Path(args.dataset))

    if args.task == "draft":
        program = DraftProgram()
    else:
        program = VerifyProgram()

    program.load(args.artifact)

    if args.task == "draft":
        metrics = evaluate_draft(program, rows)
    else:
        metrics = evaluate_verify(program, rows)

    print(json.dumps(metrics, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
