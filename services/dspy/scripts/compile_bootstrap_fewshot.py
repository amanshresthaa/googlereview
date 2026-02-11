from __future__ import annotations

import argparse
import difflib
import json
import sys
from pathlib import Path
from typing import Any

import dspy

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from programs import DraftProgram, VerifyProgram  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compile DSPy programs with BootstrapFewShot")
    parser.add_argument("--task", choices=["draft", "verify"], required=True)
    parser.add_argument("--dataset", required=True, help="Path to JSONL training examples")
    parser.add_argument("--output", required=True, help="Output artifact path")
    parser.add_argument("--max-demos", type=int, default=8)
    parser.add_argument("--similarity-threshold", type=float, default=0.75)
    return parser.parse_args()


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on line {line_number}") from exc
    if not rows:
        raise ValueError("Dataset is empty")
    return rows


def normalize_text(value: str) -> str:
    return " ".join(value.lower().split())


def draft_metric(threshold: float):
    def _metric(example: dspy.Example, prediction: Any, trace: Any = None) -> bool:  # noqa: ARG001
        expected = normalize_text(str(example.reply))
        actual = normalize_text(str(getattr(prediction, "reply", prediction)))
        if not expected or not actual:
            return False
        ratio = difflib.SequenceMatcher(a=expected, b=actual).ratio()
        return ratio >= threshold

    return _metric


def verify_metric(example: dspy.Example, prediction: Any, trace: Any = None) -> bool:  # noqa: ARG001
    expected_pass = bool(example.passed)
    actual_pass = bool(getattr(prediction, "passed", False))
    if expected_pass != actual_pass:
        return False

    expected_codes = {
        str(item.get("code"))
        for item in (example.violations or [])
        if isinstance(item, dict) and item.get("code") is not None
    }
    actual_violations = getattr(prediction, "violations", [])
    if isinstance(actual_violations, str):
        try:
            actual_violations = json.loads(actual_violations)
        except json.JSONDecodeError:
            actual_violations = []
    actual_codes = {
        str(item.get("code"))
        for item in actual_violations
        if isinstance(item, dict) and item.get("code") is not None
    }
    return expected_codes == actual_codes


def build_draft_trainset(rows: list[dict[str, Any]]) -> list[dspy.Example]:
    examples: list[dspy.Example] = []
    for row in rows:
        evidence = row.get("evidence")
        reply = row.get("reply")
        if evidence is None or not isinstance(reply, str):
            continue
        examples.append(
            dspy.Example(evidence_json=json.dumps(evidence, separators=(",", ":")), reply=reply).with_inputs(
                "evidence_json"
            )
        )
    if not examples:
        raise ValueError("No usable draft examples found in dataset")
    return examples


def build_verify_trainset(rows: list[dict[str, Any]]) -> list[dspy.Example]:
    examples: list[dspy.Example] = []
    for row in rows:
        evidence = row.get("evidence")
        draft_text = row.get("draftText")
        passed = row.get("pass")
        if evidence is None or not isinstance(draft_text, str) or not isinstance(passed, bool):
            continue
        examples.append(
            dspy.Example(
                evidence_json=json.dumps(evidence, separators=(",", ":")),
                draft_text=draft_text,
                policy_json=json.dumps(row.get("policy", {}), separators=(",", ":")),
                passed=passed,
                violations=row.get("violations") or [],
                suggested_rewrite=row.get("suggestedRewrite") or "",
            ).with_inputs("evidence_json", "draft_text", "policy_json")
        )
    if not examples:
        raise ValueError("No usable verify examples found in dataset")
    return examples


def main() -> None:
    args = parse_args()
    rows = load_jsonl(Path(args.dataset))

    if args.task == "draft":
        student = DraftProgram()
        trainset = build_draft_trainset(rows)
        metric = draft_metric(args.similarity_threshold)
    else:
        student = VerifyProgram()
        trainset = build_verify_trainset(rows)
        metric = verify_metric

    optimizer = dspy.BootstrapFewShot(
        metric=metric,
        max_bootstrapped_demos=args.max_demos,
        max_labeled_demos=args.max_demos,
    )
    compiled = optimizer.compile(student=student, trainset=trainset)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    compiled.save(str(output_path))

    print(f"Compiled {args.task} program to {output_path} using {len(trainset)} examples")


if __name__ == "__main__":
    main()
