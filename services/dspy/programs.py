from __future__ import annotations

import json
import os
import re
import time
import uuid
import hashlib
from pathlib import Path
from typing import Any

import dspy

from models import VerifierViolation
from settings import Settings


BASE_POLICY_RULES = [
    "The reply must not claim actions were taken unless the review comment explicitly states it.",
    "The reply must not invent menu items, timing, staff names, refunds, fixes, or other specifics not present in evidence.comment.",
    "If evidence.comment is empty/null, the reply must stay generic and avoid assumptions.",
    "Do not include private data, phone numbers, or fabricated compensation offers.",
]


class ServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class DraftSignature(dspy.Signature):
    """Write a safe GBP reply using evidence only and follow seo_brief naturally; when previous_draft_text is present, produce meaningfully different wording."""

    evidence_json: str = dspy.InputField()
    seo_brief: str = dspy.InputField(
        desc="SEO constraints and target keywords. Apply naturally without stuffing."
    )
    previous_draft_text: str = dspy.InputField(desc="Current draft text. Empty when there is no existing draft.")
    regeneration_attempt: int = dspy.InputField(desc="1-based regeneration attempt number.")
    reply: str = dspy.OutputField(desc="Reply text only. No markdown, no JSON wrappers.")


class VerifySignature(dspy.Signature):
    """Evaluate whether the draft reply complies with policy, evidence, and SEO constraints without hallucinations."""

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

    def forward(
        self,
        evidence_json: str,
        seo_brief: str,
        previous_draft_text: str = "",
        regeneration_attempt: int = 1,
    ) -> str:
        prediction = self.generate(
            evidence_json=evidence_json,
            seo_brief=seo_brief,
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

    def forward(
        self,
        evidence_json: str,
        draft_text: str,
        policy_json: str | None = None,
    ) -> dict[str, Any]:
        prediction = self.verify(
            evidence_json=evidence_json,
            draft_text=draft_text,
            policy_json=policy_json or json.dumps({"rules": BASE_POLICY_RULES}, separators=(",", ":")),
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
        self.program_version = settings.program_version
        self.draft_artifact_version = _artifact_version(settings.draft_artifact_path)
        self.verify_artifact_version = _artifact_version(settings.verify_artifact_path)

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

    def program_metadata(self) -> dict[str, str]:
        return {
            "version": self.program_version,
            "draftArtifactVersion": self.draft_artifact_version,
            "verifyArtifactVersion": self.verify_artifact_version,
        }

    def process_review(
        self,
        mode: str,
        evidence_json: str,
        current_draft_text: str | None = None,
        candidate_draft_text: str | None = None,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        draft_trace_id: str | None = None
        verify_trace_id = str(uuid.uuid4())
        normalized_mode = mode.upper().strip()
        try:
            evidence = _parse_evidence_json(evidence_json)
            policy = _build_policy(evidence)
            seo_brief = _build_seo_brief(policy)
            policy_json = json.dumps(policy, separators=(",", ":"))

            if normalized_mode not in {"AUTO", "MANUAL_REGENERATE", "VERIFY_EXISTING_DRAFT"}:
                raise ServiceError("INVALID_REQUEST", f"Unsupported process mode: {mode}", 400)

            generation = {"attempted": False, "changed": False, "attemptCount": 1}
            if normalized_mode == "VERIFY_EXISTING_DRAFT":
                if not (candidate_draft_text or "").strip():
                    raise ServiceError("INVALID_REQUEST", "candidateDraftText is required for verify mode.", 400)
                draft_text = str(candidate_draft_text).strip()
            else:
                generation["attempted"] = True
                current_text = (current_draft_text or "").strip()
                max_attempts = 3 if current_text else 1
                draft_text = ""
                for attempt in range(1, max_attempts + 1):
                    draft_trace_id = str(uuid.uuid4())
                    with dspy.context(lm=self.draft_lm, adapter=self.adapter):
                        candidate = self.draft_program(
                            evidence_json=evidence_json,
                            seo_brief=seo_brief,
                            previous_draft_text=current_text,
                            regeneration_attempt=attempt,
                        )
                    if not current_text or not _drafts_equivalent(current_text, candidate):
                        generation["changed"] = True
                        generation["attemptCount"] = attempt
                        draft_text = candidate.strip()
                        break
                    draft_text = candidate.strip()

                if not draft_text:
                    raise ServiceError("MODEL_SCHEMA_ERROR", "DSPy draft output was empty.", 502)

            with dspy.context(lm=self.verify_lm, adapter=self.adapter):
                result = self.verify_program(
                    evidence_json=evidence_json,
                    draft_text=draft_text,
                    policy_json=policy_json,
                )
            seo_quality = _evaluate_seo_quality(draft_text=draft_text, policy=policy)
            verifier = _merge_seo_quality_with_verifier(result, seo_quality)
            decision = "READY" if verifier["pass"] else "BLOCKED_BY_VERIFIER"
            latency_ms = int((time.perf_counter() - started) * 1000)
            return {
                "decision": decision,
                "draftText": draft_text,
                "verifier": verifier,
                "seoQuality": seo_quality,
                "generation": generation,
                "program": self.program_metadata(),
                "models": {
                    "draft": self.settings.draft_model,
                    "verify": self.settings.verify_model,
                },
                "trace": {
                    "draftTraceId": draft_trace_id,
                    "verifyTraceId": verify_trace_id,
                },
                "latencyMs": latency_ms,
            }
        except Exception as exc:  # noqa: BLE001
            if isinstance(exc, ServiceError):
                raise
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
    path = _resolve_artifact_path(artifact_path)
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


def _resolve_artifact_path(artifact_path: str) -> Path:
    path = Path(artifact_path)
    if path.is_absolute():
        return path
    return Path(__file__).resolve().parent / path


def _artifact_version(artifact_path: str) -> str:
    path = _resolve_artifact_path(artifact_path)
    if not path.exists():
        return "missing"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    return f"{path.name}:{digest}"


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


def _drafts_equivalent(previous_draft_text: str, next_draft_text: str) -> bool:
    return _normalize_draft_for_comparison(previous_draft_text) == _normalize_draft_for_comparison(next_draft_text)


def _normalize_draft_for_comparison(text: str) -> str:
    return (
        text.lower()
        .replace("\n", " ")
        .replace("\t", " ")
        .replace("\r", " ")
        .strip()
    )


def _parse_evidence_json(evidence_json: str) -> dict[str, Any]:
    try:
        parsed = json.loads(evidence_json)
    except json.JSONDecodeError as exc:
        raise ServiceError("INVALID_REQUEST", "Invalid evidence JSON payload.", 400) from exc
    if not isinstance(parsed, dict):
        raise ServiceError("INVALID_REQUEST", "Evidence payload must be an object.", 400)
    return parsed


def _build_policy(evidence: dict[str, Any]) -> dict[str, Any]:
    primary = _normalized_terms(evidence, ("seoProfile", "primaryKeywords"))
    secondary = _normalized_terms(evidence, ("seoProfile", "secondaryKeywords"))
    geo_terms = _normalized_terms(evidence, ("seoProfile", "geoTerms"))

    required_keywords = (primary[:2] or secondary[:2])[:2]
    optional_keywords = [term for term in primary[2:] + secondary if term not in required_keywords][:3]
    optional_geo_terms = geo_terms[:1]

    policy = {
        "rules": [*BASE_POLICY_RULES],
        "seoTargets": {
            "requiredKeywords": required_keywords,
            "optionalKeywords": optional_keywords,
            "geoTerms": optional_geo_terms,
        },
    }

    if required_keywords or optional_keywords or optional_geo_terms:
        policy["rules"].append(
            "Use SEO targets naturally: include at least one required keyword when available, optional keywords only if relevant, and at most one geo term."
        )
        policy["rules"].append(
            "Never repeat keywords unnaturally or force phrases that do not match the review context."
        )

    return policy


def _build_seo_brief(policy: dict[str, Any]) -> str:
    targets = policy.get("seoTargets", {})
    required = targets.get("requiredKeywords", [])
    optional = targets.get("optionalKeywords", [])
    geo_terms = targets.get("geoTerms", [])

    if not required and not optional and not geo_terms:
        return "No specific SEO keywords are configured. Keep response natural and concise."

    parts = [
        "Optimize the reply for local SEO while sounding natural.",
        f"Required keywords (use at least one): {', '.join(required) if required else 'none'}",
        f"Optional keywords (use only if relevant): {', '.join(optional) if optional else 'none'}",
        f"Geo terms (use at most one if natural): {', '.join(geo_terms) if geo_terms else 'none'}",
        "Do not keyword-stuff, repeat terms, or add facts not grounded in evidence.",
    ]
    return " ".join(parts)


def _normalized_terms(evidence: dict[str, Any], path: tuple[str, str]) -> list[str]:
    node: Any = evidence
    for key in path:
        if not isinstance(node, dict):
            return []
        node = node.get(key)
    if not isinstance(node, list):
        return []

    cleaned: list[str] = []
    seen: set[str] = set()
    for value in node:
        if not isinstance(value, str):
            continue
        normalized = value.strip().lower()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)
    return cleaned


def _evaluate_seo_quality(draft_text: str, policy: dict[str, Any]) -> dict[str, Any]:
    targets = policy.get("seoTargets", {})
    required = _normalize_target_terms(targets.get("requiredKeywords"))
    optional = _normalize_target_terms(targets.get("optionalKeywords"))
    geo_terms = _normalize_target_terms(targets.get("geoTerms"))

    term_counts: dict[str, int] = {}
    total_keyword_mentions = 0
    for term in [*required, *optional, *geo_terms]:
        count = _count_phrase_occurrences(draft_text, term)
        term_counts[term] = count
        total_keyword_mentions += count

    required_hits = sum(1 for term in required if term_counts.get(term, 0) > 0)
    optional_hits = sum(1 for term in optional if term_counts.get(term, 0) > 0)
    geo_hits = sum(1 for term in geo_terms if term_counts.get(term, 0) > 0)

    required_coverage = _ratio(required_hits, len(required))
    optional_coverage = _ratio(optional_hits, len(optional))
    geo_coverage = _ratio(geo_hits, len(geo_terms))

    weighted_components: list[tuple[float, float]] = []
    if required:
        weighted_components.append((required_coverage, 0.7))
    if optional:
        weighted_components.append((optional_coverage, 0.2))
    if geo_terms:
        weighted_components.append((geo_coverage, 0.1))

    if weighted_components:
        numerator = sum(value * weight for value, weight in weighted_components)
        denominator = sum(weight for _, weight in weighted_components)
        keyword_coverage = numerator / denominator
    else:
        keyword_coverage = 1.0

    word_count = max(1, len(re.findall(r"\b\w+\b", draft_text.lower())))
    keyword_density = total_keyword_mentions / word_count
    max_phrase_repeat = max(term_counts.values(), default=0)

    missing_required_keywords = [term for term in required if term_counts.get(term, 0) == 0]
    geo_term_overuse = geo_hits > 1
    stuffing_risk = bool(
        geo_term_overuse
        or max_phrase_repeat >= 3
        or (total_keyword_mentions >= 3 and keyword_density > 0.12)
    )

    return {
        "keywordCoverage": _round_ratio(keyword_coverage),
        "requiredKeywordUsed": len(missing_required_keywords) == 0 if required else True,
        "requiredKeywordCoverage": _round_ratio(required_coverage),
        "optionalKeywordCoverage": _round_ratio(optional_coverage),
        "geoTermUsed": geo_hits > 0,
        "geoTermOveruse": geo_term_overuse,
        "stuffingRisk": stuffing_risk,
        "keywordMentions": int(total_keyword_mentions),
        "missingRequiredKeywords": missing_required_keywords,
    }


def _merge_seo_quality_with_verifier(verifier: dict[str, Any], seo_quality: dict[str, Any]) -> dict[str, Any]:
    violations = list(verifier.get("violations", []))
    passed = bool(verifier.get("pass", False))

    missing_required = seo_quality.get("missingRequiredKeywords", [])
    if missing_required:
        passed = False
        violations.append({
            "code": "SEO_REQUIRED_KEYWORD_MISSING",
            "message": "Draft is missing required SEO keywords configured for this location.",
            "snippet": ", ".join(missing_required[:3]),
        })

    if seo_quality.get("geoTermOveruse", False):
        passed = False
        violations.append({
            "code": "SEO_GEO_OVERUSE",
            "message": "Draft overuses geo terms and sounds unnatural.",
        })

    if seo_quality.get("stuffingRisk", False):
        passed = False
        violations.append({
            "code": "SEO_KEYWORD_STUFFING",
            "message": "Draft appears keyword-stuffed and should be rewritten naturally.",
        })

    deduped: list[dict[str, str]] = []
    seen_keys: set[tuple[str, str]] = set()
    for violation in violations:
        if not isinstance(violation, dict):
            continue
        code = str(violation.get("code", "INVALID"))
        message = str(violation.get("message", "Verifier flagged this draft."))
        key = (code, message)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        entry = {"code": code, "message": message}
        snippet = violation.get("snippet")
        if snippet is not None:
            entry["snippet"] = str(snippet)
        deduped.append(entry)

    validated = [VerifierViolation.model_validate(v).model_dump(exclude_none=True) for v in deduped]
    return {
        "pass": passed,
        "violations": validated,
        "suggestedRewrite": verifier.get("suggestedRewrite"),
    }


def _normalize_target_terms(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for term in value:
        if not isinstance(term, str):
            continue
        normalized = term.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)
    return cleaned


def _count_phrase_occurrences(text: str, phrase: str) -> int:
    phrase = phrase.strip().lower()
    if not phrase:
        return 0
    pattern = r"(?<!\w)" + re.escape(phrase) + r"(?!\w)"
    return len(re.findall(pattern, text.lower()))


def _ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 1.0
    return min(1.0, max(0.0, numerator / denominator))


def _round_ratio(value: float) -> float:
    return round(min(1.0, max(0.0, value)), 4)
