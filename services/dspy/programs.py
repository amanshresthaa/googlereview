from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

import dspy

from models import VerifierViolation
from settings import Settings


POLICY = {
    "rules": [
        "The reply must not claim actions were taken unless the review comment explicitly states it.",
        "The reply must not invent menu items, timing, staff names, refunds, fixes, or other specifics not present in evidence.comment.",
        "If evidence.comment is empty/null, the reply must stay generic and avoid assumptions.",
        "Do not include private data, phone numbers, or fabricated compensation offers.",
    ]
}


class ServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class DraftSignature(dspy.Signature):
    """Write a safe GBP reply using evidence only; when previous_draft_text is present, produce a meaningfully different wording."""

    evidence_json: str = dspy.InputField()
    previous_draft_text: str = dspy.InputField(desc="Current draft text. Empty when there is no existing draft.")
    regeneration_attempt: int = dspy.InputField(desc="1-based regeneration attempt number.")
    reply: str = dspy.OutputField(desc="Reply text only. No markdown, no JSON wrappers.")


class VerifySignature(dspy.Signature):
    """Evaluate whether the draft reply complies with policy and evidence without hallucinations."""

    evidence_json: str = dspy.InputField()
    draft_text: str = dspy.InputField()
    policy_json: str = dspy.InputField()
    passed: bool = dspy.OutputField(desc="True only when the draft is compliant.")
    violations: list[dict[str, str]] = dspy.OutputField(desc="List of policy violations with code/message/snippet.")
    suggested_rewrite: str = dspy.OutputField(
        desc="Optional safer rewrite. Return an empty string when no rewrite is needed."
    )


class DraftProgram(dspy.Module):
    def __init__(self) -> None:
        super().__init__()
        self.generate = dspy.ChainOfThought(DraftSignature)

    def forward(self, evidence_json: str, previous_draft_text: str, regeneration_attempt: int) -> str:
        prediction = self.generate(
            evidence_json=evidence_json,
            previous_draft_text=previous_draft_text,
            regeneration_attempt=regeneration_attempt,
        )
        text = str(getattr(prediction, "reply", "")).strip()
        if not text:
            raise ServiceError("MODEL_SCHEMA_ERROR", "DSPy draft output was empty.", 502)
        return text


class VerifyProgram(dspy.Module):
    def __init__(self) -> None:
        super().__init__()
        self.verify = dspy.Predict(VerifySignature)

    def forward(self, evidence_json: str, draft_text: str, policy_json: str) -> dict[str, Any]:
        prediction = self.verify(
            evidence_json=evidence_json,
            draft_text=draft_text,
            policy_json=policy_json,
        )
        violations = _normalize_violations(getattr(prediction, "violations", []))
        return {
            "pass": bool(getattr(prediction, "passed", False)),
            "violations": violations,
            "suggestedRewrite": _normalize_optional_text(getattr(prediction, "suggested_rewrite", "")),
        }


class ProgramManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

        os.environ.setdefault("OPENAI_API_KEY", settings.openai_api_key)
        # Configure cache backend explicitly for serverless behavior.
        if hasattr(dspy, "configure_cache"):
            dspy.configure_cache(
                enable_disk_cache=settings.enable_disk_cache,
                enable_memory_cache=settings.enable_memory_cache,
                memory_max_entries=settings.memory_cache_max_entries,
            )

        self.draft_lm = dspy.LM(
            settings.draft_model,
            temperature=settings.draft_temperature,
            max_tokens=settings.draft_max_tokens,
            cache=True,
            num_retries=settings.num_retries,
        )
        self.verify_lm = dspy.LM(
            settings.verify_model,
            temperature=settings.verify_temperature,
            max_tokens=settings.verify_max_tokens,
            cache=True,
            num_retries=settings.num_retries,
        )
        self.adapter = _create_json_adapter()

        dspy.configure(lm=self.verify_lm, adapter=self.adapter)

        self.draft_program = DraftProgram()
        self.verify_program = VerifyProgram()

        _maybe_load_program(self.draft_program, settings.draft_artifact_path)
        _maybe_load_program(self.verify_program, settings.verify_artifact_path)

    def generate_draft(
        self,
        evidence_json: str,
        previous_draft_text: str | None = None,
        regeneration_attempt: int | None = None,
    ) -> dict[str, str]:
        trace_id = str(uuid.uuid4())
        try:
            with dspy.context(lm=self.draft_lm, adapter=self.adapter):
                draft_text = self.draft_program(
                    evidence_json=evidence_json,
                    previous_draft_text=(previous_draft_text or ""),
                    regeneration_attempt=regeneration_attempt or 1,
                )
            return {
                "draftText": draft_text,
                "model": self.settings.draft_model,
                "traceId": trace_id,
            }
        except Exception as exc:  # noqa: BLE001
            raise _map_model_error(exc) from exc

    def verify_draft(self, evidence_json: str, draft_text: str) -> dict[str, Any]:
        trace_id = str(uuid.uuid4())
        try:
            with dspy.context(lm=self.verify_lm, adapter=self.adapter):
                result = self.verify_program(
                    evidence_json=evidence_json,
                    draft_text=draft_text,
                    policy_json=json.dumps(POLICY, separators=(",", ":")),
                )
            return {
                **result,
                "model": self.settings.verify_model,
                "traceId": trace_id,
            }
        except Exception as exc:  # noqa: BLE001
            raise _map_model_error(exc) from exc


def _map_model_error(error: Exception) -> ServiceError:
    message = str(error)
    lowered = message.lower()

    if "timed out" in lowered or "timeout" in lowered:
        return ServiceError("MODEL_TIMEOUT", message or "Model call timed out.", 504)
    if "rate" in lowered and "limit" in lowered:
        return ServiceError("MODEL_RATE_LIMIT", message or "Rate limited by model provider.", 429)
    if "schema" in lowered or "json" in lowered:
        return ServiceError("MODEL_SCHEMA_ERROR", message or "Model returned invalid schema.", 502)

    return ServiceError("INTERNAL_ERROR", message or "Unhandled model error.", 502)


def _maybe_load_program(program: dspy.Module, artifact_path: str) -> None:
    path = Path(artifact_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent / path
    if not path.exists():
        return

    try:
        program.load(str(path))
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Failed loading DSPy program artifact: {path}") from exc


def _normalize_violations(raw_value: Any) -> list[dict[str, str]]:
    if isinstance(raw_value, str):
        try:
            decoded = json.loads(raw_value)
        except json.JSONDecodeError:
            decoded = []
    else:
        decoded = raw_value

    if not isinstance(decoded, list):
        decoded = []

    cleaned: list[dict[str, str]] = []
    for item in decoded:
        if not isinstance(item, dict):
            continue
        candidate = {
            "code": str(item.get("code", "INVALID")),
            "message": str(item.get("message", "Verifier flagged this draft.")),
        }
        snippet = item.get("snippet")
        if snippet is not None:
            candidate["snippet"] = str(snippet)
        cleaned.append(candidate)

    if not cleaned:
        return []

    validated = [VerifierViolation.model_validate(item).model_dump(exclude_none=True) for item in cleaned]
    return validated


def _normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _create_json_adapter():
    try:
        return dspy.JSONAdapter(use_native_function_calling=True)
    except TypeError:
        # Backward compatibility for DSPy builds where JSONAdapter has no kwargs.
        return dspy.JSONAdapter()
