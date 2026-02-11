from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compile DSPy draft/verify artifacts and emit a single evaluation report."
    )
    parser.add_argument("--draft-train", required=True, help="Draft training dataset (jsonl)")
    parser.add_argument("--draft-eval", required=True, help="Draft eval dataset (jsonl)")
    parser.add_argument("--verify-train", required=True, help="Verify training dataset (jsonl)")
    parser.add_argument("--verify-eval", required=True, help="Verify eval dataset (jsonl)")
    parser.add_argument("--artifacts-dir", default="artifacts", help="Artifact output directory")
    parser.add_argument("--report", default="artifacts/compile_report.json", help="Output report path")
    parser.add_argument("--max-demos", type=int, default=8)
    parser.add_argument("--similarity-threshold", type=float, default=0.75)
    parser.add_argument("--tag", default="manual", help="Run tag for report metadata")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    artifacts_dir = resolve_path(args.artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    draft_artifact = artifacts_dir / "draft_program.json"
    verify_artifact = artifacts_dir / "verify_program.json"

    run_compile(
        task="draft",
        dataset=resolve_path(args.draft_train),
        output=draft_artifact,
        max_demos=args.max_demos,
        similarity_threshold=args.similarity_threshold,
    )
    run_compile(
        task="verify",
        dataset=resolve_path(args.verify_train),
        output=verify_artifact,
        max_demos=args.max_demos,
        similarity_threshold=args.similarity_threshold,
    )

    draft_eval_metrics = run_evaluate(
        task="draft",
        dataset=resolve_path(args.draft_eval),
        artifact=draft_artifact,
    )
    verify_eval_metrics = run_evaluate(
        task="verify",
        dataset=resolve_path(args.verify_eval),
        artifact=verify_artifact,
    )

    report = {
        "tag": args.tag,
        "ranAtUtc": datetime.now(UTC).isoformat(),
        "artifacts": {
            "draft": str(draft_artifact),
            "verify": str(verify_artifact),
        },
        "eval": {
            "draft": draft_eval_metrics,
            "verify": verify_eval_metrics,
        },
    }

    report_path = resolve_path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))


def resolve_path(raw: str) -> Path:
    path = Path(raw)
    if path.is_absolute():
        return path
    return ROOT / path


def run_compile(
    *,
    task: str,
    dataset: Path,
    output: Path,
    max_demos: int,
    similarity_threshold: float,
) -> None:
    command = [
        sys.executable,
        str(SCRIPTS_DIR / "compile_bootstrap_fewshot.py"),
        "--task",
        task,
        "--dataset",
        str(dataset),
        "--output",
        str(output),
        "--max-demos",
        str(max_demos),
        "--similarity-threshold",
        str(similarity_threshold),
    ]
    subprocess.run(command, check=True)


def run_evaluate(*, task: str, dataset: Path, artifact: Path) -> dict[str, Any]:
    command = [
        sys.executable,
        str(SCRIPTS_DIR / "evaluate_program.py"),
        "--task",
        task,
        "--dataset",
        str(dataset),
        "--artifact",
        str(artifact),
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


if __name__ == "__main__":
    main()
