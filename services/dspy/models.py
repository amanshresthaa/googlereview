from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class EvidenceHighlight(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    label: str = Field(min_length=1)


class EvidenceTone(BaseModel):
    preset: str = Field(min_length=1)
    customInstructions: Optional[str] = None


class EvidenceSnapshot(BaseModel):
    starRating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    reviewerDisplayName: Optional[str] = None
    reviewerIsAnonymous: bool
    locationDisplayName: str = Field(min_length=1)
    createTime: str = Field(min_length=1)
    highlights: list[EvidenceHighlight] = Field(default_factory=list)
    mentionKeywords: list[str] = Field(default_factory=list)
    tone: EvidenceTone


class GenerateDraftRequest(BaseModel):
    orgId: str = Field(min_length=1)
    reviewId: str = Field(min_length=1)
    evidence: EvidenceSnapshot
    previousDraftText: Optional[str] = None
    regenerationAttempt: Optional[int] = Field(default=None, ge=1)
    requestId: Optional[str] = None

    @field_validator("previousDraftText")
    @classmethod
    def normalize_previous_draft_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed if trimmed else None


class VerifierViolation(BaseModel):
    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    snippet: Optional[str] = None


class VerifyDraftRequest(BaseModel):
    orgId: str = Field(min_length=1)
    reviewId: str = Field(min_length=1)
    evidence: EvidenceSnapshot
    draftText: str = Field(min_length=1)
    requestId: Optional[str] = None


class GenerateDraftResponse(BaseModel):
    draftText: str = Field(min_length=1)
    model: str = Field(min_length=1)
    traceId: str = Field(min_length=1)


class VerifyDraftResponse(BaseModel):
    pass_: bool = Field(alias="pass")
    violations: list[VerifierViolation] = Field(default_factory=list)
    suggestedRewrite: Optional[str] = None
    model: str = Field(min_length=1)
    traceId: str = Field(min_length=1)

    model_config = {"populate_by_name": True}

    @field_validator("suggestedRewrite")
    @classmethod
    def normalize_rewrite(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed if trimmed else None


class ErrorResponse(BaseModel):
    error: str = Field(min_length=1)
    message: str = Field(min_length=1)
