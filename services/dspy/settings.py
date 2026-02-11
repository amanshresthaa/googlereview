from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


@dataclass(frozen=True)
class Settings:
    service_token: str
    openai_api_key: str
    draft_model: str
    verify_model: str
    num_retries: int
    draft_temperature: float
    verify_temperature: float
    draft_max_tokens: int
    verify_max_tokens: int
    enable_memory_cache: bool
    memory_cache_max_entries: int
    enable_disk_cache: bool
    program_version: str
    draft_artifact_path: str
    verify_artifact_path: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    service_token = _read_required("DSPY_SERVICE_TOKEN")
    openai_api_key = _read_required("OPENAI_API_KEY")

    return Settings(
        service_token=service_token,
        openai_api_key=openai_api_key,
        draft_model=os.getenv("DSPY_OPENAI_MODEL_DRAFT", "openai/gpt-4o-mini").strip(),
        verify_model=os.getenv("DSPY_OPENAI_MODEL_VERIFY", "openai/gpt-4.1-mini").strip(),
        num_retries=_read_int("DSPY_NUM_RETRIES", default=3, minimum=0),
        draft_temperature=_read_float("DSPY_DRAFT_TEMPERATURE", default=0.3, minimum=0.0, maximum=2.0),
        verify_temperature=_read_float("DSPY_VERIFY_TEMPERATURE", default=0.0, minimum=0.0, maximum=2.0),
        draft_max_tokens=_read_int("DSPY_DRAFT_MAX_TOKENS", default=384, minimum=32),
        verify_max_tokens=_read_int("DSPY_VERIFY_MAX_TOKENS", default=768, minimum=64),
        enable_memory_cache=_read_bool("DSPY_ENABLE_MEMORY_CACHE", default=True),
        memory_cache_max_entries=_read_int("DSPY_MEMORY_CACHE_MAX_ENTRIES", default=4096, minimum=100),
        enable_disk_cache=_read_bool("DSPY_ENABLE_DISK_CACHE", default=False),
        program_version=os.getenv("DSPY_PROGRAM_VERSION", "default").strip() or "default",
        draft_artifact_path=os.getenv("DSPY_DRAFT_ARTIFACT_PATH", "artifacts/draft_program.json").strip(),
        verify_artifact_path=os.getenv("DSPY_VERIFY_ARTIFACT_PATH", "artifacts/verify_program.json").strip(),
    )


def _read_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _read_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    normalized = raw.strip().lower()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    raise RuntimeError(f"Invalid boolean value for {name}: {raw}")


def _read_int(name: str, default: int, minimum: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        parsed = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"Invalid integer value for {name}: {raw}") from exc
    if parsed < minimum:
        raise RuntimeError(f"{name} must be >= {minimum}, got {parsed}")
    return parsed


def _read_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        parsed = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"Invalid float value for {name}: {raw}") from exc
    if parsed < minimum or parsed > maximum:
        raise RuntimeError(f"{name} must be between {minimum} and {maximum}, got {parsed}")
    return parsed
