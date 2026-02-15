from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class EvidenceHighlight(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    label: str = Field(min_length=1)


class EvidenceTone(BaseModel):
    preset: str = Field(min_length=1)
    customInstructions: Optional[str] = None


class EvidenceSeoProfile(BaseModel):
    primaryKeywords: list[str] = Field(default_factory=list)
    secondaryKeywords: list[str] = Field(default_factory=list)
    geoTerms: list[str] = Field(default_factory=list)


class EvidenceSnapshot(BaseModel):
    starRating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    reviewerDisplayName: Optional[str] = None
    reviewerIsAnonymous: bool
    locationDisplayName: str = Field(min_length=1)
    createTime: str = Field(min_length=1)
    highlights: list[EvidenceHighlight] = Field(default_factory=list)
    mentionKeywords: list[str] = Field(default_factory=list)
    seoProfile: EvidenceSeoProfile
    tone: EvidenceTone


class ProcessReviewMode(str, Enum):
    AUTO = "AUTO"
    MANUAL_REGENERATE = "MANUAL_REGENERATE"
    VERIFY_EXISTING_DRAFT = "VERIFY_EXISTING_DRAFT"


class ProcessExecutionOverrides(BaseModel):
    experimentId: Optional[str] = None
    programVersion: Optional[str] = None
    draftModel: Optional[str] = None
    verifyModel: Optional[str] = None

    @field_validator("experimentId", "programVersion", "draftModel", "verifyModel")
    @classmethod
    def normalize_optional_identifier(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed if trimmed else None


class ProcessReviewRequest(BaseModel):
    orgId: str = Field(min_length=1)
    reviewId: str = Field(min_length=1)
    mode: ProcessReviewMode
    evidence: EvidenceSnapshot
    currentDraftText: Optional[str] = None
    candidateDraftText: Optional[str] = None
    requestId: Optional[str] = None
    execution: Optional[ProcessExecutionOverrides] = None

    @field_validator("currentDraftText", "candidateDraftText")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed if trimmed else None


class ErrorResponse(BaseModel):
    error: str = Field(min_length=1)
    message: str = Field(min_length=1)


class VerifierViolation(BaseModel):
    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    snippet: Optional[str] = None


class VerifierPayload(BaseModel):
    pass_: bool = Field(alias="pass")
    violations: list[VerifierViolation] = Field(default_factory=list)
    suggestedRewrite: Optional[str] = None

    model_config = {"populate_by_name": True}

    @field_validator("suggestedRewrite")
    @classmethod
    def normalize_rewrite(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed if trimmed else None


class GenerationPayload(BaseModel):
    attempted: bool
    changed: bool
    attemptCount: int = Field(ge=1)


class ModelsPayload(BaseModel):
    draft: str = Field(min_length=1)
    verify: str = Field(min_length=1)


class TracePayload(BaseModel):
    draftTraceId: Optional[str] = None
    verifyTraceId: str = Field(min_length=1)


class ProgramPayload(BaseModel):
    version: str = Field(min_length=1)
    draftArtifactVersion: str = Field(min_length=1)
    verifyArtifactVersion: str = Field(min_length=1)


class SeoQualityPayload(BaseModel):
    keywordCoverage: float = Field(ge=0.0, le=1.0)
    requiredKeywordUsed: bool
    requiredKeywordCoverage: float = Field(ge=0.0, le=1.0)
    optionalKeywordCoverage: float = Field(ge=0.0, le=1.0)
    geoTermUsed: bool
    geoTermOveruse: bool
    stuffingRisk: bool
    keywordMentions: int = Field(ge=0)
    missingRequiredKeywords: list[str] = Field(default_factory=list)


class ProcessReviewResponse(BaseModel):
    decision: Literal["READY", "BLOCKED_BY_VERIFIER"]
    draftText: str = Field(min_length=1)
    verifier: VerifierPayload
    seoQuality: SeoQualityPayload
    generation: GenerationPayload
    program: ProgramPayload
    models: ModelsPayload
    trace: TracePayload
    latencyMs: int = Field(ge=0)
